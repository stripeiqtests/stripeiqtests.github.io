import { test as base, expect, type Page } from '@playwright/test';
import type { TestSession } from '../../src/lib/supabase';

export const activeTest = { id: '11111111-1111-4111-8111-111111111111', title: 'IQ тест', description: 'Данные изолированного браузерного стенда.', slug: 'iq-test', price_cents: 200, is_active: true, archived_at: null as string | null, created_at: '2026-01-01' };
export const questions = [1, 2, 3].map(n => ({ id: `44444444-4444-4444-8444-44444444444${n}`, test_id: activeTest.id, question_number: n, question_text: `Контрольный вопрос ${n}`, dimension: 'analyst', options: JSON.stringify([{ label: 'A', value: 'Вариант A' }, { label: 'B', value: 'Вариант B' }]), correct_answer: 'A', image_url: null as string | null }));
export interface FixtureApi {
  test: typeof activeTest;
  questions: typeof questions;
  content: Record<string, string>;
  settings: Record<string, string>;
  failQuestions: boolean;
  failWrites: boolean;
  requests: { path: string; method: string; body: Record<string, unknown> | null }[];
  tracking: string[];
  result:TestSession|null;
  emailStatus:TestSession['email_status'];
  failResults:boolean;
}
const user = { id: '33333333-3333-4333-8333-333333333333', email: 'admin@example.test', app_metadata: { role: 'admin' }, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
const jwt = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated', app_metadata: user.app_metadata })).toString('base64url'), 'fixture-signature'].join('.');

export const test = base.extend<{ api: FixtureApi }>({
  api: [async ({ context }, use) => {
    const api: FixtureApi = { test: { ...activeTest }, questions: structuredClone(questions), content: {}, settings: { language_mode: 'ru', support_contact: 'stripeiqtests@proton.me', follow_up_test_slug: '' }, failQuestions: false, failWrites: false, requests: [], tracking: [],result:null,emailStatus:null,failResults:false };
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === 'http://127.0.0.1:4173') return route.continue();
      if (/googletagmanager|google-analytics|facebook/.test(url.hostname)) api.tracking.push(url.origin + url.pathname);
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      const method = request.method();
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
      if (method === 'OPTIONS') return route.fulfill({ headers, body: '' });
      let body: Record<string, unknown> | null = null;
      try { body = request.postDataJSON(); } catch { /* GET */ }
      api.requests.push({ path: url.pathname, method, body });
      const single = request.headers()['accept']?.includes('vnd.pgrst.object');
      let data: unknown = [];
      if (url.pathname === '/auth/v1/token') data = { access_token: jwt, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname === '/auth/v1/user') data = user;
      else if (url.pathname === '/rest/v1/tests') {
        if (method === 'PATCH' && !api.failWrites) Object.assign(api.test, body);
        const rows = url.searchParams.get('is_active') === 'eq.true' && !api.test.is_active ? [] : [api.test];
        data = single ? rows[0] ?? null : rows;
      } else if (url.pathname === '/rest/v1/questions') data = api.questions;
      else if (url.pathname === '/rest/v1/rpc/get_public_questions') {
        if (api.failQuestions) return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"message":"fixture service unavailable"}' });
        data = api.questions.map(({ correct_answer: _correct, ...q }) => { void _correct; return q; });
      } else if(url.pathname==='/rest/v1/rpc/get_test_session') {
        if(api.failResults)return route.fulfill({status:503,headers,contentType:'application/json',body:'{"message":"fixture result service unavailable"}'});
        data=single?api.result:api.result?[api.result]:[];
      } else if(url.pathname==='/rest/v1/rpc/get_result_context') {
        const row={test:api.test,email_status:api.emailStatus};data=single?row:[row];
      } else if (url.pathname === '/rest/v1/app_settings' || url.pathname === '/rest/v1/home_content') {
        const rows = url.pathname.endsWith('home_content') ? api.content : api.settings;
        if (method === 'POST' && body && !api.failWrites) rows[String(body.key)] = String(body.value);
        if (method === 'PATCH' && body && !api.failWrites) {
          const key = url.searchParams.get('key')?.replace('eq.', '');
          if (key && key in rows) rows[key] = String(body.value);
        }
        const key = url.searchParams.get('key')?.replace('eq.', '');
        const selected = Object.entries(rows).filter(([rowKey]) => !key || rowKey === key).map(([key, value]) => ({ key, value }));
        data = single ? selected[0] ?? null : selected;
      } else if (url.pathname === '/rest/v1/archetype_results') data = single ? null : [];
      if (api.failWrites && method !== 'GET') return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"message":"fixture write failed"}' });
      return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await use(api);
  }, { auto: true }],
});
export { expect };
export async function login(page: Page) {
  await page.goto('/admin');
  await page.getByPlaceholder('admin@example.com').fill(user.email);
  await page.getByPlaceholder('Password', { exact: true }).fill('fixture-only-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Новый тест', exact: true })).toBeVisible();
}
