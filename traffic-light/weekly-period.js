(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WeeklyPeriod=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const iso=d=>d.toISOString().slice(0,10);
  function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw new Error('日期格式須為 YYYY-MM-DD');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||iso(d)!==s)throw new Error('日期不存在');return d;}
  function latestWednesday(now=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const d=date(`${p.year}-${p.month}-${p.day}`);
    let back=(d.getUTCDay()-3+7)%7; if(back===0)back=7; // 台北週四才切換到前一天週三；週三當天仍沿用前期
    d.setUTCDate(d.getUTCDate()-back);return iso(d);
  }
  function startFor(end){const d=date(end),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-6);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,max)+1);return iso(d);}
  function rangeEnd(s){return (String(s||'').match(/\d{4}-\d{2}-\d{2}/g)||[])[1]||null;}
  function expectedMeeting(now=new Date()){
    return latestWednesday(now);
  }
  function nextWednesday(now=new Date()){
    const d=date(latestWednesday(now));d.setUTCDate(d.getUTCDate()+7);return iso(d);
  }
  function nextUpdate(now=new Date()){
    const d=date(latestWednesday(now));d.setUTCDate(d.getUTCDate()+8);return iso(d);
  }
  function validateRange(range){
    if(!range?.start||!range?.end)throw new Error('PALMS 必須提供報告內的起訖日期，不能以檔名推算週報');
    const end=date(range.end);date(range.start);
    const start=startFor(range.end);if(range.start!==start)throw new Error(`六個月週報期間應為 ${start} 至 ${range.end}，請依此日期重新匯出`);
    return {asOf:iso(end),start};
  }
  function validate(range,now=new Date()){
    const result=validateRange(range);
    if(date(range.end).getUTCDay()!==3)throw new Error('週報截止日必須是週三；請重新匯出以當週三為截止日的六個月 PALMS');
    if(range.end>latestWednesday(now))throw new Error('報告截止日不得晚於本次更新基準（已到週四更新日的週三）：'+latestWednesday(now));
    return result;
  }
  // Read-only compatibility for reports stored before the Thursday update rule.
  // Uploads use the current cycle and independent submission evidence instead.
  function validateStored(range,now=new Date()){
    const result=validateRange(range);
    const legacyRanges={'2026-10-07':'2026-04-08','2026-10-21':'2026-04-22','2026-10-28':'2026-04-29'};
    if(legacyRanges[range.end]===range.start && +now>=+new Date(range.end+'T16:00:00Z'))return result;
    return validate(range,now);
  }
  function uploadEvidence(previous,entered={},confirmed=false,now=new Date()){
    const prior=submissionEvidence(previous), evidence=submissionEvidence(entered);
    if(!evidence.lastSubmittedMeeting)throw new Error('請填寫已核對的週三例會日期及查核來源');
    if(evidence.lastSubmittedMeeting>latestWednesday(now))throw new Error('已提交例會日期不得晚於本次更新基準');
    if(evidence.lastSubmittedMeeting===prior.lastSubmittedMeeting && evidence.lastSubmittedMeetingSource===prior.lastSubmittedMeetingSource)return evidence;
    if(!confirmed || !evidence.lastSubmittedMeetingSource || evidence.lastSubmittedMeetingSource===prior.lastSubmittedMeetingSource)throw new Error('修改提交紀錄時，請填寫本次查核來源，並確認 BNI Connect 顯示完成且出席報告含該週');
    if(prior.lastSubmittedMeeting && evidence.lastSubmittedMeeting<prior.lastSubmittedMeeting)throw new Error('已確認的提交日期不能倒退');
    return evidence;
  }
  function preventRollback(range,stored={}){
    const publishedEnd=rangeEnd(stored.range);
    if(publishedEnd && date(publishedEnd) && range.end<publishedEnd)throw new Error('目前已發布報告截止為 '+publishedEnd+'，不能以較舊的 '+range.end+' 報告覆寫；請保留現有資料');
  }
  function validateUpload(range,chapter,now=new Date(),stored={}){
    const result=validate(range,now);
    preventRollback(range,stored);
    const submitted=submissionEvidence(chapter).lastSubmittedMeeting;
    if(!submitted || submitted<range.end)throw new Error('尚未確認副主席已提交 '+range.end+' 例會，請先核對 BNI Connect PALMS 完成狀態並更新提交來源紀錄');
    return result;
  }
  // A summary report's range/asOf only describes its query cutoff. Submission
  // evidence comes from the separate PALMS attendance report, never week counts.
  function submissionEvidence(chapter={}){
    try {
      const submitted=date(chapter.lastSubmittedMeeting);
      if(submitted.getUTCDay()!==3 || typeof chapter.lastSubmittedMeetingSource!=='string' || !chapter.lastSubmittedMeetingSource.trim())return {};
      return {lastSubmittedMeeting:iso(submitted),lastSubmittedMeetingSource:chapter.lastSubmittedMeetingSource.trim()};
    } catch (_) {return {};}
  }
  function submissionStatus(chapter={},now=new Date()){
    const cutoff=rangeEnd(chapter.range);
    const submitted=submissionEvidence(chapter).lastSubmittedMeeting;
    return (cutoff ? 'PALMS 報告查詢截止：'+cutoff+'。' : 'PALMS 報告未提供查詢截止日期。')
      + (submitted ? '最新已提交例會：'+submitted+'（依 BNI Connect PALMS 狀態確認）。' : '最新已提交例會日期尚待確認。')
      + (submitted && submitted>=expectedMeeting(now) ? '' : '待核對本次基準例會提交狀態。')
      + (cutoff>latestWednesday(now) ? '目前保留先前匯入的報告；下次週四 '+nextUpdate(now)+' 處理 '+nextWednesday(now)+' 統計，須先確認副主席已提交。' : '');
  }
  return {latestWednesday,nextWednesday,nextUpdate,expectedMeeting,startFor,rangeEnd,validate,uploadEvidence,preventRollback,validateUpload,validateStored,submissionEvidence,submissionStatus};
});
