// Run from this directory with: node verify.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { normalizeNameKey } = require("../assets/member-registry.js");
const dir = path.dirname(fileURLToPath(import.meta.url));
const readBytes = name => fs.readFileSync(path.join(dir, name));
const read = name => readBytes(name).toString("utf8");
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const inlineScripts = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

const index = read("index.html");
const keyin = read("keyin.js");
const bridge = read("bridge.html");
const launcherScripts = inlineScripts(index);
assert(launcherScripts.length > 0, "public startup launcher has inline JavaScript");
launcherScripts.forEach((source, i) => new vm.Script(source, { filename: `index.html:inline-${i + 1}` }));

// The public page is a startup launcher, not the full application UI.
const CLOUD_RUN_ORIGIN = "https://hua-greenlight-umydisxveq-de.a.run.app";
const appUrlMatch = index.match(/\bconst\s+app\s*=\s*new\s+URL\(\s*(["'])(https:\/\/[^"']+)\1\s*\)/);
assert(appUrlMatch, "startup launcher contains its Cloud Run target URL");
const appUrl = new URL(appUrlMatch[2]);
assert.equal(appUrl.origin, CLOUD_RUN_ORIGIN, "startup launcher targets the fixed Cloud Run origin");
assert.equal(appUrl.pathname, "/", "startup launcher targets the Cloud Run service root");
const directLinks = [...index.matchAll(/<a\b[^>]*href\s*=\s*(["'])(https:\/\/[^"']+)\1/gi)]
  .map(match => new URL(match[2]).origin);
assert(directLinks.includes(CLOUD_RUN_ORIGIN), "noscript fallback points to the same Cloud Run service");
const launcherJavaScript = launcherScripts.join("\n");
assert.match(launcherJavaScript, /app\.search\s*=\s*location\.search/, "launcher forwards query parameters");
assert.match(launcherJavaScript, /app\.hash\s*=\s*location\.hash/, "launcher forwards the URL fragment");
assert.match(launcherJavaScript, /new\s+URL\(\s*["']\/favicon\.ico["']\s*,\s*app\s*\)/, "launcher probes the Cloud Run service");
assert.match(launcherJavaScript, /location\.replace\(app\.href\)/, "launcher redirects to the application when ready");

const bridgeScripts = inlineScripts(bridge);
assert(bridgeScripts.length > 0, "legacy bridge contains inline JavaScript");
bridgeScripts.forEach((source, i) => new vm.Script(source, { filename: `bridge.html:inline-${i + 1}` }));
new vm.Script(keyin, { filename: "keyin.js" });

const defaultsBytes = readBytes("defaults.json");
const palmsBytes = readBytes("palms.json");
const trainingBytes = readBytes("training.json");
const defaults = JSON.parse(defaultsBytes.toString("utf8"));
const palms = JSON.parse(palmsBytes.toString("utf8"));
const training = JSON.parse(trainingBytes.toString("utf8"));
const provenance = JSON.parse(read("data-provenance.json"));

assert(isRecord(defaults) && Array.isArray(defaults.members) && defaults.members.length > 0,
  "central roster is a nonempty member array");
assert(defaults.members.every(member => isRecord(member)
  && nonempty(member.no)
  && nonempty(member.memberId)
  && nonempty(member.name)
  && nonempty(member.job)
  && Array.isArray(member.aliases)
  && member.aliases.length > 0
  && member.aliases.every(nonempty)), "central member records have required fields and aliases");
const memberIds = defaults.members.map(member => member.memberId);
const memberNumbers = defaults.members.map(member => member.no);
assert.equal(new Set(memberIds).size, memberIds.length, "stable member IDs are unique");
assert.equal(new Set(memberNumbers).size, memberNumbers.length, "displayed member numbers are unique");
assert.equal(typeof normalizeNameKey, "function", "shared member registry name normalizer is available");
assert.equal(normalizeNameKey(" Ｈｕｂｅｒｔ・Wang "), "hubertwang", "shared normalizer handles Unicode, spaces, and punctuation");

assert(isRecord(palms) && isRecord(palms.chapter) && Array.isArray(palms.members) && palms.members.length > 0,
  "PALMS contains chapter metadata and nonempty member rows");
assert(palms.members.every(row => Array.isArray(row) && row.length > 1 && nonempty(row[1])),
  "PALMS rows contain a member name");
const aliasesToMembers = new Map();
for (const member of defaults.members) {
  const memberAliasKeys = new Set([member.name, ...member.aliases].map(normalizeNameKey));
  assert(!memberAliasKeys.has(""), "member names and aliases normalize to nonempty keys");
  for (const aliasKey of memberAliasKeys) {
    const matches = aliasesToMembers.get(aliasKey) ?? new Set();
    matches.add(member.memberId);
    aliasesToMembers.set(aliasKey, matches);
  }
}
assert([...aliasesToMembers.values()].every(matches => matches.size === 1),
  "normalized aliases do not conflict across central members");
const matchedMemberIds = new Set();
for (const row of palms.members) {
  const aliasKey = normalizeNameKey(row[1]);
  const matches = aliasesToMembers.get(aliasKey) ?? new Set();
  assert.equal(matches.size, 1, "each PALMS member name matches one normalized central alias");
  const [memberId] = matches;
  assert(!matchedMemberIds.has(memberId), "PALMS rows map one-to-one to central members");
  matchedMemberIds.add(memberId);
}

assert.equal(palms.chapter.frequency, "weekly", "PALMS uses weekly data");
assert(!palms.chapter.est, "PALMS does not use the outer old-baseline chapter");
const periodDates = palms.chapter.range.match(/\d{4}-\d{2}-\d{2}/g) || [];
assert.equal(periodDates.length, 2, "PALMS reports both cycle dates");
assert.equal(palms.chapter.asOf, periodDates[1], "PALMS asOf matches the cycle end");
const cycleEnd = new Date(`${periodDates[1]}T00:00:00Z`);
assert(!Number.isNaN(cycleEnd.valueOf()), "PALMS cycle end is a valid date");
const expectedStart = new Date(cycleEnd);
expectedStart.setUTCDate(1);
expectedStart.setUTCMonth(expectedStart.getUTCMonth() - 6);
const daysInMonth = new Date(Date.UTC(expectedStart.getUTCFullYear(), expectedStart.getUTCMonth() + 1, 0)).getUTCDate();
expectedStart.setUTCDate(Math.min(cycleEnd.getUTCDate(), daysInMonth) + 1);
assert.equal(periodDates[0], expectedStart.toISOString().slice(0, 10), "PALMS covers the complete six-month cycle");

assert(Array.isArray(defaults.events) && defaults.events.length > 0, "official activities are nonempty");
assert(defaults.events.every(event => isRecord(event)
  && nonempty(event.name)
  && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
  && Array.isArray(event.members)
  && event.members.length > 0), "official activity events have valid dates and member candidates");
assert(isRecord(training) && Array.isArray(training.records) && training.records.length > 0,
  "training registrations are nonempty");
assert(training.records.every(record => isRecord(record)
  && nonempty(record.id)
  && nonempty(record.name)
  && nonempty(record.chapter)
  && nonempty(record.course)
  && nonempty(record.status)), "training registrations contain required source fields");

assert(isRecord(provenance) && isRecord(provenance.roster) && isRecord(provenance.palms)
  && isRecord(provenance.training) && isRecord(provenance.activities), "data provenance sections are present");
const rosterSource = defaults.source;
assert(isRecord(rosterSource), "central roster source metadata is present");
assert(Number.isInteger(rosterSource.rosterVersion) && rosterSource.rosterVersion > 0,
  "central roster version is a positive integer");
assert.match(rosterSource.rosterHash ?? "", /^[a-f0-9]{64}$/i, "central roster hash is SHA-256 shaped");
assert.equal(provenance.roster.rosterVersion, rosterSource.rosterVersion, "roster provenance version matches the source");
assert.equal(provenance.roster.contentHash, rosterSource.rosterHash, "roster provenance hash matches the source");
assert.equal(provenance.roster.members, defaults.members.length, "roster provenance member count matches the data");
assert.equal(provenance.roster.source, rosterSource.url, "roster provenance points to the same source");
assert.equal(provenance.roster.commit, rosterSource.commit, "roster provenance commit matches the source metadata");
assert.equal(provenance.palms.members, palms.members.length, "PALMS provenance row count matches the data");
assert.equal(provenance.palms.range, palms.chapter.range, "PALMS provenance range matches the data");
assert.equal(provenance.palms.asOf, palms.chapter.asOf, "PALMS provenance date matches the data");
assert.equal(provenance.training.records, training.records.length, "training provenance row count matches the data");
assert.equal(provenance.activities.rows, defaults.events.length, "activity provenance row count matches the data");
assert.equal(provenance.activities.source, rosterSource.activitySource, "activity provenance points to the configured source");

const fileHashes = provenance.sha256;
assert(isRecord(fileHashes), "file SHA-256 provenance is present");
for (const requiredFile of ["defaults.json", "palms.json", "training.json"]) {
  assert(Object.hasOwn(fileHashes, requiredFile), `file hash provenance includes ${requiredFile}`);
}
for (const [name, expectedHash] of Object.entries(fileHashes)) {
  assert.equal(path.basename(name), name, "provenance hash entries use local file names");
  assert.match(expectedHash, /^[a-f0-9]{64}$/i, `provenance hash for ${name} is SHA-256 shaped`);
  assert(fs.existsSync(path.join(dir, name)), `provenance source file exists: ${name}`);
  const actualHash = crypto.createHash("sha256").update(readBytes(name)).digest("hex");
  assert.equal(actualHash, expectedHash, `provenance SHA-256 matches ${name}`);
}

assert(keyin.includes("location.hostname") && keyin.includes("www.bniconnectglobal.com"),
  "legacy keyin restricts its allowed host");
const blocked = [];
vm.runInNewContext(keyin, {
  location: { protocol: "https:", hostname: "example.test" },
  alert: message => blocked.push(message),
});
assert.equal(blocked.length, 1, "keyin aborts on an unapproved host before touching the page");
assert(keyin.includes("r.referredName") && keyin.includes("refDescriptionField(d)"));
assert(keyin.includes("data.pending[k]") && keyin.includes("successSignal(before)"));
assert(keyin.includes("e.source !== bridgeWindow") && keyin.includes("e.data?.nonce !== bridgeNonce"));
assert(bridge.includes("event.source !== window.opener") && bridge.includes("BNI_ORIGINS.has(event.origin)"));
assert(bridge.includes("event.data?.nonce !== nonce"));
assert(fs.existsSync(path.join(dir, "vendor/xlsx.full.min.js")));

console.log(`PASS: public launcher URL and JavaScript, legacy keyin/bridge security, ${defaults.members.length} central members, ${palms.members.length} PALMS rows, ${defaults.events.length} activities, and ${training.records.length} training records validated.`);
