import {test,expect,login} from './fixtures';

test('a preview query alone cannot show a fabricated paid result to a visitor',async({page,api})=>{
  await page.goto('/results/preview?preview=admin');
  await expect(page.getByRole('heading',{name:'Нужна персональная ссылка',exact:true})).toBeVisible();
  await expect(page.getByText('78',{exact:true})).toHaveCount(0);
  expect(api.requests.some(r=>r.path.endsWith('/verify-payment')||r.path.endsWith('/create-checkout'))).toBe(false);
});

test('an authenticated administrator can switch between result and paywall previews',async({page,api})=>{
  await login(page);await page.goto('/results/preview?preview=admin');
  await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
  await page.evaluate(()=>{history.pushState(null,'','/results/preview-paywall?preview=admin');dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page.getByText('Единовременный платёж',{exact:true})).toBeVisible();
  expect(api.requests.some(r=>r.path.endsWith('/verify-payment')||r.path.endsWith('/create-checkout'))).toBe(false);
});
