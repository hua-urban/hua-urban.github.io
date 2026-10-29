import test from 'node:test';
import assert from 'node:assert/strict';
import {blobRevision,buildWeeklyPayload} from './weekly-member-payload.mjs';
import {readFileSync} from 'node:fs';
import {parsePalmsRows} from './member-period-palms.mjs';
const row=[1,'甲先生 English',26,26,0,0,0,0,15,3,2,30,5,100];
function input(){const sourceBytes=Buffer.from(JSON.stringify({members:[],chapter:{size:55,est:{chapter:{range:'2026-04-22 – 2026-10-21',asOf:'2026-10-21'},members:[row]}}}));return {sourceBytes,baseRevision:blobRevision(sourceBytes),roster:[{no:'001',name:'甲先生'}],policy:{members:[{memberNo:'001',name:'甲先生',latestCycleMonth:'2026-04'}]},common:{range:{start:'2026-04-29',end:'2026-10-28'},members:[row],totals:{p:26,a:0,med:0,s:0,rg:15,v:2},sha256:'a'.repeat(64)},reports:[{range:{start:'2026-05-01',end:'2026-10-28'},members:[row],sha256:'b'.repeat(64)}],monthly:{months:[{month:'2026-09',period:'2026 年 9 月',source:'https://example.org/official',chapter:{growth:5,retention:0,conv:22.86,score:65}}]},submission:{lastSubmittedMeeting:'2026-10-28',lastSubmittedMeetingSource:'BNI Connect PALMS 完成，出席報告含 10/28'},confirmed:true,uploadedBy:'本機核對',now:new Date('2026-10-29T04:00:00Z')};}
test('older baseline plus common and member reports create one CAS payload',()=>{const x=input(),p=buildWeeklyPayload(x),ch=p.chapter.est.chapter;assert.equal(p.baseRevision,x.baseRevision);assert.equal(p.chapterOnly,true);assert.equal(ch.asOf,'2026-10-28');assert.equal(ch.growth,5);assert.equal(ch.retention,0);assert.equal(ch.conv,22.86);assert.equal(ch.ref,.58);assert.equal(ch.vis,.08);assert.equal(ch.absent,0);assert.equal(ch.score,40);assert.equal(ch.lastSubmittedMeeting,'2026-10-28');assert.equal(ch.commonReportEvidence.start,'2026-04-29');assert.equal(ch.memberPeriodEvidence.reports[0].start,'2026-05-01');assert.deepEqual(p.chapter.est.members[0].slice(0,2),row.slice(0,2));assert.equal(p.chapter.size,55);});
test('snapshot bytes must match original CAS revision',()=>{const x=input();x.baseRevision='0'.repeat(40);assert.throws(()=>buildWeeklyPayload(x),/baseRevision/);});
test('submission missing, unconfirmed or older than cutoff rejects',()=>{let x=input();x.submission={};assert.throws(()=>buildWeeklyPayload(x));x=input();x.confirmed=false;assert.throws(()=>buildWeeklyPayload(x));x=input();x.submission.lastSubmittedMeeting='2026-10-21';assert.throws(()=>buildWeeklyPayload(x),/尚未確認/);});
test('wrong common range, missing official source and missing member report reject',()=>{let x=input();x.common.range.start='2026-05-01';assert.throws(()=>buildWeeklyPayload(x),/六個月/);x=input();x.monthly={months:[]};assert.throws(()=>buildWeeklyPayload(x),/official/);x=input();x.reports=[];assert.throws(()=>buildWeeklyPayload(x),/Missing verified/);});
test('new roster member without policy requires a fresh private membership report',()=>{const x=input();x.policy.members=[];assert.throws(()=>buildWeeklyPayload(x),/重新匯出 BNI Connect/);});
test('new member with policy enters from common report; historical leaver is removed and scores rank new rows',()=>{
  const x=input(),newRow=[0,'乙小姐 English',26,26,0,0,0,0,100,3,20,100,20,3000000];
  const prior=JSON.parse(x.sourceBytes);prior.chapter.est.members.push([2,'退會會員',...row.slice(2)]);x.sourceBytes=Buffer.from(JSON.stringify(prior));x.baseRevision=blobRevision(x.sourceBytes);
  x.roster.push({no:'002',name:'乙小姐'});x.policy.members.push({memberNo:'002',name:'乙小姐',latestCycleMonth:'2026-04'});
  x.common.members.push(newRow,[3,'退會會員',...row.slice(2)]);x.reports[0].members.push(newRow);
  const output=buildWeeklyPayload(x).chapter.est.members;
  assert.deepEqual(output.map(r=>r.slice(0,2)),[[1,'乙小姐 English'],[2,'甲先生 English']]);
  assert.equal(output.some(r=>r[1]==='退會會員'),false);
  x.policy.members.pop();assert.throws(()=>buildWeeklyPayload(x),/重新匯出 BNI Connect/);
});
test('absence thresholds match the original strict low-tier comparison at 5, 10 and 12 percent',()=>{
  for(const [absent,points] of [[4.99,15],[5,10],[9.99,10],[10,5],[11.99,5],[12,0]]){
    const x=input();x.common.totals={p:100-absent,a:absent,med:0,s:0,rg:15,v:2};
    const chapter=buildWeeklyPayload(x).chapter.est.chapter;
    assert.equal(chapter.absent,absent);assert.equal(chapter.score,25+points,`absence ${absent}`);
  }
});
test('common-report metrics match original parsePalms and exclude zero-week member rows',()=>{
  const dashboard=readFileSync(new URL('../traffic-light/dashboard-core.js',import.meta.url),'utf8');
  const original=dashboard.slice(dashboard.indexOf('function parsePalms(rows){'),dashboard.indexOf('// 分會七項 → 分會得分'));
  const oldParse=Function('num','scoreOf','palmsDate',`let palmsChapter; ${original}; return rows=>{const parsed=parsePalms(rows);return {parsed,chapter:palmsChapter};};`)(v=>Number(v)||0,()=>({score:0}),v=>v);
  const headers=['姓氏','名字','出席','缺席','遲到','病假','替代人','提供內部引薦','提供外部引薦','收到內部引薦','收到外部引薦','來賓','一對一會面','分會教育單位','交易價值'];
  const sheet=[['PALMS'],['從:','2026-04-29'],['至:','2026-10-28'],headers,['甲','先生 English',26,0,0,0,0,10,5,2,1,2,30,5,100],['零','週會員',0,0,0,0,0,1,2,0,0,1,0,0,0],['BNI','',0,0,0,0,0,0,0,0,0,7,0,0,0],['總數','',26,0,0,0,0,11,7,2,1,10,30,5,100]];
  const old=oldParse(sheet),x=input();x.common={...parsePalmsRows(sheet),sha256:'a'.repeat(64)};
  const current=buildWeeklyPayload(x).chapter.est.chapter;
  assert.equal(old.parsed.members.length,1);
  for(const key of ['size','ref','vis','absent'])assert.equal(current[key],old.chapter[key],key);
});
