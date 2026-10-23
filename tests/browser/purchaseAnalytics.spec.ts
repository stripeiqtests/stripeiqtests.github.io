import {test,expect} from './fixtures';

test('concurrent purchase callbacks are deduplicated without storage and never send a checkout capability',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('inner-code:analytics-consent:v2','granted');
    Object.defineProperty(window,'sessionStorage',{value:{getItem:()=>{throw new DOMException('Blocked');},setItem:()=>{throw new DOMException('Blocked');}}});
    window.dataLayer=[];window.gtag=(...args:unknown[])=>window.dataLayer.push(args);
  });
  await page.goto('/');
  const recorded=await page.evaluate(async modulePath=>{
    const {trackPurchase}=await import(modulePath);
    await Promise.all([trackPurchase('fixture-test',200,'USD','cs_test_privatefixture'),trackPurchase('fixture-test',200,'USD','cs_test_privatefixture')]);
    return window.dataLayer.filter(item=>Array.isArray(item)&&item[0]==='event'&&item[1]==='purchase');
  },'/src/lib/analytics.ts');
  expect(recorded).toHaveLength(1);
  expect(JSON.stringify(recorded)).not.toContain('cs_test_privatefixture');
  expect((recorded[0] as unknown[])[2]).toMatchObject({transaction_id:expect.stringMatching(/^[a-f0-9]{64}$/),value:2});
});
