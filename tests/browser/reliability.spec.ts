import { test, expect, login } from './fixtures';

test('a failed homepage request does not claim no tests exist and can be retried',async({page,api})=>{
  api.failTests=true;await page.goto('/');
  await expect(page.getByRole('heading',{name:'Не удалось загрузить список тестов',exact:true})).toBeVisible();
  await expect(page.getByText('Тестов пока нет',{exact:true})).toHaveCount(0);
  api.failTests=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByTestId('hero-start')).toBeVisible();
});

test('a double answer advances once; manual navigation cancels pending advance', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/iq-test');
  await page.getByRole('button', { name: 'A Вариант A', exact: true }).dblclick({ delay: 25 });
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 2' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Вопрос 1: есть ответ', exact: true }).click();
  await page.getByRole('button', { name: 'B Вариант B', exact: true }).click();
  await page.getByRole('button', { name: 'Вопрос 3: нет ответа', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 3' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a draft survives reload and can be explicitly discarded', async ({ page }) => {
  await page.goto('/iq-test');
  await page.getByRole('button', { name: 'A Вариант A', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 2' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 2' })).toBeVisible();
  await expect(page.getByText('Сохранённые ответы восстановлены.')).toBeVisible();
  await page.getByRole('button', { name: 'Вопрос 1: есть ответ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'A Вариант A', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(page.getByRole('button', { name: 'A Вариант A', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('a service failure has a retry and is not called an empty test', async ({ page, api }) => {
  api.failQuestions = true; await page.goto('/iq-test');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить тест' })).toBeVisible();
  await expect(page.getByText('Этот тест ещё не заполнен.', { exact: false })).toHaveCount(0);
  api.failQuestions = false;
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 1' })).toBeVisible();
});

test('malformed options show a recoverable error instead of crashing', async ({ page, api }) => {
  api.questions[0].options = '{broken'; const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/iq-test');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить тест' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('new content really persists; failure keeps the editor draft', async ({ page, api }) => {
  await login(page); await page.goto('/');
  const card = page.locator('section').first().locator('.grid > div').nth(2);
  await card.getByRole('button',{name:/^Редактировать:/}).first().click();
  await card.locator('input').fill('Сохранённый заголовок');
  await card.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(card.getByRole('heading', { name: 'Сохранённый заголовок' })).toBeVisible();
  expect(Object.values(api.content)).toContain('Сохранённый заголовок');
  await page.reload();
  await expect(card.getByRole('heading', { name: 'Сохранённый заголовок' })).toBeVisible();
  await card.getByRole('button',{name:/^Редактировать:/}).first().click();
  await card.locator('input').fill('Несохранённый черновик'); api.failWrites = true;
  await card.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(card.getByRole('alert')).toBeVisible();
  await expect(card.locator('input')).toHaveValue('Несохранённый черновик');
});

test('a delayed content load cannot replace a newer saved value', async ({ page, api }) => {
  await login(page);
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/home_content*', async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    await delayed;
    return route.fulfill({ contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([
        {key:'feature3_title_ru',value:'Старый заголовок'},
        {key:'footer_ru',value:'Контроль завершённой загрузки'},
      ]) });
  });
  try {
    await page.goto('/');
    const card = page.locator('section').first().locator('.grid > div').nth(2);
    await card.getByRole('button',{name:/^Редактировать:/}).first().click();
    await card.locator('input').fill('Новое сохранённое значение');
    await card.getByRole('button',{name:'Сохранить',exact:true}).click();
    await expect(card.getByRole('heading',{name:'Новое сохранённое значение'})).toBeVisible();
    expect(api.content.feature3_title_ru).toBe('Новое сохранённое значение');
    release();
    await expect(page.getByText('Контроль завершённой загрузки',{exact:true})).toBeVisible();
    await expect(card.getByRole('heading',{name:'Новое сохранённое значение'})).toBeVisible();
  } finally { release(); }
});

test('renaming keeps the slug; archiving never deletes questions and can be reversed', async ({ page, api }) => {
  await login(page);
  await page.goto('/admin/tests?editTest=' + api.test.id);
  await page.getByRole('textbox', { name: 'Название теста', exact: true }).fill('Новое название');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Название теста', exact: true })).toHaveCount(0);
  expect(api.test.slug).toBe('iq-test');
  expect(api.requests.filter(r => r.path.endsWith('/tests') && r.method === 'PATCH').every(r => !('slug' in (r.body ?? {})))).toBe(true);
  page.on('dialog', dialog => dialog.accept());
  await page.getByTitle('Архивировать тест', { exact: true }).click();
  await expect(page.getByText('Новое название', { exact: true })).toHaveCount(0);
  expect(api.test.archived_at).not.toBeNull(); expect(api.questions).toHaveLength(3);
  expect(api.requests.some(r => r.method === 'DELETE')).toBe(false);
  await page.getByRole('checkbox', { name: 'Показать архив' }).check();
  await page.getByTitle('Восстановить из архива', { exact: true }).click();
  await expect(page.getByTitle('Архивировать тест', { exact: true })).toBeVisible();
  expect(api.test.archived_at).toBeNull(); expect(api.test.is_active).toBe(false);
});

test('support is configurable and is not falsely saved on failure', async ({ page, api }) => {
  await login(page); await page.goto('/admin/settings');
  await page.getByLabel('Публичный контакт поддержки').fill('help@example.test');
  await page.getByRole('button', { name: 'Сохранить контакт', exact: true }).click();
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Сохранено' })).toBeVisible();
  expect(api.settings.support_contact).toBe('help@example.test');
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Связаться с поддержкой' })).toHaveAttribute('href', 'mailto:help@example.test');
});

test('no analytics before consent or after decline; choice can be changed', async ({ page, api }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Отклонить', exact: true })).toBeVisible();
  expect(api.tracking).toEqual([]);
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click(); await page.reload();
  await expect(page.getByRole('button', { name: 'Отклонить', exact: true })).toHaveCount(0);
  expect(api.tracking).toEqual([]);
  await page.getByRole('button', { name: 'Настройки cookies', exact: true }).click();
  await page.getByRole('button', { name: 'Разрешить', exact: true }).click();
  await expect.poll(() => api.tracking.length).toBe(1);
  expect(api.tracking[0]).toContain('googletagmanager');
  await page.getByRole('button', { name: 'Настройки cookies', exact: true }).click();
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await expect(page.locator('#optional-ga')).toHaveCount(0);
});

test('mobile start is visible early and cookie controls never cover navigation', async ({ page }) => {
  await page.goto('/');
  const start = page.getByTestId('hero-start');
  await expect(start).toBeVisible();
  expect((await start.boundingBox())!.y).toBeLessThan(844);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  const card = page.locator('a[href="/iq-test"]').last().locator('..');
  const dimensions = await card.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  await page.goto('/iq-test');
  await page.getByRole('button', { name: 'Вопрос 3: нет ответа' }).click();
  await expect(page.getByRole('heading', { name: 'Контрольный вопрос 3' })).toBeVisible();
});
