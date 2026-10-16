import { createHash } from "node:crypto";

function eventDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function currentDateInTaipei(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function mapEvents(rows, members, today) {
  if (!Array.isArray(rows)) throw new Error("Official activity feed is not an array.");
  if (!Array.isArray(members)) throw new Error("Current member roster is not an array.");
  const cutoff = eventDate(today);
  if (!cutoff || cutoff !== today) throw new Error("Activity cutoff must be a valid YYYY-MM-DD date.");

  return rows.map(row => {
    const name = String(row?.["活動標題"] || row?.["名稱"] || "").trim();
    const date = eventDate(row?.["日期"]);
    if (!name || !date || date >= cutoff) return null;
    return { name, date };
  }).filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(event => ({
      id: `official-${event.date}-${createHash("sha256").update(event.name).digest("hex").slice(0, 8)}`,
      name: event.name,
      date: event.date,
      // The public calendar provides event details, not an attendance list. The form asks members to select their own interaction partners.
      members: members.map(member => member.no),
      outside: [],
    }));
}
