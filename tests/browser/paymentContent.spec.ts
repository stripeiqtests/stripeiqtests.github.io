import {test,expect,login} from './fixtures';

test('public payment cancellation uses each language saved by the page editor',async({page,api})=>{
  api.settings.language_mode='bilingual';
  api.content={payment_cancel_title_ru:'Сохранённый заголовок отмены',payment_cancel_title_en:'Saved cancellation title',
    payment_cancel_message_ru:'Проверочный русский текст отмены.',payment_cancel_message_en:'Saved English cancellation text.',
    try_again_button_ru:'Вернуться к моему результату',try_again_button_en:'Return to my result',
    back_to_home_ru:'Открыть главную страницу',back_to_home_en:'Open the home page',
    payment_cancel_title:'Old shared title must not override locale',payment_cancel_message:'Old shared message'};
  await page.goto('/payment/cancel?session_id=22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading',{name:'Сохранённый заголовок отмены',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Вернуться к моему результату',exact:true})).toHaveAttribute('href','/results/22222222-2222-4222-8222-222222222222');
  await page.getByRole('button',{name:'EN (English)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved cancellation title',exact:true})).toBeVisible();
  await expect(page.getByText('Saved English cancellation text.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Return to my result',exact:true})).toBeVisible();
  await page.goto('/payment/cancel');
  await expect(page.getByRole('link',{name:'Open the home page',exact:true})).toHaveAttribute('href','/');
});

test('administrator payment previews save and reload independent Russian and English text',async({page,api},info)=>{
  api.settings.language_mode='bilingual';
  api.content={payment_success_title_ru:'Русский заголовок',payment_success_title_en:'English title',
    payment_success_processing_ru:'Русская обработка',payment_success_processing_en:'English processing',
    payment_cancel_message_ru:'Русский текст отмены',payment_cancel_message_en:'English cancellation text'};
  await login(page);await page.goto('/payment/success?preview=admin&session_id=demo');
  await page.getByRole('button',{name:'Редактировать: Русский заголовок',exact:true}).click();
  await page.getByRole('textbox',{name:'Редактировать: Русский заголовок',exact:true}).fill('Сохранённая русская версия');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Сохранённая русская версия',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'EN (English)',exact:true}).click();
  await page.getByRole('button',{name:'Edit: English title',exact:true}).click();
  await page.getByRole('textbox',{name:'Edit: English title',exact:true}).fill('Saved English version');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved English version',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Saved English version',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'RU (Русский)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Сохранённая русская версия',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Редактировать: Сохранённая русская версия',exact:true}).click();
  await page.getByRole('textbox',{name:'Редактировать: Сохранённая русская версия',exact:true}).fill('Незавершённый русский черновик');
  await page.getByRole('button',{name:'EN (English)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved English version',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(api.content.payment_success_title_ru).toBe('Сохранённая русская версия');
  expect(api.content.payment_success_title_en).toBe('Saved English version');
  expect(api.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/home_content')).map(r=>r.body?.key))
    .toEqual(['payment_success_title_ru','payment_success_title_en']);
  await page.goto('/payment/cancel?preview=admin');
  await page.getByRole('button',{name:'Edit: English cancellation text',exact:true}).click();
  await page.getByRole('textbox',{name:'Edit: English cancellation text',exact:true}).fill('Saved cancellation message');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await expect(page.getByText('Saved cancellation message',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'RU (Русский)',exact:true}).click();
  await expect(page.getByText('Русский текст отмены',{exact:true})).toBeVisible();
  expect(api.content.payment_cancel_message_ru).toBe('Русский текст отмены');
  expect(api.content.payment_cancel_message_en).toBe('Saved cancellation message');
  await page.screenshot({path:info.outputPath('localized-payment-cancel-admin.png'),fullPage:false,animations:'disabled'});
});

test('real verification pending and failure states use the same localized copy keys',async({page,api})=>{
  api.settings.language_mode='en';
  api.content={payment_success_processing_en:'Saved processing message',payment_error_en:'Saved verification error message'};
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  await page.route('**/functions/v1/verify-payment',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
    await pending;await route.fulfill({status:503,headers,contentType:'application/json',body:'{"error":"fixture unavailable"}'});
  });
  await page.goto('/payment/success?session_id=cs_test_localized');
  try{
    await expect(page.getByText('Saved processing message',{exact:true})).toBeVisible();
    release();
    await expect(page.getByRole('heading',{name:'Could not confirm payment',exact:true})).toBeVisible();
    await expect(page.getByText('Saved verification error message',{exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('do not pay again');
  }finally{release();}
});
