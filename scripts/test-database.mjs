import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const runId = randomUUID();
const container = `inner-code-sql-test-${runId}`;
const ownerLabel = 'inner-code.audit-test';
function docker(args, quiet = false) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 180000 });
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed: ${result.stderr || result.error || result.stdout}`);
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  return result.stdout?.trim();
}
const temp = resolve(root, 'node_modules/.tmp/database-test');
mkdirSync(temp, { recursive: true });
// Minimal platform schemas expose the same SQL boundary used by our functions.
// This executes real PostgreSQL/RLS; it does not emulate Supabase HTTP services.
const platform = `
create schema if not exists extensions;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
create schema storage;
create table storage.buckets(id text primary key, name text unique, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select,insert,update,delete on storage.objects to anon, authenticated;
`;
const fixtures = `
insert into public.tests(id,title,slug,price_cents,is_active)
values ('11111111-1111-4111-8111-111111111111','Isolated SQL fixture','sql-fixture',200,true);
insert into public.questions(test_id,question_number,question_text,options,correct_answer,dimension)
select '11111111-1111-4111-8111-111111111111',n,'Fixture question '||n,
  '[{"label":"A","value":"First"},{"label":"B","value":"Second"}]'::jsonb,'A',
  (array['analyst','strategist','observer','intuitive'])[n] from generate_series(1,4) n;
`;
const migrations = readdirSync(resolve(root, 'supabase/migrations')).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
writeFileSync(resolve(temp, 'run.sql'), '\\set ON_ERROR_STOP on\n' + platform + '\n'
  + migrations.map(file => `\\echo Applying ${file}\n\\i /migrations/${file}`).join('\n')
  + '\n' + fixtures + '\n\\i /tests/security_rls.sql\n\\i /tests/storage_readiness.sql\n\\i /tests/audit_safety.sql\n\\i /tests/payment_fulfillment.sql\n');
let created = false;
try {
  docker(['run', '-d', '--name', container, '--label', `${ownerLabel}=${runId}`, '--network', 'none', '--memory', '512m', '--cpus', '1', '-e', 'POSTGRES_PASSWORD=isolated-fixture-only', '-e', 'POSTGRES_DB=app_test', 'postgres:15-alpine'], true);
  created = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    // The image briefly starts a socket-only initialization server and then
    // restarts it. TCP readiness identifies the final server, avoiding a race
    // where psql runs while the initialization socket disappears on fresh CI.
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'app_test'], { encoding: 'utf8', timeout: 5000 });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
  docker(['cp', resolve(root, 'supabase/migrations'), `${container}:/migrations`], true);
  docker(['cp', resolve(root, 'supabase/tests'), `${container}:/tests`], true);
  docker(['cp', resolve(temp, 'run.sql'), `${container}:/run.sql`], true);
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-f', '/run.sql']);
  // Two independent database connections race as webhook and return-page
  // verification would. PostgreSQL row locks, not a JavaScript mock, arbitrate.
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-v', 'ON_ERROR_STOP=1', '-c', `
    insert into public.test_sessions(id,test_id,email,access_token,overall_score)
    values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',
      'concurrency@example.test','44444444-4444-4444-8444-444444444444',100);
    insert into public.checkout_orders(id,session_id,test_id,title,expected_amount,language,return_origin,stripe_checkout_id)
    values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111','Concurrency fixture',200,'en','https://inner-code.me','cs_test_race');`], true);
  const fulfill = `select public.fulfill_checkout('33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','cs_test_race',200,100,'en');`;
  function connection(sql) {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-v', 'ON_ERROR_STOP=1', '-c', sql], { cwd: root });
      let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
      child.on('error', reject); child.on('close', code => code === 0 ? resolve(output) : reject(new Error(output)));
    });
  }
  const outcomes = await Promise.all([
    connection(`begin; ${fulfill} select pg_sleep(0.25); commit;`), connection(fulfill),
  ]);
  if (outcomes.filter(value => value.includes('"alreadyProcessed": false')).length !== 1
    || outcomes.filter(value => value.includes('"alreadyProcessed": true')).length !== 1) throw new Error('Concurrent fulfillment was not idempotent');
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-v', 'ON_ERROR_STOP=1', '-c', `do $$ begin
    if (select count(*) from public.result_email_outbox where session_id='22222222-2222-4222-8222-222222222222') <> 1 then raise exception 'Duplicate concurrent mail'; end if;
    end $$;`], true);
  console.log('PASS: simultaneous webhook/return-page fulfillment unlocks once and queues one email.');
  console.log('PASS: clean migration chain, scoring, unpaid/paid disclosure, RLS, archive and Storage policy contracts.');
} finally {
  // Remove only the isolated container created by this exact invocation.
  if (created) {
    const label = docker(['inspect', '--format', `{{index .Config.Labels "${ownerLabel}"}}`, container], true);
    if (label !== runId) throw new Error('Refusing to remove a container with a different ownership label');
    docker(['rm', '--force', container], true);
  }
}
