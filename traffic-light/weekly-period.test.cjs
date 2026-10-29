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
  assert.match(status, /待更新/);
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
  const next = {range:'2026-05-06 – 2026-11-04', ...period.submissionEvidence(chapter)};
  assert.equal(next.lastSubmittedMeeting, '2026-10-21');
  assert.match(period.submissionStatus(next, now), /最新已提交例會：2026-10-21/);
});

test('latest verified meeting removes pending hint only when it matches the latest expected meeting', () => {
  const current = {...chapter, lastSubmittedMeeting:'2026-10-28'};
  assert.doesNotMatch(period.submissionStatus(current, now), /待更新/);
});

test('all public entrypoints use the explicit submission status and uploads retain evidence', () => {
  const core = fs.readFileSync(__dirname+'/dashboard-core.js','utf8');
  const home = fs.readFileSync(__dirname+'/index.html','utf8');
  assert.match(core, /WeeklyPeriod\.submissionStatus\(CH\)/);
  assert.match(core, /Object\.assign\(chapter, WeeklyPeriod\.submissionEvidence\(CH\.est\?\.chapter\)\)/);
  assert.match(home, /WeeklyPeriod\.submissionStatus\(est\.chapter\)/);
  assert.doesNotMatch(home, /已取得本週統計/);
});
