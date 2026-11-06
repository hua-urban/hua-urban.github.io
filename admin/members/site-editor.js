/* Login shell, navigation, and safe site content editor. */
(() => {
  "use strict";

  const api = window.registryApi;
  const workspace = document.getElementById("workspace");
  const loginScreen = document.getElementById("loginScreen");
  const loginForm = document.getElementById("loginForm");
  const loginName = document.getElementById("loginName");
  const loginEmail = document.getElementById("loginEmail");
  const loginButton = document.getElementById("loginButton");
  const loginStatus = document.getElementById("loginStatus");
  const memberWorkspace = document.getElementById("memberWorkspace");
  const siteWorkspace = document.getElementById("siteWorkspace");
  const membersTab = document.getElementById("membersTab");
  const siteTab = document.getElementById("siteTab");
  const logoutButton = document.getElementById("logoutButton");

  const copyFields = [
    ["home.announcement.title", "公告標題"],
    ["home.announcement.body", "公告內容"],
    ["home.about.title", "關於我們標題"],
    ["home.about.p1", "關於我們第一段"],
    ["home.about.p2", "關於我們第二段"],
  ];
  const groupCodes = ["A", "B", "C", "D", "E"];
  const groupLabels = { A: "A 組", B: "B 組", C: "C 組", D: "D 組", E: "E 組" };

  let editorReady = false;
  let loading = false;
  let saving = false;
  let stale = false;
  let dirty = false;
  let latestLoaded = { content: [], groups: [], services: [], version: "", csrf: "" };
  const isSiteVersion = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  let baseline = null;
  let pendingSave = null;
  let focusAfterLoad = "";

  function make(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }

  function field(container, id, labelText, kind, value) {
    const wrap = make("div", null, "field site-field");
    const label = make("label", labelText);
    const input = kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.id = id;
    input.name = id;
    input.dataset.editorField = "true";
    if (kind === "textarea") input.rows = 3;
    else input.type = kind;
    input.value = typeof value === "string" ? value : "";
    label.htmlFor = id;
    wrap.append(label, input);
    container.appendChild(wrap);
    return input;
  }

  function checkField(container, id, labelText, checked) {
    const wrap = make("label", null, "check-option site-check-field");
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "checkbox";
    input.dataset.editorField = "true";
    input.checked = !!checked;
    wrap.append(input, make("span", labelText));
    container.appendChild(wrap);
    return input;
  }

  function section(id, title) {
    const panel = make("section", null, "panel editor-section");
    panel.id = id;
    panel.setAttribute("aria-labelledby", id + "Title");
    const heading = make("h3", title);
    heading.id = id + "Title";
    heading.tabIndex = -1;
    panel.appendChild(heading);
    return panel;
  }

  function setLoginStatus(message) {
    loginStatus.textContent = message || "";
    loginStatus.hidden = !message;
  }

  function showLogin(message) {
    workspace.hidden = true;
    loginScreen.hidden = false;
    setLoginStatus(message || "");
    loginName.focus();
  }

  function showWorkspace() {
    loginScreen.hidden = true;
    workspace.hidden = false;
    setLoginStatus("");
  }

  function syncEditorButtons() {
    const controls = siteWorkspace.querySelectorAll("input, textarea");
    controls.forEach((control) => { control.disabled = loading || saving; });
    const save = document.getElementById("siteSaveButton");
    const reload = document.getElementById("siteReloadButton");
    if (save) {
      save.disabled = loading || saving || stale || !latestLoaded.csrf;
      save.textContent = pendingSave ? "重送同一筆儲存" : "儲存變更";
    }
    if (reload) reload.disabled = loading || saving;
  }

  function setEditorStatus(message, kind) {
    const status = document.getElementById("siteStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.remove("status-success", "status-error");
    if (kind === "success") status.classList.add("status-success");
    if (kind === "error") status.classList.add("status-error");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
  }

  function createEditor() {
    if (editorReady) return;
    editorReady = true;
    const heading = make("h2", "網站內容");
    heading.id = "siteEditorTitle";
    heading.tabIndex = -1;
    const intro = make("p", "編輯官網公告、簡介、分組資訊與服務連結。", "muted");
    const toolbar = make("div", null, "button-row site-toolbar");
    const reloadButton = make("button", "重新載入", "button button-secondary");
    reloadButton.type = "button";
    reloadButton.id = "siteReloadButton";
    const saveButton = make("button", "儲存變更", "button");
    saveButton.type = "button";
    saveButton.id = "siteSaveButton";
    toolbar.append(reloadButton, saveButton);
    const status = make("div", "尚未載入網站內容。", "statusline status-text site-status");
    status.id = "siteStatus";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const formArea = make("div", null, "stack site-editor-form");
    formArea.id = "siteEditorForm";
    siteWorkspace.replaceChildren(heading, intro, toolbar, status, formArea);

    reloadButton.addEventListener("click", () => loadSiteContent(true));
    saveButton.addEventListener("click", saveSiteContent);
    formArea.addEventListener("input", onEditorInput);
    formArea.addEventListener("change", onEditorInput);
    syncEditorButtons();
  }

  function normalizeContent(raw) {
    const byKey = new Map();
    (Array.isArray(raw) ? raw : []).forEach((row) => {
      if (row && typeof row.key === "string") byKey.set(row.key, typeof row.value === "string" ? row.value : "");
    });
    return copyFields.map(([key]) => ({ key, value: byKey.get(key) || "" }));
  }

  function normalizeGroups(raw) {
    const byCode = new Map();
    (Array.isArray(raw) ? raw : []).forEach((group) => {
      if (group && typeof group.code === "string") byCode.set(group.code, group);
    });
    return groupCodes.map((code) => {
      const group = byCode.get(code) || {};
      return { code, name: typeof group.name === "string" ? group.name : "", schedule: typeof group.schedule === "string" ? group.schedule : "" };
    });
  }

  function normalizeServices(raw) {
    return (Array.isArray(raw) ? raw : []).filter((service) => service && typeof service.id === "string").map((service) => ({
      id: service.id,
      title: typeof service.title === "string" ? service.title : "",
      url: typeof service.url === "string" ? service.url : "",
      description: typeof service.description === "string" ? service.description : "",
      enabled: service.enabled === true,
    }));
  }

  function renderData(data) {
    const content = normalizeContent(data.content);
    const groups = normalizeGroups(data.groups);
    const services = normalizeServices(data.services);
    latestLoaded = {
      content,
      groups,
      services,
      version: isSiteVersion(data.version) ? data.version : "",
      csrf: typeof data.csrf === "string" ? data.csrf : "",
    };
    stale = !latestLoaded.csrf || !isSiteVersion(latestLoaded.version);
    pendingSave = null;
    dirty = false;
    baseline = JSON.stringify({ content, groups, services });

    const formArea = document.getElementById("siteEditorForm");
    const contentSection = section("siteCopySection", "官網文字");
    content.forEach((item, index) => field(contentSection, "siteCopy" + index, copyFields[index][1], "textarea", item.value));

    const groupsSection = section("siteGroupsSection", "分組資訊");
    groups.forEach((group, index) => {
      const card = make("div", null, "site-record");
      const title = make("h4", groupLabels[group.code] || group.code);
      card.appendChild(title);
      field(card, "siteGroupName" + index, "組名", "text", group.name);
      field(card, "siteGroupSchedule" + index, "時段", "text", group.schedule);
      card.dataset.groupCode = group.code;
      groupsSection.appendChild(card);
    });

    const servicesSection = section("siteServicesSection", "服務連結");
    services.forEach((service, index) => {
      const card = make("div", null, "site-record");
      card.appendChild(make("h4", service.title || service.id));
      card.appendChild(make("p", "服務 ID：" + service.id, "muted small"));
      field(card, "siteServiceTitle" + index, "服務名稱", "text", service.title);
      field(card, "siteServiceUrl" + index, "服務網址", "url", service.url);
      field(card, "siteServiceDescription" + index, "服務說明", "textarea", service.description);
      checkField(card, "siteServiceEnabled" + index, "啟用此服務", service.enabled);
      card.dataset.serviceId = service.id;
      servicesSection.appendChild(card);
    });
    if (!services.length) servicesSection.appendChild(make("p", "目前沒有可編輯的服務連結。", "empty"));

    formArea.replaceChildren(contentSection, groupsSection, servicesSection);
    const versionText = "網站內容已載入。";
    setEditorStatus(stale ? versionText + " 尚未取得儲存驗證資訊，請重新載入。" : versionText, stale ? "error" : "");
    syncEditorButtons();
  }

  function readPayload() {
    const content = copyFields.map(([key], index) => ({
      key,
      value: document.getElementById("siteCopy" + index).value,
    }));
    const groups = groupCodes.map((code, index) => ({
      code,
      name: document.getElementById("siteGroupName" + index).value,
      schedule: document.getElementById("siteGroupSchedule" + index).value,
    }));
    const services = latestLoaded.services.map((service, index) => ({
      id: service.id,
      title: document.getElementById("siteServiceTitle" + index).value,
      url: document.getElementById("siteServiceUrl" + index).value,
      description: document.getElementById("siteServiceDescription" + index).value,
      enabled: document.getElementById("siteServiceEnabled" + index).checked,
    }));
    return { content, groups, services };
  }

  function onEditorInput() {
    pendingSave = null;
    dirty = JSON.stringify(readPayload()) !== baseline;
    syncEditorButtons();
    if (dirty && !stale) setEditorStatus("有尚未儲存的變更。", "");
  }

  function isConflict(error) {
    return error && (error.code === "VERSION_CONFLICT" || error.code === "CONFLICT" || error.code === "STALE_VERSION");
  }

  function isNetworkFailure(error) {
    return error && ["NETWORK_ERROR", "TIMEOUT"].includes(error.code);
  }

  function errorText(error) {
    return error && typeof error.message === "string" && error.message.trim()
      ? error.message.trim()
      : "網站內容操作失敗，表單仍保留，請稍後再試。";
  }

  async function loadSiteContent(confirmReplace) {
    if (loading || saving || !api.hasSession()) return;
    createEditor();
    if ((dirty || pendingSave) && confirmReplace && !window.confirm("目前有尚未儲存的內容。重新載入會以伺服器資料取代表單，是否繼續？")) return;
    loading = true;
    syncEditorButtons();
    setEditorStatus("正在載入網站內容…", "");
    try {
      const data = await api.request("siteLoad", {});
      renderData(data || {});
      if (focusAfterLoad) focusTarget(focusAfterLoad);
    } catch (error) {
      if (error.code === "UNAUTHORIZED") stale = true;
      setEditorStatus(errorText(error), "error");
    } finally {
      loading = false;
      syncEditorButtons();
    }
  }

  async function saveSiteContent() {
    if (loading || saving || stale || !latestLoaded.csrf || !api.hasSession()) return;
    if (!pendingSave) {
      let requestId;
      try {
        if (!window.crypto || typeof window.crypto.randomUUID !== "function") throw new Error("此瀏覽器無法產生儲存識別碼，請使用新版瀏覽器後重試。");
        requestId = window.crypto.randomUUID();
      } catch (error) {
        setEditorStatus(errorText(error), "error");
        return;
      }
      const current = readPayload();
      pendingSave = {
        content: current.content,
        groups: current.groups,
        services: current.services,
        expectedVersion: latestLoaded.version,
        requestId,
        csrf: latestLoaded.csrf,
      };
    }

    saving = true;
    syncEditorButtons();
    setEditorStatus("正在儲存網站內容…", "");
    try {
      const result = await api.request("siteSave", pendingSave);
      if (result && isSiteVersion(result.version)) latestLoaded.version = result.version;
      if (result && typeof result.csrf === "string") latestLoaded.csrf = result.csrf;
      pendingSave = null;
      dirty = false;
      baseline = JSON.stringify(readPayload());
      if (!result || !isSiteVersion(result.version) || !latestLoaded.csrf) {
        stale = true;
        setEditorStatus("網站內容已儲存；請重新載入以確認最新版本。", "success");
      } else {
        setEditorStatus("網站內容已儲存。", "success");
      }
    } catch (error) {
      if (isConflict(error)) {
        pendingSave = null;
        stale = true;
        setEditorStatus("網站內容已由其他人更新。表單內容已保留；請使用重新載入取得最新版本後再修改。", "error");
      } else if (error.code === "UNAUTHORIZED") {
        stale = true;
        setEditorStatus("登入狀態已失效。表單內容已保留；重新登入後請先重新載入。", "error");
      } else if (isNetworkFailure(error)) {
        setEditorStatus(errorText(error) + "按「重送同一筆儲存」會沿用原內容與識別碼。", "error");
      } else {
        pendingSave = null;
        setEditorStatus(errorText(error), "error");
      }
    } finally {
      saving = false;
      syncEditorButtons();
    }
  }

  function focusTarget(hash) {
    const targets = {
      "#site": "siteEditorTitle",
      "#groups": "siteGroupsSectionTitle",
      "#services": "siteServicesSectionTitle",
    };
    const id = targets[hash] || targets["#site"];
    const target = document.getElementById(id);
    if (target) target.focus();
    focusAfterLoad = "";
  }

  function selectTab(tab) {
    const isSite = tab === "site";
    memberWorkspace.hidden = isSite;
    siteWorkspace.hidden = !isSite;
    membersTab.setAttribute("aria-selected", isSite ? "false" : "true");
    siteTab.setAttribute("aria-selected", isSite ? "true" : "false");
    membersTab.tabIndex = isSite ? -1 : 0;
    siteTab.tabIndex = isSite ? 0 : -1;
    if (isSite) {
      createEditor();
      if (!latestLoaded.version && !loading) loadSiteContent(false);
      if (loading) focusAfterLoad = window.location.hash || "#site";
      else focusTarget(window.location.hash || "#site");
    }
  }

  function routeFromHash() {
    if (!api.hasSession()) return;
    const hash = window.location.hash;
    if (["#site", "#groups", "#services"].includes(hash)) selectTab("site");
    else selectTab("members");
  }

  function setHash(hash) {
    if (window.location.hash === hash) routeFromHash();
    else window.location.hash = hash;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (loginButton.disabled) return;
    loginButton.disabled = true;
    loginName.disabled = true;
    loginEmail.disabled = true;
    loginButton.textContent = "登入中…";
    setLoginStatus("");
    try {
      const result = await api.login(loginName.value.trim(), loginEmail.value.trim());
      api.storeToken(result && result.token);
      showWorkspace();
      window.dispatchEvent(new CustomEvent("registry:authenticated"));
      if (typeof window.registryAdminReload === "function") window.registryAdminReload();
      routeFromHash();
    } catch (error) {
      setLoginStatus(errorText(error));
      loginName.focus();
    } finally {
      loginButton.disabled = false;
      loginName.disabled = false;
      loginEmail.disabled = false;
      loginButton.textContent = "登入";
    }
  });

  membersTab.addEventListener("click", () => setHash("#members"));
  siteTab.addEventListener("click", () => setHash("#site"));
  membersTab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      siteTab.focus();
      setHash("#site");
    }
  });
  siteTab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      membersTab.focus();
      setHash("#members");
    }
  });
  logoutButton.addEventListener("click", async () => {
    if (logoutButton.disabled) return;
    logoutButton.disabled = true;
    const token = api.getToken();
    try { await api.logout(token); } catch (ignore) { /* Clear the local session even if logout cannot reach the service. */ }
    api.clearToken();
    window.location.reload();
  });

  window.addEventListener("registry:auth-required", () => showLogin("登入狀態已失效，請重新登入。"));
  window.addEventListener("registry:authenticated", () => {
    showWorkspace();
    if (siteTab.getAttribute("aria-selected") === "true" && dirty) {
      stale = true;
      setEditorStatus("已重新登入。表單內容已保留；請重新載入取得最新資料後再儲存。", "error");
      syncEditorButtons();
    }
  });
  window.addEventListener("hashchange", routeFromHash);

  if (api.hasSession()) showWorkspace();
  else showLogin("");
  routeFromHash();
})();
