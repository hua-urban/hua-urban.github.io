import {sites,routes} from './groups.js?v=fullnames1';
const group=document.body.dataset.group;
const activeGroups=Object.keys(sites).map(g=>String.fromCharCode(g.toUpperCase().charCodeAt(0)+0xFEE0)).join('・');
const futureGroups=['a','b','c','d','e'].filter(g=>!sites[g]).map(g=>String.fromCharCode(g.toUpperCase().charCodeAt(0)+0xFEE0)).join('、');
const href=(g,t)=>sites[g].url+'?topic='+encodeURIComponent(t)+'#explore';
function connections(topic){return routes.filter(r=>r[group]&&(!topic||r[group]===topic||(group==='d'&&topic==='logistics'&&r.name==='廠房空間'))).flatMap(r=>Object.keys(sites).filter(g=>g!==group&&r[g]).map(target=>({route:r,target})));}
const switcher=document.createElement('nav');switcher.className='group-switcher';switcher.setAttribute('aria-label','產業群島切換');switcher.innerHTML=`<a href="#archipelago">⌁ 產業群島</a>${Object.entries(sites).map(([g,s])=>g===group?`<span aria-current="page">${s.name}</span>`:`<a href="${s.url}">${s.name} ↗</a>`).join('')}`;document.querySelector('.site-header').after(switcher);
const overview=document.createElement('section');overview.id='archipelago';overview.className='archipelago';overview.innerHTML=`<details><summary>探索產業群島 <small>${activeGroups}已連通／五組群島架構</small><span>＋</span></summary><p>先選產業島，或沿著共同需求找到另一組的專業。跨組連結會在目前分頁開啟另一座島。</p><div class="group-islands">${['a','b','c','d','e'].map(g=>sites[g]?`<a href="${sites[g].url}" ${g===group?'aria-current="page"':''}><b>${g.toUpperCase()}</b><span>${sites[g].name.slice(3)}</span><small>${g===group?'目前所在':'前往探索 ↗'}</small></a>`:`<div class="future-island"><b>${g.toUpperCase()}</b><span>產業島</span><small>預留擴充</small></div>`).join('')}</div><h3>沿著共同需求，跨組探索</h3><div class="cross-route-grid">${connections().map(({route:r,target})=>`<a href="${href(target,r[target])}"><b>${r.name} ↗</b><span>${r.desc}</span><small>前往${sites[target].name}的對應主題</small></a>`).join('')}</div><p class="group-note">目前${activeGroups}可瀏覽${futureGroups?`；${futureGroups}為預留位置`:"，五組已連通"}。連線呈現需求轉接方向，實際服務及合作分工由夥伴確認。<a href="../">查看群島總覽 ↗</a></p></details>`;document.querySelector('.intro').after(overview);
// Open the destination before native anchor scrolling, including direct hash links.
const overviewDetails=overview.querySelector('details');
const overviewLink=switcher.querySelector('a[href="#archipelago"]');
overviewDetails.id='archipelago-details';
overviewLink.setAttribute('aria-controls',overviewDetails.id);
function openOverview(){overviewDetails.open=true;}
overviewLink.addEventListener('click',openOverview);
window.addEventListener('hashchange',()=>{if(location.hash==='#archipelago')openOverview();});
if(location.hash==='#archipelago')openOverview();
function renderCrossLinks(){const detail=document.querySelector('#detail-content');if(!detail||detail.querySelector('.cross-group-links'))return;const id=document.querySelector('#topic-list [aria-pressed="true"]')?.dataset.topic;const match=connections(id);if(!match.length)return;const block=document.createElement('section');block.className='detail-block cross-group-links';block.innerHTML=`<h3>跨組合作 · 找到接棒的專業</h3>${match.map(({route:r,target})=>`<a href="${href(target,r[target])}"><b>${r.name} ↗</b><small>${r.desc}</small><span>前往${sites[target].name}的對應主題</span></a>`).join('')}`;detail.insertBefore(block,detail.querySelector('#ask-topic'));}
new MutationObserver(renderCrossLinks).observe(document.querySelector('#detail-content'),{childList:true});renderCrossLinks();
