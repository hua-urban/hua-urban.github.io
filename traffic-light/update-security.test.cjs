'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const {
  createSecurityClient, describeWriteFailure, showWriteFailure, confirmAndPostChapterUpdate
} = require('./dashboard-core.js');

const REVISION = '0123456789abcdef0123456789abcdef01234567';
const coreSource = fs.readFileSync(require.resolve('./dashboard-core.js'), 'utf8');

function jsonResponse(status, value, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {get: name => headers[name] || null},
    json: async () => value
  };
}

function makeHarness({revisionResponse, postResponse} = {}) {
  const calls = [];
  const client = createSecurityClient({
    apiUrl: 'https://api.test/write',
    documentObject: {createElement() { throw Error('Must not show CAPTCHA'); }},
    fetchImpl: async (url, options = {}) => {
      calls.push({url, options});
      if (url === 'https://api.test/write?revision=1') return revisionResponse || jsonResponse(200, {ok:true, baseRevision:REVISION});
      assert.equal(url, 'https://api.test/write', 'no security config or CAPTCHA request');
      assert.equal(options.method, 'POST');
      return postResponse || jsonResponse(200, {ok:true});
    }
  });
  return {client, calls};
}

test('updates POST without CAPTCHA and do not impose a client upload quota', async () => {
  const h = makeHarness();
  assert.equal(await h.client.prepareRevision(), REVISION);
  for (let i=0;i<5;i++) assert.equal((await h.client.postProtected({chapterOnly:true},REVISION)).data.ok,true);
  const posts=h.calls.filter(c=>c.options.method==='POST');
  assert.equal(posts.length,5);
  for (const p of posts) assert.deepEqual(JSON.parse(p.options.body),{chapterOnly:true,baseRevision:REVISION});
});

test('invalid revision blocks submission', async () => {
  const h=makeHarness();
  await assert.rejects(h.client.postProtected({},'bad'),/沒有可用的資料版本/);
  assert.equal(h.calls.length,0);
});

test('chapter updates still require confirmation and a valid base revision', async () => {
  const h=makeHarness();
  const args={reportMonth:'2026 年 9 月',score:82,prepareRevision:h.client.prepareRevision,postProtected:h.client.postProtected,payload:{chapterOnly:true}};
  assert.deepEqual(await confirmAndPostChapterUpdate({...args,confirmFn:()=>false}),{confirmed:false});
  assert.equal(h.calls.length,0);
  assert.equal((await confirmAndPostChapterUpdate({...args,confirmFn:()=>true})).data.ok,true);
  assert.equal(h.calls.length,2);
  const bad=makeHarness({revisionResponse:jsonResponse(503,{ok:false})});
  await assert.rejects(confirmAndPostChapterUpdate({...args,confirmFn:()=>true,prepareRevision:bad.client.prepareRevision,postProtected:bad.client.postProtected}),/無法取得資料版本/);
  assert.equal(bad.calls.length,1);
});

test('chapter report refresh is wired to a user action rather than called during score rendering', () => {
  const renderStart = coreSource.indexOf('function renderChapterSrc(){');
  const refreshStart = coreSource.indexOf('async function refreshChapter(){', renderStart);
  assert.ok(renderStart >= 0 && refreshStart > renderStart);
  const renderSource = coreSource.slice(renderStart, refreshStart);
  assert.match(renderSource, /addEventListener\('click', refreshChapter\)/);
  const refreshEnd = coreSource.indexOf('\n}\n', refreshStart) + 3;
  assert.ok(refreshEnd > refreshStart);
  const outsideRefresh = coreSource.slice(0, refreshStart) + coreSource.slice(refreshEnd);
  assert.doesNotMatch(outsideRefresh, /\brefreshChapter\s*\(/,
    'refreshChapter must not be invoked automatically when the dashboard renders');
});

test('429 and 409 responses are surfaced, and API error text is assigned as text', () => {
  const rate = describeWriteFailure(jsonResponse(429, {retryAfter: 17}), {retryAfter: 17});
  assert.equal(rate.retryAfter, 17);
  assert.match(rate.message, /17 秒/);
  assert.equal(describeWriteFailure(jsonResponse(409, {}), {}).status, 409);

  let assignedText = '';
  const output = {
    set textContent(value) { assignedText = value; },
    set innerHTML(_value) { throw new Error('must not use innerHTML'); }
  };
  const payload = '<img src=x onerror=alert(1)>';
  showWriteFailure(jsonResponse(400, {ok: false, error: payload}), {ok: false, error: payload}, output);
  assert.equal(assignedText, payload);
});
