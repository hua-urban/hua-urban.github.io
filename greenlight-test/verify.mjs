// Run from this directory with: node verify.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(dir, name), "utf8");
const index = read("index.html");
const keyin = read("keyin.js");
const bridge = read("bridge.html");
const inline = html => html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
new vm.Script(inline(index), { filename: "index.html" });
new vm.Script(keyin, { filename: "keyin.js" });
new vm.Script(inline(bridge), { filename: "bridge.html" });

const bundle = index.match(/^const KEYIN_SOURCE = (".*");$/m);
assert(bundle, "bookmarklet bundle is present");
assert.equal(JSON.parse(bundle[1]), keyin, "bookmarklet bundle matches current keyin.js");
const bookmarklet = vm.runInNewContext(`const KEYIN_SOURCE = ${bundle[1]}; ${index.match(/^const BOOKMARKLET = .*;$/m)[0]} BOOKMARKLET`, {
  URL, JSON, encodeURIComponent, location: { href: "https://example.test/greenlight/" },
});
assert(bookmarklet.startsWith("javascript:"));
new vm.Script(decodeURIComponent(bookmarklet.slice("javascript:".length)), { filename: "bookmarklet" });
assert(!bookmarklet.includes("/keyin.js"), "bookmarklet does not load an external script");

const defaults = JSON.parse(read("defaults.json"));
const palms = JSON.parse(read("palms.json"));
const training = JSON.parse(read("training.json"));
assert(defaults.members.length >= 40, "official roster contains a plausible chapter roster");
assert(palms.members.length >= 40 && palms.members.length <= defaults.members.length, "PALMS contains current-member rows");
assert.equal(palms.chapter.frequency, "weekly", "PALMS uses the full-cycle weekly dataset");
assert(!palms.chapter.est, "PALMS must not use the outer old-baseline chapter");
const periodDates = palms.chapter.range.match(/\d{4}-\d{2}-\d{2}/g) || [];
assert.equal(periodDates.length, 2, "PALMS reports both full-cycle dates");
assert.equal(palms.chapter.asOf, periodDates[1], "PALMS asOf matches the cycle end");
const cycleEnd = new Date(periodDates[1] + "T00:00:00Z");
const expectedStart = new Date(cycleEnd);
expectedStart.setUTCDate(1);
expectedStart.setUTCMonth(expectedStart.getUTCMonth() - 6);
const daysInMonth = new Date(Date.UTC(expectedStart.getUTCFullYear(), expectedStart.getUTCMonth() + 1, 0)).getUTCDate();
expectedStart.setUTCDate(Math.min(cycleEnd.getUTCDate(), daysInMonth) + 1);
assert.equal(periodDates[0], expectedStart.toISOString().slice(0, 10), "PALMS covers the complete six-month cycle");
assert.equal(training.records.length, 191);
assert(defaults.members.every(m => /^\d{3}$/.test(m.no) && m.name && m.job && !/範例|小明|小華|大同/.test(m.name)));
assert.equal(new Set(defaults.members.map(m => m.no)).size, defaults.members.length);
const zh3 = s => String(s).replace(/\s+/g, "").match(/^[\u4e00-\u9fa5]+/)?.[0]?.slice(0, /^(張簡|歐陽|司馬|諸葛|上官|東方|皇甫|范姜|司徒|夏侯)/.test(s) ? 4 : 3);
const rosterKeys = new Set(defaults.members.map(m => zh3(m.name)));
assert(palms.members.every(r => Array.isArray(r) && rosterKeys.has(zh3(r[1]))), "PALMS rows belong to current members");
assert(defaults.events.every(e => e.name && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.members.length), "official activity events are valid interaction prompts");
assert(index.includes('const LIGHT_DATA = `${OFFICIAL_DATA_ROOT}/palms.json`'));
assert(index.includes('const ROSTER_DATA = `${OFFICIAL_DATA_ROOT}/defaults.json`'));
assert(index.includes('const SB_URL = ""'));
assert(index.includes('Math.ceil(2 * m.weeks)') && index.includes('Math.ceil(1.5 * m.weeks)'));
assert(index.includes('data-gap-flow="${k}"') && index.includes('還差 ${remaining} ${goal.unit}'));
assert(!index.includes('href="admin.html"'), "public main page does not expose the admin link");
assert(index.indexOf('portalCard("121", true)') < index.indexOf('portalCard("ref", true)')
  && index.indexOf('portalCard("ref", true)') < index.indexOf('id="memberTraining"'), "training records appear after the referral flow");
assert(index.includes('hua-urban-greenlight-submissions-v1'));
assert(index.includes('已保存在此瀏覽器'));
assert(index.includes('data-f="referredName"'));
assert(index.includes('data-f="place" list="meeting-locations"'));
assert(index.includes('data-gf="venue" list="meeting-locations"'));
assert(index.includes('HuaTraining.renderFor(me.name, me.chapter)'));
assert(keyin.includes('location.hostname') && keyin.includes('www.bniconnectglobal.com'));
const blocked = [];
vm.runInNewContext(keyin, { location: { protocol: "https:", hostname: "example.test" }, alert: message => blocked.push(message) });
assert.equal(blocked.length, 1, "bookmarklet aborts on an unapproved host before touching the page");
assert(keyin.includes('r.referredName') && keyin.includes('refDescriptionField(d)'));
assert(keyin.includes('data.pending[k]') && keyin.includes('successSignal(before)'));
assert(keyin.includes('e.source !== bridgeWindow') && keyin.includes('e.data?.nonce !== bridgeNonce'));
assert(bridge.includes('event.source !== window.opener') && bridge.includes('BNI_ORIGINS.has(event.origin)'));
assert(bridge.includes('event.data?.nonce !== nonce'));
assert(fs.existsSync(path.join(dir, "vendor/xlsx.full.min.js")));
console.log(`PASS: scripts and bundled bookmarklet parse; ${defaults.members.length} roster members, ${palms.members.length} current PALMS rows, ${defaults.events.length} official activities, and ${training.records.length} training registrations validated.`);
