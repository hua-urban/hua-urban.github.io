"use strict";

const CONFIG_URL = "/admin/config.json";
const PUBLIC_ROSTER_URL = "https://hua-urban.com/bni-pt-groups/data.json";

const statusNode = document.getElementById("connection-status");
const detailNode = document.getElementById("connection-detail");
const editButton = document.getElementById("edit-button");
const memberList = document.getElementById("member-list");
const memberSearch = document.getElementById("member-search");
const snapshotCount = document.getElementById("snapshot-count");
let publicMembers = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeAdminUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch (_error) {
    return null;
  }
}

async function loadAdminEntry() {
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("設定檔不存在");
    const config = await response.json();
    const target = config && typeof config === "object"
      ? safeAdminUrl(config.memberAdminUrl)
      : null;
    if (!target) throw new Error("管理入口尚未設定");

    statusNode.textContent = "已設定";
    detailNode.textContent = "可前往會員編輯服務；身分與權限由該服務驗證。";
    const link = element("a", "connect-action", "前往管理後台");
    link.href = target;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    editButton.replaceWith(link);
  } catch (_error) {
    statusNode.textContent = "準備中";
    detailNode.textContent = "會員編輯功能準備中，目前可查閱名冊。";
    editButton.disabled = true;
  }
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "未提供";
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (item === null || item === undefined) return "";
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (typeof item === "object") {
        return String(item.name || item.label || item.title || item.code || "");
      }
      return "";
    }).filter(Boolean);
    return items.length ? items.join("、") : "未提供";
  }
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "未提供";
}

function memberSearchText(member) {
  return [member.id, member.name, member.profession, member.chains]
    .map(displayValue)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

function renderMember(member) {
  const row = element("article", "member-row");
  const nameLine = element("div", "member-name-line");
  nameLine.append(element("h3", "member-name", displayValue(member.name)));
  const memberNumber = displayValue(member.id);
  const formattedMemberNumber = /^\d+$/.test(memberNumber) ? memberNumber.padStart(3, "0") : memberNumber;
  nameLine.append(element("span", "member-id", "會員編號 " + formattedMemberNumber));

  const details = element("dl", "member-detail");
  [["專業別", member.profession], ["分組", member.chains]].forEach(([label, value]) => {
    details.append(element("dt", "", label));
    details.append(element("dd", "", displayValue(value)));
  });
  row.append(nameLine, details);
  return row;
}

function renderMembers() {
  const query = memberSearch.value.trim().toLocaleLowerCase("zh-Hant");
  const visible = publicMembers.filter((member) => !query || memberSearchText(member).includes(query));
  const fragment = document.createDocumentFragment();
  if (visible.length) {
    visible.forEach((member) => fragment.append(renderMember(member)));
  } else {
    fragment.append(element("p", "snapshot-message", publicMembers.length ? "沒有符合搜尋條件的會員。" : "公開名冊目前沒有會員資料。"));
  }
  memberList.replaceChildren(fragment);
  snapshotCount.textContent = "顯示 " + visible.length + " 位公開名冊會員";
}

async function loadPublicRoster() {
  try {
    const response = await fetch(PUBLIC_ROSTER_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("公開快照讀取失敗");
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.members)) throw new Error("公開快照格式不符");
    publicMembers = payload.members.filter((member) => member && typeof member === "object");
    renderMembers();
  } catch (_error) {
    memberList.replaceChildren(element("p", "snapshot-message", "目前無法讀取官網公開名冊，請稍後再試。"));
    snapshotCount.textContent = "公開名冊暫時無法讀取";
  }
}

memberSearch.addEventListener("input", renderMembers);
loadAdminEntry();
loadPublicRoster();
