// Runs on the existing Cloudflare account, independently of Supabase and GitHub.
export const HEALTH_CRON = '17 */6 * * *';
export const MAIL_CRON = '*/2 * * * *';
export const PROBE_CRON = '* * * * *'; // Temporary cutover check, absent from normal config.
const SITE = 'https://inner-code.me';
const DATABASE = 'https://afsoyuczexiztsjntkvi.supabase.co';
const PUBLIC_KEY = 'sb_publishable_ARjsX-L4PvbkuPSEttyQnQ_Wtq-Aibs';
const LIMIT = 65536;

class CheckError extends Error {}
function fail(code) { throw new CheckError(code); }

async function read(path, { json = false, database = false, body, limit = LIMIT } = {}, transport = fetch) {
  const response = await transport(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Cache-Control': 'no-cache',
      ...(database ? { apikey: PUBLIC_KEY } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    fail(`http_${response.status}`);
  }
  // Bound response work as well as network time on Workers Free.
  const reader = response.body?.getReader();
  if (!reader) fail('empty_response');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        if (json) fail('response_too_large');
        chunks.push(value.subarray(0, Math.max(0, limit - size + value.byteLength)));
        break; // Images/HTML need only a bounded prefix, not the whole file.
      }
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  if (json) {
    try { return JSON.parse(text); } catch { fail('invalid_json'); }
  }
  return { text, size: bytes.byteLength, type: response.headers.get('content-type') || '' };
}

export async function checkHealth(transport = fetch) {
  const checks = [], skipped_checks = [];
  // Bypass Cloudflare caching for a real minimal SELECT, not fake traffic.
  const tests = await read(`${DATABASE}/rest/v1/tests?select=id&is_active=eq.true&limit=1`, { json: true, database: true }, transport);
  if (!Array.isArray(tests) || tests.length !== 1 || typeof tests[0]?.id !== 'string' || !tests[0].id) fail('no_active_test');
  checks.push('active_test_database_read');
  const page = await read(`${SITE}/`, {}, transport);
  if (!page.type.includes('text/html') || !page.text.includes('id="root"')) fail('invalid_homepage');
  checks.push('homepage');
  const image = await read(`${SITE}/question_images/q11_1.gif`, { limit: 1024 }, transport);
  if (!image.size || !image.type.startsWith('image/')) fail('invalid_question_image');
  checks.push('question_illustration');
  const folders = [''];
  let sampled = 0, lastPage = [];
  while (folders.length && sampled < 3) {
    const prefix = folders.shift();
    lastPage = await read(`${DATABASE}/storage/v1/object/list/images`, {
      json: true, database: true,
      body: { prefix, limit: 10, offset: 0, sortBy: { column: 'name', order: 'asc' } },
    }, transport);
    sampled++;
    if (!Array.isArray(lastPage) || lastPage.length > 10) fail('invalid_storage_listing');
    for (const item of lastPage) {
      const name = item?.name;
      if (typeof name !== 'string' || !name || name.includes('\0') || name.split('/').some(p => p === '.' || p === '..')) fail('invalid_storage_name');
      const fullName = prefix + name;
      if (item.id) {
        const path = fullName.split('/').map(encodeURIComponent).join('/');
        const object = await read(`${DATABASE}/storage/v1/object/public/images/${path}`, { limit: 1024 }, transport);
        if (!object.size || !object.type.startsWith('image/')) fail('invalid_storage_image');
        return { checks: [...checks, 'storage_listing', 'storage_object_download'], skipped_checks };
      }
      folders.push(fullName + '/');
    }
  }
  checks.push('storage_listing');
  skipped_checks.push({ check: 'storage_object_download', reason: sampled === 1 && !lastPage.length ? 'bucket_empty' : 'no_object_in_bounded_sample' });
  return { checks, skipped_checks };
}

export async function drainMail(env, transport = fetch) {
  // Production currently has an older function. An explicit cutover is required.
  if (env.MAIL_ENABLED !== 'outbox-v1') return { status: 'disabled' };
  if (!env.RESULT_EMAIL_WORKER_SECRET || env.RESULT_EMAIL_WORKER_SECRET.length < 32) fail('mail_secret_missing');
  const response = await transport(`${DATABASE}/functions/v1/send-results-email`, {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${env.RESULT_EMAIL_WORKER_SECRET}`, 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(90000),
  });
  // Never log the body: it can contain personal data on a bad/mismatched server.
  if (response.status !== 200) { await response.body?.cancel(); fail(`mail_http_${response.status}`); }
  const length = response.headers.get('content-length');
  if (length && Number(length) > 1024) { await response.body?.cancel(); fail('mail_invalid_response'); }
  // Same bounded streaming reader, using this already-received response only.
  const result = await read('https://unused.invalid', { json: true, limit: 1024 }, async () => response);
  if (!Number.isInteger(result?.processed) || !Number.isInteger(result?.sent) || result.sent < 0 || result.processed < result.sent || result.processed > 5) fail('mail_invalid_response');
  return { status: result.sent === result.processed ? 'ok' : 'retry_pending', processed: result.processed, sent: result.sent };
}

export function inspectStatus(state, now = Date.now(), maxAge = 8 * 3600000) {
  const checked = Date.parse(state?.checked_at), success = Date.parse(state?.last_success_at);
  if (!Number.isFinite(checked) || !Number.isFinite(success) || checked > now + 300000 || success > checked || !['ok', 'error', 'retry_pending'].includes(state?.status)) return { status: 'error', reason: 'invalid_status' };
  if (state.status !== 'ok') return { status: 'error', reason: 'last_check_failed' };
  if (now - checked > maxAge || now - success > maxAge) return { status: 'error', reason: 'check_stale' };
  return { status: 'ok', checked_at: state.checked_at, last_success_at: state.last_success_at };
}

export async function runScheduled(event, env, transport = fetch, now = Date.now()) {
  if (![HEALTH_CRON, MAIL_CRON, PROBE_CRON].includes(event.cron)) fail('unknown_schedule');
  const kind = event.cron === MAIL_CRON ? 'mail' : 'health';
  if (kind === 'mail' && env.MAIL_ENABLED !== 'outbox-v1') return { status: 'disabled' };
  if (!env.STATUS) fail('status_binding_missing');
  const previous = await env.STATUS.get(kind, 'json');
  const report = { checked_at: new Date(now).toISOString(), last_success_at: previous?.last_success_at || null, status: 'error' };
  for (let attempt = 1; attempt <= (kind === 'health' ? 2 : 1); attempt++) {
    try {
      Object.assign(report, kind === 'health' ? { status: 'ok', ...await checkHealth(transport) } : await drainMail(env, transport));
      report.attempts = attempt;
      if (report.status === 'ok') report.last_success_at = report.checked_at;
      delete report.error;
      break;
    } catch (error) {
      report.attempts = attempt;
      report.error = error instanceof CheckError ? error.message : 'request_failed';
    }
  }
  await env.STATUS.put(kind, JSON.stringify(report));
  console.log(JSON.stringify({ kind, ...report }));
  if (report.status !== 'ok') fail(`${kind}_failed`);
  return report;
}

export default {
  // Preserve the existing monitor URL, without executing SQL/mail on public calls.
  async fetch(request, env) {
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
    if (new URL(request.url).pathname !== '/health/supabase') return new Response('Not found', { status: 404, headers });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
    let ok = false;
    try { ok = inspectStatus(await env.STATUS.get('health', 'json')).status === 'ok'; } catch { /* Fail closed. */ }
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ ok }), { status: ok ? 200 : 503, headers });
  },
  async scheduled(event, env) { await runScheduled(event, env); },
};
