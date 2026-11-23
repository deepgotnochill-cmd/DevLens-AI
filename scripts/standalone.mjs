// Produce a portable copy of the static frontend for local review.
import {readFile,writeFile} from 'node:fs/promises';
const [page,css,model,dashboard,snapshot,portrait]=await Promise.all([
  readFile('out/index.html','utf8'),readFile('public/dashboard.css','utf8'),
  readFile('public/model.js','utf8'),readFile('public/dashboard.js','utf8'),
  readFile('public/featured.json','utf8'),readFile('public/deep.jpg')
]);
const js=model.replace(/^export /gm,'')+'\nconst h=safe;\n'+dashboard
  .replace(/^import[^;]+;/m,'')
  .replace("request('./featured.json')","Promise.resolve("+snapshot+")")
  .replaceAll('./deep.jpg','data:image/jpeg;base64,'+portrait.toString('base64'));
const html=page.replace(/<link rel="stylesheet" href="\.\/dashboard\.css(?:\?v=[a-f0-9]+)?">/,()=>'<style>'+css+'</style>')
  .replace(/<script type="module" src="\.\/dashboard\.js(?:\?v=[a-f0-9]+)?"><\/script>/,()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>');
await writeFile('DevLens-AI.html',html);

