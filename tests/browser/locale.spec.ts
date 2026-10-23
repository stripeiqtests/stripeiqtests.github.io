import {test,expect,login} from './fixtures';

test('English-only mode still applies when preference storage is blocked',async({page,api})=>{
  api.settings.language_mode='en';
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Available Tests',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('button',{name:'RU (Русский)',exact:true})).toHaveCount(0);
});

test('bilingual switching has selected-state semantics and settings have a translated name',async({page,api})=>{
  await login(page);api.settings.language_mode='bilingual';
  await page.goto('/admin/settings');
  await expect(page.getByRole('link',{name:'Настройки',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'EN (English)',exact:true}).click();
  await expect(page.getByRole('button',{name:'EN (English)',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('link',{name:'Settings',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
});
