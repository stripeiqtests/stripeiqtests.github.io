// Execute the exact deploy bundle in workerd, with every outbound request mocked.
// This catches Workers-only export/Fetch API incompatibilities Node mocks miss.
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { HEALTH_CRON, MAIL_CRON } from '../ops/scheduler/worker.mjs';

let calls = 0, redirect = false;
const runtime = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: 'ops/scheduler/node_modules/.tmp/scheduler-bundle/index.js',
  compatibilityDate: '2026-10-23',
  kvNamespaces: ['STATUS'],
  bindings: { MAIL_ENABLED: 'false' },
  outboundService: async request => {
    calls++;
    const url = new URL(request.url);
    assert.ok(['afsoyuczexiztsjntkvi.supabase.co', 'inner-code.me'].includes(url.hostname));
    if (url.pathname.startsWith('/rest/v1/')) {
      assert.match(request.headers.get('apikey'), /^sb_publishable_/);
      assert.equal(request.headers.get('authorization'), null);
      if (redirect) return new Response(null, { status: 302, headers: { location: 'https://must-not-be-followed.invalid' } });
      return Response.json([{ id: 'fixture' }]);
    }
    if (url.pathname.includes('/object/list/')) return Response.json([]);
    if (url.pathname.endsWith('.gif')) return new Response('GIF89a', { headers: { 'content-type': 'image/gif' } });
    return new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } });
  },
}));
try {
  await runtime.ready; // Also rejects invalid named entry-point exports.
  const worker = await runtime.getWorker();
  const STATUS = await runtime.getKVNamespace('STATUS');
  assert.equal((await runtime.dispatchFetch('https://fixture/health/supabase')).status, 503);
  await worker.scheduled({ cron: HEALTH_CRON });
  const good = await STATUS.get('health', 'json');
  assert.equal(good.status, 'ok');
  assert.equal(good.skipped_checks[0].reason, 'bucket_empty');
  assert.equal(calls, 4);
  const healthy = await runtime.dispatchFetch('https://fixture/health/supabase');
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { ok: true });
  await worker.scheduled({ cron: MAIL_CRON });
  assert.equal(calls, 4); // Disabled mail never contacts an old production function.
  redirect = true;
  try { await worker.scheduled({ cron: HEALTH_CRON }); } catch { /* Expected failure. */ }
  const bad = await STATUS.get('health', 'json');
  assert.equal(bad.status, 'error');
  assert.equal(bad.error, 'http_302');
  assert.equal(bad.last_success_at, good.last_success_at);
  assert.equal(calls, 6); // Exactly two rejected redirects; no target followed.
  assert.equal((await runtime.dispatchFetch('https://fixture/health/supabase')).status, 503);
  console.log('Workers runtime checks passed: exact bundle, read-only health, KV freshness, disabled mail, redirect rejection.');
} finally { await runtime.dispose(); }

let mailCalls = 0;
const mailRuntime = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: 'ops/scheduler/node_modules/.tmp/scheduler-bundle/index.js',
  compatibilityDate: '2026-10-23',
  kvNamespaces: ['STATUS'],
  bindings: { MAIL_ENABLED: 'outbox-v1', RESULT_EMAIL_WORKER_SECRET: 'fixture-worker-secret-longer-than-32-bytes' },
  outboundService: async request => {
    mailCalls++;
    assert.equal(request.url, 'https://afsoyuczexiztsjntkvi.supabase.co/functions/v1/result-email-worker');
    assert.equal(request.headers.get('authorization'), 'Bearer fixture-worker-secret-longer-than-32-bytes');
    assert.equal(await request.text(), '{}');
    return Response.json({ processed: 0, sent: 0 });
  },
}));
try {
  await mailRuntime.ready;
  await (await mailRuntime.getWorker()).scheduled({ cron: MAIL_CRON });
  const status = await (await mailRuntime.getKVNamespace('STATUS')).get('mail', 'json');
  assert.equal(status.status, 'ok');
  assert.equal(status.processed, 0);
  assert.equal(mailCalls, 1);
  console.log('Enabled mail schedule passed with native Workers Fetch, fixed private endpoint and narrow secret.');
} finally { await mailRuntime.dispose(); }
