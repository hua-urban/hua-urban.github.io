"use strict";

const CONFIG_URL = "/admin/config.json";
const statusNode = document.getElementById("connection-status");
const detailNode = document.getElementById("connection-detail");
const editButton = document.getElementById("edit-button");
const memberList = document.getElementById("member-list");
const memberSearch = document.getElementById("member-search");
const snapshotMeta = document.getElementById("snapshot-meta");
const snapshotCount = document.getElementById("snapshot-count");
let centralMembers = [];
let snapshotState = "loading";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeAdminUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== "https://script.google.com" ||
        url.username || url.password || url.hash ||
        !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) ||
        url.searchParams.get("admin") !== "1") return null;
    return url.href;
  } catch (_error) {
    return null;
  }
}

async function loadAdminEntry() {
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error("管理入口設定讀取失敗");
    const config = await response.json();
    const target = config && typeof config === "object"
      ? safeAdminUrl(config.memberAdminUrl)
      : null;
    if (!target) throw new Error("管理入口尚未設定");

    statusNode.textContent = "入口已設定";
    detailNode.textContent = "開啟 Google 登入管理；可用功能依登入帳號權限設定而定。";
    const link = element("a", "connect-action", "Google 登入管理");
    link.href = target;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    editButton.replaceWith(link);
  } catch (_error) {
    statusNode.textContent = "入口未設定";
    detailNode.textContent = "目前無法讀取 Google 登入管理入口設定，請聯絡管理者。";
    editButton.disabled = true;
  }
}

function displayValue(value) {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || "未提供";
  }
  return "未提供";
}

function memberChains(member) {
  if (!Array.isArray(member.chains)) return [];
  return Array.from(new Set(member.chains.filter((chain) =>
    typeof chain === "string" && /^[A-E]$/.test(chain)
  )));
}

function memberSearchText(member) {
  return [member.memberNo, member.name, member.profession, member.role, ...memberChains(member)]
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(String)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

function renderMember(member) {
  const row = element("article", "member-row");
  const nameLine = element("div", "member-name-line");
  nameLine.append(element("h3", "member-name", displayValue(member.name)));
  nameLine.append(element("span", "member-id", "會員編號 " + displayValue(member.memberNo)));

  const details = element("dl", "member-detail");
  details.append(element("dt", "", "專業別"));
  details.append(element("dd", "", displayValue(member.profession)));
  if (typeof member.role === "string" && member.role.trim()) {
    details.append(element("dt", "", "職務"));
    details.append(element("dd", "", member.role.trim()));
  }
  details.append(element("dt", "", "分組"));
  details.append(element("dd", "", memberChains(member).join("、") || "未提供"));
  row.append(nameLine, details);
  return row;
}

function renderMembers() {
  const query = memberSearch.value.trim().toLocaleLowerCase("zh-Hant");
  const visible = centralMembers.filter((member) => !query || memberSearchText(member).includes(query));
  const fragment = document.createDocumentFragment();
  if (visible.length) {
    visible.forEach((member) => fragment.append(renderMember(member)));
  } else {
    let message = "目前沒有會員資料。";
    if (centralMembers.length) message = "沒有符合搜尋條件的會員。";
    else if (snapshotState === "unavailable") message = "目前無法確認會員名單是否最新，請稍後再試。";
    fragment.append(element("p", "snapshot-message", message));
  }
  memberList.replaceChildren(fragment);

  if (snapshotState === "current") {
    snapshotCount.textContent = query
      ? "顯示 " + visible.length + " / 共 " + centralMembers.length + " 位會員"
      : "共 " + centralMembers.length + " 位會員";
  } else if (snapshotState === "stale") {
    snapshotCount.textContent = "尚未確認最新會員名單；顯示 " + visible.length + " / 共 " + centralMembers.length + " 位前次資料";
  } else if (snapshotState === "unavailable") {
    snapshotCount.textContent = "目前無法確認會員名單是否最新";
  } else {
    snapshotCount.textContent = "正在載入會員名單…";
  }
}

function isUsableSnapshot(snapshot) {
  return !!snapshot && Array.isArray(snapshot.members) &&
    Number.isFinite(snapshot.rosterVersion) &&
    typeof snapshot.effectiveAsOf === "string" && snapshot.effectiveAsOf.trim() !== "" &&
    typeof snapshot.contentHash === "string" && snapshot.contentHash.trim() !== "";
}

function showUnavailable() {
  centralMembers = [];
  snapshotState = "unavailable";
  snapshotMeta.textContent = "名單確認日期：未確認。";
  renderMembers();
}

function showSnapshot(snapshot, isCurrent) {
  centralMembers = snapshot.members.filter((member) => member && typeof member === "object");
  snapshotState = isCurrent ? "current" : "stale";
  const effectiveDate = snapshot.effectiveAsOf.trim();
  snapshotMeta.textContent = isCurrent
    ? "名單確認日期：" + effectiveDate
    : "名單確認日期：" + effectiveDate + "（前次資料；最新狀態未確認）。";
  renderMembers();
}

async function loadCentralRoster() {
  try {
    if (!window.HuaMembers || typeof window.HuaMembers.load !== "function") {
      throw new Error("中央會員名冊 client 尚未載入");
    }
    const result = await window.HuaMembers.load();
    const snapshot = result && result.snapshot;
    if (!isUsableSnapshot(snapshot)) {
      showUnavailable();
      return;
    }
    const latestConfirmed = result.ok === true && result.latestConfirmed !== false;
    showSnapshot(snapshot, latestConfirmed);
  } catch (_error) {
    showUnavailable();
  }
}

memberSearch.addEventListener("input", renderMembers);
loadAdminEntry();
loadCentralRoster();
