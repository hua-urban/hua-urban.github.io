/* 追綠光 · BNI Connect 測試版。此檔只填使用者已開啟的表單，絕不提交。 */
(() => {
  "use strict";
  const SITE = "__SITE_URL__";
  const SITE_ORIGIN = new URL(SITE).origin;
  const ALLOWED_HOSTS = new Set([
    "www.bniconnectglobal.com", "bniconnectglobal.com", "connect.bniconnectglobal.com"
  ]);
  const TYPES = { ready: "hua-greenlight-test-ready", request: "hua-greenlight-test-request", data: "hua-greenlight-test-data" };
  if (location.protocol !== "https:" || !ALLOWED_HOSTS.has(location.hostname)) {
    alert("請只在 BNI Connect 網頁版開啟這個書籤。此頁未執行填表。");
    return;
  }
  if (window.__huaGreenlightTestPanel) { window.__huaGreenlightTestPanel.show(); return; }

  let drafts = null;
  let tab = "121";
  let popup = null;
  let nonce = "";
  let message = "請先從測試頁讀取草稿，或貼上測試頁複製的 JSON。";
  let busy = false;
  let reviewAuto = false;
  let run = null;
  const attempted = new Set();
  const skipped = new Set();
  const outcomes = new Map();
  const host = document.createElement("div");
  host.id = "hua-greenlight-test-panel";
  host.style.cssText = "position:fixed;z-index:2147483000;right:16px;top:56px;max-width:calc(100vw - 24px)";
  const root = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const string = value => typeof value === "string" ? value.trim() : "";

  function parseDrafts(value) {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    if (!obj || obj.app !== "hua-greenlight-connect-test" || obj.version !== 1 ||
        !string(obj.me) || !Array.isArray(obj.rows121) || !Array.isArray(obj.refs) ||
        obj.rows121.length + obj.refs.length > 100 || !obj.rows121.length && !obj.refs.length) {
      throw new Error("草稿格式不符，請回測試頁重新按「準備帶入」。");
    }
    const rows121 = obj.rows121.map(row => {
      if (!row || !string(row.name) || typeof row.ext !== "boolean" || !/^\d{4}-\d{2}-\d{2}$/.test(string(row.date)) ||
          !string(row.place) || !string(row.topic)) throw new Error("121 草稿欄位不完整。");
      return { name: string(row.name), chapter: string(row.chapter), ext: row.ext === true, date: string(row.date),
        place: string(row.place), topic: string(row.topic) };
    });
    const refs = obj.refs.map(row => {
      if (!row || !string(row.name) || typeof row.ext !== "boolean" || !["內部", "外部"].includes(row.type) || !string(row.content) ||
          !["", "card", "call"].includes(row.contact ?? "")) throw new Error("引薦草稿欄位不完整。");
      return { name: string(row.name), chapter: string(row.chapter), ext: row.ext === true, type: row.type,
        content: string(row.content), details: string(row.details), phone: string(row.phone), contact: row.contact || "" };
    });
    const ownName = string(obj.me).replace(/\s+/g, "");
    if ([...rows121, ...refs].some(row => row.name.replace(/\s+/g, "") === ownName))
      throw new Error("收件會員不能是草稿建立者本人，請修改後重新準備。");
    return { me: string(obj.me), rows121, refs };
  }

  function render() {
    const rows = drafts ? (tab === "121" ? drafts.rows121 : drafts.refs) : [];
    root.innerHTML = `
      <style>
        *{box-sizing:border-box} .box{width:340px;max-height:calc(100vh - 76px);overflow:auto;background:#fff;color:#1c2822;border:2px solid #0b5d3b;border-radius:17px;box-shadow:0 18px 50px #17231c55;font:14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang TC","Microsoft JhengHei",sans-serif}
        .head{background:#0b5d3b;color:#fff;padding:12px 14px;display:flex;gap:10px;align-items:center}.head strong{flex:1;font-size:15px}.head button{background:#fff;color:#0b5d3b;border:0;border-radius:7px;padding:2px 8px;font-size:20px;cursor:pointer}
        .body{padding:14px}.alert{background:#f7f1f3;border-left:4px solid #6b1735;padding:9px 11px;margin:0 0 12px;white-space:pre-line}.lead{font-size:13px;margin:0 0 12px}.line{height:1px;background:#d7e4db;margin:14px 0}
        button{font:inherit;cursor:pointer}.primary{background:#0b5d3b;border:1px solid #0b5d3b;color:white;border-radius:9px;padding:9px 12px;font-weight:700}.secondary{background:white;border:1px solid #0b5d3b;color:#0b5d3b;border-radius:9px;padding:8px 11px;font-weight:700}
        .actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.tabs{display:flex;gap:8px;margin-bottom:10px}.tabs button{flex:1}.tabs .active{background:#6b1735;color:white;border-color:#6b1735}.item{border:1px solid #cadbd0;border-radius:11px;padding:11px;margin:9px 0}.item b{color:#6b1735}.small{font-size:12px;color:#3c5145;margin:5px 0 9px}.fill{width:100%}.review{border:2px solid #6b1735;border-radius:11px;padding:10px;margin:10px 0;background:#f8f1f3}.review ol{padding-left:21px;max-height:150px;overflow:auto}.review li{margin:4px 0}.review button{margin:3px}.pending{color:#6b1735;font-weight:700}
        textarea{display:block;width:100%;height:84px;border:1px solid #526b59;border-radius:9px;padding:8px;margin:7px 0;color:#1c2822;background:white;font:12px/1.4 monospace}textarea::placeholder{color:#4d6255}button:focus-visible,textarea:focus-visible{outline:3px solid #a44364;outline-offset:2px}
      </style>
      <section class="box" aria-label="追綠光 BNI Connect 測試填表面板">
        <div class="head"><strong>追綠光 · 停在提交前</strong><button id="close" type="button" aria-label="關閉面板">×</button></div>
        <div class="body">
          <p class="alert" role="status">${esc(message)}</p>
          <p class="lead">單筆填入：先手動開啟對應表單，最後自行核對與提交。自動批次：先看清單並親自開始；遇到選人不明、提示或表單錯誤會停下。</p>
          <div class="actions"><button class="primary" id="bridge" type="button">從測試頁讀取已準備草稿</button></div>
          <details><summary>小視窗被擋住？貼上 JSON</summary><textarea id="json" aria-label="貼上草稿 JSON" placeholder="貼上測試頁複製的 JSON"></textarea><button class="secondary" id="import" type="button">讀取貼上的草稿</button></details>
          ${drafts ? `<div class="line"></div><p class="small">草稿建立者：<b>${esc(drafts.me)}</b>。請自行核對目前登入的 BNI 帳號。</p>
            ${run ? `<p class="alert">自動批次進行中：${run.index}/${run.total}。${esc(run.current || "")}<br>目前：${esc(run.status)}。可按暫停，會在當筆處理完後停止。</p><button class="secondary" id="pause-auto" type="button">暫停自動批次</button>` : `<button class="secondary" id="review-auto" type="button">檢視並自動送出草稿</button>`}
            ${reviewAuto && !run ? (() => { const remaining = [
              ...drafts.rows121.map((row, i) => ({ kind:"121", i, row })),
              ...drafts.refs.map((row, i) => ({ kind:"ref", i, row }))
            ].filter(item => !attempted.has(`${item.kind}-${item.i}`) && !skipped.has(`${item.kind}-${item.i}`));
              return `<div class="review"><b>確認自動批次範圍：尚有 ${remaining.length} 筆</b><p class="small">小工具會嘗試找唯一會員、填入並按 Connect「提交」。遇到選人或欄位錯誤會停下，該筆留給你手動處理；下次批次略過。未知確認訊息會交給你回答並停止批次。表單關閉但沒有明確成功通知時，僅記「已操作提交，待核對」。</p><ol>${remaining.map(item => `<li>${item.kind === "121" ? "121" : "引薦"} ${item.i + 1}：${esc(item.row.name)}${item.row.chapter ? `（${esc(item.row.chapter)}）` : ""}${item.row.ext ? " · 跨分會" : ""}</li>`).join("")}</ol><button class="primary" id="start-auto" type="button" ${remaining.length ? "" : "disabled"}>確認，開始自動送出</button><button class="secondary" id="cancel-auto" type="button">取消</button></div>`; })() : ""}
            <div class="tabs"><button class="secondary ${tab === "121" ? "active" : ""}" data-tab="121" type="button">121（${drafts.rows121.length}）</button><button class="secondary ${tab === "ref" ? "active" : ""}" data-tab="ref" type="button">引薦（${drafts.refs.length}）</button></div>
            ${rows.length ? rows.map((row, index) => `<div class="item"><b>${index + 1}. ${esc(row.name)}</b>${row.chapter ? ` · ${esc(row.chapter)}` : ""}<p class="small">${tab === "121" ? `${esc(row.date)} · ${esc(row.place)} · ${esc(row.topic)}` : `${esc(row.type)} · ${esc(row.content)}${row.phone ? ` · ${esc(row.phone)}` : ""}`}${tab === "ref" && row.details ? `<br>其他說明（手動補）：${esc(row.details)}` : ""}</p>${outcomes.has(`${tab}-${index}`) ? `<p class="small pending">${esc(outcomes.get(`${tab}-${index}`))}</p>` : ""}<button class="primary fill" data-fill="${index}" type="button" ${busy || run ? "disabled" : ""}>填入，停在提交前</button></div>`).join("") : `<p class="small">這一類尚無草稿。</p>`}` : ""}
        </div>
      </section>`;
  }

  // 僅接受使用者已打開、且欄位特徵吻合的 BNI 對話框。
  function currentForm(kind) {
    const dialogs = [...document.querySelectorAll(".MuiDialog-root")].filter(dialog => dialog.getClientRects().length);
    const matches = dialogs.filter(dialog => kind === "121"
      ? !!dialog.querySelector('input[name="location"]') && !!dialog.querySelector('textarea[name="comments"]')
      : !!dialog.querySelector('input[name="referralPersonName"]'));
    return matches.length === 1 ? matches[0] : null;
  }
  function setText(dialog, selector, value, label, missing) {
    const input = dialog.querySelector(selector);
    if (!input) { missing.push(label); return; }
    const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) { missing.push(label); return; }
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    if (input.value !== value) missing.push(label);
  }
  function setCheck(dialog, selector, desired, label, missing) {
    const input = dialog.querySelector(selector);
    if (!input) { missing.push(label); return; }
    if (input.checked !== desired) input.click();
    if (input.checked !== desired) missing.push(label);
  }
  function fillForm(kind, row) {
    const dialog = currentForm(kind);
    if (!dialog) {
      message = `找不到唯一且已開啟的${kind === "121" ? "一對一會面" : "提供引薦"}表單。請在 BNI Connect 手動開啟後再按填入。`;
      render(); return;
    }
    const missing = [];
    if (kind === "121") {
      setText(dialog, 'input[name="location"]', row.place, "地點", missing);
      setText(dialog, 'textarea[name="comments"]', row.topic, "會談主題", missing);
      const [year, month, day] = row.date.split("-");
      setText(dialog, 'input[placeholder="DD/MM/YYYY"]', `${day}/${month}/${year}`, "日期", missing);
    } else {
      setText(dialog, 'input[name="referralPersonName"]', row.content, "引薦內容", missing);
      const radio = dialog.querySelector(`input[name="referralType"][value="${row.type === "內部" ? "INSIDE" : "OUTSIDE"}"]`);
      if (!radio) missing.push("引薦類型");
      else { if (!radio.checked) radio.click(); if (!radio.checked) missing.push("引薦類型"); }
      if (row.phone) setText(dialog, 'input[name="phoneNumber"]', row.phone, "電話", missing);
      if (row.contact) {
        setCheck(dialog, 'input[name="cardGiven"]', row.contact === "card", "名片選項", missing);
        setCheck(dialog, 'input[name="callRequired"]', row.contact === "call", "致電選項", missing);
      }
    }
    message = `${missing.length ? `部分欄位未能確認：${missing.join("、")}。請手動補上。\n` : "已填入可辨識欄位。\n"}請自行選擇${kind === "121" ? "會面對象與邀請人" : "接收引薦會員"}，核對每一欄；只有你能在 BNI Connect 手動按提交。此工具不追蹤送出狀態。`;
    render();
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const COMPOUND = ["張簡", "歐陽", "司馬", "諸葛", "上官", "東方", "皇甫", "范姜", "司徒", "夏侯"];
  function chineseName(value) {
    const match = string(value).replace(/\s+/g, "").match(/^[\u4e00-\u9fff]+/);
    return match ? match[0] : "";
  }
  function sameNameExact(option, wanted) {
    const left = chineseName(option), right = chineseName(wanted);
    if (left && right) return left === right;
    const normalized = value => string(value).replace(/\s+/g, " ").toLowerCase();
    return !!normalized(option) && normalized(option) === normalized(wanted);
  }
  function chapterKey(value) { return string(value).replace(/\s+|分會/g, "").toLowerCase(); }
  function visibleOptions() {
    return [...document.querySelectorAll('[role="listbox"] [role="option"]')].filter(el => el.getClientRects().length);
  }
  async function pickUnique(combo, wanted, inviter = false) {
    if (!combo) return null;
    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles:true }));
    await sleep(420);
    const hits = visibleOptions().filter(option => inviter
      ? option.getAttribute("data-value") === "-2" || sameNameExact(option.innerText, wanted)
      : sameNameExact(option.innerText, wanted));
    if (hits.length !== 1) {
      combo.dispatchEvent(new KeyboardEvent("keydown", { key:"Escape", bubbles:true }));
      return null;
    }
    const label = hits[0].innerText.trim();
    hits[0].click();
    await sleep(350);
    return label;
  }
  function guardedConfirm(action, routineSelection = false) {
    const original = window.confirm;
    const state = { duplicate:false, unknown:"" };
    window.confirm = function (prompt) {
      const text = string(prompt);
      if (/已被記錄|已有另一個|already recorded/i.test(text)) { state.duplicate = true; return false; }
      if (routineSelection && /^您確定嗎[？?]?$/.test(text)) return true;
      state.unknown = text || "未命名確認訊息";
      return original.call(window, prompt);
    };
    try { action(); }
    catch (error) { window.confirm = original; throw error; }
    return { state, restore() { if (window.confirm !== original) window.confirm = original; } };
  }
  function splitChineseName(full) {
    const name = chineseName(full);
    if (!name) return null;
    const familyLength = COMPOUND.some(part => name.startsWith(part)) ? 2 : 1;
    return { family:name.slice(0, familyLength), given:name.slice(familyLength) };
  }
  function searchDialog(main) {
    return [...document.querySelectorAll(".MuiDialog-root")].find(el => el !== main &&
      /跨分會查找|搜尋分會/.test(el.innerText) &&
      [...el.querySelectorAll("button")].some(button => /^(查找|搜尋)$/.test(button.innerText.trim()))) || null;
  }
  async function selectExternal(dialog, row) {
    if (!row.chapter) return "跨分會紀錄必須填分會，才能核對唯一會員";
    const name = splitChineseName(row.name);
    if (!name) return "跨分會姓名無法拆分，請手動選人";
    const buttons = [...dialog.querySelectorAll("button")].filter(button => /搜尋分會|跨分會查找/.test(button.innerText));
    if (buttons.length !== 1) return "找不到唯一的跨分會搜尋按鈕";
    buttons[0].click();
    let search = null;
    for (let i = 0; i < 15 && !search; i++) { await sleep(200); search = searchDialog(dialog); }
    if (!search) return "跨分會搜尋視窗未開啟";
    const inputs = search.querySelectorAll('input[type="text"]');
    if (inputs.length < 2) return "跨分會搜尋欄位已改版";
    // BNI Connect 現有搜尋欄位標示順序與資料順序相反；沿用原腳本的已知對應。
    const set = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.dispatchEvent(new Event("change", { bubbles:true }));
    };
    set(inputs[0], name.family); set(inputs[1], name.given);
    const searchButton = [...search.querySelectorAll("button")].find(button => /^(查找|搜尋)$/.test(button.innerText.trim()));
    if (!searchButton) return "跨分會搜尋按鈕已改版";
    searchButton.click();
    let rows = [];
    for (let i = 0; i < 25; i++) {
      await sleep(250);
      rows = [...search.querySelectorAll('tr, [role="row"]')].filter(el => el.querySelector('input[type="checkbox"]') && !/名稱/.test(el.innerText));
      if (rows.length) break;
    }
    const chapter = chapterKey(row.chapter);
    const matches = rows.filter(el => sameNameExact(el.innerText.trim().split(/\t|\n/)[0], row.name) &&
      chapterKey(el.innerText).includes(chapter));
    if (matches.length !== 1) return `跨分會搜尋符合 ${matches.length} 位，請手動核對並選人`;
    const checkbox = matches[0].querySelector('input[type="checkbox"]');
    const guard = guardedConfirm(() => checkbox.click(), true);
    await sleep(1200); guard.restore();
    if (guard.state.duplicate) return "Connect 顯示已有紀錄，已取消並停止";
    if (guard.state.unknown) return `Connect 顯示新的確認訊息（${guard.state.unknown}），已停止`;
    for (let i = 0; i < 15 && searchDialog(dialog); i++) await sleep(200);
    if (!dialog.innerText.split("\n").some(line => sameNameExact(line, row.name))) return "選人後無法在表單核對姓名";
    return "";
  }
  async function selectRecipient(dialog, kind, row) {
    if (row.ext) {
      const error = await selectExternal(dialog, row);
      if (error) return error;
    } else {
      const combo = dialog.querySelector('[role="combobox"]');
      const label = await pickUnique(combo, row.name);
      if (!label || !sameNameExact(combo.innerText, row.name)) return "收件會員找不到唯一且可核對的姓名，請手動選人";
    }
    if (kind === "121") {
      const inviter = dialog.querySelectorAll('[role="combobox"]')[1];
      const selected = await pickUnique(inviter, drafts.me, true);
      if (!selected || /選擇/.test(inviter.innerText) ||
          !(sameNameExact(selected, drafts.me) || /自己|本人|self/i.test(selected))) {
        return "121 邀請人無法核對為本人，請手動選人";
      }
    }
    return "";
  }
  function fillFields(kind, dialog, row) {
    const missing = [];
    if (kind === "121") {
      setText(dialog, 'input[name="location"]', row.place, "地點", missing);
      setText(dialog, 'textarea[name="comments"]', row.topic, "會談主題", missing);
      const [year, month, day] = row.date.split("-");
      setText(dialog, 'input[placeholder="DD/MM/YYYY"]', `${day}/${month}/${year}`, "日期", missing);
    } else {
      setText(dialog, 'input[name="referralPersonName"]', row.content, "被引薦人姓名", missing);
      const radio = dialog.querySelector(`input[name="referralType"][value="${row.type === "內部" ? "INSIDE" : "OUTSIDE"}"]`);
      if (!radio) missing.push("引薦類型");
      else { if (!radio.checked) radio.click(); if (!radio.checked) missing.push("引薦類型"); }
      if (row.phone) setText(dialog, 'input[name="phoneNumber"]', row.phone, "電話", missing);
      if (row.contact) {
        setCheck(dialog, 'input[name="cardGiven"]', row.contact === "card", "名片選項", missing);
        setCheck(dialog, 'input[name="callRequired"]', row.contact === "call", "致電選項", missing);
      }
    }
    return missing;
  }
  function verifyFields(kind, dialog, row) {
    const value = selector => dialog.querySelector(selector)?.value;
    if (kind === "121") {
      const [year, month, day] = row.date.split("-");
      return value('input[name="location"]') === row.place &&
        value('textarea[name="comments"]') === row.topic &&
        value('input[placeholder="DD/MM/YYYY"]') === `${day}/${month}/${year}`;
    }
    return value('input[name="referralPersonName"]') === row.content &&
      (!row.phone || value('input[name="phoneNumber"]') === row.phone) &&
      dialog.querySelector('input[name="referralType"]:checked')?.value === (row.type === "內部" ? "INSIDE" : "OUTSIDE") &&
      (!row.contact || (!!dialog.querySelector('input[name="cardGiven"]')?.checked === (row.contact === "card") &&
        !!dialog.querySelector('input[name="callRequired"]')?.checked === (row.contact === "call")));
  }
  function dashboardOpener(kind) {
    const label = kind === "121" ? "一對一會面" : "提供引薦";
    const other = kind === "121" ? "提供引薦" : "一對一會面";
    const candidates = [...document.querySelectorAll("button")].filter(button => {
      if (button.innerText.trim() !== "提交" || button.closest(".MuiDialog-root") || host.contains(button)) return false;
      let ancestor = button.parentElement;
      for (let depth = 0; ancestor && depth < 6; depth++, ancestor = ancestor.parentElement) {
        const text = ancestor.innerText || "";
        if (text.includes(label) && !text.includes(other)) return true;
      }
      return false;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }
  async function formForAuto(kind) {
    const existing = currentForm(kind);
    if (existing) return existing;
    if ([...document.querySelectorAll(".MuiDialog-root")].some(el => el.getClientRects().length)) return null;
    const opener = dashboardOpener(kind);
    if (!opener) return null;
    opener.click();
    for (let i = 0; i < 20; i++) { await sleep(200); const dialog = currentForm(kind); if (dialog) return dialog; }
    return null;
  }
  function alertTexts() {
    return [...document.querySelectorAll('[role="alert"],.MuiAlert-root,.MuiSnackbar-root,.Toastify__toast')]
      .map(el => string(el.innerText)).filter(Boolean);
  }
  async function runAuto() {
    const list = [
      ...drafts.rows121.map((row, index) => ({ kind:"121", index, row })),
      ...drafts.refs.map((row, index) => ({ kind:"ref", index, row }))
    ].filter(item => !attempted.has(`${item.kind}-${item.index}`) && !skipped.has(`${item.kind}-${item.index}`));
    if (!list.length) { message = "本次已操作過所有草稿。請先在 BNI Connect 核對紀錄，避免重複送出。"; render(); return; }
    run = { total:list.length, index:0, current:"", status:"準備中", pause:false, success:0, pending:0 };
    reviewAuto = false; render();
    let stopReason = "";
    for (const item of list) {
      if (run.pause) { stopReason = "使用者已暫停"; break; }
      run.index++; run.current = `${item.kind === "121" ? "121" : "引薦"}：${item.row.name}`; run.status = "尋找表單"; render();
      const dialog = await formForAuto(item.kind);
      if (!dialog) { stopReason = "找不到唯一的表單或首頁開啟按鈕；請手動開啟對應表單"; break; }
      run.status = "選擇並核對會員"; render();
      const selectionError = await selectRecipient(dialog, item.kind, item.row);
      if (selectionError) {
        skipped.add(`${item.kind}-${item.index}`);
        outcomes.set(`${item.kind}-${item.index}`, `需手動處理：${selectionError}。下次自動批次會略過此筆。`);
        stopReason = selectionError; break;
      }
      const missing = fillFields(item.kind, dialog, item.row);
      await sleep(350);
      if (missing.length || !verifyFields(item.kind, dialog, item.row)) {
        skipped.add(`${item.kind}-${item.index}`);
        outcomes.set(`${item.kind}-${item.index}`, "欄位未能核對，需手動處理；下次自動批次會略過此筆。");
        stopReason = `欄位未能核對：${missing.join("、") || "填入值不符"}。表單保持開啟，請手動處理`;
        break;
      }
      // 明確只點目前對話框內唯一一顆「提交」；未知確認交還使用者並中止後續批次。
      const submitButtons = [...dialog.querySelectorAll("button")].filter(button => button.innerText.trim() === "提交");
      if (submitButtons.length !== 1) { stopReason = "找不到唯一的提交按鈕，表單保持開啟"; break; }
      const beforeAlerts = new Set(alertTexts());
      run.status = "已按提交，等待 Connect 回應"; render();
      const guard = guardedConfirm(() => submitButtons[0].click());
      attempted.add(`${item.kind}-${item.index}`);
      outcomes.set(`${item.kind}-${item.index}`, "已按提交，結果待核對；本次不會重試此筆。");
      run.pending++;
      let closed = false;
      try {
        for (let i = 0; i < 40; i++) {
          await sleep(250);
          if (guard.state.duplicate || guard.state.unknown) break;
          if (!dialog.isConnected || !currentForm(item.kind)) { closed = true; break; }
        }
      } finally {
        guard.restore();
      }
      if (guard.state.duplicate) {
        run.pending--;
        outcomes.set(`${item.kind}-${item.index}`, "Connect 提示已有紀錄，已取消；請到 Connect 核對。");
        stopReason = "Connect 提示已有紀錄；已取消此筆並停止批次"; break;
      }
      if (guard.state.unknown) { stopReason = `Connect 顯示未預設的確認訊息（${guard.state.unknown}）；已交由你回答並停止後續批次`; break; }
      if (!closed) { stopReason = "按提交後表單未關閉，可能有欄位錯誤；請檢查目前表單"; break; }
      const newAlerts = alertTexts().filter(text => !beforeAlerts.has(text));
      if (newAlerts.some(text => !/(?:未|不).{0,8}成功|失敗|錯誤|error|not submitted|unsuccessful|failed/i.test(text) &&
          /成功|successfully|submitted/i.test(text))) {
        run.success++; run.pending--;
        outcomes.set(`${item.kind}-${item.index}`, "Connect 明確顯示成功；請到紀錄核對。");
      }
      run.status = "已操作提交，等待核對"; render();
      await sleep(650);
      if ([...document.querySelectorAll(".MuiDialog-root")].some(el => el.getClientRects().length)) { stopReason = "Connect 顯示額外視窗，已停止批次"; break; }
    }
    const completed = run.success, pending = run.pending;
    run = null;
    message = `${stopReason ? `已停止：${stopReason}。\n` : "批次已跑完。\n"}Connect 明確顯示成功 ${completed} 筆；另有 ${pending} 筆已操作提交、待到 Connect 紀錄核對。請勿在核對前重跑。`;
    render();
  }

  root.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "close") { host.hidden = true; return; }
    if (target.dataset.tab) { tab = target.dataset.tab; render(); return; }
    if (target.id === "review-auto" && drafts && !run) { reviewAuto = true; render(); return; }
    if (target.id === "cancel-auto") { reviewAuto = false; render(); return; }
    if (target.id === "pause-auto" && run) { run.pause = true; run.status = "將在當筆處理完後暫停"; render(); return; }
    if (target.id === "start-auto" && reviewAuto && drafts && !run) {
      runAuto().catch(error => {
        run = null;
        message = `自動批次因錯誤停止：${error?.message || "未知錯誤"}。請檢查目前表單與 Connect 紀錄。`;
        render();
      });
      return;
    }
    if (target.id === "bridge") {
      nonce = crypto.randomUUID();
      popup = window.open(new URL(`bridge.html?nonce=${encodeURIComponent(nonce)}`, SITE).href,
        "hua-greenlight-test-bridge", "width=460,height=300");
      message = popup ? "正在讀取測試頁已準備的草稿…" : "小視窗被擋住。請到測試頁複製 JSON，貼在下方。";
      render(); return;
    }
    if (target.id === "import") {
      try {
        const value = root.getElementById("json").value;
        if (value.length > 200000) throw new Error("草稿過大。");
        drafts = parseDrafts(value);
        message = `已讀取 ${drafts.rows121.length} 筆 121、${drafts.refs.length} 筆引薦草稿。尚未填入或送出。`;
      } catch (error) { message = error.message || "JSON 無法讀取。"; }
      render(); return;
    }
    if (target.dataset.fill !== undefined && drafts && !busy) {
      const index = Number(target.dataset.fill);
      const row = (tab === "121" ? drafts.rows121 : drafts.refs)[index];
      if (!row) return;
      busy = true;
      try { fillForm(tab, row); }
      catch { message = "填入時遇到未預期的表單變化，請自行核對並手動補上。"; render(); }
      finally { busy = false; }
    }
  });

  window.addEventListener("message", event => {
    if (!popup || event.source !== popup || event.origin !== SITE_ORIGIN || event.data?.nonce !== nonce) return;
    if (event.data.type === TYPES.ready) {
      popup.postMessage({ type: TYPES.request, nonce }, SITE_ORIGIN);
    } else if (event.data.type === TYPES.data) {
      try {
        drafts = parseDrafts(event.data.drafts);
        message = `已讀取 ${drafts.rows121.length} 筆 121、${drafts.refs.length} 筆引薦草稿。尚未填入或送出。`;
      } catch (error) { message = error.message || "測試頁還沒有已準備的草稿。"; }
      popup = null; nonce = ""; render();
    }
  });
  window.__huaGreenlightTestPanel = { show() { host.hidden = false; render(); } };
  render();
})();
