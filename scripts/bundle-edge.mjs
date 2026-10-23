import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Use Vite's locked esbuild dependency; do not fetch a separate executable or
// inline server credentials. npm: Stripe imports remain version-pinned for Deno.
const {build}=createRequire(import.meta.resolve('vite'))('esbuild');
const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'node_modules/.tmp/edge-bundles');
const names=['create-checkout','verify-payment','send-results-email','result-email-worker','stripe-webhook'];
await mkdir(output,{recursive:true});
const manifest={project:'afsoyuczexiztsjntkvi',deployed:false,functions:[]};
for(const name of names){
  const outfile=resolve(output,`${name}.js`);
  await build({
    entryPoints:[resolve(root,`supabase/functions/${name}/index.ts`)],outfile,
    bundle:true,format:'esm',platform:'neutral',target:'es2022',
    external:['npm:*'],sourcemap:false,minify:false,charset:'utf8',
  });
  const content=await readFile(outfile,'utf8');
  manifest.functions.push({name,file:`${name}.js`,verify_jwt:false,
    sha256:createHash('sha256').update(content).digest('hex'),bytes:Buffer.byteLength(content)});
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${names.length} single-file dashboard candidates in ${output}; nothing deployed.`);
