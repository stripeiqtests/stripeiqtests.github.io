-- Deploy before the matching Edge functions. Private state is service-only.
begin;

create table public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id),
  test_id uuid not null references public.tests(id),
  title text not null,
  expected_amount integer not null check (expected_amount between 50 and 100000),
  currency text not null default 'usd' check (currency = 'usd'),
  language text not null check (language in ('ru','en')),
  return_origin text not null,
  stripe_checkout_id text unique,
  state text not null default 'pending' check (state in ('pending','expired','paid')),
  amount_paid integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '25 hours'),
  paid_at timestamptz
);
create unique index checkout_orders_one_pending on public.checkout_orders(session_id) where state = 'pending';
alter table public.checkout_orders enable row level security;
revoke all on public.checkout_orders from anon, authenticated;

create table public.result_email_outbox (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.test_sessions(id),
  title text not null,
  language text not null check (language in ('ru','en')),
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  payload jsonb,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index result_email_due on public.result_email_outbox(next_attempt_at) where state in ('pending','sending');
alter table public.result_email_outbox enable row level security;
revoke all on public.result_email_outbox from anon, authenticated;

create function public.prepare_checkout(p_session_id uuid, p_access_token uuid, p_language text, p_origin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.test_sessions; t public.tests; o public.checkout_orders;
begin
  select * into s from public.test_sessions where id = p_session_id for update;
  if not found or s.access_token is distinct from p_access_token then raise exception 'Session not found'; end if;
  if s.is_paid then raise exception 'Already paid'; end if;
  if p_language is null or p_origin is null or p_language not in ('ru','en') or p_origin not in ('https://inner-code.me','https://www.inner-code.me','https://stripeiqtests.github.io','http://localhost:5173','http://127.0.0.1:5173') then
    raise exception 'Invalid checkout context';
  end if;
  update public.checkout_orders set state = 'expired' where session_id = s.id and state = 'pending' and expires_at <= now();
  select * into o from public.checkout_orders where session_id = s.id and state = 'pending';
  if not found then
    select * into strict t from public.tests where id = s.test_id;
    insert into public.checkout_orders(session_id,test_id,title,expected_amount,language,return_origin)
    values(s.id,t.id,t.title,t.price_cents,p_language,p_origin) returning * into o;
  end if;
  return to_jsonb(o) || jsonb_build_object('email',s.email);
end $$;

create function public.attach_checkout(p_order_id uuid, p_checkout_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.checkout_orders;
begin
  select * into strict o from public.checkout_orders where id = p_order_id for update;
  if o.stripe_checkout_id is not null and o.stripe_checkout_id <> p_checkout_id then raise exception 'Checkout mismatch'; end if;
  if p_checkout_id is null or p_checkout_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' then raise exception 'Invalid checkout'; end if;
  update public.checkout_orders set stripe_checkout_id = p_checkout_id where id = o.id;
end $$;

-- Called only after retrieving and validating the canonical Stripe Checkout.
create function public.expire_checkout(p_order_id uuid, p_checkout_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.checkout_orders set state='expired'
  where id=p_order_id and state='pending' and (stripe_checkout_id is null or stripe_checkout_id=p_checkout_id);
  if not found then raise exception 'Order cannot expire'; end if;
end $$;

-- Called only after retrieving and validating the canonical Stripe Checkout.
-- One transaction unlocks the result AND creates the durable email job.
create function public.fulfill_checkout(
  p_order_id uuid, p_session_id uuid, p_test_id uuid, p_checkout_id text,
  p_expected_amount integer, p_amount_paid integer, p_language text default 'ru'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.test_sessions; o public.checkout_orders; title_snapshot text; lang text; was_paid boolean;
begin
  select * into strict s from public.test_sessions where id = p_session_id for update;
  if s.test_id <> p_test_id or p_checkout_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
     or p_checkout_id is null or p_test_id is null or p_expected_amount is null or p_amount_paid is null
     or p_expected_amount not between 50 and 100000 or p_amount_paid not between 0 and p_expected_amount then
    raise exception 'Payment mismatch';
  end if;
  if p_order_id is not null then
    select * into strict o from public.checkout_orders where id = p_order_id for update;
    if o.session_id <> s.id or o.test_id <> s.test_id or o.expected_amount <> p_expected_amount
       or (o.stripe_checkout_id is not null and o.stripe_checkout_id <> p_checkout_id) then raise exception 'Order mismatch'; end if;
    title_snapshot := o.title; lang := o.language;
  else
    -- Compatibility for Checkout sessions created by the old server, whose
    -- signed Stripe metadata already contains expectedAmount/test IDs.
    select title into strict title_snapshot from public.tests where id = s.test_id;
    lang := case when p_language = 'en' then 'en' else 'ru' end;
  end if;
  was_paid := coalesce(s.is_paid,false);
  if was_paid and s.stripe_session_id is distinct from p_checkout_id then raise exception 'Another checkout already paid'; end if;
  update public.test_sessions set is_paid = true, stripe_session_id = p_checkout_id where id = s.id;
  if p_order_id is not null then
    update public.checkout_orders set state='paid',stripe_checkout_id=p_checkout_id,amount_paid=p_amount_paid,paid_at=coalesce(paid_at,now()) where id=o.id;
  end if;
  if nullif(btrim(s.email),'') is not null then
    insert into public.result_email_outbox(session_id,title,language) values(s.id,title_snapshot,lang) on conflict(session_id) do nothing;
  end if;
  return jsonb_build_object('success',true,'testSessionId',s.id,'testId',s.test_id,'amountPaid',p_amount_paid,
    'resultAccessToken',s.access_token,'alreadyProcessed',was_paid);
end $$;

create function public.claim_result_emails(p_session_id uuid default null, p_limit integer default 5)
returns setof jsonb language plpgsql security definer set search_path = '' as $$
declare job public.result_email_outbox;
begin
  -- Resend retains idempotency keys for 24h. Stop before that window expires:
  -- an ambiguous old send requires operator review, not a possible duplicate.
  update public.result_email_outbox set state='failed',last_error='retry_window_expired',lease_id=null,lease_until=null
  where state in ('pending','sending') and (attempts >= 8 or first_attempt_at < now()-interval '23 hours')
    and (lease_until is null or lease_until <= now());
  for job in select * from public.result_email_outbox
    where (p_session_id is null or session_id = p_session_id)
      and ((state='pending' and next_attempt_at<=now()) or (state='sending' and lease_until<=now()))
    order by next_attempt_at for update skip locked limit greatest(1,least(p_limit,5))
  loop
    update public.result_email_outbox set state='sending',attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
      where id=job.id returning * into job;
    return next to_jsonb(job);
  end loop;
end $$;

create function public.set_result_email_payload(p_id uuid, p_lease_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update public.result_email_outbox set payload=coalesce(payload,p_payload)
  where id=p_id and lease_id=p_lease_id and state='sending' and lease_until>now() returning payload into result;
  if not found then raise exception 'Email lease expired'; end if;
  return result;
end $$;

create function public.finish_result_email(p_id uuid, p_lease_id uuid, p_provider_id text, p_error text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.result_email_outbox set
    state=case when p_provider_id is not null then 'sent' when attempts>=8 then 'failed' else 'pending' end,
    provider_id=p_provider_id,sent_at=case when p_provider_id is not null then now() else null end,
    last_error=left(p_error,80),next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts-1)::integer)),
    lease_id=null,lease_until=null
  where id=p_id and lease_id=p_lease_id and state='sending' and lease_until>now();
  return found;
end $$;

-- Grant only the private execution boundary; no public table access.
create function public.get_result_context(p_session_id uuid,p_access_token uuid)
returns table(test jsonb,email_status text) language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',t.id,'slug',t.slug,'title',coalesce(o.title,t.title),
    'description',t.description,'price_cents',coalesce(o.expected_amount,t.price_cents),
    'is_active',t.is_active,'archived_at',t.archived_at,'created_at',t.created_at),e.state
  from public.test_sessions s join public.tests t on t.id=s.test_id
  left join lateral (select title,expected_amount from public.checkout_orders
    where session_id=s.id order by (state='paid') desc,created_at desc limit 1) o on true
  left join public.result_email_outbox e on e.session_id=s.id
  where s.id=p_session_id and (s.access_token=p_access_token or public.is_admin());
$$;
revoke all on function public.get_result_context(uuid,uuid) from public;
grant execute on function public.get_result_context(uuid,uuid) to anon,authenticated;

-- Grant only the private execution boundary; no public table access.
revoke all on function public.prepare_checkout(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.attach_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.expire_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.fulfill_checkout(uuid,uuid,uuid,text,integer,integer,text) from public,anon,authenticated;
revoke all on function public.claim_result_emails(uuid,integer) from public,anon,authenticated;
revoke all on function public.set_result_email_payload(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.finish_result_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.prepare_checkout(uuid,uuid,text,text), public.attach_checkout(uuid,text),
  public.expire_checkout(uuid,text),
  public.fulfill_checkout(uuid,uuid,uuid,text,integer,integer,text), public.claim_result_emails(uuid,integer),
  public.set_result_email_payload(uuid,uuid,jsonb), public.finish_result_email(uuid,uuid,text,text) to service_role;
grant select on public.checkout_orders, public.result_email_outbox to service_role;
grant select on public.test_sessions, public.app_settings to service_role;
notify pgrst, 'reload schema';
commit;
