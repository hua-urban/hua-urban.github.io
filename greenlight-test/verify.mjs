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
assert.equal(defaults.members.length, 55);
assert.equal(palms.members.length, 55);
assert.equal(training.records.length, 191);
assert(defaults.members.every(m => /^\d{3}$/.test(m.no) && m.name && m.job && !/範例|小明|小華|大同/.test(m.name)));
assert.equal(new Set(defaults.members.map(m => m.no)).size, 55);
const zh3 = s => String(s).replace(/\s+/g, "").match(/^[\u4e00-\u9fa5]+/)?.[0]?.slice(0, /^(張簡|歐陽|司馬|諸葛|上官|東方|皇甫|范姜|司徒|夏侯)/.test(s) ? 4 : 3);
assert.deepEqual(new Set(defaults.members.map(m => zh3(m.name))), new Set(palms.members.map(r => zh3(r[1]))));
assert(index.includes('const LIGHT_DATA = "./palms.json"'));
assert(index.includes('const SB_URL = ""'));
assert(index.includes('Math.ceil(2 * m.weeks)') && index.includes('Math.ceil(1.5 * m.weeks)'));
assert(index.includes('hua-urban-greenlight-submissions-v1'));
assert(index.includes('已保存在此瀏覽器'));
assert(index.includes('data-f="referredName"'));
assert(index.includes('data-f="place" list="meeting-locations"'));
assert(index.includes('data-gf="venue" list="meeting-locations"'));
assert(index.includes('HuaTraining.renderFor(me.name)'));
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
console.log("PASS: scripts and bundled bookmarklet parse; 55 verified roster/PALMS members, 191 real training records; local storage, score targets, referral fields, and bridge guards are present.");
