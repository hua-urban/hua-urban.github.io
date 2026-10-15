(function(){
'use strict';
let dataset=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=s=>{const n=String(s||'').replace(/\s/g,'');const zh=n.match(/^[\u3400-\u9fff]+/)?.[0];return zh?zh.slice(0,['張簡','歐陽','司馬','諸葛','上官','東方','皇甫','范姜','司徒','夏侯'].some(x=>zh.startsWith(x))?4:3):n.toLowerCase();};
async function load(){if(!dataset){const r=await fetch('./training.json',{cache:'no-store'});if(!r.ok)throw Error('無法讀取培訓紀錄');dataset=await r.json();}return dataset;}
function recordsFor(name){return(dataset?.records||[]).filter(r=>key(r.name)===key(name)).sort((a,b)=>(b.sessionDate||b.registeredAt).localeCompare(a.sessionDate||a.registeredAt));}
function renderFor(name){const rows=recordsFor(name);return `<section class="training-real"><h2>教育培訓紀錄</h2><p>來源更新：${esc(dataset?.sourceUpdatedAt||'')} · ${rows.length} 筆實際報名紀錄</p><p>教育分數採本期 PALMS 已入帳 CEU。以下是報名查詢資料，出席與 CEU 認列以正式紀錄為準。</p>${rows.length?`<details><summary>查看 ${esc(name)} 的完整培訓紀錄</summary><ul>${rows.map(r=>`<li><b>${esc(r.course)}</b> · ${esc(r.sessionDate||r.sessionLabel||'場次未標示')}<br><small>${esc(r.trainingType)} · ${esc(r.mode)} · 報名日 ${esc(r.registeredAt||'未提供')}</small></li>`).join('')}</ul></details>`:'<p>來源中目前查無這位會員的報名紀錄。</p>'}<p><a href="./training.html">查詢華都更完整資料</a> · <a href="${esc(dataset?.source||'https://bni-train.autolab.cloud/explorer/')}" target="_blank" rel="noopener">開啟原始培訓查詢</a></p></section>`;}
window.HuaTraining={load,recordsFor,renderFor,nameKey:key};
})();
