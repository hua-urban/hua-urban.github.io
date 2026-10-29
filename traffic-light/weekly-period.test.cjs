const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const period = require('./weekly-period.js');
const now = new Date('2026-10-29T04:00:00Z');
const chapter = {
  range:'2026-04-29 – 2026-10-28', asOf:'2026-10-28', frequency:'weekly',
  lastSubmittedMeeting:'2026-10-21', lastSubmittedMeetingSource:'PALMS 出席報告：完成'
};

test('report cutoff never establishes submission status, including current weekly reports', () => {
  const status = period.submissionStatus(chapter, now);
  assert.match(status, /查詢截止：2026-10-28/);
  assert.match(status, /最新已提交例會：2026-10-21/);
  assert.doesNotMatch(status, /待更新/);
  assert.doesNotMatch(status, /已取得本週統計/);
  const unknown = period.submissionStatus({range:chapter.range, asOf:chapter.asOf, weeks:26}, now);
  assert.match(unknown, /最新已提交例會日期尚待確認/);
  assert.doesNotMatch(unknown, /最新已提交例會：2026-10-28/);
});

test('carry only explicit valid submission evidence and preserve its source on subsequent uploads', () => {
  assert.deepEqual(period.submissionEvidence(chapter), {
    lastSubmittedMeeting:'2026-10-21', lastSubmittedMeetingSource:'PALMS 出席報告：完成'
  });
  for (const invalid of [undefined, {}, {asOf:'2026-10-28'},
    {lastSubmittedMeeting:'2026-02-30', lastSubmittedMeetingSource:'source'},
    {lastSubmittedMeeting:'2026-10-22', lastSubmittedMeetingSource:'source'},
    {lastSubmittedMeeting:'2026-10-21'}]) {
    assert.deepEqual(period.submissionEvidence(invalid), {});
  }
  const next = {range:'2026-05-05 – 2026-11-04', ...period.submissionEvidence(chapter)};
  assert.equal(next.lastSubmittedMeeting, '2026-10-21');
  assert.match(period.submissionStatus(next, now), /最新已提交例會：2026-10-21/);
});

test('latest verified meeting removes pending hint only when it matches the latest expected meeting', () => {
  const current = {...chapter, lastSubmittedMeeting:'2026-10-21'};
  assert.doesNotMatch(period.submissionStatus(current, now), /待更新/);
});

