(function(){
'use strict';
let dataset=null;
const selected=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=s=>{let n=String(s||'').normalize('NFKC').trim();let old;do{old=n;n=n.replace(/\([^()]*\)/g,'');}while(old!==n);if(/[()]/.test(n))return '';const zh=n.match(/\p{Script=Han}/gu);return zh?zh.join(''):n.replace(/\s/g,'').toLowerCase();};
const chapterKey=s=>{const k=String(s||'華都更').normalize('NFKC').replace(/^BNI\s*/i,'').replace(/\s/g,'').replace(/分會$/,'').toLowerCase();return {'華都更huaurban+':'華都更','華地產huarealestate':'華地產'}[k]||k;};
const lookupKey=(name,chapter)=>JSON.stringify([key(name),chapterKey(chapter)]);
async function load(name,chapter='華都更'){
  if(name && chapterKey(chapter)!=='華都更'){
    const id=lookupKey(name,chapter);
    if(!selected.has(id)){
      if(location.protocol==='file:')throw Error('外分會培訓查詢請使用公開測試版');
      const r=await fetch('/api/training?'+new URLSearchParams({name,chapter}),{cache:'no-store'});
      if(!r.ok)throw Error('培訓來源暫時無法查詢');
      selected.set(id,await r.json());
    }
    return selected.get(id);
  }
  if(!dataset){const r=await fetch('./training.json',{cache:'no-store'});if(!r.ok)throw Error('無法讀取培訓紀錄');dataset=await r.json();}return dataset;
}
function dataFor(name,chapter){return chapterKey(chapter)==='華都更'?dataset:selected.get(lookupKey(name,chapter));}
function recordsFor(name,chapter='華都更'){return(dataFor(name,chapter)?.records||[]).filter(r=>key(r.name)===key(name)&&chapterKey(r.chapter)===chapterKey(chapter)).sort((a,b)=>String(b.sessionDate||b.registeredAt||'').localeCompare(String(a.sessionDate||a.registeredAt||'')));}
function renderFor(name,chapter='華都更'){
 const data=dataFor(name,chapter),rows=recordsFor(name,chapter);return `<section class="training-real"><h2>教育培訓紀錄</h2><p>${esc(chapter)} · 來源更新：${esc(data?.sourceUpdatedAt||'未提供')} · ${rows.length} 筆報名紀錄</p>${rows.length?`<details><summary><span>查看 ${esc(name)} 的完整培訓紀錄</span><span class="training-toggle" aria-hidden="true"></span></summary><ul>${rows.map(r=>`<li><b>${esc(r.course)}</b> · ${esc(r.sessionDate||r.sessionLabel||'場次未標示')}<br><small>${esc(r.trainingType)} · ${esc(r.mode)} · 報名日 ${esc(r.registeredAt||'未提供')}</small></li>`).join('')}</ul></details>`:'<p>培訓來源中目前查無此姓名與分會的報名紀錄。</p>'}<p>${chapterKey(chapter)==='華都更'?'<a href="./training.html">查詢華都更完整資料</a> · ':''}<a href="https://bni-train.autolab.cloud/explorer/" target="_blank" rel="noopener">開啟原始培訓查詢</a></p></section>`;
}
window.HuaTraining={load,recordsFor,renderFor,nameKey:key};
})();
