import {test,expect} from './fixtures';
import type {TestSession} from '../../src/lib/supabase';
const id='22222222-2222-4222-8222-222222222222';
const token='44444444-4444-4444-8444-444444444444';
const result:TestSession={id,test_id:'11111111-1111-4111-8111-111111111111',email:null,
  answers:'{}',analyst_score:0,observer_score:0,intuitive_score:0,strategist_score:0,overall_score:0,
  is_paid:false,stripe_session_id:null,completed_at:'2026-01-01',created_at:'2026-01-01'};
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,OPTIONS'};

test('changing the return URL while verification is delayed cannot open the earlier checkout result',async({page,api})=>{
  api.result={...result,is_paid:true};
  let release!:()=>void,started!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const captured=new Promise<void>(resolve=>{started=resolve;});
  await page.route('**/functions/v1/verify-payment',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    if(route.request().postDataJSON().stripeSessionId==='cs_test_old'){
      started();await pending;
      await route.fulfill({headers,contentType:'application/json',body:JSON.stringify({success:true,testSessionId:id,resultAccessToken:token,testId:api.test.id,amountPaid:200})});
    }else await route.fulfill({status:503,headers,contentType:'application/json',body:'{"error":"fixture failure"}'});
  });
  await page.goto('/payment/success?session_id=cs_test_old');await captured;
  await page.evaluate(()=>{history.pushState(null,'','/payment/success?session_id=cs_test_new');dispatchEvent(new PopStateEvent('popstate'));});
  try{
    await expect(page.getByRole('heading',{name:'Не удалось подтвердить оплату',exact:true})).toBeVisible();
    release();
    await expect(page).toHaveURL(/session_id=cs_test_new$/);
    await expect(page.getByRole('alert')).toContainText('не платите повторно');
    expect(api.requests.some(r=>r.path.endsWith('/get_test_session'))).toBe(false);
  }finally{release();}
});

test('checkout failure is retryable and broken analytics cannot block checkout or test answers',async({page,api})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('inner-code:analytics-consent:v2','granted');window.gtag=()=>{throw new Error('Fixture blocked provider');};});
  api.result={...result};let calls=0;
  await page.route('**/functions/v1/create-checkout',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    calls++;await route.fulfill({status:503,headers,contentType:'application/json',body:'{"error":"fixture failure"}'});
  });
  await page.goto(`/results/${id}#access_token=${token}`);
  const checkout=page.getByRole('button',{name:'Разблокировать мой результат',exact:true});
  await checkout.click();await expect(page.getByRole('alert')).toContainText('Не удалось открыть оплату');
  await checkout.click();await expect.poll(()=>calls).toBe(2);
  await page.goto('/iq-test');await page.getByRole('button',{name:'A Вариант A',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Контрольный вопрос 2',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('a delayed checkout cannot redirect after leaving its result',async({page,api})=>{
  api.result={...result};
  let release!:()=>void,started!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const captured=new Promise<void>(resolve=>{started=resolve;});
  await page.route('**/functions/v1/create-checkout',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    started();await pending;
    await route.fulfill({headers,contentType:'application/json',body:'{"url":"https://checkout.stripe.com/c/pay/fixture"}'});
  });
  await page.goto(`/results/${id}#access_token=${token}`);
  await page.getByRole('button',{name:'Разблокировать мой результат',exact:true}).click();await captured;
  try{
    await page.getByRole('link',{name:/На главную/}).click();
    await expect(page.getByTestId('hero-start')).toBeVisible();
    const returned=page.waitForResponse(response=>response.url().endsWith('/create-checkout'));
    release();await returned;await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
  }finally{release();}
});

test('a stalled verification becomes retryable and never asks the visitor to pay again',async({page})=>{
  await page.clock.install();
  let release!:()=>void,started!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const captured=new Promise<void>(resolve=>{started=resolve;});
  await page.route('**/functions/v1/verify-payment',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    started();await pending;await route.fulfill({status:503,headers,body:'{}'});
  });
  await page.goto('/payment/success?session_id=cs_test_stalled');await captured;
  try{
    await page.clock.runFor(25000);
    await expect(page.getByRole('alert')).toContainText('не платите повторно');
    await expect(page.getByRole('button',{name:'Повторить проверку',exact:true})).toBeEnabled();
  }finally{release();}
});

test('successful verification opens its protected paid result and repeated visits do not duplicate purchase analytics',async({page,api})=>{
  api.result={...result,is_paid:true};let verifications=0;
  await page.addInitScript(()=>{
    localStorage.setItem('inner-code:analytics-consent:v2','granted');
    window.dataLayer=[];window.gtag=(...args:unknown[])=>window.dataLayer.push(args);
  });
  await page.route('**/functions/v1/verify-payment',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    verifications++;await route.fulfill({headers,contentType:'application/json',body:JSON.stringify({success:true,testSessionId:id,resultAccessToken:token,testId:api.test.id,amountPaid:100})});
  });
  await page.goto('/payment/success?session_id=cs_test_paidfixture');
  await expect(page.getByRole('button',{name:'Сохранить персональную ссылку',exact:true})).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/results/${id}$`));expect(verifications).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.dataLayer.filter(item=>Array.isArray(item)&&item[0]==='event'&&item[1]==='purchase').length)).toBe(1);
  const recorded=await page.evaluate(()=>window.dataLayer.filter(item=>Array.isArray(item)&&item[0]==='event'&&item[1]==='purchase'));
  expect((recorded[0] as unknown[])[2]).toMatchObject({value:1});
  expect(JSON.stringify(recorded)).not.toContain('cs_test_paidfixture');
  await page.goto('/payment/success?session_id=cs_test_paidfixture');
  await expect(page.getByRole('button',{name:'Сохранить персональную ссылку',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.dataLayer.filter(item=>Array.isArray(item)&&item[0]==='event'&&item[1]==='purchase').length)).toBe(0);
});