test('all public entrypoints use the explicit submission status and uploads retain evidence', () => {
  const core = fs.readFileSync(__dirname+'/dashboard-core.js','utf8');
  const home = fs.readFileSync(__dirname+'/index.html','utf8');
  assert.match(core, /WeeklyPeriod\.submissionStatus\(CH\)/);
  assert.match(core, /Object\.assign\(chapter, verifiedSubmission\)/);
  assert.match(core, /WeeklyPeriod\.uploadEvidence\(CH\.est\?\.chapter \|\| CH/);
  assert.match(home, /WeeklyPeriod\.submissionStatus\(est\.chapter\)/);
  assert.doesNotMatch(home, /已取得本週統計/);
});


test('Taipei Wednesday fixes the prior Wednesday baseline until the following update', () => {
  for (const [stamp, cutoff, next, update] of [
    ['2026-10-27T15:59:59Z','2026-10-14','2026-10-21','2026-10-28'],
    ['2026-10-27T16:00:00Z','2026-10-21','2026-10-28','2026-11-04'],
    ['2026-10-29T04:00:00Z','2026-10-21','2026-10-28','2026-11-04'],
    ['2026-11-03T15:59:59Z','2026-10-21','2026-10-28','2026-11-04'],
    ['2026-11-03T16:00:00Z','2026-10-28','2026-11-04','2026-11-11'],
    ['2026-12-31T04:00:00Z','2026-12-23','2026-12-30','2027-01-06'],
    ['2027-01-05T16:00:00Z','2026-12-30','2027-01-06','2027-01-13'],
    ['2024-03-05T16:00:00Z','2024-02-28','2024-03-06','2024-03-13']
  ]) {
    const time=new Date(stamp);
    assert.equal(period.latestWednesday(time),cutoff);
    assert.equal(period.expectedMeeting(time),cutoff);
    assert.equal(period.nextWednesday(time),next);
    assert.equal(period.nextUpdate(time),update);
  }
  assert.match(period.submissionStatus(chapter,new Date('2026-11-04T04:00:00Z')),/待核對本次基準例會/);
  assert.match(period.submissionStatus(chapter,now),/下次週三 2026-11-04 處理 2026-10-28/);
});

test('new uploads require a Wednesday no later than this update baseline and six calendar months', () => {
  const current={start:'2026-04-22',end:'2026-10-21'};
  const next={start:'2026-04-29',end:'2026-10-28'};
  assert.deepEqual(period.validate(current,now),{start:'2026-04-22',asOf:'2026-10-21'});
  assert.deepEqual(period.validate(next,new Date('2026-11-04T04:00:00Z')),{start:'2026-04-29',asOf:'2026-10-28'});
  assert.equal(period.startFor('2026-08-31'),'2026-03-01');
  assert.equal(period.startFor('2024-08-31'),'2024-03-01');
  assert.equal(period.startFor('2024-02-29'),'2023-08-30');
  assert.equal(period.startFor('2026-12-30'),'2026-07-01');
  assert.throws(()=>period.validate({start:'2026-04-28',end:'2026-10-27'},now),/必須是週三/);
  assert.throws(()=>period.validate(next,now),/不得晚於本次更新基準/);
  assert.throws(()=>period.validate({start:'2026-04-21',end:'2026-10-21'},now),/六個月週報期間/);
  assert.throws(()=>period.validate(null,now),/報告內的起訖日期/);
  assert.throws(()=>period.validate(current,new Date('2026-10-27T15:59:59Z')),/不得晚於本次更新基準/);
});

test('upload requires independent verified submission evidence and never infers it from cutoff or weeks', () => {
  const range={start:'2026-04-22',end:'2026-10-21'};
  assert.equal(period.validateUpload(range,chapter,now).asOf,'2026-10-21');
  assert.throws(()=>period.validateUpload(range,{range:chapter.range,weeks:26},now),/尚未確認副主席已提交/);
  const next={start:'2026-04-29',end:'2026-10-28'};
  const nextTime=new Date('2026-11-04T04:00:00Z');
  assert.throws(()=>period.validateUpload(next,chapter,nextTime),/尚未確認副主席已提交 2026-10-28/);
  assert.equal(period.validateUpload(next,{...chapter,lastSubmittedMeeting:'2026-10-28',lastSubmittedMeetingSource:'BNI Connect 完成'},nextTime).asOf,'2026-10-28');
});

test('existing reports retain real historical dates without weakening upload validation', () => {
  const historical={start:'2026-04-29',end:'2026-10-28'};
  assert.deepEqual(period.validateStored(historical,now),{start:'2026-04-29',asOf:'2026-10-28'});
  assert.deepEqual(period.validateStored({start:'2026-04-22',end:'2026-10-21'},now),{start:'2026-04-22',asOf:'2026-10-21'});
  assert.throws(()=>period.validate(historical,now),/不得晚於本次更新基準/);
  assert.throws(()=>period.validateStored(historical,new Date('2026-10-28T04:00:00Z')),/不得晚於本次更新基準/);
  const saved=JSON.parse(fs.readFileSync(__dirname+'/data.json','utf8')).chapter.est.chapter;
  assert.equal(saved.range,'2026-04-29 – 2026-10-28');
  assert.equal(saved.lastSubmittedMeeting,'2026-10-21');
  assert.match(saved.lastSubmittedMeetingSource,/10\/21 完成，10\/28 草稿/);
});

test('new submission evidence requires explicit source and verification and is returned for one atomic upload', () => {
  const nextTime=new Date('2026-11-04T04:00:00Z');
  const entered={lastSubmittedMeeting:'2026-10-28',lastSubmittedMeetingSource:'BNI Connect PALMS 管理；2026-11-04 查閱：10/28 完成，出席報告含該週'};
  assert.deepEqual(period.uploadEvidence(chapter,chapter,false,now),period.submissionEvidence(chapter));
  assert.throws(()=>period.uploadEvidence(chapter,entered,false,nextTime),/修改提交紀錄/);
  assert.throws(()=>period.uploadEvidence(chapter,{...entered,lastSubmittedMeetingSource:chapter.lastSubmittedMeetingSource},true,nextTime),/修改提交紀錄/);
  assert.throws(()=>period.uploadEvidence(chapter,entered,true,now),/不得晚於本次更新基準/);
  assert.throws(()=>period.uploadEvidence(chapter,{lastSubmittedMeeting:'2026-10-28'},true,nextTime),/請填寫已核對/);
  const evidence=period.uploadEvidence(chapter,entered,true,nextTime);
  assert.deepEqual(evidence,entered);
  assert.equal(period.validateUpload({start:'2026-04-29',end:'2026-10-28'},evidence,nextTime).asOf,'2026-10-28');
});

test('new uploads cannot roll back a published later report; same cutoff can be reimported when eligible', () => {
  const old={start:'2026-04-22',end:'2026-10-21'};
  const equal={start:'2026-04-29',end:'2026-10-28'};
  assert.throws(()=>period.preventRollback(old,chapter),/目前已發布報告截止為 2026-10-28.*不能以較舊的 2026-10-21/);
  assert.throws(()=>period.validateUpload(old,chapter,now,chapter),/不能以較舊的/);
  assert.throws(()=>period.validateUpload(equal,chapter,now,chapter),/不得晚於本次更新基準/);
  const nextTime=new Date('2026-11-04T04:00:00Z');
  const verified={lastSubmittedMeeting:'2026-10-28',lastSubmittedMeetingSource:'BNI Connect PALMS；11/4確認10/28完成且出席含該週'};
  assert.equal(period.validateUpload(equal,verified,nextTime,chapter).asOf,'2026-10-28');
  assert.throws(()=>period.validateUpload(equal,chapter,nextTime,chapter),/尚未確認副主席已提交/);
  const core=fs.readFileSync(__dirname+'/dashboard-core.js','utf8');
  assert.match(core,/WeeklyPeriod\.preventRollback\(parsed\.range, CH\.est\?\.chapter \|\| CH\)/);
  assert.match(core,/WeeklyPeriod\.validateUpload\(\{start:dates\[0\],end:dates\[1\]\}, verifiedSubmission, new Date\(\), CH\.est\?\.chapter \|\| CH\)/);
});
