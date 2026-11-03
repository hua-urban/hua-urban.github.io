import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  createMemberRegistryClient,
  normalizeNameKey,
  reconcileWeeklyRows
} = require('../assets/member-registry.js');

const memberA = {
  id: 1, memberId: '11111111-1111-4111-8111-111111111111', memberNo: '003',
  name: '王常殷 Hubert', profession: '都更', role: '副主席', aliases: ['Hubert Wang', '王常殷']
};
const memberB = {
  id: 2, memberId: '22222222-2222-4222-8222-222222222222', memberNo: '017',
  name: '新會員', profession: '顧問', role: '', aliases: []
};

function payload(overrides = {}) {
  return {
    ok: true,
    members: [memberA, memberB],
    groups: [{code: 'D', name: 'D 組', leader: '組長', schedule: '週三'}],
    rosterVersion: 7,
    effectiveAsOf: '2026-11-03',
    contentHash: 'sha256:sample',
    ...overrides
  };
}

function response(body, options = {}) {
  return {ok: options.ok !== false, status: options.status || 200, json: async () => body};
}

test('load activates only a versioned, well-formed snapshot and requests without persistent cache', async () => {
  let request;
  const client = createMemberRegistryClient({fetchImpl: async (...args) => {
    request = args;
    return response(payload());
  }, now: () => 1234});

  const result = await client.load();

  assert.equal(result.ok, true);
  assert.equal(result.latestConfirmed, true);
  assert.equal(result.status, 'active');
  assert.equal(result.snapshot.rosterVersion, 7);
  assert.equal(result.snapshot.members[0].role, '副主席');
  assert.deepEqual(request[1] && {
    method: request[1].method,
    cache: request[1].cache,
    credentials: request[1].credentials
  }, {method: 'GET', cache: 'no-store', credentials: 'omit'});
  assert.match(request[0], /_huaMembers=1234$/);
});

test('legacy unversioned response and duplicate IDs/member numbers never activate', async (t) => {
  await t.test('legacy response', async () => {
    const client = createMemberRegistryClient({fetchImpl: async () => response({
      ok: true, members: [memberA], groups: []
    })});
    const result = await client.load();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'unversioned');
    assert.equal(result.error.message, '尚未接入中央名冊。');
    assert.equal(result.snapshot, null);
  });

  await t.test('duplicate member ID', async () => {
    const duplicate = {...memberB, id: memberA.id};
    const client = createMemberRegistryClient({fetchImpl: async () => response(payload({members: [memberA, duplicate]}))});
    const result = await client.load();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'invalid');
  });

  await t.test('duplicate member number', async () => {
    const duplicate = {...memberB, memberNo: memberA.memberNo};
    const client = createMemberRegistryClient({fetchImpl: async () => response(payload({members: [memberA, duplicate]}))});
    const result = await client.load();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'invalid');
  });
});

test('unrecognized roles stay display-only and are not surfaced as privileges', async () => {
  const client = createMemberRegistryClient({fetchImpl: async () => response(payload({
    members: [{...memberA, role: '管理員'}, memberB]
  }))});
  const result = await client.load();
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.members[0].role, '');
});

test('timeout marks latest unconfirmed and keeps the prior in-memory snapshot available', async () => {
  let calls = 0;
  const client = createMemberRegistryClient({
    timeoutMs: 10,
    fetchImpl: async (_url, options) => {
      calls += 1;
      if (calls === 1) return response(payload());
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
      });
    }
  });

  const first = await client.load();
  const second = await client.load({force: true});

  assert.equal(second.ok, false);
  assert.equal(second.status, 'timeout');
  assert.equal(second.latestConfirmed, false);
  assert.equal(second.snapshot, first.snapshot);
});

test('weekly reconciliation uses exact normalized aliases, central number/name, and separate pending states', () => {
  const central = [
    {...memberA, aliases: ['Hubert Wang', '王常殷']},
    {...memberB, aliases: ['Same Name']},
    {...memberB, id: 3, memberId: '33333333-3333-4333-8333-333333333333', memberNo: '021', name: '另一人', aliases: ['Same Name']},
    {...memberB, id: 4, memberId: '44444444-4444-4444-8444-444444444444', memberNo: '028', name: '雙列會員', aliases: ['Palms One', 'Palms Two']}
  ];
  const palms = [
    [99, ' Hubert　Wang ', 26, 25, 0, 0, 0, 0, 4, 0, 3, 2, 1, 500],
    [98, 'Same Name', 20, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [97, 'Palms One', 20, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [96, 'Palms Two', 19, 19, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [95, '離會者', 12, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  const original = structuredClone(palms);

  const result = reconcileWeeklyRows(central, palms);

  assert.equal(normalizeNameKey(' Hubert　Wang '), 'hubertwang');
  assert.equal(result.members.length, 1);
  assert.equal(result.members[0][0], '003');
  assert.equal(result.members[0][1], '王常殷 Hubert');
  assert.equal(result.members[0][2], 26, 'PALMS metrics are preserved without recalculation');
  assert.equal(result.members[0].memberId, memberA.memberId);
  assert.deepEqual(result.pending.map(({memberNo, status}) => [memberNo, status]), [
    ['017', '待核對'], ['021', '待核對'], ['028', '待核對']
  ]);
  assert.deepEqual(palms, original, 'source PALMS rows remain unchanged');
  assert.ok(!result.members.some(row => row[1] === '離會者'));
});

test('new current member without a PALMS row is pending and receives no numeric score fields', () => {
  const result = reconcileWeeklyRows([memberA], []);
  assert.deepEqual(result.members, []);
  assert.deepEqual(result.pending, [{
    memberId: memberA.memberId, memberNo: '003', name: '王常殷 Hubert', status: '待PALMS資料'
  }]);
});
