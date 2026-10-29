import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildMemberPeriodPalms,nameKey} from './member-period-palms.mjs';
const weekly=createRequire(import.meta.url)('../traffic-light/weekly-period.js');
export function blobRevision(bytes){return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');}
export function memberScore(row){
  const rate=(value,tiers)=>tiers.reduce((score,[threshold,points])=>value>=threshold-1e-9?points:score,0),w=row[2];
  return (row[4]===0?20:row[4]===1?15:row[4]===2?10:0)
    +rate(row[8]/w,[[.75,5],[1,10],[1.2,15],[1.5,20]])+rate(row[10]/w*4,[[1,10],[2,15]])
    +rate(row[11]/w,[[.5,5],[1,10],[2,15]])+rate(row[12],[[2,5],[4,10],[6,15]])+rate(row[13],[[400000,5],[800000,10],[2000000,15]]);
}
export function buildWeeklyPayload({sourceBytes,baseRevision,roster,policy,common,reports,monthly,submission,confirmed,uploadedBy,now=new Date()}){
  if(!/^[a-f0-9]{40}$/.test(baseRevision||'') || blobRevision(sourceBytes)!==baseRevision)throw new Error('Baseline bytes do not match preview baseRevision');
  const source=JSON.parse(sourceBytes.toString('utf8'));
  if(!source.chapter?.est?.chapter || !Array.isArray(source.chapter.est.members))throw new Error('Missing baseline chapter.est');
  const prior=source.chapter.est.chapter;
  const verified=weekly.uploadEvidence(prior,submission,confirmed,now);
  // Confirmation is required even if an old evidence object already exists.
  if(confirmed!==true)throw new Error('Explicit submission verification required');
  const {asOf}=weekly.validateUpload(common.range,verified,now,prior);
  const official=[...(monthly?.months||[])].sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0];
  if(!official?.source || !/^\d{4}-(0[1-9]|1[0-2])$/.test(official.month||'') || !official.period || official.month>asOf.slice(0,7))throw new Error('Missing valid official chapter source');
  const inherited=official.chapter;
  if(!['growth','retention','conv','score'].every(k=>Number.isFinite(inherited?.[k])))throw new Error('Missing official inherited indicators');
  const rows=common.members.filter(r=>r[2]>0),W=Math.max(...rows.map(r=>r[2])),t=common.totals;
  if(new Set(common.members.map(r=>r[1])).size!==common.members.length || common.members.some(r=>r.length!==14 || r.slice(2).some(v=>!Number.isFinite(v)||v<0) || r[2]!==r[3]+r[4]+r[6]+r[7]))throw new Error('Common report has duplicate members or invalid rows');
  if(!rows.length || !t || !['p','a','med','s','rg','v'].every(k=>Number.isFinite(t[k])&&t[k]>=0) || t.p+t.a+t.med+t.s<=0 || !/^[a-f0-9]{64}$/.test(common.sha256||''))throw new Error('Common report requires valid totals and source digest');
  const r2=v=>Math.round(v*100)/100;
  const chapter={size:rows.length,growth:inherited.growth,retention:inherited.retention,conv:inherited.conv,ref:r2(t.rg/rows.length/W),vis:r2(t.v/W),absent:r2(t.a/(t.p+t.a+t.med+t.s)*100),prevScore:inherited.score};
  const tiers={size:[[31,15],[26,10],[21,5],[0,0]],growth:[[5,15],[3,10],[1,5],[0,0]],retention:[[70,15],[60,10],[50.01,5],[0,0]],ref:[[1.11,15],[.91,10],[.71,5],[0,0]],vis:[[2.01,15],[1.51,10],[1.01,5],[0,0]],conv:[[20.01,10],[10.01,5],[0,0]],absent:[[5,15],[10,10],[12,5],[Infinity,0]]};
  chapter.score=Object.entries(tiers).reduce((sum,[k,ts])=>sum+(ts.find(([v])=>k==='absent'?chapter[k]<v:chapter[k]>=v-1e-9)?.[1]||0),0);
  // Current roster decides who is active; the current common report supplies
  // their names and membership baseline. Historical rows never keep a leaver
  // alive or prevent a newcomer from joining the new weekly result.
  const rosterKeys=roster.map(m=>nameKey(m.name));
  if(new Set(rosterKeys).size!==roster.length)throw new Error('Ambiguous current roster names');
  const currentRows=rows.filter(r=>rosterKeys.includes(nameKey(r[1])));
  if(new Set(currentRows.map(r=>nameKey(r[1]))).size!==currentRows.length || currentRows.length!==roster.length)throw new Error('Current roster must uniquely match active common PALMS members');
  const result=buildMemberPeriodPalms({roster,policy,reports,end:asOf,storedChapter:prior,baselineMembers:currentRows,now});
  result.members.sort((a,b)=>memberScore(b)-memberScore(a)||a[1].localeCompare(b[1]));
  result.members.forEach((r,i)=>r[0]=i+1);
  result.memberPeriodEvidence.metricsSha256=createHash('sha256').update(JSON.stringify(result.members)).digest('hex');
  Object.assign(chapter,{range:common.range.start+' – '+asOf,asOf,frequency:'weekly',period:`${asOf.slice(0,4)} 年 ${Number(asOf.slice(5,7))} 月`,...verified,officialBaseline:official.period,officialSource:official.source,chapterMonth:official.period,chapterStale:official.month<asOf.slice(0,7),chapterFetchedAt:now.toISOString(),memberPeriodEvidence:result.memberPeriodEvidence,commonReportEvidence:{...common.range,sha256:common.sha256},provisional:'分會指標採共同六個月 PALMS；個人成績採各會員有效起日對應報告，期間可能不同。正式分數以 LTnA 公布為準。'});
  return {baseRevision,chapterOnly:true,chapter:{...source.chapter,est:{updatedAt:now.toISOString(),uploadedBy,chapter,members:result.members}},uploadedBy};
}
