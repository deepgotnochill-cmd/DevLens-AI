                                                                    
                                                           
                                                                                                                                                                                                                                                                                                                                                 
export function slug(input       ){
  const m=/^https:\/\/github\.com\/([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d_.-]{1,104})\/?$/i.exec(input.trim());
  const repo=m?.[2].replace(/\.git$/,'');
  if(!repo || repo==='.' || repo==='..'||repo.length>100)throw Error('Enter a public URL such as https://github.com/pallets/flask.');
  return m [1]+'/'+repo;
}
export async function request(url       , init            ={}){
  const r=await fetch(url,{...init,signal:AbortSignal.timeout(45000)});
  if(!r.ok){
    const body=await r.json().catch(()=>({}));
    const detail=typeof body.detail==='string'?body.detail:undefined;
    throw Object.assign(Error(detail || ({403:'GitHub rate limit or access restriction. Try again later.',404:'Repository unavailable. Check that the URL points to a public repository.',429:'Request limit reached. Try again later.'}                         )[r.status] || 'The service could not complete this request.'),{status:r.status});
  }
  return r.json();
}
                                                                            
const cache=new Map                                     ();
export async function loadRepo(url       ,api       )                {
  const name=slug(url), key=name.toLowerCase(), cached=cache.get(key);
  if(cached && cached.expires>Date.now()) return cached.data;
  let data       ;
  if(api){
    data=await request(api+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
  }else{
    const root='https://api.github.com/repos/'+name;
    const meta=await request(root);
    if(meta.private!==false)throw Error('Only public repositories are supported.');
    const commits            =await request(root+'/commits?per_page=100&sha='+encodeURIComponent(meta.default_branch)).catch(e=>{if(e.status===409)return [];throw e});
    const head=commits[0]?.sha||'';
    const [languages,tree]=await Promise.all([request(root+'/languages'),head?request(root+'/git/trees/'+head+'?recursive=1'):{tree:[],truncated:false}]);
    data={full_name:meta.full_name,url:meta.html_url,description:meta.description||'',stars:meta.stargazers_count,forks:meta.forks_count,open_items:meta.open_issues_count,watchers:meta.subscribers_count,default_branch:meta.default_branch,license:meta.license?.spdx_id||null,archived:meta.archived,pushed_at:meta.pushed_at,analyzed_at:new Date().toISOString(),languages,head,files:tree.tree.slice(0,5000),truncated:tree.truncated||tree.tree.length>5000,commits:commits.map(c=>({sha:c.sha,date:c.commit.committer.date,message:c.commit.message.split('\n')[0]}))};
  }
  if(cache.size>=8)cache.delete(cache.keys().next().value );
  cache.set(key,{data,expires:Date.now()+300000});return data;
}
export function buckets(commits         ,end     ,days       ){
  const day=86400000, last=Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()), first=last-(days-1)*day;
  const bins=Array.from({length:days},(_,i)=>({date:new Date(first+day*i).toISOString().slice(0,10),count:0}));
  for(const c of commits){const i=Math.floor((Date.parse(c.date)-first)/day);if(i>=0 && i<days)bins[i].count++}
  return bins;
}
export function signals(r       ){
  const paths=r.files.filter(f=>f.type==='blob').map(f=>f.path);
  return [
    {name:'Project README',pattern:/^(?:\.github\/|docs\/)?readme(?:\.[^/]+)?$/i,action:'Add a README describing installation and first use.'},
    {name:'Contributor guide',pattern:/(^|\/)contributing(?:\.[^/]+)?$/i,action:'Document the steps to submit and test a contribution.'},
    {name:'CI workflows',pattern:/^\.github\/workflows\/[^/]+\.ya?ml$/i,action:'Consider running your checks in a GitHub Actions workflow.'},
    {name:'Test files',pattern:/(^|\/)(tests?|__tests__)(\/|\.)|[._](test|spec)\./i,action:'Add tests for the repository’s main entry points.'},
  ].map(s=>({...s,path:paths.find(p=>s.pattern.test(p)),uncertain:r.truncated}));
}
export const safe=(v        )=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ));

