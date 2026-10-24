import {test,expect} from './fixtures';

test('reload resumes the same server snapshot after admin changes or archives a test',async({page,api})=>{
  await page.goto('/iq-test');await page.getByRole('button',{name:'A Вариант A',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Контрольный вопрос 2',exact:true})).toBeVisible();
  const token=api.requests.find(r=>r.path.endsWith('/start_test_attempt'))!.body!.p_attempt_token;
  api.questions[1].question_text='Новая редакция вопроса';api.test.price_cents=900;api.test.is_active=false;
  await page.reload();await expect(page.getByRole('heading',{name:'Контрольный вопрос 2',exact:true})).toBeVisible();
  await expect(page.getByText('Новая редакция вопроса',{exact:true})).toHaveCount(0);
  expect(api.requests.filter(r=>r.path.endsWith('/start_test_attempt')).every(r=>r.body!.p_attempt_token===token)).toBe(true);
  await page.getByRole('button',{name:'Вопрос 1: есть ответ',exact:true}).click();
  await expect(page.getByRole('button',{name:'A Вариант A',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('ambiguous submission retries the same attempt instead of creating a second result',async({page,api})=>{
  api.failSubmissionOnce=true;
  await page.goto('/iq-test');
  for(let n=1;n<=3;n++){
    await expect(page.getByRole('heading',{name:`Контрольный вопрос ${n}`,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'A Вариант A',exact:true}).click();
  }
  await page.getByRole('button',{name:'Завершить тест',exact:true}).click();
  await page.getByRole('button',{name:'Получить результаты',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Ошибка отправки. Попробуйте еще раз.');
  await page.getByRole('button',{name:'Получить результаты',exact:true}).click();
  await expect(page).toHaveURL(/\/results\/22222222/);
  expect(api.submissions).toBe(1);
  const sends=api.requests.filter(r=>r.path.endsWith('/submit_test_attempt'));
  expect(sends).toHaveLength(2);expect(sends[0].body!.p_attempt_token).toBe(sends[1].body!.p_attempt_token);
});
test('admission quota has a clear message while an existing attempt can still resume',async({page,api})=>{
  api.limitAttempts=true;await page.goto('/iq-test');
  await expect(page.getByText('Новые попытки временно ограничены',{exact:false})).toBeVisible();
  api.limitAttempts=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Контрольный вопрос 1',exact:true})).toBeVisible();
  api.limitAttempts=true;await page.reload();
  await expect(page.getByRole('heading',{name:'Контрольный вопрос 1',exact:true})).toBeVisible();
});
