(() => {
  "use strict";

  const API = {
    status: "/api/bni/status",
    login: "/api/bni/login",
    logout: "/api/bni/logout",
    prepare: "/api/bni/prepare",
    submit: "/api/bni/submit",
    retryReview: "/api/bni/retry-review",
  };
  const HTML_LIKE = /<!doctype|<html\b|<\/?[a-z][^>]*>/i;

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function textFromServer(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const text = value.trim();
    if (!text || HTML_LIKE.test(text)) return fallback;
    return text;
  }

  function identityNameKey(value) {
    let name = String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    let previous;
    do { previous = name; name = name.replace(/\([^()]*\)/gu, ""); } while (name !== previous);
    if (/[()]/u.test(name)) return "";
    const han = (name.match(/\p{Script=Han}/gu) || []).join("");
    return han || name.replace(/\s+/gu, "");
  }

  function identityChapterKey(value) {
    const key = String(value || "").normalize("NFKC").trim()
      .replace(/^BNI\s*/i, "").replace(/\s+/g, "").replace(/分會$/u, "").toLocaleLowerCase();
    return { "華都更huaurban+": "華都更", "華地產huarealestate": "華地產" }[key] || key;
  }

  function diagnosticMessage(code, diagnostic = {}) {
    const http = Number(diagnostic.httpStatus);
    if (http === 429) return 'BNI 回應操作過於頻繁。請先查官方紀錄，稍候再處理，勿立即重送。';
    if (http >= 500 && http <= 599) return `BNI 服務回應異常（HTTP ${http}），無法判斷是否已入帳。請先查官方紀錄，稍後再處理。`;
    if (http === 405) return 'BNI 不接受這次送出方式（HTTP 405）。請保留草稿並通知管理者，不要反覆重送。';
    const messages = {
      BNI_DUPLICATE_OR_CONFIRMATION: "BNI Connect 回應重複或要求額外確認，請先檢查這筆是否已建立。",
      BNI_VALIDATION_REJECTED: "BNI 未接受填寫資料。請按「編輯草稿」檢查會員、分會、日期與必填欄位，再配對單據會員；BNI 未指出具體錯誤欄位。",
      BNI_RESPONSE_UNCONFIRMED: "BNI 有回應，但沒有可判讀的成功結果，原因尚未確認。請先查看官方紀錄；確認沒有這筆後，再編輯或重試。",
      BNI_RESPONSE_ERROR: "BNI 回傳錯誤，但未提供可安全顯示的具體欄位原因。請先核對官方紀錄，再檢查日期、會員、分會與必填內容。",
      BNI_RESPONSE_WARNING: "BNI Connect 回傳警告，請先核對這筆資料是否已建立。",
      BNI_TRANSPORT_UNKNOWN: "連線中斷，無法確認是否建立；請先在 BNI Connect 查看。",
      BNI_AUTH_REQUIRED: "BNI 登入已逾時，無法確認是否建立；請先在 BNI Connect 查看。",
      BNI_ADAPTER_EXCEPTION: "送出服務發生錯誤，無法確認是否建立；請先在 BNI Connect 查看。",
      BNI_JOURNAL_FAILURE: "BNI 送出結果未能保存到追綠光，官方可能已入帳。請先查看官方紀錄，不要直接重送。",
    };
    return Object.hasOwn(messages, code)
      ? messages[code]
      : "送出結果需要確認。請先在 BNI Connect 查看這筆資料。";
  }

  function parseJson(response) {
    return response.json().catch(() => null);
  }

  class ApiError extends Error {
    constructor(status) {
      super("BNI API request failed");
      this.status = status;
    }
  }

  function mount(host, payload, options = {}) {
    if (!(host instanceof Element)) return null;
    if (document.documentElement.dataset.pagesPreview === "true") {
      host.replaceChildren(node("p", "bc-message bc-message-info", "這個公開介面測試版尚未開放 BNI 登入、會員配對及送單。你填寫的資料仍保存在此瀏覽器。"));
      return { refresh: async () => {}, getStatus: () => ({ available: false, authenticated: false, itemCount: 0 }) };
    }

    const rows121 = Array.isArray(payload?.rows121) ? payload.rows121 : [];
    const state = {
      statusLoaded: false,
      available: false,
      authenticated: false,
      csrfToken: "",
      member: null,
      busy: "status",
      activeItemId: null,
      inviterByRow: rows121.map(row => row?.initiatedBy === "other" ? "other" : "me"),
      inviterDetailsOpen: false,
      planId: null,
      hasPrepared: false,
      matchingChanged: false,
      resolvedMembers: Object.create(null),
      items: [],
      submissionResults: new Map(),
      selected: new Set(),
      reviewedSourceKey: null,
      reviewConfirmItemId: null,
      reviewAbsenceChecked: false,
      planMember: null,
      bulkConfirm: null,
      message: "正在確認 BNI 登入服務狀態…",
      messageKind: "info",
    };

    const completedSources = new Map();
    let cleanupFailed = false;
    function notifyConfirmed(items) {
      const confirmed = items.filter(item => ['success', 'already_sent'].includes(item.status))
        .map(item => ({kind: item.kind, sourceIndex: sourceIndexFor(item), status: item.status}))
        .filter(item => item.sourceIndex >= 0);
      if (!confirmed.length) return;
      for (const item of confirmed) completedSources.set(`${item.kind}:${item.sourceIndex}`, item);
      try {
        if (typeof options.onConfirmed === 'function') {
          if (options.onConfirmed([...completedSources.values()]) === false) throw Error('Draft cleanup failed');
        }
        cleanupFailed = false;
      } catch { cleanupFailed = true; }
    }

    function identityMatchesTarget() {
      const loggedName = identityNameKey(state.member?.name);
      const targetName = identityNameKey(payload?.me);
      if (!loggedName || !targetName || loggedName !== targetName) return false;
      const targetChapter = identityChapterKey(payload?.meChapter);
      if (!targetChapter) return true;
      const loggedChapter = identityChapterKey(state.member?.chapter);
      return !!loggedChapter && loggedChapter === targetChapter;
    }

    function samePlanMember() {
      if (!state.planMember || !state.member || !identityMatchesTarget()) return false;
      const plannedId = String(state.planMember.id || "");
      const currentId = String(state.member.id || "");
      if (plannedId && currentId) return plannedId === currentId;
      return identityNameKey(state.planMember.name) === identityNameKey(state.member.name)
        && identityChapterKey(state.planMember.chapter) === identityChapterKey(state.member.chapter);
    }

    function canSubmitItem(item) {
      if (item?.status !== "ready" || item.id == null || !String(item.id).trim() || !samePlanMember()) return false;
      const kind = item.kind === "referral" ? "ref" : item.kind;
      if (!(["121", "ref"].includes(kind))) return false;
      const sourceRows = sourceRowsFor(kind);
      const sourceIndex = sourceIndexFor(item);
      if (sourceIndex < 0 || sourceIndex >= sourceRows.length || !sourceRows[sourceIndex]) return false;
      if (Array.isArray(item.candidates) && item.candidates.length && !state.resolvedMembers[`${kind}:${sourceIndex}`]) return false;
      return true;
    }

    function eligibleReadyItems() {
      const idCounts = new Map();
      state.items.forEach(item => {
        if (item?.id == null || !String(item.id).trim()) return;
        const id = String(item.id);
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      });
      return state.items.filter(item => canSubmitItem(item) && idCounts.get(String(item.id)) === 1);
    }

    function isSelectableReadyItem(item) {
      return eligibleReadyItems().includes(item);
    }

    function currentReadyItems() {
      return eligibleReadyItems().filter(item => state.selected.has(String(item.id)));
    }

    function invitersComplete() {
      return state.inviterByRow.every(value => value === "me" || value === "other");
    }

    function rememberSubmissionResult(planId, item) {
      if (!item?._submitted || !planId || item.id == null) return;
      const key = `${planId}:${item.id}`;
      state.submissionResults.set(key, { ...item, _journalKey: key });
    }

    function archiveSubmissionResults(planId = state.planId) {
      state.items.forEach(item => rememberSubmissionResult(planId, item));
    }

    function invalidatePlan(message = "資料已更新。請重新配對單據會員後再送出。", matchingChanged = true) {
      archiveSubmissionResults();
      state.planId = null;
      state.planMember = null;
      state.items = [];
      state.selected.clear();
      state.bulkConfirm = null;
      state.reviewConfirmItemId = null;
      state.reviewAbsenceChecked = false;
      state.matchingChanged = matchingChanged;
      state.message = message;
      state.messageKind = "info";
    }

    function updateBatchButton() {
      const button = host.querySelector("[data-action='send-batch']");
      if (!button) return;
      const count = currentReadyItems().length;
      button.textContent = `確認送出已勾選 ${count} 筆`;
      button.disabled = !count || !!state.busy || !!state.bulkConfirm || !state.available || !state.authenticated || !state.planId;
      const counter = host.querySelector("[data-selection-count]");
      if (counter) counter.textContent = `已勾選 ${count} 筆可送出的資料`;
    }

    function rememberDisclosureState() {
      const details = host.querySelector("[data-inviter-details]");
      if (details) state.inviterDetailsOpen = details.open;
    }

    function setMessage(message, kind = "info") {
      state.message = message;
      state.messageKind = kind;
    }

    async function getStatus() {
      const response = await fetch(API.status, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = await parseJson(response);
      if (!response.ok) throw new ApiError(response.status || 503);
      if (!body || body.available !== true) throw new ApiError(404);
      if (typeof body.csrfToken !== "string" || !body.csrfToken) throw new ApiError(503);
      return body;
    }

    function postJson(path, body) {
      const requestBody = JSON.stringify(body);
      return fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": state.csrfToken,
        },
        body: requestBody,
      }).then(async response => {
        const result = await parseJson(response);
        if (!response.ok) throw new ApiError(response.status);
        if (!result || typeof result !== "object") throw new ApiError(502);
        if (typeof result.csrfToken === "string" && result.csrfToken) state.csrfToken = result.csrfToken;
        return result;
      });
    }

    function statusMessage(error) {
      if (error?.status === 404) return "目前網站尚未提供 BNI 登入服務。你的填寫資料仍保留；服務開通後可在此頁重試，或展開 Excel 備份。";
      return "目前無法連線到 BNI 登入服務。你的填寫資料仍保留；請稍後重試或展開 Excel 備份。";
    }

    function postFailureMessage(error, action) {
      if (error?.status === 401) return action === "login"
        ? "登入未成功，請確認使用者名稱與密碼後重試。"
        : "登入已逾時，請重新登入後再預覽資料。";
      if (error?.status === 409) {
        if (action === "login") return "BNI Connect 要求額外驗證，這批資料尚未送出。請先完成驗證，再回到本頁登入。";
        if (action === "prepare") return "登入會員與本次填寫會員的姓名或分會不符。請核對上方姓名與分會，或回首頁重新選擇會員；括號綽號與英文不影響比對。";
        return "BNI Connect 要求額外驗證。請先確認這筆是否已送出；系統不會自動重送。";
      }
      if (error?.status === 429) return action === "submit"
        ? "BNI Connect 目前限制送出頻率。請先確認這筆是否已記錄，稍候再處理；系統不會自動重送。"
        : "目前操作較頻繁，請稍候再試。";
      if (error?.status === 403) return action === "prepare"
        ? "目前無法完成會員配對。請重新登入，並確認登入會員與本次填寫會員相符。"
        : "目前無法完成這項操作。請重新檢查登入狀態後再試。";
      if (error?.status === 404) return "BNI 登入服務暫時無法使用。填寫資料仍保留，請稍後重試。";
      if (action === "submit" && !error?.status) return "瀏覽器未收到送出服務的回覆，可能是網路中斷或連線逾時，無法確認是否已入帳。請先到 BNI Connect 查這筆，再決定是否重試。";
      if (action === "submit" && error?.status >= 500) return `送出服務回應異常（HTTP ${error.status}），無法確認是否已入帳。請先查看 BNI 官方紀錄；草稿已保留，可編輯或清除。`;
      return action === "submit"
        ? "送出結果目前無法確認。這筆已標示為待確認，請先到 BNI Connect 查看，系統不會自動重送。"
        : "無法完成 BNI Connect 操作，請稍後再試。";
    }

    function setAuthenticated(member) {
      const name = textFromServer(member?.name);
      if (!name) return false;
      state.authenticated = true;
      state.member = {
        id: member?.id == null ? "" : String(member.id),
        name,
        chapter: textFromServer(member?.chapter),
      };
      return true;
    }

    function expireSession(message) {
      state.authenticated = false;
      state.member = null;
      state.csrfToken = "";
      state.planId = null;
      state.planMember = null;
      state.bulkConfirm = null;
      state.selected.clear();
      setMessage(message, "error");
    }

    function createButton(label, action, className = "bc-button", disabled = false) {
      const button = node("button", className, label);
      button.type = "button";
      button.dataset.action = action;
      button.disabled = disabled;
      return button;
    }

    function createInfoLine(label, value) {
      const line = node("p", "bc-info-line");
      line.append(node("span", "bc-info-label", label), node("span", "bc-info-value", textFromServer(value, "—")));
      return line;
    }


    function renderLogin() {
      const section = node("section", "bc-login");
      if (state.authenticated && state.member) {
        section.className += " bc-login-connected";
        const member = node("div", "bc-member");
        member.setAttribute("aria-label", "BNI Connect 登入會員");
        member.append(node("span", "bc-member-mark", "已登入"));
        member.append(node("strong", "bc-member-name", state.member.name));
        if (state.member.chapter) member.append(node("span", "bc-member-chapter", state.member.chapter));
        section.append(member);
        const logout = createButton("登出", "logout", "bc-button bc-secondary", !!state.busy);
        section.append(logout);
        return section;
      }

      section.append(node("h3", "bc-section-title", "登入 BNI Connect"));
      const form = node("form", "bc-login-form");
      form.dataset.loginForm = "true";
      const locked = !state.statusLoaded || !state.available || !state.csrfToken || !!state.busy;
      const usernameLabel = node("label", "bc-field");
      usernameLabel.append(node("span", "bc-field-name", "使用者名稱"));
      const username = node("input", "bc-input");
      username.name = "username";
      username.autocomplete = "username";
      username.required = true;
      username.disabled = locked;
      usernameLabel.append(username);
      const passwordLabel = node("label", "bc-field");
      passwordLabel.append(node("span", "bc-field-name", "密碼"));
      const password = node("input", "bc-input");
      password.name = "password";
      password.type = "password";
      password.autocomplete = "current-password";
      password.required = true;
      password.disabled = locked;
      passwordLabel.append(password);
      form.append(usernameLabel, passwordLabel);
      const login = node("button", "bc-button bc-primary", state.busy === "login" ? "登入中…" : "登入並預覽資料");
      login.type = "submit";
      login.disabled = locked;
      form.append(login);
      form.append(node("p", "bc-help", "登入資料只會送到本頁的 BNI 登入服務；密碼送出後立即清除，不會儲存在瀏覽器。"));
      section.append(form);
      return section;
    }

    function kindLabel(kind) {
      if (kind === "121") return "121";
      if (kind === "ref" || kind === "referral") return "引薦";
      return textFromServer(kind, "資料");
    }

    function statusLabel(status) {
      if (status === "ready") return ["可送出", "bc-status-ready"];
      if (status === "blocked") return ["暫不可送出", "bc-status-blocked"];
      if (status === "already_sent") return ["BNI 已有紀錄", "bc-status-done"];
      if (status === "success") return ["已送出", "bc-status-done"];
      if (status === "failed") return ["送出失敗", "bc-status-failed"];
      if (status === "uncertain") return ["結果待確認", "bc-status-uncertain"];
      return ["狀態待確認", "bc-status-blocked"];
    }

    function sourceRowsFor(kind) {
      if (kind === "121") return rows121;
      if (kind === "ref" || kind === "referral") return Array.isArray(payload?.refs) ? payload.refs : [];
      return [];
    }

    function sourceIndexFor(item) {
      return typeof item?.sourceIndex === "number" && Number.isInteger(item.sourceIndex) && item.sourceIndex >= 0
        ? item.sourceIndex
        : -1;
    }

    function sourceRowForItem(item) {
      const sourceRows = sourceRowsFor(item?.kind);
      const sourceIndex = sourceIndexFor(item);
      if (sourceIndex < 0 || sourceIndex >= sourceRows.length) return null;
      return sourceRows[sourceIndex];
    }

    function renderCandidates(item) {
      if (item?.status !== "blocked" || !Array.isArray(item.candidates) || !item.candidates.length) return null;
      const kind = item.kind === "referral" ? "ref" : item.kind;
      const sourceRows = sourceRowsFor(item.kind);
      const index = sourceIndexFor(item);
      const wrap = node("div", "bc-candidate-pairing");
      if (!Number.isInteger(index) || index < 0 || index >= sourceRows.length || !["121", "ref", "referral"].includes(item.kind)) {
        wrap.append(node("p", "bc-help", "這筆資料無法安全配對，請再次配對單據會員。"));
        return wrap;
      }
      const key = `${kind}:${index}`;
      const label = node("label", "bc-inviter-label");
      label.append(node("span", "", "候選會員（選擇後需配對單據會員）"));
      const select = node("select", "bc-select");
      select.dataset.candidateKind = kind;
      select.dataset.sourceIndex = String(index);
      select.disabled = !!state.busy || !state.authenticated;
      select.setAttribute("aria-label", `第 ${index + 1} 筆 ${kind === "121" ? "121" : "引薦"} 選擇配對會員`);
      const blank = node("option", "", "請選擇配對會員");
      blank.value = "";
      blank.selected = !state.resolvedMembers[key];
      select.append(blank);
      item.candidates.forEach(candidate => {
        if (!candidate || candidate.id == null) return;
        const name = textFromServer(candidate.name, "未提供姓名");
        const chapter = textFromServer(candidate.chapter);
        const option = node("option", "", chapter ? `${name} · ${chapter}` : name);
        option.value = String(candidate.id);
        option.selected = state.resolvedMembers[key] === option.value;
        select.append(option);
      });
      label.append(select);
      wrap.append(label);
      return wrap;
    }

    function renderItem(item, index) {
      const card = node("article", "bc-item");
      const head = node("div", "bc-item-head");
      const sourceRow = sourceRowForItem(item);
      const sourceName = textFromServer(sourceRow?.name) || textFromServer(item?.name, "未命名會員");
      const sourceChapter = textFromServer(sourceRow?.chapter) || textFromServer(item?.chapter);
      const title = node("h4", "bc-item-title", `${index + 1}. ${sourceName}`);
      const kind = node("span", "bc-kind", kindLabel(item?.kind));
      const [statusText, statusClass] = statusLabel(item?.status);
      const badge = node("span", `bc-status ${statusClass}`, statusText);
      head.append(title, kind, badge);
      card.append(head);

      const chapter = sourceChapter;
      const date = textFromServer(item?.date) || textFromServer(sourceRow?.date);
      const summary = textFromServer(item?.summary);
      const matchedName = textFromServer(item?.matchedMember?.name);
      const matchedChapter = textFromServer(item?.matchedMember?.chapter);
      if (matchedName) {
        const match = node("div", "bc-matched-member");
        match.append(node("span", "bc-match-label", "配對會員："));
        match.append(node("strong", "bc-match-name", matchedName));
        if (matchedChapter) match.append(node("span", "bc-match-chapter", `（${matchedChapter}）`));
        card.append(match);
        const sourceDiffers = matchedName !== sourceName
          || (matchedChapter && matchedChapter !== chapter);
        if (sourceDiffers) {
          card.append(node("p", "bc-source-member", `來源資料：${sourceName}${chapter ? `（${chapter}）` : ""}`));
        }
      }
      const detail = node("div", "bc-item-detail");
      if (item?.kind === "121" && item?.initiatedBy) {
        detail.append(createInfoLine("邀請方", item.initiatedBy === "other" ? "對方邀請我" : "我邀請對方"));
      }
      if (chapter) detail.append(createInfoLine("分會", chapter));
      if (date) detail.append(createInfoLine("日期", date));
      const fields = [
        ["地點", item?.place || sourceRow?.place],
        ["121 主題", item?.topic || sourceRow?.topic],
        ["引薦類型", item?.type || sourceRow?.type],
        ["被引薦人", item?.referredName || sourceRow?.referredName],
        ["引薦內容", item?.content || sourceRow?.content],
        ["電話", item?.phone || sourceRow?.phone],
        ["聯絡方式", item?.contact || ({ card: "提供名片", call: "電話聯絡", both: "提供名片、電話聯絡", none: "未勾選" }[sourceRow?.contact] || "")],
      ];
      fields.forEach(([label, value]) => {
        const text = textFromServer(value);
        if (text) detail.append(createInfoLine(label, text));
      });
      if (summary) detail.append(createInfoLine("摘要", summary));
      if (!chapter && !date && !summary && !fields.some(([, value]) => textFromServer(value))) {
        detail.append(node("p", "bc-help", "沒有其他資料可顯示。"));
      }
      card.append(detail);
      if (!['success', 'already_sent'].includes(item?.status) && sourceRow && typeof options.onEditDraft === 'function') {
        const edit = createButton('編輯草稿', 'edit-draft', 'bc-button bc-secondary', !!state.busy);
        edit.dataset.editKind = item.kind;
        edit.dataset.editSourceIndex = String(sourceIndexFor(item));
        card.append(edit);
        if (item.status === 'uncertain' || item.retryReviewAllowed === true)
          card.append(node('p', 'bc-help', '原單送出結果仍待確認；更正後請先到 BNI 核對，再決定是否送出。'));
      }

      const message = textFromServer(item?.resultMessage) || textFromServer(item?.reason);
      if (message) card.append(node("p", "bc-item-message", message));
      if (item?.diagnostic?.code && !["success", "already_sent"].includes(item.status)) {
        card.append(node("p", "bc-item-message", `原因與處理方式：${diagnosticMessage(item.diagnostic.code, item.diagnostic)}`));
      }

      if (item?.status === "blocked" && item?.retryReviewAllowed === true) {
        const review = node("div", "bc-item-review");
        if (state.reviewConfirmItemId === String(item.id)) {
          review.append(node("p", "bc-help", "請先在 BNI Connect 搜尋這筆資料。勾選確認後只記錄人工核對，再配對單據會員；仍需你手動勾選送出。"));
          const label = node("label", "bc-review-confirm-label");
          const checkbox = node("input", "bc-review-confirm-checkbox");
          checkbox.type = "checkbox";
          checkbox.dataset.reviewConfirm = String(item.id);
          checkbox.checked = state.reviewAbsenceChecked;
          checkbox.disabled = !!state.busy;
          checkbox.setAttribute("aria-label", "已確認在 BNI Connect 沒有此單");
          label.append(checkbox, node("span", "", "已確認在 BNI Connect 沒有此單"));
          review.append(label);

          const actions = node("div", "bc-review-confirm-actions");
          const confirm = createButton(
            "確認解除鎖定並配對單據會員",
            "confirm-review-absent",
            "bc-button bc-primary",
            !!state.busy || !state.available || !state.authenticated || !state.planId || !state.reviewAbsenceChecked,
          );
          confirm.dataset.itemId = String(item.id);
          const cancel = createButton("取消", "cancel-review-absent", "bc-button bc-secondary", !!state.busy);
          cancel.dataset.itemId = String(item.id);
          actions.append(confirm, cancel);
          review.append(actions);
        } else {
          review.append(node("p", "bc-help", "若已確認這筆沒有建立，可記錄人工核對並配對單據會員；此操作不會送出資料。"));
          const button = createButton(
            "檢查後解除重試鎖定",
            "review-absent",
            "bc-button bc-secondary",
            !!state.busy || !state.available || !state.authenticated || !state.planId,
          );
          button.dataset.itemId = String(item.id);
          review.append(button);
        }
        card.append(review);
      }

      const candidates = renderCandidates(item);
      if (candidates) card.append(candidates);

      if (item?.status === "ready") {
        const label = node("label", "bc-pick-label");
        const input = node("input", "bc-checkbox");
        input.type = "checkbox";
        input.dataset.itemId = String(item.id);
        input.checked = state.selected.has(String(item.id));
        input.disabled = !!state.busy || !!state.bulkConfirm || !isSelectableReadyItem(item) || !state.authenticated || !state.planId;
        input.setAttribute("aria-label", `選取第 ${index + 1} 筆 ${textFromServer(item.name, "資料")} 送出`);
        label.append(input, node("span", "", "選取此筆送出"));
        card.append(label);
      }
      return card;
    }

    function render() {
      const shell = node("div", "bc-shell");
      if (!state.authenticated || !identityMatchesTarget()) {
        shell.append(node("div", "bc-filled-member", `本次填寫會員：${textFromServer(payload?.me, "資料未提供")}${payload?.meChapter ? " · " + textFromServer(payload.meChapter) : ""}`));
      }

      if (state.message) {
        const status = node("div", `bc-message bc-message-${state.messageKind}`, state.message);
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        shell.append(status);
      }
      if (state.messageKind === "error") {
        const recovery = node("div", "bc-panel-controls");
        recovery.append(createButton("重新檢查登入狀態", "refresh", "bc-button bc-secondary", !!state.busy));
        shell.append(recovery);
      }

      shell.append(renderLogin());

      if (state.authenticated && state.member) {
        const actions = node("div", "bc-actions");
        const preview = createButton(
          state.busy === "prepare" ? "配對單據會員中…" : "配對單據會員",
          "prepare",
          "bc-button bc-secondary",
          !!state.busy || !!state.bulkConfirm || !invitersComplete() || !state.csrfToken || !identityMatchesTarget(),
        );
        actions.append(preview);
        if (state.planId && state.items.length) {
          if (state.bulkConfirm) {
            const confirm = node("div", "bc-bulk-confirm");
            const count = state.bulkConfirm.ids.length;
            confirm.append(node("p", "bc-bulk-confirm-message", `將依序送出 ${count} 筆可送出單據。請確認實際筆數後開始。`));
            const confirmActions = node("div", "bc-bulk-confirm-actions");
            confirmActions.append(createButton("取消", "cancel-send-all", "bc-button bc-secondary", !!state.busy));
            confirmActions.append(createButton(`確認送出 ${count} 筆`, "confirm-send-all", "bc-button bc-primary", !!state.busy));
            confirm.append(confirmActions);
            actions.append(confirm);
          } else {
            const eligibleCount = eligibleReadyItems().length;
            actions.append(createButton("一鍵奔綠燈", "send-all", "bc-button bc-primary bc-send-all",
              !eligibleCount || !!state.busy || !state.available || !state.authenticated || !identityMatchesTarget()));
          }
        }
        if (!invitersComplete() && rows121.length) {
          actions.append(node("p", "bc-help bc-full", "請先設定 121 邀請方。"));
        } else if (!identityMatchesTarget()) {
          actions.append(node("p", "bc-help bc-full bc-identity-warning", "登入會員與本次填寫會員不符，請確認帳號後再配對。"));
        }
        shell.append(actions);
      }

      if (state.items.length) {
        const preview = node("section", "bc-preview");
        const heading = node("h3", "bc-section-title", "會員配對預覽");
        preview.append(heading);
        preview.append(node("p", "bc-help", "逐筆確認單據內容；只有「可送出」項目能勾選。"));
        const list = node("div", "bc-items");
        state.items.forEach((item, index) => list.append(renderItem(item, index)));
        preview.append(list);
        if (state.matchingChanged || !state.planId) {
          preview.append(node("p", "bc-selection-count", "配對資料已變更；請先按上方「配對單據會員」。"));
        } else {
          const send = createButton("確認送出已勾選 0 筆", "send-batch", "bc-button bc-primary bc-send", true);
          preview.append(send);
          const count = node("p", "bc-selection-count", "已勾選 0 筆可送出的資料");
          count.dataset.selectionCount = "true";
          count.setAttribute("aria-live", "polite");
          preview.append(count);
        }
        shell.append(preview);
      }

      const visibleJournal = [...state.submissionResults.values()]
        .filter(result => !state.items.some(item => String(item.id) === String(result.id)));
      if (visibleJournal.length) {
        const history = node("section", "bc-preview bc-result-history");
        history.append(node("h3", "bc-section-title", "本頁先前的送出結果"));
        history.append(node("p", "bc-help", "保留本頁先前的送出結果。"));
        const list = node("div", "bc-items");
        visibleJournal.forEach(item => list.append(renderItem(item, sourceIndexFor(item) >= 0 ? sourceIndexFor(item) : 0)));
        history.append(list);
        shell.append(history);
      }

      if ((rows121.length || payload?.refs?.length) && typeof options.onClearDrafts === "function") {
        const clear = node("section", "bc-clear-drafts");
        clear.append(createButton("清除Key單", "clear-drafts", "bc-button bc-secondary", !!state.busy || !!state.bulkConfirm));
        clear.append(node("p", "bc-help", cleanupFailed
          ? "BNI 已確認完成，但本機清除未完成。請按「清除Key單」移除本頁草稿，勿重送。"
          : "清除本機 121 與引薦草稿，不會刪除 BNI 官方單據。"));
        shell.append(clear);
      }

      host.replaceChildren(shell);
      updateBatchButton();
    }

    async function refreshStatus({ initial = false } = {}) {
      if (!initial && state.busy) return;
      state.busy = "status";
      setMessage(initial
        ? "正在確認 BNI 登入服務狀態…"
        : "正在只讀確認 BNI 登入狀態；不會重新送出或清除本頁結果。");
      render();
      try {
        const result = await getStatus();
        state.statusLoaded = true;
        state.busy = null;
        state.available = true;
        state.csrfToken = result.csrfToken;
        if (result.authenticated === true) {
          if (setAuthenticated(result.member)) {
            if (!identityMatchesTarget()) {
              if (state.planId) invalidatePlan("登入會員已變更，請重新配對單據會員。", true);
              setMessage("登入會員與本次填寫會員不符，請確認帳號後再配對。", "error");
            } else if (state.planId && !samePlanMember()) {
              invalidatePlan("登入會員已變更，請重新配對單據會員。", true);
              setMessage("登入會員已變更，請重新配對單據會員。", "error");
            } else {
              setMessage(invitersComplete() ? "" : "請先設定 121 邀請方，再配對單據會員。");
            }
          } else {
            state.authenticated = false;
            state.member = null;
            state.planId = null;
            state.planMember = null;
            state.bulkConfirm = null;
            state.selected.clear();
            setMessage("登入狀態缺少會員資料，請重新登入。", "error");
          }
        } else {
          state.authenticated = false;
          state.member = null;
          state.planId = null;
          state.planMember = null;
          state.bulkConfirm = null;
          state.selected.clear();
          setMessage(state.items.length || state.submissionResults.size
            ? "BNI Connect 尚未登入。本頁送出結果仍保留。"
            : "服務可用。請在同一頁登入 BNI Connect。");
        }
        render();
        if (initial && state.authenticated && identityMatchesTarget() && invitersComplete()) await prepare();
      } catch (error) {
        state.statusLoaded = true;
        state.busy = null;
        state.available = false;
        state.authenticated = false;
        state.csrfToken = "";
        state.member = null;
        state.planId = null;
        state.planMember = null;
        state.bulkConfirm = null;
        state.selected.clear();
        setMessage(state.items.length || state.submissionResults.size
          ? "無法確認目前的登入狀態。本頁送出結果仍保留；這次只讀檢查沒有重新送出資料。請稍後再試。"
          : statusMessage(error), "error");
        render();
      }
    }

    async function login(form) {
      if (!state.available || !state.csrfToken || !state.statusLoaded || state.busy) return;
      const usernameField = form.elements.namedItem("username");
      const passwordField = form.elements.namedItem("password");
      const credentials = {
        username: String(usernameField?.value || "").trim(),
        password: String(passwordField?.value || ""),
      };
      if (passwordField) passwordField.value = "";
      if (!credentials.username || !credentials.password) {
        credentials.password = "";
        setMessage("請輸入使用者名稱與密碼。", "error");
        render();
        return;
      }
      state.busy = "login";
      setMessage("正在登入 BNI Connect…");
      const request = postJson(API.login, credentials);
      credentials.password = "";
      render();
      try {
        const result = await request;
        if (typeof result.csrfToken !== "string" || !result.csrfToken) {
          state.busy = null;
          state.authenticated = false;
          state.member = null;
          state.csrfToken = "";
          setMessage("登入服務未回傳更新後的安全驗證資訊。請重新檢查服務狀態。", "error");
          render();
          return;
        }
        if (!setAuthenticated(result.member)) {
          state.authenticated = false;
          state.member = null;
          state.busy = null;
          setMessage("登入服務沒有回傳可辨識的會員資料。", "error");
          render();
          return;
        }
        state.busy = null;
        invalidatePlan(invitersComplete()
          ? ""
          : "請先設定 121 邀請方，再配對單據會員。", state.hasPrepared);
        render();
        if (!identityMatchesTarget()) {
          setMessage("登入會員與本次填寫會員不符，請確認帳號後再配對。", "error");
          render();
        } else if (invitersComplete()) {
          await prepare();
        }
      } catch (error) {
        state.busy = null;
        if (error?.status === 401) {
          state.authenticated = false;
          state.member = null;
          state.csrfToken = "";
        } else if (error?.status === 403) {
          state.csrfToken = "";
        }
        setMessage(error?.status === 403
          ? "登入請求被拒絕，請重新檢查服務後再登入。"
          : postFailureMessage(error, "login"), "error");
        render();
      }
    }

    function payloadForPrepare() {
      const resolvedRow = (row, kind, index) => {
        const resolvedMemberId = state.resolvedMembers[`${kind}:${index}`];
        return resolvedMemberId ? { ...row, resolvedMemberId } : { ...row };
      };
      return {
        ...payload,
        rows121: rows121.map((row, index) => ({
          ...resolvedRow(row, "121", index),
          initiatedBy: state.inviterByRow[index],
        })),
        refs: (Array.isArray(payload?.refs) ? payload.refs : []).map((row, index) => resolvedRow(row, "ref", index)),
      };
    }

    async function prepare() {
      if (!state.available || !state.authenticated || !state.csrfToken || state.busy) return;
      if (!identityMatchesTarget()) {
        setMessage("登入會員與本次填寫會員不符，請確認帳號後再配對。", "error");
        render();
        return;
      }
      if (!invitersComplete()) {
        setMessage("請先設定 121 邀請方。", "error");
        render();
        return;
      }
      state.busy = "prepare";
      archiveSubmissionResults();
      state.planId = null;
      state.planMember = null;
      state.bulkConfirm = null;
      state.selected.clear();
      state.reviewConfirmItemId = null;
      state.reviewAbsenceChecked = false;
      const reviewedSourceKey = state.reviewedSourceKey;
      setMessage("正在配對單據會員…");
      render();
      try {
        const result = await postJson(API.prepare, { payload: payloadForPrepare() });
        if (!result.planId || !Array.isArray(result.items)) throw new ApiError(502);
        state.planId = String(result.planId);
        state.planMember = { ...state.member };
        const preparedRows = payloadForPrepare().rows121;
        let reviewedItemFound = false;
        state.items = result.items.filter(item => item && item.id != null).map(item => {
          let initiatedBy;
          if (item.kind === "121") {
            const sourceIndex = sourceIndexFor(item);
            if (sourceIndex >= 0 && sourceIndex < preparedRows.length) {
              initiatedBy = preparedRows[sourceIndex].initiatedBy;
            }
          }
          const sourceKey = `${item.kind}:${sourceIndexFor(item)}`;
          const reviewed = !!reviewedSourceKey && sourceKey === reviewedSourceKey && item.status === "ready";
          if (reviewed) reviewedItemFound = true;
          return {
            ...item,
            id: String(item.id),
            initiatedBy,
            status: ["ready", "blocked", "already_sent"].includes(item.status) ? item.status : "blocked",
            resultMessage: reviewed
                ? "已記錄你在 BNI Connect 的人工核對，並再次配對單據會員。請檢查內容，再手動勾選送出。"
              : item.retryReviewAllowed === true
                ? "先前送出結果待確認。請到 BNI Connect 核對；如已確認沒有此單，可記錄人工核對後再次配對單據會員。"
                : "",
          };
        });
        for (const item of state.items) {
          if (completedSources.has(`${item.kind}:${sourceIndexFor(item)}`)) item.status = 'already_sent';
        }
        notifyConfirmed(state.items);
        if (reviewedSourceKey) state.reviewedSourceKey = null;
        state.busy = null;
        state.hasPrepared = true;
        state.matchingChanged = false;
        setMessage(reviewedSourceKey
          ? (reviewedItemFound
            ? "人工核對已記錄，會員配對完成。"
            : "人工核對已記錄，但配對結果沒有回傳這筆資料。請檢查目前結果。")
          : "",
        reviewedSourceKey ? (reviewedItemFound ? "info" : "error") : "success");
        render();
      } catch (error) {
        state.busy = null;
        state.planId = null;
        state.planMember = null;
        state.bulkConfirm = null;
        state.selected.clear();
        if (error?.status === 401) {
          expireSession(postFailureMessage(error, "prepare"));
        } else {
          setMessage(postFailureMessage(error, "prepare"), "error");
        }
        render();
      }
    }

    function submittedStatus(status) {
      return ["success", "failed", "uncertain", "already_sent"].includes(status) ? status : "uncertain";
    }

    function beginSendAll() {
      if (!state.planId || !state.authenticated || state.busy || state.bulkConfirm || !identityMatchesTarget()) return;
      const ids = eligibleReadyItems().map(item => String(item.id));
      if (!ids.length) return;
      state.selected = new Set(ids);
      void sendBatch(ids);
    }

    function beginManualSend() {
      if (!state.planId || !state.authenticated || state.busy || state.bulkConfirm || !identityMatchesTarget()) return;
      const eligible = currentReadyItems();
      if (!eligible.length) return;
      state.bulkConfirm = {
        ids: eligible.map(item => String(item.id)),
        previousSelection: [...state.selected],
      };
      state.selected = new Set(state.bulkConfirm.ids);
      setMessage("");
      render();
    }

    function cancelSendAll() {
      if (!state.bulkConfirm) return;
      const previous = state.bulkConfirm.previousSelection;
      state.selected = new Set(previous.filter(id => eligibleReadyItems().some(item => String(item.id) === id)));
      state.bulkConfirm = null;
      render();
    }

    async function sendBatch(expectedIds = null) {
      if (!state.planId || !state.authenticated || state.busy || (state.bulkConfirm && !expectedIds)) return;
      const ready = currentReadyItems();
      const expected = expectedIds ? new Set(expectedIds) : null;
      const selected = expected ? ready.filter(item => expected.has(String(item.id))) : ready;
      if (expected && selected.length !== expected.size) {
        const previous = state.bulkConfirm?.previousSelection || [];
        state.selected = new Set(previous.filter(id => eligibleReadyItems().some(item => String(item.id) === id)));
        state.bulkConfirm = null;
        setMessage("可送出資料已變更，請重新確認筆數後再送出。", "error");
        render();
        return;
      }
      if (!selected.length) return;
      const planId = state.planId;
      state.bulkConfirm = null;
      state.busy = "submit";
      setMessage(`開始依序送出 ${selected.length} 筆已確認資料。`, "info");
      render();

      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index];
        state.activeItemId = item.id;
        setMessage(`正在送出第 ${index + 1} / ${selected.length} 筆：${textFromServer(item.name, "資料")}…`);
        render();
        let result;
        try {
          result = await postJson(API.submit, { planId, itemId: item.id });
        } catch (error) {
          item.status = "uncertain";
          item._submitted = true;
          item.resultMessage = postFailureMessage(error, "submit");
          rememberSubmissionResult(planId, item);
          state.selected.delete(item.id);
          if (error?.status === 401) {
            state.activeItemId = null;
            state.busy = null;
            expireSession("登入已逾時，批次已停止。這筆結果待確認；請先到 BNI Connect 查看，系統不會自動重送。");
            render();
            return;
          }
          state.activeItemId = null;
          state.busy = null;
          setMessage("批次已停止，因為這筆結果無法確認。請先到 BNI Connect 查看這筆；系統不會自動重送。", "error");
          render();
          return;
        }

        item.status = submittedStatus(result.status);
        if (result.diagnostic && typeof result.diagnostic === "object") item.diagnostic = result.diagnostic;
        item._submitted = true;
        item.resultMessage = textFromServer(result.message,
          item.status === "success" ? "BNI Connect 已確認送出。" :
          item.status === "already_sent" ? "BNI Connect 已有這筆記錄。" :
          item.status === "failed" ? "BNI Connect 未確認送出。系統不會自動重試。" :
          "結果待確認。請先到 BNI Connect 查看，系統不會自動重送。");
        rememberSubmissionResult(planId, item);
        notifyConfirmed([item]);
        state.selected.delete(item.id);
        state.activeItemId = null;
        render();
      }

      state.activeItemId = null;
      state.busy = null;
      const failed = selected.filter(item => item.status === "failed").length;
      const uncertain = selected.filter(item => item.status === "uncertain").length;
      if (failed || uncertain) {
        const confirmed = selected.filter(item => item.status === "success" || item.status === "already_sent").length;
        setMessage(`本批次送出嘗試已結束：確認 ${confirmed} 筆、失敗 ${failed} 筆、待確認 ${uncertain} 筆。請查看各筆狀態；失敗或待確認項目不會自動重送。`, "error");
      } else {
        setMessage("本批次已由 BNI Connect 確認完成。請查看各筆狀態。", "success");
      }
      render();
    }

    async function reviewAbsent(item) {
      if (!item || item.status !== "blocked" || item.retryReviewAllowed !== true
        || !state.planId || !state.authenticated || !state.reviewAbsenceChecked
        || state.reviewConfirmItemId !== String(item.id) || state.busy) return;

      const planId = state.planId;
      state.reviewConfirmItemId = null;
      state.reviewAbsenceChecked = false;
      state.busy = "review";
      setMessage("正在記錄人工核對；不會送出資料…");
      render();
      try {
        const result = await postJson(API.retryReview, {
          planId,
          itemId: item.id,
          confirmedAbsent: true,
        });
        if (result.status !== "reviewed") throw new ApiError(502);
        state.reviewedSourceKey = `${item.kind}:${sourceIndexFor(item)}`;
        state.busy = null;
        setMessage(textFromServer(result.message,
          "已記錄人工核對，正在配對單據會員。仍需由你檢查並手動送出。"));
        render();
        await prepare();
      } catch (error) {
        state.busy = null;
        if (error?.status === 401) {
          expireSession("登入已逾時，人工核對未完成。請重新登入並配對單據會員。");
        } else {
          setMessage("無法記錄人工核對。送出狀態未變，請到 BNI Connect 核對後再試。", "error");
        }
        render();
      }
    }

    async function logout() {
      if (!state.authenticated || state.busy) return;
      state.busy = "logout";
      setMessage("正在登出…");
      render();
      try {
        const result = await postJson(API.logout, {});
        state.busy = null;
        archiveSubmissionResults();
        state.authenticated = false;
        state.member = null;
        state.planId = null;
        state.planMember = null;
        state.bulkConfirm = null;
        state.items = [];
        state.selected.clear();
        if (typeof result.csrfToken !== "string" || !result.csrfToken) state.csrfToken = "";
        setMessage(state.csrfToken ? "已登出 BNI Connect。" : "已登出，但服務未回傳更新後的安全驗證資訊；請重新檢查服務。",
          state.csrfToken ? "info" : "error");
      } catch (error) {
        state.busy = null;
        archiveSubmissionResults();
        state.authenticated = false;
        state.member = null;
        state.csrfToken = "";
        state.planId = null;
        state.planMember = null;
        state.bulkConfirm = null;
        state.items = [];
        state.selected.clear();
        setMessage(error?.status === 401 ? "登入狀態已結束。" : "無法確認登出狀態，請重新檢查服務。", "error");
      }
      render();
    }

    host.addEventListener("submit", event => {
      if (!event.target.matches("[data-login-form]")) return;
      event.preventDefault();
      void login(event.target);
    });

    host.addEventListener("change", event => {
      const select = event.target.closest?.("[data-inviter-index]");
      if (select) {
        rememberDisclosureState();
        const index = Number(select.dataset.inviterIndex);
        if (!Number.isInteger(index) || index < 0 || index >= state.inviterByRow.length) return;
        state.inviterByRow[index] = select.value === "me" || select.value === "other" ? select.value : "";
        state.reviewedSourceKey = null;
        invalidatePlan("邀請方已更新。請重新配對單據會員後再送出。", state.hasPrepared);
        render();
        return;
      }
      const candidateSelect = event.target.closest?.("[data-candidate-kind][data-source-index]");
      if (candidateSelect) {
        const kind = candidateSelect.dataset.candidateKind;
        const index = Number(candidateSelect.dataset.sourceIndex);
        const key = `${kind}:${index}`;
        if (candidateSelect.value) state.resolvedMembers[key] = candidateSelect.value;
        else delete state.resolvedMembers[key];
        state.reviewedSourceKey = null;
        state.planId = null;
        state.planMember = null;
        state.bulkConfirm = null;
        state.selected.clear();
        state.matchingChanged = true;
        setMessage("候選配對已更新。請按「配對單據會員」再次確認；此項目目前不能送出。", "info");
        render();
        return;
      }
      const reviewConfirm = event.target.closest?.("[data-review-confirm]");
      if (reviewConfirm) {
        state.reviewAbsenceChecked = reviewConfirm.checked;
        const confirm = [...host.querySelectorAll("[data-action='confirm-review-absent']")]
          .find(button => button.dataset.itemId === reviewConfirm.dataset.reviewConfirm);
        if (confirm) {
          confirm.disabled = !!state.busy || !state.available || !state.authenticated
            || !state.planId || !state.reviewAbsenceChecked;
        }
        return;
      }
      const checkbox = event.target.closest?.("[data-item-id]");
      if (checkbox) {
        const id = checkbox.dataset.itemId;
        if (checkbox.checked) state.selected.add(id);
        else state.selected.delete(id);
        updateBatchButton();
      }
    });

    host.addEventListener("click", event => {
      const button = event.target.closest?.("[data-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      if (action === "refresh") void refreshStatus();
      else if (action === "edit-draft") {
        if (state.busy) return;
        const sourceIndex = Number(button.dataset.editSourceIndex);
        const kind = button.dataset.editKind;
        if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || !['121', 'ref'].includes(kind)) return;
        invalidatePlan('草稿已開啟編輯；修改後請配對單據會員。');
        options.onEditDraft?.({kind, sourceIndex});
      }
      else if (action === "clear-drafts") {
        if (state.busy || state.bulkConfirm) return;
        try {
          if (options.onClearDrafts?.() === false) throw Error('Draft cleanup failed');
        } catch { setMessage('本機清除尚未完成，請保留本頁結果，勿重送。', 'error'); render(); }
      }
      else if (action === "prepare") void prepare();
      else if (action === "send-batch") beginManualSend();
      else if (action === "send-all") beginSendAll();
      else if (action === "cancel-send-all") cancelSendAll();
      else if (action === "confirm-send-all") {
        const ids = state.bulkConfirm?.ids;
        if (ids) void sendBatch(ids);
      }
      else if (action === "review-absent") {
        const item = state.items.find(candidate => String(candidate.id) === button.dataset.itemId);
        state.reviewConfirmItemId = item && item.retryReviewAllowed === true ? String(item.id) : null;
        state.reviewAbsenceChecked = false;
        render();
        host.querySelector("[data-review-confirm]")?.focus();
      } else if (action === "cancel-review-absent") {
        const itemId = button.dataset.itemId;
        state.reviewConfirmItemId = null;
        state.reviewAbsenceChecked = false;
        render();
        [...host.querySelectorAll("[data-action='review-absent']")]
          .find(candidate => candidate.dataset.itemId === itemId)?.focus();
      } else if (action === "confirm-review-absent") {
        const item = state.items.find(candidate => String(candidate.id) === button.dataset.itemId);
        void reviewAbsent(item);
      }
      else if (action === "logout") void logout();
    });

    host.addEventListener("toggle", event => {
      if (event.target.matches?.("[data-inviter-details]")) state.inviterDetailsOpen = event.target.open;
    }, true);

    render();
    void refreshStatus({ initial: true });
    return {
      refresh: refreshStatus,
      getStatus: () => ({ available: state.available, authenticated: state.authenticated, itemCount: state.items.length, busy: state.busy }),
    };
  }

  window.BniConnect = Object.freeze({ mount });
})();
