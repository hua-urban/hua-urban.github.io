'use strict';
(async()=>{
 const status=document.getElementById('service-status'),launch=document.getElementById('launch');
 try{
  const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw new Error('config');
  const config=await response.json();if(!config.webAppUrl){status.textContent='平台建置中，Google 後端尚未啟用。正式開放時間請洽資訊組。';return;}
  const url=new URL(config.webAppUrl);
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.hash)throw new Error('invalid-url');
  launch.href=url.href;launch.hidden=false;status.textContent='會內專用入口。進入後請輸入通行密碼。';
 }catch{status.textContent='目前無法確認平台入口，請稍後重試或聯絡資訊組。';}
})();
