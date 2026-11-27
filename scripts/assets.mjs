import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
for(const name of ['model','dashboard']){
  const source = await readFile('src/'+name+'.ts','utf8');
  await writeFile('public/'+name+'.js',stripTypeScriptTypes(source).replaceAll("'./model.ts'","'./model.js'"));
}
// The same dashboard can also run on a static host with no Node server.
if(process.argv.includes('--static')){
  await mkdir('out',{recursive:true});
  await cp('public','out',{recursive:true});
  const fingerprint = async file => createHash('sha256').update(await readFile('public/'+file)).digest('hex').slice(0,12);
  const [styleId,scriptId,modelId] = await Promise.all(['dashboard.css','dashboard.js','model.js'].map(fingerprint));
  await writeFile('out/dashboard.js',(await readFile('public/dashboard.js','utf8')).replace("'./model.js'","'./model.js?v="+modelId+"'"));
  await writeFile('out/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Explore public GitHub repository activity, language composition, and source evidence. Built by Deep Datta Chaudhury."><meta property="og:title" content="DevLens AI | Repository intelligence"><meta property="og:description" content="Trace the commits, inspect the code, and explore the evidence."><meta property="og:image" content="./social-preview.png"><meta name="theme-color" content="#0d0e13"><title>DevLens AI · Repository intelligence</title><link rel="stylesheet" href="./dashboard.css?v='+styleId+'"></head><body><main id="devlens"><noscript>Enable JavaScript to analyze a repository.</noscript></main><script type="module" src="./dashboard.js?v='+scriptId+modelId+'"></script></body></html>');
}
