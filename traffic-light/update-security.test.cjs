'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const {
  createSecurityClient, describeWriteFailure, showWriteFailure, confirmAndPostChapterUpdate
} = require('./dashboard-core.js');

const REVISION = '0123456789abcdef0123456789abcdef01234567';
const SITE_KEY = '0x4AAAAAAAtest_public_key';
const coreSource = fs.readFileSync(require.resolve('./dashboard-core.js'), 'utf8');

function jsonResponse(status, value, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {get: name => headers[name] || null},
    json: async () => value
  };
}

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.attributes = {};
    this.open = false;
    this.textContent = '';
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  remove() { this.removed = true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.listeners.click?.({preventDefault(){}}); }
}

function makeHarness({siteKey = SITE_KEY, configStatus = 200, revisionResponse, postResponse, timeoutMs = 1000} = {}) {
  const calls = [];
  const scripts = [];
  const dialogs = [];
  const renders = [];
  const removed = [];
  const reset = [];
  const win = {};
  const documentObject = {
    body: new Element('body'),
    head: {
      appendChild(script) {
        scripts.push(script);
        win.turnstile = {
          render(_container, options) {
            renders.push(options);
            return 'widget-' + renders.length;
          },
          reset(id) { reset.push(id); },
          remove(id) { removed.push(id); }
        };
        script.onload();
      }
    },
    createElement(tagName) {
      const element = new Element(tagName);
      if (tagName === 'dialog') dialogs.push(element);
      return element;
    },
    createTextNode(text) { return {textContent: text}; }
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, options});
    if (url === 'https://api.test/write?revision=1') {
      return revisionResponse || jsonResponse(200, {ok: true, baseRevision: REVISION});
    }
    if (url === '/security-config.json') {
      return jsonResponse(configStatus, {turnstileSiteKey: siteKey});
    }
    if (url === 'https://api.test/write' && options.method === 'POST') {
      return postResponse || jsonResponse(200, {ok: true});
    }
    throw new Error('unexpected request: ' + url);
  };
  const client = createSecurityClient({
    fetchImpl,
    documentObject,
    windowObject: win,
    apiUrl: 'https://api.test/write',
    configUrl: '/security-config.json',
    timeoutMs
  });
  return {client, calls, scripts, dialogs, renders, removed, reset};
}

