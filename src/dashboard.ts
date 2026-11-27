import {safe as h,loadRepo,request,signals,buckets} from './model.ts';
import type {Report} from './model.ts';

const root=document.querySelector<HTMLElement>('#devlens')!;
const api=(root.dataset.api||'').replace(/\/$/,'');
const explainApi = location.origin === 'https://deepgotnochill-cmd.github.io' ? 'https://devlens-review.onrender.com/public' : api;
const paths:Record<string,string>={
 lens:'<path d="M12 2 22 8v8l-10 6-10-6V8z M2 8l10 6 10-6 M12 14v8"/>',
 overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 activity:'<path d="M2 13h4l3-8 5 14 3-8h5"/>',
 code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
 branch:'<circle cx="6" cy="5" r="2.3"/><circle cx="6" cy="19" r="2.3"/><circle cx="18" cy="6" r="2.3"/><path d="M6 8v9m0-3c7 0 12-1 12-6"/>',
 star:'<path d="m12 2 3 6.5 7 .9-5 5 1.3 7-6.3-3.4-6.3 3.4 1.3-7-5-5 7-.9z"/>',
 issue:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 2v1"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 file:'<path d="M5 2h9l5 5v15H5z M14 2v6h5 M8 13h8m-8 4h6"/>',
 folder:'<path d="M3 5h6l3 3h9v12H3z"/>',book:'<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z M12 6v15"/>',
 spark:'<path d="m11 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2z M19 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
 person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 terminal:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m6 9 3 3-3 3m6 0h5"/>',
 scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M3 12h18"/>',
 github:'<path fill="currentColor" stroke="none" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.06c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.02-.69.07-.68.07-.68 1.13.08 1.72 1.16 1.72 1.16 1 .97 2.61.89 3.24.68.1-.73.4-1.22.71-1.5-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.06 1.14a10.53 10.53 0 0 1 5.57 0c2.12-1.44 3.06-1.14 3.06-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.77 1.15 2.99 0 4.27-2.61 5.21-5.1 5.49.4.35.76 1.02.76 2.06v3.3c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9z"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 insight:'<path d="M8 16c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7z M9 19h6m-5 3h4"/>',
 link:'<path d="M14 3h7v7m0-7L10 14m0-9H4v15h15v-6"/>'
};
const ic=(key:string,n=18)=>`<svg aria-hidden="true" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[key]||''}</svg>`;
const nav=[['overview','Overview'],['activity','Commit activity'],['folder','File explorer'],['book','Documentation'],['spark','Code explainer'],['insight','Recommendations'],['person','Meet the developer']];
const compact=(n:number)=>Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
const date=(s:string)=>new Date(s).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const colors=['#6ae3c8','#99aaf2','#e6b673','#8293a1','#e48faa','#8997d9','#c1c6d4'];
let report:Report|null=null,view='overview',featured=true,busy=false,error='',days=14,dir='',answer='',question='',selected='',aiBusy=false,aiToken=0,query='',fileSearch='';
function brand(){return `<span class="brandmark"><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path fill="#64e5cb" fill-rule="evenodd" d="M16 1 30 9v14l-14 8L2 23V9zm0 6-8 5v8l8 5 8-5v-8z"/><path fill="#64e5cb" d="m16 11 5 3v5l-5 3-5-3v-5z"/></svg></span><span>DevLens <em>AI</em></span>`}
function sidebar(){return `<aside id="side"><div class="brand">${brand()}</div><div class="sidebody">${nav.map(([id,label],i)=>`${i===0?'<p class="navgroup">WORKSPACE</p>':i===4?'<p class="navgroup">INTELLIGENCE</p>':i===6?'<p class="navgroup">ABOUT</p>':''}<button data-view="${id}" class="nav ${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${ic(id)}${label}</button>`).join('')}</div><button class="signature" data-view="person"><img src="./deep.jpg" alt=""><span><b>Deep Datta Chaudhury</b><small>Platform developer</small></span></button></aside>`}
function artwork(){
  // Decorative exploded lens. Its geometry is independent of repository metrics.
  const layers=[87,66,45,24].map((y,i)=>`<g transform="translate(0 ${y})" opacity="${.55+i*.14}">
    <path d="M38 80 Q125 8 212 80 L212 87 Q125 159 38 87Z" fill="url(#edge)" stroke="#75e8da"/>
    <path d="M38 80 Q125 8 212 80 Q125 152 38 80Z" fill="url(#glass)" stroke="#a5fff0"/>
    <ellipse cx="125" cy="80" rx="51" ry="19" fill="none" stroke="#92ede0"/>
    <ellipse cx="125" cy="80" rx="31" ry="11" fill="#123c40" stroke="#8adbcf"/>
    </g>`).join('');
  return `<svg class="optics" viewBox="0 0 250 225" aria-hidden="true"><defs>
    <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#a2ffed"/><stop offset=".37" stop-color="#378886"/><stop offset=".72" stop-color="#193e50"/><stop offset="1" stop-color="#6fe9ce"/></linearGradient>
    <linearGradient id="edge"><stop stop-color="#368383"/><stop offset=".5" stop-color="#143440"/><stop offset="1" stop-color="#84efdb"/></linearGradient>
    </defs><g fill="none" stroke="#67e6ca" opacity=".25"><ellipse cx="125" cy="183" rx="99" ry="31"/><path d="M125 10v195 M12 143l215 57 M15 200l212-63" stroke-dasharray="3 5"/></g><g class="lens-stack">${layers}</g></svg>`;
}
function hero(){return `<section class="hero launch"><div class="heroart">${artwork()}</div><div class="heroContent">
  <div class="eyebrow"><span class="tinyline"></span>REPOSITORY INTELLIGENCE</div><h1>Understand the repo.<br><span>Know where to start.</span></h1>
  <p>Explore the files, follow the commits, and review the code behind any public GitHub repository.</p>
  <form id="analyze"><label class="urlfield">${ic('github',19)}<input id="repo" type="text" aria-label="Public GitHub repository URL" placeholder="https://github.com/owner/repository" required maxlength="300" value="${h(query)}"></label><button class="primary" ${busy?'disabled':''}>${ic('scan',17)}${busy?'Analyzing…':'Analyze'}</button></form>
  <div class="samples"><span>Try a repo</span>${['pallets/flask','deepgotnochill-cmd/cpp-practice'].map(n=>`<button data-sample="${n}" ${busy?'disabled':''}>${n}</button>`).join('')}</div></div></section><nav class="journeys" aria-label="Explore this report"><button data-view="activity">${ic('activity')}<b>Trace activity</b><small>See when the code changed</small></button><button data-view="folder">${ic('folder')}<b>Explore files</b><small>Map folders and inspect tooling</small></button><button data-view="insight">${ic('insight')}<b>Plan improvements</b><small>Prepare a source-based review</small></button></nav>`}
function head(){return report?`<div class="repohead"><div><div class="repoTitle"><span class="repoicon">${ic('github',21)}</span><h2>${h(report.full_name.split('/')[0])}<i> / </i><strong>${h(report.full_name.split('/')[1])}</strong></h2><span class="badge">Public</span></div><p>${h(report.description)}</p><div class="revision">${ic('branch',14)}<span>${h(report.default_branch)}</span>${report.head ? `<a href="${h(report.url)}/commit/${h(report.head)}" target="_blank" rel="noreferrer" aria-label="View analyzed commit ${h(report.head)}">${h(report.head.slice(0,7))} ${ic('link',12)}</a>` : ''}</div></div><div class="stamp"><span class="badge source">${ic('time',13)} ${featured?'Saved snapshot':'Analyzed'}</span><small>${date(report.analyzed_at)} UTC</small></div></div>`:''}
function stats(r:Report){return `<div class="stats">${[['star','Stars',r.stars,'gold'],['branch','Forks',r.forks,'purple'],['issue','Open items',r.open_items,'green'],['eye','Watchers',r.watchers,'blue']].map(([key,label,val,color])=>`<article class="stat"><div><span class="metricicon ${color}">${ic(String(key),17)}</span><span>${label}</span></div><b title="${Number(val).toLocaleString()}">${compact(Number(val))}</b></article>`).join('')}</div>`}
function activity(r:Report){
 const data=buckets(r.commits,new Date(r.analyzed_at),days),max=Math.max(1,...data.map(d=>d.count)),x=(i:number)=>36+i*458/(data.length-1),y=(n:number)=>115-90*n/max;
 const pts=data.map((d,i)=>`${x(i)},${y(d.count)}`).join(' ');
 return `<section class="panel chartpanel"><div class="panelhead"><h3>${ic('activity')} Commit activity</h3><div class="period" role="group" aria-label="Activity period">${[7,14,30].map(n=>`<button data-days="${n}" aria-pressed="${n===days}">${n}D</button>`).join('')}</div></div><p>Sampled commits by day · UTC</p><svg viewBox="0 0 510 146" class="chart" role="group" aria-label="Daily commit counts from the retrieved sample"><defs><linearGradient id="area" x2="0" y2="1"><stop stop-color="#65ddc9" stop-opacity=".34"/><stop offset="1" stop-color="#65ddc9" stop-opacity=".015"/></linearGradient></defs>${[...new Set([0,Math.round(max/2),max])].map(n=>`<path d="M36 ${y(n)}H494" stroke="#33343d" stroke-dasharray="3 5"/><text x="12" y="${y(n)+3}">${n}</text>`).join('')}<polygon points="36,115 ${pts} 494,115" fill="url(#area)"/><polyline points="${pts}" fill="none" stroke="#71e7cd" stroke-width="2.7" stroke-linejoin="round"/>${data.map((d,i)=>`<g class="sample-point" tabindex="0" role="img" aria-label="${d.date}, ${d.count} sampled commits"><rect x="${x(i)-7}" y="16" width="14" height="103" fill="transparent"/><g class="sample-tip" pointer-events="none"><line x1="${x(i)}" x2="${x(i)}" y1="22" y2="115" stroke="#89dfce" stroke-dasharray="3 4"/><circle cx="${x(i)}" cy="${y(d.count)}" r="4" fill="#adffed"/><rect x="${Math.min(384,Math.max(8,x(i)-54))}" y="0" width="116" height="20" rx="5" fill="#213c3d"/><text x="${Math.min(384,Math.max(8,x(i)-54))+58}" y="14" text-anchor="middle">${d.date.slice(5)} · ${d.count} commits</text></g></g>`).join('')}${[0,Math.floor((days-1)/2),days-1].map((i,j)=>`<text x="${x(i)}" text-anchor="${['start','middle','end'][j]}" y="139">${date(data[i].date).split(',')[0]}</text>`).join('')}</svg><small class="legend"><i></i>Commits in retrieved history</small></section>`;
}
function languages(r:Report){
 const entries=Object.entries(r.languages).sort((a,b)=>b[1]-a[1]),total=entries.reduce((a,e)=>a+e[1],0);
 if(!total)return '<section class="panel"><h3>Languages</h3><p>No language bytes reported by GitHub.</p></section>';
 const rows=entries.slice(0,3);if(entries.length>3)rows.push(['Other',entries.slice(3).reduce((a,e)=>a+e[1],0)]);
 let sum=0;const gradient=rows.map(([,n],i)=>{const start=sum;sum+=100*n/total;return `${colors[i]} ${start}% ${sum}%`}).join(',');
 return `<section class="panel"><div class="panelhead"><h3>${ic('code')} Languages</h3></div><p>Share of repository code by bytes</p><div class="langbody"><div class="donut" style="background:conic-gradient(${gradient})"><div><b>${entries.length}</b><small>languages</small></div></div><div class="langkey">${rows.map(([k,n],i)=>`<div title="${n.toLocaleString()} bytes"><i style="background:${colors[i]}"></i><span>${h(k)}</span><b>${(100*n/total).toFixed(1)}%</b></div>`).join('')}</div></div></section>`;
}
const srcLink=(r:Report,path:string,type='blob')=>h(r.url+'/'+type+'/'+r.head+'/'+path.split('/').map(encodeURIComponent).join('/'));
function commitList(r:Report,limit:number){return `<section class="panel list"><div class="panelhead"><h3>${ic('branch')} Recent commits</h3>${limit===4?'<button data-view="activity" class="textbtn">View activity</button>':''}</div>${r.commits.slice(0,limit).map(c=>`<div class="row"><a class="hash" href="${h(r.url)}/commit/${h(c.sha)}" target="_blank" rel="noreferrer">${h(c.sha.slice(0,7))}</a><span>${h(c.message)}</span><small>${date(c.date)}</small></div>`).join('')||'<p>No commits in this repository.</p>'}</section>`}
function evidence(r:Report){return `<section class="panel"><h3>${ic('insight')} Maintenance signals</h3><p>Evidence from the inspected revision</p>${signals(r).map(s=>`<div class="signal"><span>${h(s.name)}</span><small class="${s.path?'found':''}">${s.path?'Detected':s.uncertain?'Partial tree':'No match'}</small></div>`).join('')}</section>`}
function projectMap(r:Report){
 const prefix=dir?dir+'/':'';
 const counts=new Map<string,number>();
 for(const f of r.files){
   if(!f.path.startsWith(prefix))continue;
   const relative=f.path.slice(prefix.length), split=relative.indexOf('/');
   if(split<0 && f.type==='tree' && !counts.has(relative))counts.set(relative,0);
   if(split<0 || f.type!=='blob')continue;
   const child=relative.slice(0,split);
   counts.set(child,(counts.get(child)||0)+1);
 }
 const folders=[...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
 const maximum=folders[0]?.[1]||1;
 const parent=dir.split('/').slice(0,-1).join('/');
 return `<section class="panel mapPanel"><div class="panelhead"><h3>${ic('folder')} Project map</h3>
   ${dir?`<button class="textbtn" data-dir="${h(parent)}">Parent folder</button>`:''}</div>
   <p>${h(dir||r.full_name)} · ${folders.length} immediate folders. Bars count indexed files beneath each folder.</p>
   ${r.truncated?'<p class="mapNote">Partial tree. Counts cover only the paths returned by GitHub.</p>':''}
   <div class="mapGrid">${folders.slice(0,12).map(([name,n])=>{
     const path=prefix+name;
     const inner=`<b>${ic('folder',15)} ${h(name)}</b><small>${n} indexed ${n===1?'file':'files'}</small><span class="mapTrack"><i style="width:${100*n/maximum}%"></i></span>`;
     return n?`<button class="mapTile" data-dir="${h(path)}">${inner}</button>`:`<a class="mapTile" href="${srcLink(r,path,'tree')}" target="_blank" rel="noreferrer">${inner}</a>`;
   }).join('')}</div>${!folders.length?'<p>No child folders in this listing.</p>':folders.length>12?'<p>Showing the 12 largest folders. All returned paths are searchable below.</p>':''}</section>`;
}
function tooling(r:Report){
 const rules:[string,RegExp][]=[
   ['Next.js',/^next\.config\.(ts|mjs|js|cjs)$/i],['TypeScript',/^tsconfig(?:\..+)?\.json$/i],
   ['Docker Compose',/^(?:docker-)?compose\.ya?ml$/i],['Docker',/^(?:Dockerfile(?:\..+)?|.+\.Dockerfile)$/i],
   ['Node.js packages',/^package\.json$/i],['Python packaging',/^(?:pyproject\.toml|requirements\.txt|Pipfile)$/i],
   ['Rust packages',/^Cargo\.toml$/],['Go modules',/^go\.mod$/],['Prisma',/^schema\.prisma$/i],
   ['GitHub Actions',/^\.github\/workflows\/[^/]+\.ya?ml$/]
 ];
 const blobs=r.files.filter(f=>f.type==='blob').sort((a,b)=>a.path.length-b.path.length||a.path.localeCompare(b.path));
 return rules.flatMap(([name,pattern])=>{
   const hit=blobs.find(f=>pattern.test(f.path.split('/').pop()!)||pattern.test(f.path));
   return hit?[{name,path:hit.path}]:[];
 });
}
function toolPanel(r:Report){
 const hits=tooling(r);
 return `<section class="panel"><h3>${ic('terminal')} Tooling evidence</h3><p>Configuration files found in the indexed revision.</p>
   ${hits.map(t=>`<div class="signal"><b>${h(t.name)}</b><a href="${srcLink(r,t.path)}" target="_blank" rel="noreferrer">${h(t.path)}</a></div>`).join('')||'<p>No recognized configuration files in the sample.</p>'}</section>`;
}
function explorer(r:Report){
 const prefix=dir?dir+'/':'',needle=fileSearch.toLowerCase();
 const files=r.files.filter(f=>needle?f.path.toLowerCase().includes(needle):f.path.startsWith(prefix)&&!f.path.slice(prefix.length).includes('/')).sort((a,b)=>Number(b.type==='tree')-Number(a.type==='tree')||a.path.localeCompare(b.path));
 return `<section class="panel"><div class="panelhead"><h3>${ic('folder')} File explorer</h3><span class="badge">${h(r.default_branch)}</span></div><p>${r.truncated?'Partial file listing':'Indexed file tree'} · ${h(r.head.slice(0,7))}</p><input id="filter" placeholder="Filter paths…" aria-label="Filter file paths" value="${h(fileSearch)}"><div class="crumb"><button data-dir="">Repository root</button> / ${h(dir)}</div><div id="files">${files.slice(0,200).map(f=>`<div class="row">${ic(f.type==='tree'?'folder':'file',16)}${f.type==='tree' && r.files.some(e=>e.path.startsWith(f.path+'/'))?`<button class="plain" data-dir="${h(f.path)}">${h(f.path)}</button>`:`<a href="${srcLink(r,f.path,f.type==='tree'?'tree':'blob')}" target="_blank" rel="noreferrer">${h(f.path)}</a>`}</div>`).join('')||'<p>No matching paths.</p>'}${files.length>200?'<p>Showing the first 200 matches. Refine your filter.</p>':''}</div></section>`;
}
function docs(r:Report){const files=r.files.filter(f=>f.type==='blob'&&/(^|\/)(readme|contributing|changelog|license)|^docs\//i.test(f.path));return `<section class="panel"><h3>${ic('book')} Documentation</h3><p>Documentation and guides found in the sampled tree.</p>${files.slice(0,160).map(f=>`<div class="row">${ic('file',16)}<a href="${srcLink(r,f.path)}" target="_blank" rel="noreferrer">${h(f.path)}</a></div>`).join('')||'<p>No matching documents in the sample.</p>'}</section>`}
function brief(r:Report){
  const observations=signals(r).map(s=>s.name+' — '+(s.path || (s.uncertain?'unknown in partial tree':'no matching path')));
  return ['Review '+r.url+' at revision '+(r.head||'(empty repository)')+'.',
    'Sample: '+r.commits.length+' commits and '+r.files.length+' paths. Tree coverage: '+(r.truncated?'partial':'complete returned tree')+'.',
    ...observations,
    'Inspect the source before proposing up to three improvements. For each, cite the exact file and lines, explain the impact, suggest a minimal edit and give a verification step. State what you could not verify.'
  ].join('\n');
}
function recommendations(r:Report){return `<section class="panel"><h3>${ic('insight')} Evidence-backed recommendations</h3><details class="brief"><summary>Prepare an AI review prompt</summary><button class="textbtn" data-export-review>Download review as Markdown</button><p>Copy this prompt into your AI tool with repository access.</p><textarea readonly aria-label="Repository review prompt">${h(brief(r))}</textarea></details><p>File-presence checks at revision ${h(r.head.slice(0,7))}. Open each source to review its contents.</p>${signals(r).map(s=>`<article class="rec"><b>${h(s.name)}</b><p>${s.path?`Detected in <a href="${srcLink(r,s.path)}" target="_blank" rel="noreferrer">${h(s.path)}</a>.`:s.uncertain?'Coverage is partial. Inspect the full tree before drawing a conclusion.':`No matching path in the indexed tree. ${h(s.action)}`}</p></article>`).join('')}<a href="${srcLink(r,'','tree')}" target="_blank" rel="noreferrer">Inspect revision on GitHub</a></section>`}
const reviewPrompts = [
 ['Explain this file', 'What does this file do, and which lines show its main responsibility?'],
 ['Trace the inputs', 'How does this file handle inputs and errors? Cite the relevant lines.'],
 ['Suggest a test', 'Suggest a test for a behavior visible in this file. Cite the lines that justify it.']
];
function ai(r:Report){const files=r.files.filter(f=>f.type==='blob'&&f.size>0&&f.size<=60000&&/\.(py|tsx?|jsx?|md|go|rs|cpp|c|h|css|java|rb|toml|ya?ml|json|sh|kt)$/i.test(f.path));
 if(!selected)selected=files[0]?.path||'';
 return `<section class="panel"><h3>${ic('spark')} Code explainer</h3><p>Ask about a file and trace the explanation to lines from its analyzed revision.</p><form id="explain"><label>Source file<select id="source">${files.map(f=>`<option ${f.path===selected?'selected':''}>${h(f.path)}</option>`).join('')}</select></label><div class="promptChoices" role="group" aria-label="Suggested questions">${reviewPrompts.map(([label],i)=>`<button type="button" data-prompt="${i}">${h(label)}</button>`).join('')}</div><label>Your question<textarea id="question" maxlength="1200" minlength="3" required placeholder="What does this file do?">${h(question)}</textarea></label><button class="primary" ${!explainApi||!files.length||aiBusy?'disabled':''}>${ic('spark')} ${aiBusy?'Retrieving evidence…':'Explain code'}</button></form>${!explainApi?'<div class="notice">Line-cited AI reviews run in the private review workspace. Open Recommendations to prepare a review prompt for this repository.</div>':''}<div aria-live="polite">${answer}</div></section>`}
function developer(){return `<section class="developer panel"><img src="./deep.jpg" alt="Deep Datta Chaudhury, developer of DevLens AI"><div><div class="eyebrow">MEET THE DEVELOPER</div><h1>Deep Datta Chaudhury</h1><p>I built DevLens AI for that first visit to an unfamiliar repository. I wanted to see where the work happens, follow a change back to its commit, and check a code explanation against the lines it describes.</p><div class="devskills"><span>TypeScript</span><span>Python</span><span>pgvector</span></div><a class="primary" href="https://github.com/deepgotnochill-cmd" target="_blank" rel="noreferrer">${ic('github')} GitHub profile</a></div></section>`}
function render(){
 const r=report,title=nav.find(n=>n[0]===view)![1];
 const body=view==='person'?developer():!r?'':view==='overview'?`${head()}${stats(r)}<div class="charts">${activity(r)}${languages(r)}</div><div class="lower">${commitList(r,4)}${evidence(r)}</div>`:`${head()}${view==='activity'?activity(r)+commitList(r,100):view==='folder'?projectMap(r)+toolPanel(r)+explorer(r):view==='book'?docs(r):view==='spark'?ai(r):recommendations(r)}`;
 root.innerHTML=`${sidebar()}<button class="scrim" aria-label="Close navigation" data-dismiss></button><div class="shell"><header><button id="toggle" aria-controls="side" aria-expanded="${document.body.classList.contains('menuopen')}" aria-label="Toggle navigation">${ic('menu')}</button><span class="breadcrumb">Workspace <i>/</i> <b>${h(title)}</b></span><button class="topbrand" data-search>${ic('scan',15)} Analyze repository <kbd>/</kbd></button></header><div class="content">${view==='overview'?hero():view==='person'?'':`<div class="eyebrow">REPOSITORY WORKSPACE</div><h1 class="pageh">${h(title)}</h1>`}${error?`<div class="notice" role="alert">${h(error)}</div>`:''}${body||(!error?'<div class="notice" role="status">Loading repository evidence…</div>':'')}${r&&view!=='person'?`<details class="scope"><summary>Analysis scope & sources</summary><p>${r.commits.length} sampled commits · ${r.files.length} indexed paths · ${r.truncated?'partial tree':'complete returned tree'}. Open items include issues and pull requests.</p>${(r.notes||[]).map(n=>`<p>${h(n)}</p>`).join('')}<a href="${h(r.url)}" target="_blank" rel="noreferrer">View repository on GitHub</a></details>`:''}<footer>DevLens AI <span>Made by <button data-view="person">Deep Datta Chaudhury</button></span></footer></div></div>`;
}
function closeMenu(){
 document.body.classList.remove('menuopen');
 const toggle=root.querySelector<HTMLElement>('#toggle');
 toggle?.setAttribute('aria-expanded','false');
 toggle?.focus();
}
function navigate(next:string){
 if(!nav.some(([id])=>id===next))return;
 view=next;
 document.body.classList.remove('menuopen');
 if(location.hash!=='#'+next)location.hash=next;
 render();
 const heading=root.querySelector<HTMLElement>('h1');
 heading?.setAttribute('tabindex','-1');
 heading?.focus({preventScroll:true});
 window.scrollTo(0,0);
}
function focusSearch(){
 if(view!=='overview')navigate('overview');
 document.body.classList.remove('menuopen');
 root.querySelector<HTMLInputElement>('#repo')?.focus();
}
function readLocation(){
 const hash=location.hash.slice(1);
 const next=nav.some(([id])=>id===hash)?hash:'overview';
 if(view!==next){view=next;document.body.classList.remove('menuopen');render()}
}
window.addEventListener('hashchange',readLocation);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape' && document.body.classList.contains('menuopen')){closeMenu();return}
 if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target as Element)?.closest('input,textarea,select,[contenteditable=true]')){
   event.preventDefault();focusSearch();
 }
});
root.addEventListener('click',e=>{const t=(e.target as Element).closest<HTMLElement>('button');if(!t)return;
 if(t.id==='toggle'){t.setAttribute('aria-expanded',String(document.body.classList.toggle('menuopen')));return}
 if(t.hasAttribute('data-export-review') && report){
   const evidence=tooling(report).map(f=>f.name+' — '+srcLink(report!,f.path).replaceAll('&amp;','&'));
   const text='# Repository review: '+report.full_name+'\\n\\n'+brief(report)+'\\n\\n## Tooling evidence\\n\\n'+(evidence.join('\\n')||'No recognized tooling files in this sample.')+'\\n';
   const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
   const link=document.createElement('a');
   link.href=url;link.download=report.full_name.replace('/','-')+'-review.md';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);return;
 }
 if(t.hasAttribute('data-dismiss')){closeMenu();return}
 if(t.hasAttribute('data-search')){focusSearch();return}
 if(t.dataset.prompt!==undefined){
   const prompt=reviewPrompts[Number(t.dataset.prompt)];
   const field=root.querySelector<HTMLTextAreaElement>('#question');
   if(prompt && field){question=prompt[1];field.value=question;field.focus()}
   return;
 }
 if(t.dataset.sample){query='https://github.com/'+t.dataset.sample;const input=root.querySelector<HTMLInputElement>('#repo')!;input.value=query;input.form?.requestSubmit();return}
 if(t.dataset.days){days=Number(t.dataset.days);render();root.querySelector<HTMLElement>(`[data-days="${days}"]`)?.focus({preventScroll:true});return}
 if(t.dataset.view)navigate(t.dataset.view);
 if(t.dataset.dir!==undefined){dir=t.dataset.dir;fileSearch='';render()}
});
root.addEventListener('input',e=>{const t=e.target as HTMLInputElement;if(t.id==='repo')query=t.value;if(t.id==='question')question=t.value;if(t.id==='filter'){fileSearch=t.value;if(report){const template=document.createElement('template');template.innerHTML=explorer(report);const rows=template.content.querySelector('#files');if(rows)root.querySelector('#files')?.replaceChildren(...Array.from(rows.childNodes))}}});
root.addEventListener('change',e=>{const t=e.target as HTMLSelectElement;if(t.id==='days'){days=Number(t.value);render()}if(t.id==='source'){selected=t.value;answer='';aiToken++;aiBusy=false;render()}});
let sequence=0;
root.addEventListener('submit',async e=>{
 e.preventDefault();const id=(e.target as HTMLFormElement).id;
 if(id==='analyze'&&!busy){const seq=++sequence;busy=true;error='';render();try{const next=await loadRepo(query.trim(),api);if(seq===sequence){report=next;featured=false;dir='';fileSearch='';selected='';answer='';aiToken++;aiBusy=false}}catch(err){error=(err as Error).message+(report?' The previous report is still displayed.':'')}finally{busy=false;render()}}
 if(id==='explain'&&report&&explainApi&&!aiBusy){const token=++aiToken;aiBusy=true;answer='';render();try{const v=await request(explainApi+'/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:report.url,revision:report.head,path:selected,question})});if(token===aiToken)answer=`<article class="rec"><h3>Explanation</h3><p class="answer">${h(v.answer)}</p>${v.sources.map((s:{start:number,end:number,excerpt:string,path:string})=>`<details class="citation"><summary>${h(s.path)} · lines ${s.start}–${s.end}</summary><pre>${h(s.excerpt)}</pre><a href="${srcLink(report!,s.path)}#L${Number(s.start)}-L${Number(s.end)}" target="_blank" rel="noreferrer">View cited lines on GitHub ${ic('link',13)}</a></details>`).join('')}</article>`}catch(err){if(token===aiToken)answer=`<p role="alert" class="notice">${h((err as Error).message)}</p>`}finally{if(token===aiToken)aiBusy=false;render()}}
});
readLocation();
render();
request('./featured.json').then(r=>{if(sequence===0){report=r;render()}}).catch(()=>{if(sequence===0){error='Enter a repository URL to begin.';render()}});

