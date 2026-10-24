import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareHosting, securityHeaders } from './prepare-hosting.mjs';

test('CSP authorizes the emitted redirect helper with a hash, preserving same-origin admin previews', () => {
  const script="window.history.replaceState(null, '', '/iq-test');";
  const headers=securityHeaders(`<script>${script}</script><script src="/assets/app.js"></script>`);
  const policy=headers.split('\n').find(line=>line.includes('Content-Security-Policy:'));
  assert.ok(policy.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.ok(!policy.match(/script-src[^;]*unsafe-inline/));
  assert.ok(!policy.includes('unsafe-eval'));assert.ok(policy.includes("frame-ancestors 'self'"));
  assert.ok(!headers.includes('includeSubDomains')); // do not pin unrelated subdomains
});
test('Cloudflare artifact enables SPA fallback while the GitHub artifact keeps its 404 redirect',()=>{
  const base=resolve(import.meta.dirname,'../node_modules/.tmp');mkdirSync(base,{recursive:true});
  const directory=mkdtempSync(resolve(base,'hosting-'));
  try {
    writeFileSync(resolve(directory,'index.html'),'<div id="root"></div>');
    writeFileSync(resolve(directory,'404.html'),'legacy fallback');
    prepareHosting(directory,false);assert.ok(existsSync(resolve(directory,'404.html')));
    prepareHosting(directory,true);assert.ok(!existsSync(resolve(directory,'404.html')));
    const headers=readFileSync(resolve(directory,'_headers'),'utf8');assert.ok(headers.includes('Referrer-Policy: no-referrer'));
  }finally{
    // Remove only the three named fixture files and the empty directory we made.
    for(const file of ['index.html','404.html','_headers'])if(existsSync(resolve(directory,file)))unlinkSync(resolve(directory,file));
    rmdirSync(directory);
  }
});
