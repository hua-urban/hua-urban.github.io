import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFullCyclePalms } from './greenlight-palms.mjs';

function source() {
  return {
    chapter: {
      range: '2026-03-01 – 2026-08-31',
      est: {
        updatedAt: '2026-10-13T05:41:17.259Z',
        chapter: { range: '2026-04-08 – 2026-10-07', asOf: '2026-10-07', frequency: 'weekly' },
        members: [[1, '完整週期會員', 23, 23, 0, 0, 0, 0, 36, 21, 12, 106, 20, 5065760]],
      },
    },
    members: [[1, '舊基準會員', 17]],
  };
}

test('selects full-cycle chapter and member rows together, never the older outer baseline', () => {
  const data = source();
  const selected = selectFullCyclePalms(data);
  assert.equal(selected, data.chapter.est);
  assert.equal(selected.members[0][2], 23);
  assert.equal(selected.members[0][11], 106);
  assert.equal(selected.chapter.range, '2026-04-08 – 2026-10-07');
});

test('missing full-cycle data is rejected instead of silently using the older baseline', () => {
  const data = source(); delete data.chapter.est;
  assert.throws(() => selectFullCyclePalms(data), /Full-cycle PALMS/);
});

test('a partial month cannot be accepted as the full six-month report', () => {
  const data = source(); data.chapter.est.chapter.range = '2026-10-01 – 2026-10-07';
  assert.throws(() => selectFullCyclePalms(data), /六個月週報期間/);
});

test('report end and asOf must agree', () => {
  const data = source(); data.chapter.est.chapter.asOf = '2026-10-14';
  assert.throws(() => selectFullCyclePalms(data), /asOf/);
});
