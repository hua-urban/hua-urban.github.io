(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WeeklyPeriod=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const iso=d=>d.toISOString().slice(0,10);
  function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw new Error('日期格式須為 YYYY-MM-DD');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||iso(d)!==s)throw new Error('日期不存在');return d;}
  function latestWednesday(now=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const d=date(`${p.year}-${p.month}-${p.day}`);
    let back=(d.getUTCDay()-3+7)%7; if(back===0)back=7; // 週三尚未結算，週四才使用前一天的資料
    d.setUTCDate(d.getUTCDate()-back);return iso(d);
  }
  function startFor(end){const d=date(end),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-6);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,max)+1);return iso(d);}
  function rangeEnd(s){return (String(s||'').match(/\d{4}-\d{2}-\d{2}/g)||[])[1]||null;}
  function validate(range,now=new Date()){
    if(!range?.start||!range?.end)throw new Error('PALMS 必須提供報告內的起訖日期，不能以檔名推算週報');
    const end=date(range.end);date(range.start);
    if(end.getUTCDay()!==3)throw new Error('週報截止日必須是週三；請重新匯出截至週三的六個月 PALMS');
    if(range.end>latestWednesday(now))throw new Error('請使用已結算週三的報告，不接受未來或尚未結算的日期');
    const start=startFor(range.end);if(range.start!==start)throw new Error(`六個月週報期間應為 ${start} 至 ${range.end}，請依此日期重新匯出`);
    return {asOf:range.end,start};
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
      + (submitted===latestWednesday(now) ? '' : '待更新最新例會提交狀態。');
  }
  return {latestWednesday,startFor,rangeEnd,validate,submissionEvidence,submissionStatus};
});
