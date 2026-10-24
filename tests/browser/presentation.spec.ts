import { expect, login, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { defaultPresentation } from '../../supabase/functions/_shared/presentation';
const id = '22222222-2222-4222-8222-222222222222';
const token = '44444444-4444-4444-8444-444444444444';
const resultPath = `/results/${id}#access_token=${token}`;
const scores = { analyst_score: 80, strategist_score: 80, observer_score: 40, intuitive_score: 20 };

test(
  'administrator saves tie priority and zero direction; result and archetype selection follow the rules',
  async ({ page, api }, testInfo) => {
    await login(page);
    await page.goto('/admin/settings');
    const panel = page.getByRole('region', { name: 'Спорные результаты и сообщения' });
    await expect(
      panel.getByRole('combobox', { name: 'При одинаковом максимальном балле', exact: true }),
    ).toHaveValue('mixed');
    await expect(
      panel.getByRole('combobox', {
        name: 'Если все измеренные показатели равны нулю',
        exact: true,
      }),
    ).toHaveValue('none');
    await panel.getByRole('combobox', { name: 'При одинаковом максимальном балле', exact: true })
      .selectOption('priority');
    await panel.getByRole('combobox', { name: 'Приоритет 1', exact: true }).selectOption(
      'strategist',
    );
    await panel.getByRole('combobox', {
      name: 'Если все измеренные показатели равны нулю',
      exact: true,
    }).selectOption('observer');
    await expect(
      panel.getByLabel('Предпросмотр правил').getByText(/Ваша сильнейшая сторона — Стратег/),
    ).toBeVisible();
    await expect(
      panel.getByLabel('Предпросмотр правил').getByText(/Ваша сильнейшая сторона — Наблюдатель/),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Сохранить правила и сообщения' }).click();
    await expect(panel.getByRole('status')).toHaveText('Правила сохранены');
    const stored = JSON.parse(api.settings.result_presentation);
    expect(stored.priority).toEqual(['strategist', 'analyst', 'observer', 'intuitive']);
    expect(stored.zero).toBe('observer');
    await page.reload();
    await expect(panel.getByRole('combobox', { name: 'Приоритет 1', exact: true })).toHaveValue(
      'strategist',
    );
    await page.setViewportSize({ width: 1200, height: 1000 });
    await panel.screenshot({ path: testInfo.outputPath('presentation-settings.png') });
    await panel.getByText('Тексты сообщений — русский и английский', { exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const archetypes: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/archetype_results')) {
        archetypes.push(url.searchParams.get('dimension') || '');
      }
    });
    api.result = {
      id,
      test_id: api.test.id,
      email: 'fixture@example.test',
      answers: '{}',
      ...scores,
      overall_score: 55,
      is_paid: true,
      stripe_session_id: null,
      created_at: '2026-01-01',
      completed_at: '2026-01-01',
    };
    await page.goto(resultPath);
    await expect(page.getByText(/Ваша сильнейшая сторона — Стратег\./)).toBeVisible();
    await expect.poll(() => archetypes).toEqual(['eq.strategist']);
    archetypes.length = 0;
    Object.assign(api.result, {
      analyst_score: 0,
      strategist_score: 0,
      observer_score: 0,
      intuitive_score: 0,
    });
    await page.reload();
    await expect(page.getByText(/Ваша сильнейшая сторона — Наблюдатель\./)).toBeVisible();
    await expect.poll(() => archetypes).toEqual(['eq.observer']);
    archetypes.length = 0;
    Object.assign(api.result, {
      analyst_score: null,
      strategist_score: null,
      observer_score: null,
      intuitive_score: null,
    });
    await page.reload();
    await expect(
      page.getByText('В этой попытке нет выраженного ведущего измерения.', { exact: true }),
    ).toBeVisible();
    expect(archetypes).toEqual([]);
  },
);

test('custom bilingual state messages persist, apply publicly and keep unsaved edits on write failure', async ({ page, api }) => {
  api.settings.language_mode = 'bilingual';
  await login(page);
  await page.goto('/admin/settings');
  const panel = page.getByRole('region', { name: 'Спорные результаты и сообщения' });
  await panel.getByText('Тексты сообщений — русский и английский', { exact: true }).click();
  await panel.getByRole('textbox', { name: 'Письмо в очереди — RU', exact: true }).fill(
    'Русская очередь:',
  );
  await panel.getByRole('textbox', { name: 'Письмо в очереди — EN', exact: true }).fill(
    'English queue:',
  );
  await panel.getByRole('textbox', { name: 'Подтверждение оплаты — RU', exact: true }).fill(
    'Проверяем подтверждение',
  );
  await panel.getByRole('textbox', { name: 'Подтверждение оплаты — EN', exact: true }).fill(
    'Checking confirmation',
  );
  await panel.getByRole('textbox', { name: 'Смешанный профиль — RU', exact: true }).fill(
    'Равные направления: {dimensions}.',
  );
  await panel.getByRole('button', { name: 'Сохранить правила и сообщения' }).click();
  await expect(panel.getByRole('status')).toHaveText('Правила сохранены');
  await page.reload();
  await panel.getByText('Тексты сообщений — русский и английский', { exact: true }).click();
  await expect(panel.getByRole('textbox', { name: 'Письмо в очереди — EN', exact: true }))
    .toHaveValue('English queue:');
  await panel.getByRole('textbox', { name: 'Смешанный профиль — RU', exact: true }).fill(
    'Шаблон без списка',
  );
  const writes = () =>
    api.requests.filter((r) => r.method === 'POST' && r.body?.key === 'result_presentation').length;
  const count = writes();
  await panel.getByRole('button', { name: 'Сохранить правила и сообщения' }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  expect(writes()).toBe(count);
  await panel.getByRole('textbox', { name: 'Смешанный профиль — RU', exact: true }).fill(
    'Равные направления: {dimensions}.',
  );
  api.failWrites = true;
  await panel.getByRole('textbox', { name: 'Письмо в очереди — RU', exact: true }).fill(
    'Несохранённая очередь',
  );
  await panel.getByRole('button', { name: 'Сохранить правила и сообщения' }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'Письмо в очереди — RU', exact: true }))
    .toHaveValue('Несохранённая очередь');
  expect(JSON.parse(api.settings.result_presentation).messages.emailQueued.ru).toBe(
    'Русская очередь:',
  );
  api.failWrites = false;
  api.result = {
    id,
    test_id: api.test.id,
    email: 'fixture@example.test',
    answers: '{}',
    ...scores,
    overall_score: 55,
    is_paid: true,
    stripe_session_id: null,
    created_at: '2026-01-01',
    completed_at: '2026-01-01',
  };
  api.emailStatus = 'pending';
  await page.goto(resultPath);
  await expect(page.getByText('Равные направления: Аналитик, Стратег.', { exact: true }))
    .toBeVisible();
  await expect(page.getByRole('status')).toContainText('Русская очередь: fixture@example.test');
  await page.getByRole('button', { name: 'EN (English)', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('English queue: fixture@example.test');
  await page.route('**/functions/v1/verify-payment', () => {});
  await page.goto('/payment/success?session_id=cs_test_fixture');
  await expect(page.getByRole('heading', { name: 'Checking confirmation', exact: true }))
    .toBeVisible();
});

test('failed settings load cannot overwrite rules with defaults; resetting defaults requires saving', async ({ page, api }) => {
  api.settings.result_presentation = JSON.stringify({
    ...defaultPresentation(),
    zero: 'intuitive',
  });
  await login(page);
  let fail = true;
  await page.route('**/rest/v1/app_settings*', (route) => {
    const url = new URL(route.request().url());
    if (fail && url.searchParams.get('key') === 'eq.result_presentation') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '{}',
      });
    }
    return route.fallback();
  });
  await page.goto('/admin/settings');
  const panel = page.getByRole('region', { name: 'Спорные результаты и сообщения' });
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Сохранить правила и сообщения' })).toHaveCount(0);
  fail = false;
  await panel.getByRole('button', { name: 'Повторить загрузку правил' }).click();
  await expect(
    panel.getByRole('combobox', { name: 'Если все измеренные показатели равны нулю', exact: true }),
  ).toHaveValue('intuitive');
  await panel.getByRole('button', { name: 'Вернуть значения по умолчанию' }).click();
  expect(JSON.parse(api.settings.result_presentation).zero).toBe('intuitive');
  await panel.getByRole('button', { name: 'Сохранить правила и сообщения' }).click();
  await expect(panel.getByRole('status')).toHaveText('Правила сохранены');
  expect(JSON.parse(api.settings.result_presentation).zero).toBe('none');
  api.result = {
    id,
    test_id: api.test.id,
    email: null,
    answers: '{}',
    ...scores,
    overall_score: 55,
    is_paid: true,
    stripe_session_id: null,
    created_at: '2026-01-01',
    completed_at: '2026-01-01',
  };
  fail = true;
  await page.goto(resultPath);
  await expect(
    page.getByText('Не удалось загрузить правила отображения результата.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Смешанный профиль: Аналитик, Стратег.', { exact: true }))
    .toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByText('Смешанный профиль: Аналитик, Стратег.', { exact: true }))
    .toBeVisible();
});
