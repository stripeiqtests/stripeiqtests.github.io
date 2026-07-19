import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const adminContext = read('src/lib/AdminContext.tsx');
const adminPage = read('src/pages/Admin.tsx');
const testPage = read('src/pages/Test.tsx');
const resultsPage = read('src/pages/Results.tsx');
const checkoutFunction = read('supabase/functions/create-checkout/index.ts');
const verifyFunction = read('supabase/functions/verify-payment/index.ts');
const emailFunction = read('supabase/functions/send-results-email/index.ts');
const supabaseConfig = read('supabase/config.toml');
const hardeningMigration = read('supabase/migrations/20260719000000_high_roi_security_hardening.sql');
const schema = read('supabase/schema.sql');
const deployment = read('DEPLOYMENT.md');
const analytics = read('src/lib/analytics.ts');
const indexHtml = read('index.html');

assert.doesNotMatch(adminContext, /localStorage\.getItem\(['"]admin_auth['"]\)/);
assert.match(adminContext, /signInWithPassword/);
assert.doesNotMatch(adminPage, /admin_password/);

assert.match(testPage, /rpc\(['"]get_public_questions['"]/);
assert.match(testPage, /rpc\(['"]submit_test_session['"]/);
assert.doesNotMatch(testPage, /\.from\(['"]test_sessions['"]\)\s*\.update/s);

assert.match(resultsPage, /rpc\(['"]get_test_session['"]/);
assert.doesNotMatch(resultsPage, /dangerouslySetInnerHTML/);

assert.match(checkoutFunction, /accessToken/);
assert.match(checkoutFunction, /session\.access_token\s*!==\s*accessToken/);
assert.match(verifyFunction, /resultAccessToken/);
assert.match(emailFunction, /authorization.*Bearer \$\{serviceKey\}/s);
assert.match(supabaseConfig, /\[functions\.create-checkout\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(supabaseConfig, /\[functions\.verify-payment\][\s\S]*?verify_jwt\s*=\s*false/);
assert.match(supabaseConfig, /\[functions\.send-results-email\][\s\S]*?verify_jwt\s*=\s*false/);

assert.doesNotMatch(schema, /admin_password/i);
assert.doesNotMatch(schema, /GRANT\s+ALL\s+ON\s+(tests|questions|test_sessions)\s+TO\s+anon/i);
assert.match(schema, /submit_test_session/);
assert.match(schema, /get_test_session/);
assert.match(hardeningMigration, /grant insert, update, delete on table public\.app_settings to authenticated/);

assert.doesNotMatch(deployment, /sk_(?:test|live)_[A-Za-z0-9_-]{20,}/);
assert.doesNotMatch(deployment, /login with password:\s*`?[^\r\n]+/i);
assert.equal(existsSync(resolve(root, 'messages.html')), false);

assert.match(indexHtml, /send_page_view:\s*false/);
assert.doesNotMatch(indexHtml, /ev=PageView/);
assert.doesNotMatch(analytics, /transaction_id:\s*sessionId/);

console.log('security regression checks passed');
