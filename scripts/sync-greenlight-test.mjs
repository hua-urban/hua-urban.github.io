import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { currentDateInTaipei, mapEvents } from "./greenlight-events.mjs";
import { selectFullCyclePalms } from "./greenlight-palms.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const TEST_DIR = resolve(ROOT, "greenlight-test");
const HOMEPAGE_URL = "https://hua-urban.com/";
const PALMS_URL = "https://hua-urban.com/traffic-light/data.json";
const MONTHLY_URL = "https://hua-urban.com/traffic-light/monthly.json";
const REPOSITORY = "https://github.com/hua-urban/hua-urban.github.io";
const CHAPTER = "華都更";

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": "hua-urban-greenlight-weekly-sync/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}: ${new URL(url).origin}${new URL(url).pathname}`);
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function decodeHtml(value) {
  return String(value ?? "").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity.toLowerCase()] || "";
  }).trim();
}

function attribute(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function spanText(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<span\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, "i"));
  return decodeHtml(match?.[1]?.replace(/<[^>]*>/g, "") ?? "");
}

function parseRoster(html) {
  const members = [];
  for (const [, attrs, body] of html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    if (!/\bdata-n\s*=/.test(attrs) || !/\bdata-p\s*=/.test(attrs)) continue;
    const displayedNo = spanText(body, "m-num");
    const name = spanText(body, "m-name");
    const job = attribute(attrs, "data-p");
    if (!displayedNo || !name || !job) continue;
    members.push({
      no: displayedNo.padStart(3, "0"),
      name,
      dataName: attribute(attrs, "data-n"),
      job,
      role: attribute(attrs, "data-role"),
    });
  }
  const numbers = members.map(member => member.no);
  if (members.length < 40 || new Set(numbers).size !== members.length) {
    throw new Error(`Refusing to sync an invalid roster (${members.length} entries).`);
  }
  return members;
}

const COMPOUND_SURNAMES = ["張簡", "歐陽", "司馬", "諸葛", "上官", "東方", "皇甫", "范姜", "司徒", "夏侯"];
function nameKey(value) {
  const compact = String(value ?? "").replace(/\s+/g, "");
  const chinese = compact.match(/^[\u3400-\u9fff]+/)?.[0];
  if (chinese) return chinese.slice(0, COMPOUND_SURNAMES.some(surname => chinese.startsWith(surname)) ? 4 : 3);
  return String(value ?? "").toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJsonIfChanged(path, value) {
  const next = json(value);
  let old = "";
  try { old = await readFile(path, "utf8"); } catch {}
  if (old === next) return false;
  await writeFile(path, next);
  return true;
}

const [homepage, officialPalms, monthly, oldProvenance, oldDefaults] = await Promise.all([
  fetchText(HOMEPAGE_URL),
  fetchJson(PALMS_URL),
  fetchJson(MONTHLY_URL),
  readFile(resolve(TEST_DIR, "data-provenance.json"), "utf8").then(JSON.parse),
  readFile(resolve(TEST_DIR, "defaults.json"), "utf8").then(JSON.parse),
]);

const members = parseRoster(homepage);
const fullCyclePalms = selectFullCyclePalms(officialPalms);
if (!monthly || !Array.isArray(monthly.months)) throw new Error("Official monthly source does not match the expected data shape.");

const gasUrlMatch = homepage.match(/\bGAS_CAL_URL\s*=\s*["']([^"']+)["']/);
if (!gasUrlMatch) throw new Error("Could not locate the official activity feed URL on the homepage.");
const activityUrl = new URL(gasUrlMatch[1]);
activityUrl.searchParams.set("sheet", "行事曆");
const activityPayload = await fetchJson(activityUrl.href);
if (activityPayload?.ok !== true || !Array.isArray(activityPayload.data)) {
  throw new Error("Official activity feed response is invalid; existing test data was left untouched.");
}

const activeNames = new Set(members.map(member => nameKey(member.name)));
const activePalmsRows = fullCyclePalms.members.filter(row => Array.isArray(row) && activeNames.has(nameKey(row[1])));
if (activePalmsRows.length < 40) throw new Error(`Refusing to sync only ${activePalmsRows.length} matching PALMS rows.`);
const palmsNames = activePalmsRows.map(row => nameKey(row[1]));
if (new Set(palmsNames).size !== activePalmsRows.length) throw new Error("Official PALMS has ambiguous matching member names.");
const syncHash = createHash("sha256").update([
  homepage,
  JSON.stringify(officialPalms),
  JSON.stringify(monthly),
  JSON.stringify(activityPayload),
].join("\0")).digest("hex");
const sourceChanged = oldDefaults.source?.syncHash !== syncHash;
const sourceCommit = sourceChanged
  ? process.env.GITHUB_SHA || "manual-sync"
  : oldDefaults.source?.commit || "manual-sync";
const sourceCommitDate = sourceChanged
  ? new Date().toISOString()
  : oldDefaults.source?.commitDate || new Date().toISOString();

const defaults = {
  source: {
    repositoryPath: "hua-urban.com",
    commit: sourceCommit,
    commitDate: sourceCommitDate,
    syncHash,
    file: "index.html",
    selector: "tr[data-n][data-p]",
    mapping: {
      no: "text from span.m-num, padded to three digits",
      name: "text from span.m-name",
      dataName: "tr @data-n",
      job: "tr @data-p",
      role: "tr @data-role",
    },
    noMeaning: "Displayed roster number; no BNI Connect member ID is inferred.",
    repository: REPOSITORY,
    url: HOMEPAGE_URL,
    activitySource: activityUrl.origin + activityUrl.pathname,
    schedule: "Every Wednesday at 10:00 Asia/Taipei",
    eventMembersNote: "Official activity data has no attendee roster; all current members are offered as interaction candidates.",
  },
  members,
  events: mapEvents(activityPayload.data, members, currentDateInTaipei()),
};
const palms = {
  updatedAt: fullCyclePalms.updatedAt,
  uploadedBy: fullCyclePalms.uploadedBy,
  chapter: fullCyclePalms.chapter,
  members: activePalmsRows,
};

const changed = [];
for (const [name, value] of Object.entries({
  "defaults.json": defaults,
  "palms.json": palms,
  "monthly.json": monthly,
})) {
  if (await writeJsonIfChanged(resolve(TEST_DIR, name), value)) changed.push(name);
}

const provenance = {
  ...oldProvenance,
  chapter: CHAPTER,
  preparedOn: sourceChanged ? currentDateInTaipei() : oldProvenance.preparedOn,
  roster: {
    source: HOMEPAGE_URL,
    commit: sourceCommit,
    members: members.length,
    memberNumbers: "Official homepage member roster, padded to 3 digits",
  },
  palms: {
    source: PALMS_URL,
    path: "chapter.est",
    members: activePalmsRows.length,
    range: fullCyclePalms.chapter.range,
    asOf: fullCyclePalms.chapter.asOf,
  },
  activities: {
    source: activityUrl.origin + activityUrl.pathname,
    rows: defaults.events.length,
    fetchedRows: activityPayload.data.length,
    schedule: "Every Wednesday at 10:00 Asia/Taipei",
    attendeeRosterAvailable: false,
  },
  sha256: {
    ...oldProvenance.sha256,
    "defaults.json": createHash("sha256").update(json(defaults)).digest("hex"),
    "palms.json": createHash("sha256").update(json(palms)).digest("hex"),
    "monthly.json": createHash("sha256").update(json(monthly)).digest("hex"),
  },
};
if (await writeJsonIfChanged(resolve(TEST_DIR, "data-provenance.json"), provenance)) changed.push("data-provenance.json");

console.log(JSON.stringify({
  synchronizedAt: new Date().toISOString(),
  rosterCount: members.length,
  palmsCount: activePalmsRows.length,
  activitySourceRows: activityPayload.data.length,
  importedPastActivities: defaults.events.length,
  changed,
}, null, 2));
