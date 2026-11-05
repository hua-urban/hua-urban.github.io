(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HuaSiteContent=api;
})(typeof window==='object'?window:this,function(){
  'use strict';
  var ENDPOINT='https://script.google.com/macros/s/AKfycbwFOmaT_WgI1cCUWDBi4rAVhnrAuu1_dtRx2mvIDSlUCL8rVEowTrcWi6uj8gd3wjGE/exec?action=siteContent';
  var COPY=['home.announcement.title','home.announcement.body','home.about.title','home.about.p1','home.about.p2'];
  var IDS=['membership','groups','website','guest','tea','training','trafficLight','greenlight','slides','calendar','lineBot'];
  var DEFAULTS={membership:'/admin/members/',groups:'/bni-pt-groups/',website:'/',guest:'/guest/',tea:'/huadu-tea/',training:'/bni-training/',trafficLight:'/traffic-light/?v=est',greenlight:'/greenlight/',calendar:'/#calendar'};
  var pending;
  function safeUrl(value){
    if(typeof value!=='string')return null;
    var url=value.trim();
    if(/[\u0000-\u0020\u007f\\]/.test(url)||url.startsWith('//'))return null;
    if(url.startsWith('/'))return url;
    try{var parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:null;}catch(e){return null;}
  }
  function normalize(value){
    if(!value||value.ok!==true||!Array.isArray(value.groups)||!Array.isArray(value.services)||!value.content||typeof value.content!=='object')throw Error('Website settings unavailable');
    var content={},services=[],groups=[],seen={};
    COPY.forEach(function(k){if(typeof value.content[k]==='string')content[k]=value.content[k].slice(0,5000);});
    value.services.forEach(function(s){
      if(!s||!IDS.includes(s.id)||seen[s.id]||typeof s.enabled!=='boolean')return;
      var url=safeUrl(s.url);if(s.enabled&&!url)return;seen[s.id]=true;
      services.push({id:s.id,title:typeof s.title==='string'?s.title.slice(0,100):'',description:typeof s.description==='string'?s.description.slice(0,1000):'',url:url||'',enabled:s.enabled});
    });
    seen={};value.groups.forEach(function(g){
      if(!g||!(/^[A-E]$/).test(g.code)||seen[g.code]||!['name','leader','schedule'].every(function(k){return typeof g[k]==='string';}))return;
      seen[g.code]=true;groups.push({code:g.code,name:g.name,leader:g.leader,schedule:g.schedule});
    });
    if(groups.length!==5)throw Error('Incomplete group settings');
    return {content:content,services:services,groups:groups.sort(function(a,b){return a.code.localeCompare(b.code);})};
  }
  function load(fetcher){
    if(!pending)pending=Promise.resolve().then(function(){return (fetcher||fetch)(ENDPOINT+'&t='+Date.now(),{cache:'no-store',credentials:'omit'});}).then(function(r){if(!r.ok)throw Error('Settings request failed');return r.json();}).then(normalize);
    return pending;
  }
  function applyHome(data,doc){
    doc.querySelectorAll('[data-site-copy]').forEach(function(node){var key=node.getAttribute('data-site-copy');if(Object.prototype.hasOwnProperty.call(data.content,key)){node.textContent=data.content[key];node.style.whiteSpace='pre-line';}});
    var banner=doc.getElementById('siteAnnouncement');
    if(banner){var title=data.content['home.announcement.title']||'',body=data.content['home.announcement.body']||'';banner.hidden=!title.trim()&&!body.trim();banner.querySelector('h2').textContent=title;banner.querySelector('p').textContent=body;}
    var table=doc.getElementById('scheduleTblBody');if(table){var rows=data.groups.map(function(g){var tr=doc.createElement('tr');[g.code,g.name,g.leader,g.schedule||'待補'].forEach(function(text,i){var td=doc.createElement('td');td.setAttribute('data-label',['組別','產業鏈','召集人','固定時段'][i]);if(i===0)td.className='stbl-group';td.textContent=text;tr.appendChild(td);});return tr;});table.replaceChildren.apply(table,rows);}
    data.groups.forEach(function(g){var next=doc.querySelector('.chain-next[data-chain="'+g.code+'"]');if(!next)return;next.textContent=g.schedule||'待補';var card=next.closest('.chain');card.querySelector('.chain-name').textContent=g.code+' '+g.name;var first=card.querySelector('.chain-meta > div'),label=doc.createElement('strong');label.textContent='召集人：';first.replaceChildren(label,doc.createTextNode(g.leader));});
    var base='https://hua-urban.com';doc.querySelectorAll('a[href]').forEach(function(a){
      var id=a.getAttribute('data-site-service');if(!id){try{var href=new URL(a.getAttribute('href'),base+'/').href;Object.keys(DEFAULTS).some(function(k){if(new URL(DEFAULTS[k],base).href===href){id=k;return true;}return false;});}catch(e){}}
      var s=data.services.find(function(s){return s.id===id;});if(!s)return;if(!s.enabled){a.hidden=true;return;}a.setAttribute('href',s.url);a.hidden=false;
    });
  }
  function applyDirectory(services,data){
    var names={'會員名單':'membership','產業鏈分組':'groups','官網與活動牆':'website','來賓報名':'guest','新人茶敘':'tea','培訓進度回報':'training','會員紅綠燈':'trafficLight','追綠光':'greenlight','每週會員簡報':'slides','LINE 小幫手':'lineBot'};
    services.forEach(function(item){var id=item.siteServiceId||names[item.title];if(!id)return;item.siteServiceId=id;var s=data.services.find(function(s){return s.id===id;});if(!s)return;if(s.title)item.title=s.title;item.description=s.description;item.use=s.enabled?[{label:'開啟'+(s.title||item.title),href:s.url}]:[{status:'目前未提供入口'}];});
  }
  return {safeUrl:safeUrl,normalize:normalize,load:load,applyHome:applyHome,applyDirectory:applyDirectory,endpoint:ENDPOINT};
});
