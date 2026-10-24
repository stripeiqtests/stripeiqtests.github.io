import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { HEALTH_CRON, MAIL_CRON, PROBE_CRON, checkHealth, drainMail, inspectStatus, runScheduled } from './worker.mjs';

const now = Date.parse('2026-10-23T08:30:00Z');
function store(initial = {}) {
  const data = structuredClone(initial);
  return { data, async get(k) { return data[k] || null; }, async put(k, v) { data[k] = JSON.parse(v); } };
}
function fixture({ listing = [], tests = [{ id: 'test-id' }], objectType = 'image/png' } = {}) {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/rest/v1/tests?')) return Response.json(tests);
    if (url.endsWith('/object/list/images')) return Response.json(listing);
    if (url.includes('/object/public/')) return new Response('image', { headers: { 'content-type': objectType } });
    if (url.endsWith('.gif')) return new Response('GIF89a', { headers: { 'content-type': 'image/gif' } });
    return new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } });
  };
  return { calls, transport };
}

test('real bounded reads use publishable key; empty bucket is explicitly skipped', async () => {
  const f = fixture();
  const r = await checkHealth(f.transport);
  assert.equal(r.skipped_checks[0].reason, 'bucket_empty');
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls[0].options.cf.cacheTtl, 0);
  assert.match(f.calls[0].options.headers.apikey, /^sb_publishable_/);
  for (const c of f.calls) {
    assert.equal(new URL(c.url).searchParams.has('health'), false);
    assert.equal(c.options.headers.Authorization, undefined);
    assert.equal(c.options.redirect, 'manual');
    assert.ok(c.options.signal instanceof AbortSignal);
  }
  assert.deepEqual(JSON.parse(f.calls[3].options.body), { prefix: '', limit: 10, offset: 0, sortBy: { column: 'name', order: 'asc' } });
});
test('public Storage image sampled, URL-encoded, response checked', async () => {
  const f = fixture({ listing: [{ name: 'РєР°СЂС‚РёРЅРєР° #1.png', id: 'object' }] });
  assert.ok((await checkHealth(f.transport)).checks.includes('storage_object_download'));
  assert.ok(f.calls.at(-1).url.includes('%23'));
  await assert.rejects(checkHealth(fixture({ listing: [{ name: 'x', id: 'id' }], objectType: 'text/html' }).transport), /invalid_storage_image/);
});
test('folder traversal and untrusted object paths are bounded', async () => {
  const f = fixture({ listing: [{ name: 'folder' }] });
  assert.equal((await checkHealth(f.transport)).skipped_checks[0].reason, 'no_object_in_bounded_sample');
  assert.equal(f.calls.filter(c => c.url.includes('/object/list/')).length, 3);
  for (const name of ['../secret', '.', 'x/../y', '\0']) {
    await assert.rejects(checkHealth(fixture({ listing: [{ name, id: 'id' }] }).transport), /invalid_storage_name/);
  }
});
test('missing active test, oversized JSON and error body are not successes', async () => {
  await assert.rejects(checkHealth(fixture({ tests: [] }).transport), /no_active_test/);
  await assert.rejects(checkHealth(async () => new Response('x'.repeat(65537))), /response_too_large/);
  await assert.rejects(checkHealth(async () => new Response('private error details', { status: 503 })), /^Error: http_503$/);
});
test('success persisted, retry success clears transient failure', async () => {
  const STATUS = store(); let calls = 0;
  const f = fixture();
  const r = await runScheduled({ cron: HEALTH_CRON }, { STATUS }, async (...args) => {
    if (!calls++) throw new Error('private connection information');
    return f.transport(...args);
  }, now);
  assert.equal(r.attempts, 2);
  assert.equal(r.error, undefined);
  assert.equal(STATUS.data.health.last_success_at, new Date(now).toISOString());
});
test('failed checks preserve last success and sanitize secrets', async () => {
  const timestamp = new Date(now - 1000).toISOString();
  const STATUS = store({ health: { last_success_at: timestamp } });
  await assert.rejects(runScheduled({ cron: HEALTH_CRON }, { STATUS }, async () => { throw new Error('SECRET'); }, now), /health_failed/);
  assert.equal(STATUS.data.health.last_success_at, timestamp);
  assert.equal(STATUS.data.health.error, 'database_Error');
  assert.equal(STATUS.data.health.attempts, 2);
});
test('no green status if KV persistence fails; invalid cron makes no request', async () => {
  const STATUS = { async get() { return null; }, async put() { throw new Error('KV unavailable'); } };
  await assert.rejects(runScheduled({ cron: HEALTH_CRON }, { STATUS }, fixture().transport, now), /KV unavailable/);
  await assert.rejects(runScheduled({ cron: 'unknown' }, {}, () => assert.fail()), /unknown_schedule/);
  await assert.rejects(runScheduled({ cron: HEALTH_CRON }, {}, () => assert.fail()), /status_binding_missing/);
});
test('mail is disabled until explicit coordinated outbox cutover', async () => {
  for (const MAIL_ENABLED of [undefined, 'true', 'false']) {
    assert.deepEqual(await drainMail({ MAIL_ENABLED }, () => assert.fail()), { status: 'disabled' });
    assert.deepEqual(await runScheduled({ cron: MAIL_CRON }, { MAIL_ENABLED }, () => assert.fail()), { status: 'disabled' });
  }
  await assert.rejects(drainMail({ MAIL_ENABLED: 'outbox-v1' }, () => assert.fail()), /mail_secret_missing/);
});
test('private mail calls have fixed origin, payload, bounded time and no redirects', async () => {
  const key = 'private-worker-secret-32-bytes-long';
  const r = await drainMail({ MAIL_ENABLED: 'outbox-v1', RESULT_EMAIL_WORKER_SECRET: key }, async (url, options) => {
    assert.equal(url, 'https://afsoyuczexiztsjntkvi.supabase.co/functions/v1/result-email-worker');
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    assert.equal(options.body, '{}'); assert.equal(options.redirect, 'manual');
    return Response.json({ processed: 2, sent: 2 });
  });
  assert.deepEqual(r, { status: 'ok', processed: 2, sent: 2 });
});
test('preflight schedule never requests delivery and stores a separate readiness status', async () => {
  const STATUS = store();
  const env = { STATUS, MAIL_ENABLED: 'preflight-v1', RESULT_EMAIL_WORKER_SECRET: 'x'.repeat(32) };
  const response = await runScheduled({ cron: MAIL_CRON }, env, async (_url, init) => {
    assert.equal(init.body, '{"dryRun":true}');
    return Response.json({ protocol: 'outbox-v1', ready: true, hasPendingJobs: false });
  }, now);
  assert.equal(response.mode, 'preflight');
  assert.equal(STATUS.data.mail, undefined);
  assert.equal(STATUS.data.mail_preflight.mode, 'preflight');
  await assert.rejects(drainMail(env, async () => Response.json({ processed: 0, sent: 0 })), /mail_preflight_failed/);
});
test('failed/partial deliveries and mismatched server responses fail monitoring', async () => {
  const env = { MAIL_ENABLED: 'outbox-v1', RESULT_EMAIL_WORKER_SECRET: 'x'.repeat(32) };
  await assert.rejects(drainMail(env, async () => new Response('SECRET', { status: 403 })), /mail_http_403/);
  for (const result of [{}, { processed: 6, sent: 6 }, { processed: 1, sent: 2 }, { processed: 0, sent: -1 }]) {
    await assert.rejects(drainMail(env, async () => Response.json(result)), /mail_invalid_response/);
  }
  await assert.rejects(drainMail(env, async () => new Response('x'.repeat(1025))), /response_too_large/);
  const STATUS = store();
  await assert.rejects(runScheduled({ cron: MAIL_CRON }, { ...env, STATUS }, async () => Response.json({ processed: 2, sent: 1 }), now), /mail_failed/);
  assert.equal(STATUS.data.mail.status, 'retry_pending');
  assert.equal(STATUS.data.mail.last_success_at, null);
});
test('stopped schedules, failures, invalid/future state cannot stay green', () => {
  const state = { status: 'ok', checked_at: new Date(now).toISOString(), last_success_at: new Date(now).toISOString() };
  assert.equal(inspectStatus(state, now).status, 'ok');
  assert.equal(inspectStatus(state, now + 9 * 3600000).reason, 'check_stale');
  assert.equal(inspectStatus({ ...state, status: 'error' }, now).reason, 'last_check_failed');
  assert.equal(inspectStatus(state, now - 3600000).reason, 'invalid_status');
  assert.equal(inspectStatus(null, now).reason, 'invalid_status');
});
test('public HTTP cannot trigger DB/mail activity or leak private state', async () => {
  const r = await worker.fetch(new Request('https://example.com/?send=true'));
  assert.equal(r.status, 404); assert.equal(await r.text(), 'Not found');
});
test('existing public health URL reports persisted freshness, not a new DB read', async () => {
  const timestamp = new Date().toISOString();
  const STATUS = store({ health: { status: 'ok', checked_at: timestamp, last_success_at: timestamp } });
  const url = 'https://example.com/health/supabase';
  const healthy = await worker.fetch(new Request(url), { STATUS });
  assert.equal(healthy.status, 200); assert.deepEqual(await healthy.json(), { ok: true });
  assert.equal(healthy.headers.get('cache-control'), 'no-store');
  assert.equal((await worker.fetch(new Request(url, { method: 'HEAD' }), { STATUS })).body, null);
  assert.equal((await worker.fetch(new Request(url, { method: 'POST' }), { STATUS })).status, 405);
  STATUS.data.health.checked_at = STATUS.data.health.last_success_at = new Date(Date.now() - 9 * 3600000).toISOString();
  assert.equal((await worker.fetch(new Request(url), { STATUS })).status, 503);
  assert.equal((await worker.fetch(new Request(url), {})).status, 503);
});
test('temporary probe cannot read or write outside its approved ten-minute window', async () => {
  const start = new Date(now).toISOString();
  for (const [HEALTH_PROBE_STARTED_AT, at] of [[undefined, now], ['invalid', now], [start, now - 1], [start, now + 600000]]) {
    assert.deepEqual(await runScheduled({ cron: PROBE_CRON }, { HEALTH_PROBE_STARTED_AT }, () => assert.fail(), at), { status: 'disabled' });
  }
  const STATUS = store();
  assert.equal((await runScheduled({ cron: PROBE_CRON }, { HEALTH_PROBE_STARTED_AT: start, STATUS }, fixture().transport, now + 599999)).status, 'ok');
});
