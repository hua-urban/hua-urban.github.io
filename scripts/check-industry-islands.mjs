import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('industry-islands');
const topics={};
for(const group of ['d','e']){
 const dir=path.join(base,group);
 const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(dir,'data.js'),'utf8')).toString('base64'));
 topics[group]=new Set(mod.topics.map(t=>t.id));
 if(topics[group].size!==8)throw Error(group+': expected 8 distinct topics');
 for(const t of mod.topics)for(const [id] of t.partners)if(!topics[group].has(id))throw Error('Invalid partner '+id);
 for(const s of mod.scenarios)for(const [id] of s.steps)if(!topics[group].has(id))throw Error('Invalid scenario topic '+id);
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^(https?:|data:|\/)/.test(ref))continue;
  if(!fs.existsSync(path.resolve(dir,ref.split('?')[0])))throw Error('Missing asset '+ref);
 }
 const scene=fs.readFileSync(path.join(dir,'scene.js'),'utf8');
 if(!scene.includes('../lib/OrbitControls.js'))throw Error('Shared controls path missing');
 console.log(group+': topics, partners, scenarios and assets OK');
}
for(const [d,e] of [['energy','industry'],['leasing','land'],['digital','ai']])if(!topics.d.has(d)||!topics.e.has(e))throw Error('Invalid cross-group route');
for(const file of ['index.html','cross-group.js','cross-group.css','lib/three.module.js','lib/three.core.js','lib/THREE-LICENSE.txt'])if(!fs.existsSync(path.join(base,file)))throw Error('Missing '+file);
console.log('All island structure checks passed.');
