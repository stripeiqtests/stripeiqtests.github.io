import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const runId = randomUUID();
const container = `inner-code-sql-test-${runId}`;
const ownerLabel = 'inner-code.audit-test';
// Production IQ Tests reports PostgreSQL 17.6. Keep 15 available for explicit
// compatibility checks, but exercise the deployed major version by default.
const postgresMajor=process.env.TEST_POSTGRES_MAJOR??'17';
if(!['15','17'].includes(postgresMajor))throw new Error('Unsupported test PostgreSQL major');
function docker(args, quiet = false) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 180000 });
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed: ${result.stderr || result.error || result.stdout}`);
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  return result.stdout?.trim();
}
const temp = resolve(root, 'node_modules/.tmp/database-test', runId);
// Decrypted recovery data must be private on Linux as well as in the Windows
// fixture directory. The unique run directory did not previously set its mode.
mkdirSync(temp, { recursive: true, mode: 0o700 });
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
  + '\n' + fixtures + '\n\\i /tests/security_rls.sql\n\\i /tests/storage_readiness.sql\n\\i /tests/audit_safety.sql\n\\i /tests/payment_fulfillment.sql\n\\i /tests/pinned_attempts.sql\n');
let created = false;
try {
  docker(['run', '-d', '--name', container, '--label', `${ownerLabel}=${runId}`, '--network', 'none', '--memory', '512m', '--cpus', '1', '-e', 'POSTGRES_PASSWORD=isolated-fixture-only', '-e', 'POSTGRES_DB=app_test', `postgres:${postgresMajor}-alpine`], true);
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
  const attemptToken='88888888-8888-4888-8888-888888888888';
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-v', 'ON_ERROR_STOP=1', '-c',
    `select public.start_test_attempt('sql-fixture','${attemptToken}');`],true);
  const submit=`select * from public.submit_test_attempt('${attemptToken}',null,
    (select jsonb_object_agg(id::text,correct_answer) from public.questions where test_id='11111111-1111-4111-8111-111111111111'));`;
  await Promise.all([connection(`begin; ${submit} select pg_sleep(0.25); commit;`),connection(submit)]);
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'app_test', '-v', 'ON_ERROR_STOP=1', '-c', `do $$ begin
    if (select count(*) from public.test_sessions where version_id is not null)<>1 then raise exception 'Concurrent submission created duplicate results';end if;
    if (select count(*) from public.test_attempts where result_session_id is not null)<>1 then raise exception 'Concurrent submission did not bind its result';end if;
    end $$;`],true);
  console.log('PASS: two simultaneous submissions of one attempt create exactly one protected result.');
  docker(['cp',resolve(root,'supabase/operations/retire_legacy_submission.sql'),`${container}:/retire-legacy.sql`],true);
  docker(['exec',container,'psql','-U','postgres','-d','app_test','-v','ON_ERROR_STOP=1','-f','/retire-legacy.sql'],true);
  docker(['exec',container,'psql','-U','postgres','-d','app_test','-v','ON_ERROR_STOP=1','-f','/tests/retired_submission.sql'],true);
  console.log('PASS: release cutover closes the legacy submission bypass and preserves anonymous pinned attempts.');
  // Exercise the real recovery path: pg_dump -> tar + age encryption ->
  // authenticated safe extraction -> pg_restore into a fresh isolated database.
  // Cluster roles already exist here, as platform roles do in a new Supabase
  // project. roles.sql is archived for review, never blindly replayed over them.
  docker(['exec',container,'psql','-U','postgres','-d','app_test','-v','ON_ERROR_STOP=1','-c',`
    insert into public.tests(id,title,slug,price_cents,is_active,archived_at)
    values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Archived backup fixture','archived-backup',200,false,now());
    insert into storage.objects(id,bucket_id,name)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','images','nested/фото #1.gif');`],true);
  docker(['exec',container,'pg_dump','-U','postgres','-d','app_test','-Fc','-f','/fixture.dump'],true);
  docker(['exec',container,'pg_dumpall','-U','postgres','--roles-only','--no-role-passwords','-f','/fixture-roles.sql'],true);
  docker(['cp',`${container}:/fixture.dump`,resolve(temp,'database.dump')],true);
  docker(['cp',`${container}:/fixture-roles.sql`,resolve(temp,'roles.sql')],true);
  const recovery=resolve(temp,'recovered');
  const backupTest=spawnSync(process.execPath,[resolve(root,'scripts/test-backup.mjs'),
    '--database-dump',resolve(temp,'database.dump'),'--roles',resolve(temp,'roles.sql'),
    '--recovery-directory',recovery],{cwd:root,stdio:'inherit',timeout:180000});
  if(backupTest.status!==0)throw new Error(`Encrypted backup recovery failed: ${backupTest.error??backupTest.status}`);
  docker(['cp',resolve(recovery,'database.dump'),`${container}:/recovered.dump`],true);
  docker(['exec',container,'createdb','-U','postgres','app_restored'],true);
  docker(['exec',container,'pg_restore','-U','postgres','-d','app_restored','--exit-on-error','--single-transaction','/recovered.dump'],true);
  const fingerprint=`select jsonb_build_object(
    'tests',(select jsonb_agg(to_jsonb(t) order by id) from public.tests t),
    'questions',(select jsonb_agg(to_jsonb(t) order by id) from public.questions t),
    'sessions',(select jsonb_agg(to_jsonb(t) order by id) from public.test_sessions t),
    'orders',(select jsonb_agg(to_jsonb(t) order by id) from public.checkout_orders t),
    'mail',(select jsonb_agg(to_jsonb(t) order by id) from public.result_email_outbox t),
    'attempts',(select jsonb_agg(to_jsonb(t) order by id) from public.test_attempts t),
    'versions',(select jsonb_agg(to_jsonb(t) order by id) from public.test_versions t),
    'settings',(select jsonb_agg(to_jsonb(t) order by key) from public.app_settings t),
    'storage_buckets',(select jsonb_agg(to_jsonb(t) order by id) from storage.buckets t),
    'storage_objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t),
    'policies',(select jsonb_agg(to_jsonb(t) order by schemaname,tablename,policyname) from pg_policies t where schemaname in ('public','storage')),
    'private_rls',(select bool_and(relrowsecurity) from pg_class where oid in ('public.checkout_orders'::regclass,'public.result_email_outbox'::regclass,'public.test_attempts'::regclass,'public.test_versions'::regclass)),
    'private_read',has_table_privilege('anon','public.result_email_outbox','select'),
    'legacy_open',has_function_privilege('anon','public.submit_test_session(uuid,text,jsonb)','execute')
  );`;
  const sourceFingerprint=docker(['exec',container,'psql','-U','postgres','-d','app_test','-At','-v','ON_ERROR_STOP=1','-c',fingerprint],true);
  const restoredFingerprint=docker(['exec',container,'psql','-U','postgres','-d','app_restored','-At','-v','ON_ERROR_STOP=1','-c',fingerprint],true);
  if(sourceFingerprint!==restoredFingerprint)throw new Error('Restored database data/policies/grants differ from source');
  docker(['exec',container,'psql','-U','postgres','-d','app_restored','-v','ON_ERROR_STOP=1','-f','/tests/retired_submission.sql'],true);
  console.log('PASS: age-encrypted backup restores real PostgreSQL data, RLS/policies/grants, pinned attempts and private payment/mail state; fixture Storage bytes match their hashes.');
  console.log('PASS: clean migration chain, scoring, unpaid/paid disclosure, RLS, archive and Storage policy contracts.');
} finally {
  // Remove only the isolated container created by this exact invocation.
  if (created) {
    const label = docker(['inspect', '--format', `{{index .Config.Labels "${ownerLabel}"}}`, container], true);
    if (label !== runId) throw new Error('Refusing to remove a container with a different ownership label');
    docker(['rm', '--force', container], true);
  }
}
