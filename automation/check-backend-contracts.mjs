import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const ignored=p=>/(^|\/)(node_modules|\.git|evidence|fixtures|_backend-guard)(\/|$)/.test(p)||/\.(md|txt|lock)$/.test(p)||/(^|\/)package-lock\.json$/.test(p)||p.endsWith('automation/backend-contracts.json');
export function violations(text,p,registry){return ignored(p)?[]:registry.services.flatMap(s=>s.retired.filter(v=>text.includes(v)).map(()=>({service:s.id,path:p,reason:'retired-backend-reference'})));}
async function readJson(url,token){let err;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();}catch(e){err=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));}}throw err;}
export async function audit({root,registry,live=true,github=false,token,fetchJson=readJson,environment=process.env}){
 const result={checkedAt:new Date().toISOString(),files:0,repositories:[],checks:[],violations:[],errors:[],limits:['Secrets 原值不提供讀回；本檢查不代表隱藏值已逐字核對。','Google Apps Script 與雲端環境不在 GitHub 原始碼掃描內，須執行專用雲端核對。']};
 async function local(dir,prefix=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.posix.join(prefix,e.name);if(ignored(p))continue;if(e.isDirectory())await local(path.join(dir,e.name),p);else if(e.isFile()){const b=await fs.readFile(path.join(dir,e.name));if(b.includes(0))continue;result.files++;result.violations.push(...violations(b.toString(),p,registry));}}}
 for(const [key,value] of Object.entries(environment))result.violations.push(...violations(String(value),`environment/${key}`,registry));
 if(root)await local(root);
 if(github){if(!token)result.errors.push({scope:'github',reason:'missing-read-token'});else for(const repo of registry.repositories){try{const meta=await fetchJson(`https://api.github.com/repos/${repo}`,token);if(!meta.size)continue;const tree=await fetchJson(`https://api.github.com/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`,token);if(tree.truncated)throw Error('truncated tree');const files=tree.tree.filter(x=>x.type==='blob'&&!ignored(x.path)&&x.size<1000000);let i=0;await Promise.all(Array.from({length:4},async()=>{while(i<files.length){const f=files[i++];const b=await fetchJson(`https://api.github.com/repos/${repo}/git/blobs/${f.sha}`,token);const text=Buffer.from(b.content,'base64');if(text.includes(0))continue;result.files++;result.violations.push(...violations(text.toString(),`${repo}/${f.path}`,registry));}}));
 const vars=await fetchJson(`https://api.github.com/repos/${repo}/actions/variables`,token);for(const v of vars.variables||[])result.violations.push(...violations(String(v.value),`${repo}/repository-variable/${v.name}`,registry));result.repositories.push(repo);
 }catch(e){result.errors.push({scope:repo,reason:String(e.message)});}}}
 if(live)for(const s of registry.services){try{const [baseline,backend]=await Promise.all([fetchJson(s.baseline),fetchJson(s.current+'?names=1')]);if(baseline.ok!==true||!Array.isArray(baseline.members)||!baseline.members.length||backend.ok!==true||!Array.isArray(backend.names))throw Error('invalid roster response');if(backend.names.length!==baseline.members.length)throw Error('member-count-mismatch');const norm=x=>String(x).replace(/[^\u4e00-\u9fff]/g,'');const names=backend.names.map(norm);for(const m of baseline.members){const n=norm(m.name);if(!names.some(x=>x===n||x.startsWith(n)||n.startsWith(x)))throw Error('member-name-mismatch');}
 const response=await fetch(s.frontend,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`frontend HTTP ${response.status}`);const html=await response.text();result.violations.push(...violations(html,'live/'+s.id,registry));if(!html.includes(s.current))throw Error('frontend-not-using-current-backend');result.checks.push({service:s.id,status:'ok',members:backend.names.length});
 }catch(e){result.errors.push({scope:s.id,reason:e.message});}}
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=(name,fallback)=>{let i=args.indexOf(name);return i<0?fallback:args[i+1];};
 const registry=args.includes('--registry-url')?await readJson(value('--registry-url')):JSON.parse(await fs.readFile(value('--registry',path.join(here,'backend-contracts.json')),'utf8'));
 const result=await audit({root:args.includes('--github-all')?null:value('--root',process.cwd()),registry,live:!args.includes('--source-only'),github:args.includes('--github-all'),token:process.env.BACKEND_AUDIT_TOKEN});
 await fs.writeFile(value('--report','backend-audit-report.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({files:result.files,repositories:result.repositories.length,checks:result.checks,violations:result.violations,errors:result.errors},null,2));
 if(result.violations.length||result.errors.length)process.exitCode=1;
}