async function waitForRender(harness, expected = harness.renders.length + 1) {
  for (let i = 0; i < 20 && harness.renders.length < expected; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(harness.renders.length, expected, 'Turnstile widget should render');
}

test('revision preview does not load Turnstile; each write gets a new token and cleans its widget', async () => {
  const harness = makeHarness();
  assert.equal(await harness.client.prepareRevision(), REVISION);
  assert.equal(harness.scripts.length, 0, 'revision read must not load Turnstile');

  const first = harness.client.postProtected({chapterOnly: true}, REVISION);
  await waitForRender(harness);
  assert.match(harness.scripts[0].src, /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit$/);
  assert.equal(harness.renders[0].action, 'traffic-light-update');
  harness.renders[0].callback('fresh-token-1');
  const firstResult = await first;
  assert.equal(firstResult.data.ok, true);

  const second = harness.client.postProtected({leftMembers: ['Member']}, REVISION);
  await waitForRender(harness);
  harness.renders[1].callback('fresh-token-2');
  await second;
  const posts = harness.calls.filter(call => call.options.method === 'POST');
  assert.equal(posts.length, 2);
  assert.deepEqual(posts.map(call => JSON.parse(call.options.body).turnstileToken), ['fresh-token-1', 'fresh-token-2']);
  assert.ok(posts.every(call => JSON.parse(call.options.body).baseRevision === REVISION));
  assert.deepEqual(harness.reset, ['widget-1', 'widget-2']);
  assert.deepEqual(harness.removed, ['widget-1', 'widget-2']);
});

test('empty public key and invalid revision prevent script loading and POST', async () => {
  const empty = makeHarness({siteKey: ''});
  await assert.rejects(empty.client.postProtected({}, REVISION), /更新驗證尚未設定，請聯絡維護者/);
  assert.equal(empty.scripts.length, 0);
  assert.equal(empty.calls.some(call => call.options.method === 'POST'), false);

  const valid = makeHarness();
  await assert.rejects(valid.client.postProtected({}, 'bad-revision'), /沒有可用的資料版本/);
  assert.equal(valid.calls.length, 0);
});

test('chapter report changes require explicit confirmation before revision read, challenge, or POST', async () => {
  const cancelled = makeHarness();
  const cancelResult = await confirmAndPostChapterUpdate({
    confirmFn: message => {
      assert.match(message, /分會報告.*七項分會指標/);
      return false;
    },
    reportMonth: '2026 年 9 月',
    score: 82,
    prepareRevision: cancelled.client.prepareRevision,
    postProtected: cancelled.client.postProtected,
    payload: {chapterOnly: true}
  });
  assert.deepEqual(cancelResult, {confirmed: false});
  assert.equal(cancelled.calls.length, 0, 'cancellation does not fetch revision or config');
  assert.equal(cancelled.scripts.length, 0, 'cancellation does not load Turnstile');

  const confirmed = makeHarness();
  const pending = confirmAndPostChapterUpdate({
    confirmFn: () => true,
    reportMonth: '2026 年 9 月',
    score: 82,
    prepareRevision: confirmed.client.prepareRevision,
    postProtected: confirmed.client.postProtected,
    payload: {chapterOnly: true}
  });
  await waitForRender(confirmed);
  confirmed.renders[0].callback('fresh-chapter-token');
  const result = await pending;
  assert.equal(result.confirmed, true);
  assert.equal(result.data.ok, true);
  assert.deepEqual(confirmed.calls.map(call => call.url), [
    'https://api.test/write?revision=1', '/security-config.json', 'https://api.test/write'
  ]);
  assert.equal(confirmed.calls.filter(call => call.options.method === 'POST').length, 1);

  const missingRevision = makeHarness({revisionResponse: jsonResponse(503, {ok: false})});
  await assert.rejects(confirmAndPostChapterUpdate({
    confirmFn: () => true,
    reportMonth: '2026 年 9 月',
    score: 82,
    prepareRevision: missingRevision.client.prepareRevision,
    postProtected: missingRevision.client.postProtected,
    payload: {chapterOnly: true}
  }), /無法取得資料版本/);
  assert.equal(missingRevision.calls.length, 1, 'failed metadata read is the only request');
  assert.equal(missingRevision.scripts.length, 0);
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

test('cancelled, failed, or timed out Turnstile attempts do not POST', async t => {
  await t.test('user cancellation', async () => {
    const harness = makeHarness();
    const pending = harness.client.postProtected({}, REVISION);
    await waitForRender(harness);
    const dialog = harness.dialogs[0];
    const cancel = dialog.children.find(child => child.tagName === 'button');
    cancel.click();
    await assert.rejects(pending, {name: 'AbortError'});
    assert.equal(harness.calls.some(call => call.options.method === 'POST'), false);
    assert.deepEqual(harness.removed, ['widget-1']);
  });

  await t.test('challenge error callback', async () => {
    const harness = makeHarness();
    const pending = harness.client.postProtected({}, REVISION);
    await waitForRender(harness);
    harness.renders[0]['error-callback']();
    await assert.rejects(pending, /更新驗證失敗/);
    assert.equal(harness.calls.some(call => call.options.method === 'POST'), false);
    assert.deepEqual(harness.removed, ['widget-1']);
  });

  await t.test('timeout', async () => {
    const harness = makeHarness({timeoutMs: 10});
    const pending = harness.client.postProtected({}, REVISION);
    await waitForRender(harness);
    await assert.rejects(pending, /更新驗證逾時/);
    assert.equal(harness.calls.some(call => call.options.method === 'POST'), false);
    assert.deepEqual(harness.removed, ['widget-1']);
  });
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
