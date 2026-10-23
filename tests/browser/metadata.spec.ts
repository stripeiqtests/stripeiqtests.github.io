import {test,expect} from './fixtures';

test('route metadata follows public navigation and does not index a private result URL',async({page})=>{
  await page.goto('/privacy');await expect(page).toHaveTitle('Конфиденциальность — Inner Code');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://inner-code.me/privacy');
  await page.goto('/results/22222222-2222-4222-8222-222222222222');
  await expect(page).toHaveTitle('Результат теста — Inner Code');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.getByRole('link',{name:'На главную',exact:true}).click();
  await expect(page).toHaveTitle('IQ Test - Discover Your Cognitive Profile');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',
    'Discover your cognitive profile with our comprehensive IQ test. Get detailed insights across four dimensions: Analyst, Strategist, Observer, and Intuitive.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','index, follow');
});
