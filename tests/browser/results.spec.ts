import {test,expect} from './fixtures';
import type {TestSession} from '../../src/lib/supabase';
const id='22222222-2222-4222-8222-222222222222';
const token='44444444-4444-4444-8444-444444444444';
const path=`/results/${id}#access_token=${token}`;
const result:TestSession={id,test_id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.test',
  answers:'{}',analyst_score:0,observer_score:0,intuitive_score:0,strategist_score:0,overall_score:0,
  is_paid:true,stripe_session_id:'cs_test_fixture',completed_at:'2026-01-01',created_at:'2026-01-01'};

test('paid zero result has a recoverable personal link, factual email status and archived context',async({page,api})=>{
  api.result={...result};api.test.is_active=false;api.test.archived_at='2026-10-22';api.emailStatus='failed';
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('Blocked'))}}));
  await page.goto(path);
  await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
  await expect(page.getByText('IQ тест',{exact:true})).toBeVisible();
  await expect(page.getByText('Не удалось отправить письмо.',{exact:false})).toBeVisible();
  await expect(page.getByText('В этой попытке нет выраженного ведущего измерения.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Сохранить персональную ссылку',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Скопируйте ссылку:'})).toHaveValue(new RegExp(`#access_token=${token}$`));
  expect(api.requests.some(r=>r.path.endsWith('/archetype_results'))).toBe(false);
  await expect(page).toHaveURL(new RegExp(`/results/${id}$`));
  await page.reload();await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
});
test('blocked session storage retains the capability fragment across reload',async({page,api})=>{
  api.result={...result};
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});
  await page.goto(path);await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#access_token=${token}$`));
  await page.reload();await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
});
test('a result network failure can be retried and missing capability never starts a new payment',async({page,api})=>{
  api.result={...result};api.failResults=true;await page.goto(path);
  await expect(page.getByRole('heading',{name:'Не удалось загрузить результат'})).toBeVisible();
  api.failResults=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Результаты IQ теста',exact:true})).toBeVisible();
  const fresh=await page.context().newPage();await fresh.goto(`/results/${id}`);
  await expect(fresh.getByRole('heading',{name:'Нужна персональная ссылка'})).toBeVisible();
  expect(api.requests.some(r=>r.path.endsWith('/create-checkout'))).toBe(false);
});
test('question images retry, zoom in a modal and close with Escape',async({page,api})=>{
  api.questions[0].image_url='https://fixture-images.test/question.png';let fail=true;
  await page.route('https://fixture-images.test/**',route=>route.fulfill(fail?{status:503,body:'Unavailable'}:{
    contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GKsAAAAASUVORK5CYII=','base64'),
  }));
  await page.goto('/iq-test');await expect(page.getByRole('alert')).toContainText('Не удалось загрузить иллюстрацию');
  fail=false;await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click();
  await page.getByRole('button',{name:'Увеличить: Иллюстрация к вопросу 1',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByRole('slider').fill('2');await expect(dialog.getByRole('img')).toHaveAttribute('style','width: 200%; max-width: none;');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
});

test('a late response for an earlier result cannot replace the current result',async({page,api})=>{
  const nextId='55555555-5555-4555-8555-555555555555';
  api.result={...result,id:nextId,overall_score:12};
  let release!:()=>void,started!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const captured=new Promise<void>(resolve=>{started=resolve;});
  await page.route('**/rest/v1/rpc/get_test_session',async route=>{
    if(route.request().postDataJSON().p_session_id!==id)return route.fallback();
    started();await pending;
    await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({...result,overall_score:94})});
  });
  await page.goto(path);await captured;
  await page.evaluate(url=>{history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));},`/results/${nextId}#access_token=${token}`);
  try{
    await expect(page.getByText('12',{exact:true})).toBeVisible();release();
    await page.waitForResponse(response=>response.url().endsWith('/rpc/get_test_session')&&response.request().postDataJSON()?.p_session_id===id);
    await expect(page.getByText('12',{exact:true})).toBeVisible();
    await expect(page.getByText('94',{exact:true})).toHaveCount(0);
  }finally{release();}
});
