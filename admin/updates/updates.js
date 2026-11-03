"use strict";

const searchNode = document.getElementById("updates-search");
const categoryNode = document.getElementById("category-filter");
const countNode = document.getElementById("result-count");
const listNode = document.getElementById("updates-list");
const emptyNode = document.getElementById("empty-state");
const errorNode = document.getElementById("load-error");
const PUBLIC_COMMIT_PATH = /^\/hua-urban\/(?:hua-urban\.github\.io|bni-pt-groups)\/commit\/[a-f0-9]{40}$/i;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function safeHref(rawHref, kind) {
  if (typeof rawHref !== "string" || !rawHref.trim()) return null;
  try {
    const url = new URL(rawHref, location.href);
    if (kind === "source") {
      return url.protocol === "https:" && url.hostname === "github.com"
        && !url.username && !url.password && !url.search && !url.hash
        && PUBLIC_COMMIT_PATH.test(url.pathname)
        ? url.href
        : null;
    }
    return url.origin === location.origin && !url.username && !url.password
      && (url.protocol === "https:" || url.protocol === "http:")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function appendLinkGroup(parent, heading, links, kind, fallback) {
  const section = element("section", "update-link-group");
  section.append(element("h4", "", heading));
  const list = element("ul", "update-link-list");
  let validCount = 0;
  if (Array.isArray(links)) {
    for (const item of links) {
      if (!item || typeof item.label !== "string") continue;
      const href = safeHref(item.href, kind);
      if (!href) continue;
      const anchor = element("a", "", item.label);
      anchor.href = href;
      anchor.rel = "noopener noreferrer";
      if (kind === "source") {
        anchor.target = "_blank";
      }
      const row = element("li");
      row.append(anchor);
      list.append(row);
      validCount += 1;
    }
  }
  if (validCount) section.append(list);
  else section.append(element("p", "update-source-note", fallback));
  parent.append(section);
}

function statusClass(kind) {
  if (kind === "live") return "is-live";
  if (kind === "pending") return "is-pending";
  if (kind === "processing") return "is-processing";
  return "is-updated";
}

function renderEntry(entry) {
  const card = element("article", "update-card");
  if (entry.id) card.id = entry.id;
  const header = element("div", "update-card-header");
  const title = element("h3", "update-title", entry.title);
  const status = element("span", `update-status ${statusClass(entry.statusKind)}`, entry.status);
  header.append(title, status);

  const meta = element("div", "update-meta");
  const date = element("time", "update-date", entry.date);
  date.dateTime = entry.date;
  meta.append(date, element("span", "update-category", entry.category));
  card.append(header, meta);
  if (typeof entry.statusDetail === "string" && entry.statusDetail.trim()) {
    card.append(element("p", "update-status-detail", entry.statusDetail));
  }

  const summary = element("ul", "update-summary");
  entry.summary.forEach(text => summary.append(element("li", "", text)));
  card.append(summary);

  const links = element("div", "update-link-groups");
  appendLinkGroup(links, "相關服務", entry.services, "service", "沒有可公開連結的相關服務。");
  appendLinkGroup(links, "查核來源", entry.sources, "source", entry.sourceNote || "目前沒有公開提交證據。");
  card.append(links);
  return card;
}

function updateDirectory(entries) {
  const query = searchNode.value.trim().toLocaleLowerCase("zh-Hant");
  const category = categoryNode.value;
  const visible = entries.filter(entry => {
    if (category !== "all" && entry.category !== category) return false;
    if (!query) return true;
    const searchable = [entry.id, entry.date, entry.status, entry.statusDetail, entry.category, entry.title,
      ...entry.summary,
      ...(Array.isArray(entry.services) ? entry.services.map(item => item.label) : []),
      ...(Array.isArray(entry.sources) ? entry.sources.map(item => item.label) : []),
      entry.sourceNote]
      .filter(value => typeof value === "string")
      .join(" ")
      .toLocaleLowerCase("zh-Hant");
    return searchable.includes(query);
  });

  const fragment = document.createDocumentFragment();
  visible.forEach(entry => fragment.append(renderEntry(entry)));
  listNode.replaceChildren(fragment);
  countNode.textContent = `顯示 ${visible.length} 則更新`;
  emptyNode.hidden = visible.length !== 0;
}

function isValidEntry(entry) {
  return entry !== null && typeof entry === "object" && !Array.isArray(entry)
    && (entry.id === undefined || (typeof entry.id === "string" && /^[a-z0-9-]+$/.test(entry.id)))
    && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.status === "string" && entry.status.trim().length > 0
    && ["live", "updated", "pending", "processing"].includes(entry.statusKind)
    && typeof entry.category === "string" && entry.category.trim().length > 0
    && typeof entry.title === "string" && entry.title.trim().length > 0
    && Array.isArray(entry.summary) && entry.summary.length > 0
    && entry.summary.every(text => typeof text === "string" && text.trim().length > 0)
    && Array.isArray(entry.services)
    && Array.isArray(entry.sources);
}

async function loadEntries() {
  try {
    const response = await fetch("./entries.json", { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error("更新日誌讀取失敗");
    const data = await response.json();
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.asOf) || !Array.isArray(data.entries) || data.entries.length === 0 || !data.entries.every(isValidEntry)) {
      throw new Error("更新日誌資料格式不正確");
    }

    document.getElementById("journal-as-of").textContent = data.asOf;
    document.getElementById("journal-footer-date").textContent = data.asOf;
    const entries = [...data.entries].sort((a, b) => b.date.localeCompare(a.date));
    const categories = [...new Set(entries.map(entry => entry.category))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
    for (const category of categories) {
      const option = element("option", "", category);
      option.value = category;
      categoryNode.append(option);
    }
    searchNode.addEventListener("input", () => updateDirectory(entries));
    categoryNode.addEventListener("change", () => updateDirectory(entries));
    errorNode.hidden = true;
    updateDirectory(entries);
  } catch {
    listNode.replaceChildren();
    emptyNode.hidden = true;
    countNode.textContent = "更新日誌暫時無法顯示";
    errorNode.textContent = "目前無法讀取更新紀錄，請稍後再試或返回管理中心。";
    errorNode.hidden = false;
  }
}

loadEntries();
