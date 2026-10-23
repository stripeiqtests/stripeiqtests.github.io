import AxeBuilder from '@axe-core/playwright';
import {test,expect,login} from './fixtures';
import type {Page,TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {TestSession} from '../../src/lib/supabase';
const resultId='22222222-2222-4222-8222-222222222222',resultToken='44444444-4444-4444-8444-444444444444';
const fixtureResult:TestSession={id:resultId,test_id:'11111111-1111-4111-8111-111111111111',email:null,answers:null,
  analyst_score:null,strategist_score:null,observer_score:null,intuitive_score:null,overall_score:null,is_paid:false,
  stripe_session_id:null,completed_at:'2026-01-01',created_at:'2026-01-01'};

async function scan(page:Page,info:TestInfo,label:string){
  const results=await new AxeBuilder({page}).analyze();
  const path=info.outputPath(`axe-${label}.json`);await writeFile(path,JSON.stringify(results,null,2));
  await info.attach(`axe-${label}`,{path,contentType:'application/json'});
  expect.soft(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),label).toEqual([]);
}

test('public entry, question and final form pass automated accessibility checks',async({page},info)=>{
  await page.goto('/');await expect(page.getByTestId('hero-start')).toBeVisible();await scan(page,info,'home');
  await page.getByTestId('hero-start').click();await expect(page.getByRole('heading',{name:'Контрольный вопрос 1',exact:true})).toBeVisible();await scan(page,info,'question');
  for(let n=1;n<=3;n++){
    await page.getByRole('button',{name:new RegExp(`^Вопрос ${n}:`)}).click();
    await page.getByRole('button',{name:'A Вариант A',exact:true}).click();
  }
  await page.getByRole('button',{name:'Завершить тест',exact:true}).click();await scan(page,info,'submit-form');
});

test('admin editors have named controls and pass automated accessibility checks',async({page},info)=>{
  await page.goto('/admin');await expect(page.getByRole('button',{name:'Login',exact:true})).toBeVisible();await scan(page,info,'login');
  await login(page);
  const row=page.locator('div.bg-white.rounded-lg').filter({has:page.getByText('Контрольный вопрос 1',{exact:true})});
  await row.getByTitle('Редактировать',{exact:true}).click();await scan(page,info,'question-editor');
  await page.goto('/admin/settings');await expect(page.getByLabel('Публичный контакт поддержки')).toBeVisible();await scan(page,info,'settings');
});

test('password dialog keeps background controls out of keyboard navigation and Escape restores focus',async({page},info)=>{
  await login(page);const opener=page.getByRole('button',{name:'Установить пароль',exact:true});
  await opener.click();const dialog=page.getByRole('dialog',{name:'Установить пароль администратора',exact:true});
  await expect(dialog).toBeVisible();await scan(page,info,'password-dialog');
  const focusSequence=[];
  for(let tab=0;tab<10;tab++){
    await page.keyboard.press('Tab');focusSequence.push(await dialog.evaluate(node=>({inside:node.contains(document.activeElement),tag:document.activeElement?.tagName,pageFocused:document.hasFocus()})));
  }
  await info.attach('keyboard-focus',{body:JSON.stringify(focusSequence),contentType:'application/json'});
  // Chromium may send Tab to browser chrome (BODY + document.hasFocus=false).
  // While the document has focus, no background control may receive it.
  expect(focusSequence.filter(item=>!item.inside&&(item.pageFocused||item.tag!=='BODY'))).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});

test('compact inline editor supports keyboard cancel and restores focus without shifting the card',async({page})=>{
  await login(page);await page.goto('/');
  const card=page.locator('section').first().locator('.grid > div').nth(2);
  const pencil=card.getByRole('button',{name:/^Редактировать:/}).first();
  await pencil.focus();await page.keyboard.press('Enter');
  const input=card.getByRole('textbox');await expect(input).toBeFocused();const original=await input.inputValue();
  await input.fill('Проверка клавиатуры');
  const save=card.getByRole('button',{name:'Сохранить',exact:true});
  expect(await save.evaluate(node=>getComputedStyle(node.parentElement!).position)).toBe('absolute');
  await page.keyboard.press('Escape');await expect(card.getByRole('heading',{name:original,exact:true})).toBeVisible();
  await expect(pencil).toBeFocused();
});

test('paywall, paid and unavailable result states pass automated accessibility checks',async({page,api},info)=>{
  api.result={...fixtureResult};await page.goto(`/results/${resultId}#access_token=${resultToken}`);
  await expect(page.getByText('Единовременный платёж',{exact:true})).toBeVisible();await scan(page,info,'paywall');
  api.result={...fixtureResult,is_paid:true,analyst_score:0,strategist_score:0,observer_score:0,intuitive_score:0,overall_score:0};
  await page.reload();await expect(page.getByRole('button',{name:'Сохранить персональную ссылку',exact:true})).toBeVisible();await scan(page,info,'paid-result');
  api.failResults=true;await page.reload();await expect(page.getByRole('heading',{name:'Не удалось загрузить результат',exact:true})).toBeVisible();await scan(page,info,'result-error');
});

test('policy, terms and cancellation pages pass automated accessibility checks',async({page},info)=>{
  for(const path of ['/privacy','/terms','/payment/cancel']){
    await page.goto(path);await expect(page.getByRole('heading',{level:1})).toBeVisible();await scan(page,info,path.replaceAll('/','-'));
  }
});

test('administrator paywall preview remains editable and passes accessibility checks',async({page},info)=>{
  await login(page);await page.goto('/results/preview-paywall?preview=admin');
  await expect(page.getByText('Единовременный платёж',{exact:true})).toBeVisible();await scan(page,info,'admin-paywall');
  await page.getByRole('button',{name:'Редактировать: Разблокировать мой результат',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Редактировать: Разблокировать мой результат',exact:true})).toBeFocused();
  await scan(page,info,'admin-paywall-editing');
  await page.screenshot({path:info.outputPath('compact-paywall-editor.png'),fullPage:false});
});
