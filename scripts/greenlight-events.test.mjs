import test from "node:test";
import assert from "node:assert/strict";
import { currentDateInTaipei, mapEvents } from "./greenlight-events.mjs";

const members = [{ no: "001" }, { no: "043" }];

test("imports every activity dated before today and orders newest first", () => {
  const rows = [
    { 日期: "2026-06-12", 活動標題: "June activity", 類型: "活動" },
    { 日期: "2026-10-21", 活動標題: "Future activity", 類型: "活動" },
    { 日期: "2026-09-12", 活動標題: "September activity", 類型: "參訪" },
    { 日期: "2026-10-16", 活動標題: "Today activity", 類型: "活動" },
    { 日期: "2026-07-03", 活動標題: "July activity", 類型: "活動" },
    { 日期: "2026-10-14", 活動標題: "Recent activity", 類型: "活動" },
    { 日期: "2026-06-01", 活動標題: "Older activity", 類型: "活動" },
  ];

  const events = mapEvents(rows, members, "2026-10-16");
  assert.deepEqual(events.map(event => event.date), [
    "2026-10-14",
    "2026-09-12",
    "2026-07-03",
    "2026-06-12",
    "2026-06-01",
  ]);
  assert.deepEqual(events[0], {
    id: "official-2026-10-14-6cb44b56",
    name: "Recent activity",
    date: "2026-10-14",
    members: ["001", "043"],
    outside: [],
  });
});

test("includes all event types and title forms, while ignoring blank titles and invalid dates", () => {
  const rows = [
    { 日期: "2026-10-15", 活動標題: "保留新類型", 類型: "參訪" },
    { 日期: "2026-10-15", 活動標題: "例會", 類型: "例會" },
    { 日期: "2026-10-15", 活動標題: "組聚", 類型: "組聚" },
    { 日期: "2026-10-15", 名稱: "沒有類型的例會" },
    { 日期: "2026-02-31", 活動標題: "無效日期", 類型: "活動" },
    { 日期: "2026-10-15", 活動標題: "   ", 類型: "活動" },
  ];

  assert.deepEqual(mapEvents(rows, members, "2026-10-16").map(event => event.name), [
    "保留新類型",
    "例會",
    "組聚",
    "沒有類型的例會",
  ]);
});

test("uses Taipei's calendar date for the cutoff", () => {
  assert.equal(currentDateInTaipei(new Date("2026-10-15T16:30:00.000Z")), "2026-10-16");
});

test("rejects invalid feed shapes and cutoff dates", () => {
  assert.throws(() => mapEvents({}, members, "2026-10-16"), /feed is not an array/);
  assert.throws(() => mapEvents([], members, "2026-02-31"), /valid YYYY-MM-DD/);
});
