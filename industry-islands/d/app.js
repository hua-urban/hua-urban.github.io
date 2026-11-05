import { topics, scenarios } from './data.js';
const $ = (s) => document.querySelector(s);
const byId = (id) => topics.find(t => t.id === id);
const requestedTopic = new URL(location.href).searchParams.get('topic');
let selected = topics.some(t=>t.id===requestedTopic) ? requestedTopic : 'energy', scene, paused = false, night = false, routes = true, touring = false;
let activeConnection = null, expandedMap = false;
let scenarioIndex = 0, stepIndex = 0, journeyTimer = null, sceneFailed = false;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
$('#reduce-motion').checked = reduced;
document.body.classList.toggle('motion-reduced', reduced);
const num = i => String(i + 1).padStart(2, '0');
$('#topic-list').innerHTML = topics.map((t, i) => `<button data-topic="${t.id}" aria-pressed="false" title="${t.title}"><span>${num(i)}</span>${t.short}</button>`).join('');
$('#question-topic').innerHTML = topics.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
function announce(text) { $('#announcement').textContent = text; }
function updateQuestions(id) {
  const t = byId(id); $('#question-topic').value = id;
  $('#questions').innerHTML = t.questions.map(q => `<li>${q}</li>`).join('');
  $('#copy-status').textContent = '';
}
function select(id, {focus = false, connectionFrom = null} = {}) {
  const t = byId(id); if (!t) return;
  selected = id; scene?.select(id);
  activeConnection = connectionFrom && byId(connectionFrom) && connectionFrom !== id ? [connectionFrom,id] : null;
  $('#connection-notice').hidden = !activeConnection;
  if(activeConnection){
    const [from,to]=activeConnection;
    routes=true;scene?.setRoutes(true);$('#routes-button').setAttribute('aria-pressed','true');
    scene?.connect?.(from,to);
    $('#connection-text').textContent=`${byId(from).short} ↔ ${byId(to).short}`;
  }
  document.documentElement.style.setProperty('--accent', t.color);
  $('#detail-content').innerHTML = `<div class="detail-top"><span class="en">${t.en}</span><span class="topic-symbol" aria-hidden="true">${t.icon}</span></div><h2>${t.title}</h2><p class="detail-tagline">${t.tagline}</p><div class="tags">${t.tags.map(tag=>`<span>${tag}</span>`).join('')}</div><div class="detail-columns"><section class="detail-block"><h3>服務對象</h3><p>${t.audience}</p></section><section class="detail-block"><h3>客戶遇到的問題</h3><p>${t.problem}</p></section><section class="detail-block"><h3>服務如何介入</h3><p>${t.approach}</p></section><section class="detail-block"><h3>可以和哪些專業協作？</h3><div class="partner-list">${t.partners.map(([pid,desc])=>`<button class="partner-link" data-from="${t.id}" data-topic="${pid}"><span>${byId(pid).short}<small>${desc}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div></section></div>${t.roles?`<section class="detail-block"><h3>可先連結的夥伴</h3><p>${t.roles}</p></section>`:''}${t.output?`<section class="detail-block"><h3>這一站要留下什麼</h3><p>${t.output}</p></section>`:''}<button class="topic-ask" id="ask-topic">帶走這個專業的需求提問 <span>↗</span></button>`;
  $('#detail-content').scrollTop = 0;
  $('#detail-content').classList.remove('fade-in');
  if (!reduced) requestAnimationFrame(()=>$('#detail-content').classList.add('fade-in'));
  $('#topic-count').textContent = `${num(topics.indexOf(t))} / 08`;
  document.querySelectorAll('#topic-list [data-topic]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic===id)));
  updateQuestions(id);
  $('#ask-topic').onclick = () => { $('#takeaway').scrollIntoView({behavior:reduced?'instant':'smooth'}); $('#question-topic').focus({preventScroll:true}); };
  const shipping = $('#shipping-link'); if(shipping) shipping.onclick = () => setScenario(0);
  if (focus) $('#topic-detail').focus({preventScroll:true});
  announce(`已選擇${t.title}`);
}
document.addEventListener('click', e => {
 const topic = e.target.closest('[data-topic]');
 if (topic && !topic.classList.contains('island-label')) {stopJourney();stopTour();select(topic.dataset.topic,{connectionFrom:topic.dataset.from});if(topic.dataset.from&&matchMedia('(max-width:900px)').matches)requestAnimationFrame(showMapRoute);}
});
function showMapRoute(){if(!expandedMap)$('.map-panel').scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});}
$('#clear-connection').onclick=()=>select(selected);
function toggleExpanded(force){
  expandedMap=typeof force==='boolean'?force:!expandedMap;
  $('.map-panel').classList.toggle('expanded',expandedMap);
  document.body.classList.toggle('map-expanded',expandedMap);
  $('#expand-map').setAttribute('aria-expanded',String(expandedMap));
  $('#expand-map').textContent=expandedMap?'× 關閉放大':'⤢ 放大島嶼';
  if(!expandedMap)$('#expand-map').focus({preventScroll:true});
}
$('#expand-map').onclick=()=>toggleExpanded();
$('.map-panel').addEventListener('keydown',e=>{
  if(!expandedMap||e.key!=='Tab')return;
  const nodes=[...$('.map-panel').querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>el.getBoundingClientRect().width>0);
  const first=nodes[0],last=nodes.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
$('#prev-topic').onclick = () => select(topics[(topics.findIndex(t=>t.id===selected)+7)%8].id);
$('#next-topic').onclick = () => select(topics[(topics.findIndex(t=>t.id===selected)+1)%8].id);
$('#question-topic').onchange = e => updateQuestions(e.target.value);
$('#help-toggle').onclick = () => { const visible = $('#scene-help').hidden; $('#scene-help').hidden = !visible; $('#help-toggle').setAttribute('aria-expanded',String(visible)); };
document.addEventListener('keydown', e => { if(e.key==='Escape'){ if(expandedMap)toggleExpanded(false); $('#scene-help').hidden=true; $('#help-toggle').setAttribute('aria-expanded','false'); }});
function stopTour() { touring=false; scene?.tour(false); $('#tour-button').setAttribute('aria-pressed','false'); }
function setPaused(value) {
 paused=value; scene?.setPaused(value); $('#pause-button').setAttribute('aria-pressed',String(value));
 $('#pause-button').innerHTML = value ? '<span>▷</span> 繼續動態' : '<span>Ⅱ</span> 暫停動態';
 if(value){stopJourney();stopTour();} announce(value?'場景動態已暫停':'場景動態已繼續');
}
$('#pause-button').onclick = () => setPaused(!paused);
function setNight(value){night=value;scene?.setNight(value);document.body.classList.toggle('night',value);$('#day-button').setAttribute('aria-pressed',String(!value));$('#night-button').setAttribute('aria-pressed',String(value));}
$('#day-button').onclick=()=>setNight(false); $('#night-button').onclick=()=>setNight(true);
$('#routes-button').onclick=()=>{routes=!routes;scene?.setRoutes(routes);$('#routes-button').setAttribute('aria-pressed',String(routes));};
$('#tour-button').onclick=()=>{if(reduced){announce('已啟用減少動態，可關閉後使用自動導覽。');return;} touring=!touring;if(touring&&paused)setPaused(false);scene?.tour(touring);$('#tour-button').setAttribute('aria-pressed',String(touring));};
$('#reset-button').onclick=()=>{stopTour();scene?.resetView();announce('鏡頭已回到全景');};
$('#scene').addEventListener('island-tour-stop',()=>{touring=false;$('#tour-button').setAttribute('aria-pressed','false');});
function setReduced(value){reduced=value;$('#reduce-motion').checked=value;document.body.classList.toggle('motion-reduced',value);scene?.setReducedMotion(value);$('#tour-button').disabled=value||sceneFailed;if(value){stopTour();stopJourney();}}
$('#reduce-motion').onchange=e=>setReduced(e.target.checked);
reducedQuery.addEventListener('change',e=>setReduced(e.matches));
$('#scenario-tabs').innerHTML=scenarios.map((s,i)=>`<button role="tab" id="scenario-tab-${i}" aria-controls="step-detail" aria-selected="false" data-scenario="${i}"><span>SCENARIO ${num(i)}</span><b>${s.title}</b><small>${s.subtitle}</small></button>`).join('');
function stopJourney(){if(journeyTimer)clearInterval(journeyTimer);journeyTimer=null;$('#play-journey').textContent='▶ 播放協作故事';$('#play-journey').setAttribute('aria-pressed','false');}
function renderStep({sync=false}={}){
 const s=scenarios[scenarioIndex], [topic,title,desc]=s.steps[stepIndex];
 $('#journey-counter').textContent=`${num(stepIndex)} / ${num(s.steps.length-1)}`;
 document.querySelectorAll('.journey-step').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===stepIndex));b.tabIndex=i===stepIndex?0:-1;});
 $('#step-detail').innerHTML=`<h4>${num(stepIndex)} · ${title}</h4><p>${desc}</p><button data-topic="${topic}">探索${byId(topic).short} ↗</button><button class="view-route" data-view-step="${stepIndex}">在地圖查看${stepIndex>0?'這段協作路線':'這項專業'} ↑</button>`;
 $('#step-detail').setAttribute('aria-labelledby',`journey-step-${stepIndex}`);
 if(sync)select(topic,{connectionFrom:stepIndex>0?s.steps[stepIndex-1][0]:null});
}
function setScenario(i){stopJourney();scenarioIndex=i;stepIndex=0;const s=scenarios[i];document.querySelectorAll('[data-scenario]').forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1;});$('#scenario-title').textContent=s.subtitle;$('#scenario-intro').textContent=`情境示例｜${s.intro}`;$('#journey-steps').setAttribute('role','tablist');$('#journey-steps').setAttribute('aria-label','協作步驟');$('#journey-steps').innerHTML=s.steps.map((step,j)=>`<button class="journey-step" role="tab" id="journey-step-${j}" aria-controls="step-detail" aria-selected="false" data-step="${j}"><span class="step-num">${num(j)}</span><span>${step[1]}</span></button>`).join('');renderStep();}
$('#step-detail').addEventListener('click',e=>{const b=e.target.closest('[data-view-step]');if(!b)return;stopJourney();stopTour();stepIndex=Number(b.dataset.viewStep);renderStep({sync:true});showMapRoute();});
$('#scenario-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-scenario]');if(b)setScenario(Number(b.dataset.scenario));});
$('#journey-steps').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b){stopJourney();stepIndex=Number(b.dataset.step);renderStep({sync:true});}});
function tabsKeyboard(container, selector, activate){container.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;const buttons=[...container.querySelectorAll(selector)],index=buttons.indexOf(document.activeElement);if(index<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;activate(next);buttons[next]?.focus();});}
tabsKeyboard($('#scenario-tabs'),'[data-scenario]',setScenario);
tabsKeyboard($('#journey-steps'),'[data-step]',i=>{stopJourney();stepIndex=i;renderStep({sync:true});});
$('#play-journey').onclick=()=>{if(journeyTimer){stopJourney();return;}stopTour();if(paused)setPaused(false);stepIndex=0;renderStep({sync:true});$('#play-journey').textContent='Ⅱ 暫停協作故事';$('#play-journey').setAttribute('aria-pressed','true');journeyTimer=setInterval(()=>{if(stepIndex>=scenarios[scenarioIndex].steps.length-1){stopJourney();announce('協作故事播放完畢');return;}stepIndex++;renderStep({sync:true});},4500);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopJourney();});
$('#copy-questions').onclick=async()=>{const t=byId($('#question-topic').value),text=`${t.title}\n${t.questions.map((q,i)=>`${i+1}．${q}`).join('\n')}\n\n協作切點須由相關夥伴確認。`;try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='已複製，可以帶到下一場交流。';}catch{$('#copy-status').textContent='瀏覽器未允許複製，請直接選取上方問題。';}};
select(selected);setScenario(0);
function failScene(error){if(sceneFailed)return;sceneFailed=true;console.error('3D scene unavailable:',error);$('#scene-loading').innerHTML='<span class="loading-island">✦</span><b>這台裝置暫時無法顯示 3D 場景。</b><small>仍可用下方八個主題，閱讀服務與協作介紹。</small>';['day-button','night-button','routes-button','tour-button','pause-button','reset-button'].forEach(id=>$('#'+id).disabled=true);}
try{const {createIsland}=await import('./scene.js?v=cat-tour-1');scene=await createIsland({container:$('#scene'),topics,onSelect:id=>{stopJourney();stopTour();select(id);},onReady:()=>{$('#scene-loading').classList.add('hidden');$('#scene-loading').setAttribute('aria-hidden','true');},onError:failScene});scene?.select(selected);if(activeConnection)scene?.connect?.(...activeConnection);scene?.setReducedMotion(reduced);setReduced(reduced);if(!reduced){touring=true;scene?.tour(true);$('#tour-button').setAttribute('aria-pressed','true');}}catch(error){failScene(error);}
window.addEventListener('pagehide',()=>{stopJourney();scene?.dispose();});
