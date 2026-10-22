import {test,expect,login} from './fixtures';
import type {Page} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GKsAAAAASUVORK5CYII=','base64');
async function validFile(page:Page){
  const base64=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
    const context=canvas.getContext('2d')!;context.fillStyle='#4338ca';context.fillRect(0,0,32,32);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return {name:'puzzle.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')};
}
async function editFirst(page:Page){
  await login(page);
  const row=page.locator('div.bg-white.rounded-lg').filter({has:page.getByText('Контрольный вопрос 1',{exact:true})});
  await row.getByTitle('Редактировать',{exact:true}).click();
  return page.locator('form').filter({has:page.getByRole('button',{name:'Отмена',exact:true})});
}
async function storage(page:Page){
  const uploads:string[]=[],removed:string[]=[];let fail=false;
  await page.route('**/storage/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,DELETE,GET,OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({headers,body:''});
    if(req.method()==='POST'){
      uploads.push(url.pathname.replace('/storage/v1/object/images/',''));
      return route.fulfill({headers,status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{message:'Fixture upload unavailable',statusCode:'503'}:{Key:url.pathname,Id:'fixture-object'})});
    }
    if(req.method()==='DELETE'){
      removed.push(...req.postDataJSON().prefixes);
      return route.fulfill({headers,contentType:'application/json',body:'[]'});
    }
    return route.fulfill({headers,contentType:'image/png',body:png});
  });
  return {uploads,removed,setFailure:(value:boolean)=>{fail=value;}};
}

test('invalid, spoofed and oversized files are rejected before Storage; text stays in the form',async({page})=>{
  const store=await storage(page);const form=await editFirst(page);
  const input=page.getByLabel('Загрузить изображение',{exact:true});
  await input.setInputFiles({name:'vector.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(form.getByRole('alert')).toContainText('Поддерживаются PNG');
  await input.setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(form.getByRole('alert')).toContainText('Поддерживаются PNG');
  await input.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  await expect(form.getByRole('alert')).toContainText('до 5 МБ');
  expect(store.uploads).toHaveLength(0);
  await expect(form.locator('textarea')).toHaveValue('Контрольный вопрос 1');
});
test('cancel cleans only this editor’s new upload, never the original image',async({page,api})=>{
  api.questions[0].image_url='https://fixture-images.test/original.png';
  const store=await storage(page);const form=await editFirst(page);
  await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles(await validFile(page));
  await expect(form.getByAltText('Preview')).toHaveAttribute('src',/storage\/v1\/object\/public\/images\/questions\/[0-9a-f-]+\.png$/);
  await form.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect.poll(()=>store.removed.length).toBe(1);
  expect(store.removed).toEqual(store.uploads);
  expect(api.questions[0].image_url).toBe('https://fixture-images.test/original.png');
});
test('an image offered to a save is preserved even after an ambiguous save failure',async({page,api})=>{
  const store=await storage(page);const form=await editFirst(page);
  await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles(await validFile(page));
  await expect(form.getByAltText('Preview')).toHaveAttribute('src',/storage\/v1\/object\/public/);
  api.failWrites=true;await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('Не удалось сохранить');
  await form.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect(form).toHaveCount(0);expect(store.removed).toEqual([]);
});
test('a successful question save keeps its upload when the form unmounts',async({page,api})=>{
  const store=await storage(page);const form=await editFirst(page);
  await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles(await validFile(page));
  await expect(form.getByAltText('Preview')).toHaveAttribute('src',/storage\/v1\/object\/public/);
  await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(form).toHaveCount(0);
  expect(api.requests.some(r=>r.path.endsWith('/questions')&&r.method==='PATCH'&&String(r.body?.image_url).includes(store.uploads[0]))).toBe(true);
  expect(store.removed).toEqual([]);
});
test('an upload service error is recoverable without discarding question text',async({page})=>{
  const store=await storage(page);store.setFailure(true);const form=await editFirst(page);
  await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles(await validFile(page));
  await expect(form.getByRole('alert')).toContainText('Проверьте подключение');
  await expect(form.locator('textarea')).toHaveValue('Контрольный вопрос 1');
  await expect.poll(()=>store.removed.length).toBe(1);
  store.setFailure(false);await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles(await validFile(page));
  await expect(form.getByAltText('Preview')).toBeVisible();
});
