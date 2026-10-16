/* 追綠光 · 一鍵帶入 BNI Connect
 *
 * 由書籤載入，在 BNI Connect 網頁版右側開一個小面板：
 *   1. 打開時自動開一個小視窗到追綠光網站（bridge.html），拿回這個瀏覽器在完成頁存下的最新 key 單資料；
 *      讀不到時才用「複製 key 單資料」貼上
 *   2. 夥伴自己打開「一對一」或「引薦單」表單，按面板上某一筆的「填入」
 *   3. 一筆一筆「填入」時，檢查與按「提交」由夥伴自己來
 *   4. 也可以勾選多筆按「自動 key」：每筆填好後讀回檢查，全部對得上才按「提交」，
 *      對不上、表單沒關、跳出提示都會立刻停下來；外分會夥伴要從搜尋結果點人，一律跳過
 *
 * 不碰帳號密碼。資料只存在這台電腦這個瀏覽器（localStorage）。
 */
(() => {
  if (location.protocol !== "https:" || !["www.bniconnectglobal.com", "bniconnectglobal.com"].includes(location.hostname)) {
    alert("請先登入 BNI Connect 網頁版，再點這個書籤。");
    return;
  }
  const KEY = "hua-urban-greenlight-bni-keyin-v1";
  const SITE = window.__huaGreenlightSite || new URL("./", document.currentScript.src).href;
  if (window.__huaGreenlight) { window.__huaGreenlight.toggle(); return; }

  // ── 資料 ───────────────────────────────────────────────
  let data = null;   // { me, rows121: [...], refs: [...], done: { "121-0": true, ... } }
  try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (data) data.pending ||= {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };

  // 新資料取代舊資料時，已完成（含 BNI 已有紀錄）的勾勾照內容對回去，不會重複 key
  const sig = (kind, r) => kind + "|" + (kind === "121"
    ? [r.name, r.chapter, r.date, r.place, r.topic] : [r.name, r.chapter, r.type, r.referredName, r.content, r.phone]).join("|");
  function merge(next) {
    if (!data) return next;
    const keep = {};
    for (const kind of ["121", "ref"]) (kind === "121" ? data.rows121 : data.refs).forEach((r, i) => {
      const k = `${kind}-${i}`;
      if (data.done[k] || data.pending?.[k]) keep[sig(kind, r)] = { done: !!data.done[k], pending: !!data.pending?.[k], dupe: !!data.dupe?.[k], note: data.note?.[k] };
    });
    next.dupe = {}; next.note = {}; next.pending = {};
    for (const kind of ["121", "ref"]) (kind === "121" ? next.rows121 : next.refs).forEach((r, i) => {
      const old = keep[sig(kind, r)], k = `${kind}-${i}`;
      if (!old) return;
      if (old.done) next.done[k] = true;
      if (old.pending) next.pending[k] = true;
      if (old.dupe) next.dupe[k] = true;
      if (old.note) next.note[k] = old.note;
    });
    return next;
  }
  const parse = txt => {
    const d = JSON.parse(txt);
    if (!d || d.app !== "hua-urban-greenlight" || !Array.isArray(d.rows121) || !Array.isArray(d.refs)) throw new Error("格式不對");
    if (d.refs.some(r => !String(r.referredName || "").trim() || !String(r.content || "").trim())) throw new Error("引薦缺少被引薦人姓名或內容");
    return { me: d.me, rows121: d.rows121, refs: d.refs, done: {}, pending: {} };
  };

  // ── 姓名比對：BNI 選單是「丁 乃玉 Margaret Ding」，我們是「丁乃玉 Margrett」 ──
  // 只看名字的前三個中文字（複姓四個字），後面的英文名、中文小名都不管：
  //   「陳力羣 娃娃」「陳 力羣 Lily」→ 陳力羣；「張簡筱凡Sarah」→ 張簡筱凡；「王瑀Eva」→ 王瑀
  const COMPOUND = ["張簡", "歐陽", "司馬", "諸葛", "上官", "東方", "皇甫", "范姜", "司徒", "夏侯"];
  const zhName = s => {
    const m = String(s || "").replace(/\s+/g, "").match(/^[\u4e00-\u9fa5]+/);
    if (!m) return "";
    return m[0].slice(0, COMPOUND.some(c => m[0].startsWith(c)) ? 4 : 3);
  };
  const nameKey = s => zhName(s) || String(s || "").replace(/\s+/g, "").toLowerCase();
  const sameName = (a, b) => {
    if (nameKey(a) === nameKey(b)) return true;
    // 外籍會員可能姓名顛倒（Josh Hung ↔ Hung Josh）
    const w = s => String(s || "").toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");
    return !!w(a) && w(a) === w(b);
  };

  // ── 操作 React（MUI）表單 ─────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dialog = () => [...document.querySelectorAll(".MuiDialog-root")].pop() || null;
  const dialogKind = d => {
    const t = d ? d.innerText : "";
    return t.includes("一對一") ? "121" : t.includes("引薦單") ? "ref" : null;
  };
  function setText(el, v) {
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }
  async function pickOption(combo, match) {
    if (!combo) return null;
    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await sleep(400);
    const opts = [...document.querySelectorAll('[role="listbox"] [role="option"]')];
    const hits = opts.filter(o => match(o.innerText.trim(), o.getAttribute("data-value")));
    const hit = hits.length === 1 ? hits[0] : null;
    if (hit) hit.click();
    else document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(300);
    return hit ? hit.innerText.trim() : null;
  }
  function setCheck(el, want) { if (el && el.checked !== want) el.click(); }
  // 外分會：打開「搜尋分會／跨分會查找」，姓填進「名字」欄、名填進「姓氏」欄（BNI 這兩欄是反的）
  function splitName(full) {
    const zh = zhName(full);
    if (!zh) return null;
    const n = COMPOUND.some(c => zh.startsWith(c)) ? 2 : 1;
    return { family: zh.slice(0, n), given: zh.slice(n) };
  }
  // BNI 在勾選搜尋結果、關閉表單時會跳出瀏覽器的「您確定嗎？」；自動流程裡暫時代答「確定」
  // 「系統中已有另一個一對一會員符合，此一對一會面已被記錄，您想要繼續嗎？」→ 一律回答取消，不重複送
  const isDup = m => /已被記錄|已有另一個|already/i.test(String(m || ""));
  async function withConfirm(fn, seen) {
    const orig = window.confirm;
    window.confirm = m => { if (seen) seen.push(String(m || "")); return !isDup(m); };
    try { fn(); await sleep(1200); } finally { window.confirm = orig; }
  }
  // 搜尋視窗：主表單以外、有「查找／搜尋」按鈕的那個
  //   引薦單 → 標題「跨分會查找」、按鈕「查找」；一對一 → 標題「搜尋分會」、按鈕「搜尋」
  //   （主表單本身也有一顆「跨分會查找／搜尋分會」按鈕，不能只看文字）
  const SEARCH_BTN = /^(查找|搜尋)$/;
  const searchDialog = main => [...document.querySelectorAll(".MuiDialog-root")].find(x => x !== main && /跨分會查找|搜尋分會/.test(x.innerText)
    && [...x.querySelectorAll("button")].some(b => SEARCH_BTN.test(b.innerText.trim()))) || null;
  const chapterKey = s => String(s || "").replace(/\s+|分會/g, "").replace(/[A-Za-z].*$/, "");

  // 外分會：跨分會查找 → 只有一位「名字＋分會」都對得上的才自動勾選；回傳 null 代表成功，否則是原因
  async function selectExt(d, r) {
    const btn = [...d.querySelectorAll("button")].find(b => /搜尋分會|跨分會查找/.test(b.innerText));
    const nm = splitName(r.name);
    if (!r.chapter) return `「${r.name}」缺少分會，請手動確認身分後再填入`;
    if (!btn || !nm) return `找不到搜尋按鈕，請手動找「${r.name}」${r.chapter ? `（${r.chapter}）` : ""}`;
    btn.click();
    let s = null;
    for (let i = 0; i < 15 && !s; i++) { await sleep(200); s = searchDialog(d); }
    if (!s) return `打不開「${btn.innerText.trim()}」，請手動找「${r.name}」${r.chapter ? `（${r.chapter}）` : ""}`;
    const inputs = s.querySelectorAll('input[type="text"]');
    setText(inputs[0], nm.family);   // 標示「名字」的欄位其實要填姓
    setText(inputs[1], nm.given);    // 標示「姓氏」的欄位其實要填名
    await sleep(200);
    [...s.querySelectorAll("button")].find(b => SEARCH_BTN.test(b.innerText.trim()))?.click();
    let rows = [];
    for (let i = 0; i < 25; i++) {
      await sleep(250);
      rows = [...s.querySelectorAll('tr, [role="row"]')].filter(x => x.querySelector('input[type="checkbox"]') && !/名稱/.test(x.innerText));
      if (rows.length) break;
    }
    const ck = chapterKey(r.chapter);
    const hits = rows.filter(x => sameName(x.innerText.trim().split(/\t|\n/)[0], r.name) && (!ck || x.innerText.includes(ck)));
    if (hits.length !== 1) {
      return `搜尋「${r.name}」${r.chapter ? `（${r.chapter}）` : ""}找到 ${hits.length} 位符合的，請在搜尋結果裡自己點選`;
    }
    await withConfirm(() => hits[0].querySelector('input[type="checkbox"]').click());
    for (let i = 0; i < 15 && searchDialog(d); i++) await sleep(200);
    return pickedName(d, r.name) ? null : `已勾選「${r.name}」，但表單上看不到，請檢查「至／會面」欄`;
  }
  // 選好外分會夥伴後，表單會在下拉選單上方顯示他的名字（「劉 政良Cheng-Liang Liu」）
  const pickedName = (d, name) => d.innerText.split("\n").some(l => sameName(l.trim(), name));

  // 關掉表單（BNI 會問「您確定嗎？」）
  async function closeForm(d) {
    const s = searchDialog(d);
    if (s) { [...s.querySelectorAll("button")].find(b => b.innerText.trim() === "返回")?.click(); await sleep(500); }
    const b = [...d.querySelectorAll("button")].find(x => x.innerText.trim() === "關閉");
    if (b) await withConfirm(() => b.click());
  }

  const ddmmyyyy = s => { const [y, m, d] = s.split("/"); return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`; };

  async function fill121(d, r) {
    const notes = [];
    const combos = d.querySelectorAll('[role="combobox"]');
    if (r.ext) { const why = await selectExt(d, r); if (why) notes.push(why); }
    else if (!r._skipPick && !await pickOption(combos[0], t => sameName(t, r.name))) notes.push(`選單裡找不到「${r.name}」，請手動選`);
    // 邀請人只有自己（value -2）
    if (!await pickOption(combos[1], (t, v) => v === "-2" || sameName(t, data.me))) notes.push("請手動選邀請人");
    setText(d.querySelector('input[name="location"]'), r.place);
    setText(d.querySelector('textarea[name="comments"]'), r.topic);
    const date = d.querySelector('input[placeholder="DD/MM/YYYY"]');
    setText(date, ddmmyyyy(r.date));
    if (date && date.value !== ddmmyyyy(r.date)) notes.push(`請手動把日期改成 ${r.date}`);
    return notes;
  }

  async function fillRef(d, r) {
    const notes = [];
    const combo = d.querySelector('[role="combobox"]');
    if (r.ext) { const why = await selectExt(d, r); if (why) notes.push(why); }
    else if (!r._skipPick && !await pickOption(combo, t => sameName(t, r.name))) notes.push(`選單裡找不到「${r.name}」，請手動選`);
    setText(d.querySelector('input[name="referralPersonName"]'), r.referredName);
    const description = refDescriptionField(d);
    if (description) setText(description, r.content);
    else notes.push("找不到 BNI 引薦內容欄位，請手動填入；這筆不會自動送出");
    const radio = d.querySelector(`input[name="referralType"][value="${r.type === "內部" ? "INSIDE" : "OUTSIDE"}"]`);
    if (radio && !radio.checked) radio.click();
    setCheck(d.querySelector('input[name="cardGiven"]'), ["card", "both"].includes(r.contact));
    setCheck(d.querySelector('input[name="callRequired"]'), ["call", "both"].includes(r.contact));
    setText(d.querySelector('input[name="phoneNumber"]'), r.phone);
    return notes;
  }

  // ── 自動 key：填好後讀回每一欄，對得上才按「提交」 ─────────────────
  const refDescriptionField = d => d.querySelector('textarea[name="referralDescription"], input[name="referralDescription"], textarea[name="comments"], input[name="comments"]');
  function verify(kind, d, r) {
    const bad = [];
    const val = sel => d.querySelector(sel)?.value ?? "";
    if (kind === "121") {
      const c = d.querySelectorAll('[role="combobox"]');
      if (r.ext ? !pickedName(d, r.name) : !sameName(c[0]?.innerText, r.name)) bad.push("會面對象");
      if (/選擇/.test(c[1]?.innerText || "選擇")) bad.push("邀請人");
      if (val('input[name="location"]') !== r.place) bad.push("地點");
      if (val('textarea[name="comments"]') !== r.topic) bad.push("會談主題");
      if (val('input[placeholder="DD/MM/YYYY"]') !== ddmmyyyy(r.date)) bad.push("日期");
    } else {
      if (r.ext ? !pickedName(d, r.name) : !sameName(d.querySelector('[role="combobox"]')?.innerText, r.name)) bad.push("引薦對象");
      if (val('input[name="referralPersonName"]') !== r.referredName) bad.push("被引薦人姓名");
      const description = refDescriptionField(d);
      if (!description || description.value !== r.content) bad.push("引薦內容");
      if (d.querySelector('input[name="referralType"]:checked')?.value !== (r.type === "內部" ? "INSIDE" : "OUTSIDE")) bad.push("引薦類型");
      if (!!d.querySelector('input[name="cardGiven"]')?.checked !== (["card", "both"].includes(r.contact))
          || !!d.querySelector('input[name="callRequired"]')?.checked !== (["call", "both"].includes(r.contact))) bad.push("引薦狀態");
      if (val('input[name="phoneNumber"]') !== r.phone) bad.push("電話");
    }
    return bad;
  }
  const openForm_ = kind => [...document.querySelectorAll(".MuiDialog-root")].reverse().find(x => dialogKind(x) === kind) || null;

  // 用「填入」之後，夥伴自己按「提交」或「提交並新建」：送出成功就自動標記已完成
  //   提交 → 表單關閉；提交並新建 → 表單清空（會面／至 變回「選擇…」）
  // BNI 已經有紀錄的：標為完成，另外記一筆「已有紀錄」給上方總覽統計
  function markDup(k) {
    data.done[k] = true; sel.delete(k);
    if (data.pending) delete data.pending[k];
    data.dupe = data.dupe || {}; data.dupe[k] = true;
    data.note = data.note || {}; data.note[k] = "BNI 已經有這筆紀錄，已自動取消（沒有重複送）";
    save();
  }

  // 同一時間只監看一筆：按下一筆「填入」時，取消上一筆的監看，避免把下一筆的送出算到上一筆
  let watching = null;
  const alertNodes = () => [...document.querySelectorAll('[role="alert"], [role="status"], .MuiSnackbar-root, .MuiAlert-root')];
  const alertSnapshot = () => new Map(alertNodes().map(n => [n, n.innerText || ""]));
  const successSignal = before => alertNodes().some(n => /提交成功|成功送出|新增成功|已送出|submitted|success/i.test(n.innerText || "")
    && (!before.has(n) || before.get(n) !== n.innerText));
  function stopWatch() {
    if (!watching) return;
    watching.d.removeEventListener("click", watching.onClick, true);
    watching.cancelled = true; watching = null;
  }
  function watchSubmit(d, kind, k, label) {
    stopWatch();
    const me = { d, cancelled: false };
    const onClick = async e => {
      const b = e.target.closest("button");
      const txt = b ? b.innerText.trim() : "";
      if (txt === "關閉") { d.removeEventListener("click", onClick, true); return; }
      if (txt !== "提交" && txt !== "提交並新建") return;
      d.removeEventListener("click", onClick, true);
      const before = alertSnapshot();
      data.pending ||= {}; data.pending[k] = true;
      data.note ||= {}; data.note[k] = "送出結果待確認；先到 BNI Connect 核對紀錄";
      sel.delete(k); save(); render();
      // BNI 若問「已被記錄，要繼續嗎？」：自動回答取消（不重複送），其他問題照常讓夥伴自己回答
      const orig = window.confirm;
      let dup = null;
      window.confirm = m => { if (isDup(m)) { dup = false; return false; } return orig.call(window, m); };
      setTimeout(() => { if (window.confirm !== orig) window.confirm = orig; }, 15000);
      for (let w = 0; w < 40; w++) {
        await sleep(250);
        if (me.cancelled) { window.confirm = orig; return; }
        if (dup === false) {
          window.confirm = orig;
          markDup(k);
          await closeForm(d);
          msg = `✓ 「${esc(label)}」BNI 已經有紀錄，已自動取消、標為完成。`;
          render(); return;
        }
        const gone = !d.isConnected || !openForm_(kind);
        const reset = txt === "提交並新建" && /選擇/.test(d.querySelector('[role="combobox"]')?.innerText || "");
        if (gone || reset) {
          window.confirm = orig;
          if (successSignal(before)) {
            data.done[k] = true; delete data.pending[k]; delete data.note[k];
            msg = `✓ 「${esc(label)}」已確認送出，標記為已完成。`;
          } else {
            msg = `⚠️ 「${esc(label)}」表單已關閉，但沒有讀到明確成功訊息，保留待確認，避免重複送出。`;
          }
          save();
          render(); return;
        }
      }
      window.confirm = orig;
      msg = `⚠️ 「${esc(label)}」送出結果待確認。請在 BNI Connect 核對後處理這筆。`;
      render();
    };
    me.onClick = onClick;
    watching = me;
    d.addEventListener("click", onClick, true);
  }

  async function runBatch(kind, keys) {
    stopWatch();
    const list = kind === "121" ? data.rows121 : data.refs;
    data.note = data.note || {};
    run = { kind, n: keys.length, i: 0, cur: "", paused: false };
    let ok = 0, skipped = 0, dupN = 0, stop = "";
    render();
    for (const k of keys) {
      if (run.paused) { stop = "已暫停。勾選的還沒送的會留著，按「自動 key」可以繼續。"; break; }
      const i = +k.split("-")[1], r = list[i];
      run.i++; run.cur = r.name; render();
      if (data.done[k] || data.pending?.[k]) { sel.delete(k); continue; }
      const d = await formFor(kind);
      if (!d) { stop = "打不開表單。請關掉畫面上其他視窗、回到 BNI Connect 首頁，再按「自動 key」繼續。"; break; }
      if (r.ext) {
        const why = await selectExt(d, r);
        if (why) {
          data.note[k] = why + "（已跳過，請按「填入」處理）"; sel.delete(k); skipped++; save();
          await closeForm(d); await sleep(800);
          if (openForm_(kind)) { stop = "表單關不掉，已停下來，請手動關掉後再按「自動 key」繼續。"; break; }
          continue;
        }
      }
      // 外分會的人已經選好，填其他欄位時不要再動下拉選單
      const fillWith = r.ext ? { ...r, ext: false, _skipPick: true } : r;
      const notes = await (kind === "121" ? fill121(d, fillWith) : fillRef(d, fillWith));
      if (notes.length) {
        stop = `第 ${i + 1} 筆「${esc(r.name)}」需要手動確認：${notes.map(esc).join("、")}。表單還開著，請檢查後自己按「提交」或關掉。`;
        break;
      }
      await sleep(400);
      const bad = verify(kind, d, r);
      if (bad.length) {
        stop = `第 ${i + 1} 筆「${esc(r.name)}」的 ${bad.join("、")} 對不上，已停下來。表單還開著，請檢查後自己按「提交」或關掉。`;
        break;
      }
      const submitButtons = [...d.querySelectorAll("button")].filter(b => b.innerText.trim() === "提交");
      if (submitButtons.length !== 1) { stop = `第 ${i + 1} 筆找不到唯一的提交按鈕，已停下來。`; break; }
      const before = alertSnapshot();
      data.pending ||= {}; data.pending[k] = true;
      data.note[k] = "送出結果待確認；先到 BNI Connect 核對紀錄";
      sel.delete(k); save(); render();
      const asked = [];
      await withConfirm(() => submitButtons[0].click(), asked);
      if (asked.some(isDup)) {
        markDup(k); dupN++; render();
        await closeForm(d); await sleep(800);
        if (openForm_(kind)) { stop = "表單關不掉，已停下來，請手動關掉後再按「自動 key」繼續。"; break; }
        continue;
      }
      let closed = false;
      for (let w = 0; w < 40 && !closed; w++) { await sleep(250); closed = !openForm_(kind); }
      if (!closed) {
        const err = [...d.querySelectorAll(".Mui-error, .MuiFormHelperText-root")].map(x => x.innerText.trim()).filter(Boolean).join("、");
        stop = `第 ${i + 1} 筆「${esc(r.name)}」送出後表單沒有關閉${err ? `（${esc(err)}）` : ""}，已停下來，請看一下畫面。`;
        break;
      }
      await sleep(500);
      if (!successSignal(before)) {
        stop = `第 ${i + 1} 筆「${esc(r.name)}」表單已關閉，但沒有讀到明確成功訊息；保留待確認，避免重複送出。`;
        save(); render(); break;
      }
      data.done[k] = true; delete data.pending[k]; delete data.note[k]; sel.delete(k); ok++; save(); render();
      await sleep(600);
      if (document.querySelector(".MuiDialog-root")) {
        stop = "BNI Connect 跳出了提示視窗，已停下來。請看一下內容、關掉後再按「自動 key」繼續。";
        break;
      }
      await sleep(900);
    }
    run = null; save();
    msg = (stop ? "⚠️ " + stop + "<br>" : "✓ ") + `這次自動送出 ${ok} 筆` + (dupN ? `，${dupN} 筆 BNI 已經有紀錄（沒有重複送，已標為完成）` : "") + (skipped ? `，跳過 ${skipped} 筆（原因寫在那一筆下面）` : "") + "。";
    render();
  }

  // ── 面板（Shadow DOM，不受 BNI 頁面樣式影響） ─────────────────
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  let tab = "121";
  let msg = "";
  let sel = new Set();       // 勾選要自動 key 的（"121-3"、"ref-0"）
  let showDone = false;      // 已完成的預設藏起來
  let confirming = false;    // 按了自動 key，等確認
  let run = null;            // 自動 key 進行中：{ kind, n, i, cur, paused }

  // 面板位置、縮小狀態記在這個瀏覽器；拖曳標題列可以移動
  const UI = "hua-urban-greenlight-keyin-ui-v1";
  let ui = { x: null, y: 72, min: false };
  try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI) || "{}") }; } catch {}
  const saveUi = () => { try { localStorage.setItem(UI, JSON.stringify(ui)); } catch {} };
  function place() {
    const box = root.querySelector(".box");
    const w = box ? box.offsetWidth : 300, h = box ? box.offsetHeight : 60;
    const x = ui.x == null ? innerWidth - w - 16 : ui.x;
    host.style.cssText = `position:fixed;z-index:2147483000;left:${Math.max(0, Math.min(x, innerWidth - w))}px;top:${Math.max(0, Math.min(ui.y, innerHeight - Math.min(h, 60)))}px;`;
  }
  addEventListener("resize", place);

  // 儀表板上「一對一會面」「提供引薦」卡片的「提交」按鈕（只是打開表單）
  function openForm(kind) {
    const label = kind === "121" ? "一對一會面" : "提供引薦";
    let best = null, bestDepth = 9;
    for (const el of document.querySelectorAll("button, a, div, span")) {
      if (el.children.length || el.innerText?.trim() !== "提交" || host.contains(el)) continue;
      let a = el, depth = 0;
      while (a && depth < 6 && !(a.innerText || "").includes(label)) { a = a.parentElement; depth++; }
      if (a && depth < bestDepth) { best = el; bestDepth = depth; }
    }
    if (best) best.click();
    return !!best;
  }
  async function formFor(kind) {
    const find = () => [...document.querySelectorAll(".MuiDialog-root")].reverse().find(x => dialogKind(x) === kind) || null;
    if (find()) return find();
    if (document.querySelector(".MuiDialog-root") || !openForm(kind)) return null;
    for (let i = 0; i < 20 && !find(); i++) await sleep(200);
    await sleep(400);
    return find();
  }

  // ── 自動讀取最新資料：開小視窗到追綠光網站，它把資料傳回來就自己關掉 ──
  const SITE_ORIGIN = new URL(SITE).origin;
  let fetching = false;
  let bridgeWindow = null;
  let bridgeNonce = null;
  function fetchLatest(auto) {
    bridgeNonce = crypto.randomUUID();
    const nonce = bridgeNonce;
    const w = window.open(SITE + "bridge.html#" + encodeURIComponent(nonce), "hua-urban-greenlight-bridge", "width=420,height=260,left=80,top=80");
    if (!w) {
      if (!auto) msg = "瀏覽器擋住了小視窗：請在網址列右邊允許這個網站「彈出式視窗」，再按「🔄 讀取最新資料」。";
      render(); return;
    }
    bridgeWindow = w;
    fetching = true; render();
    setTimeout(() => { if (fetching && bridgeNonce === nonce) { fetching = false; render(); } }, 8000);
  }
  window.addEventListener("message", e => {
    if (e.origin !== SITE_ORIGIN || e.source !== bridgeWindow || e.data?.nonce !== bridgeNonce) return;
    if (e.data?.type === "hua-urban-greenlight-ready") {
      bridgeWindow.postMessage({ type: "hua-urban-greenlight-request", nonce: bridgeNonce }, SITE_ORIGIN);
      return;
    }
    if (e.data?.type !== "hua-urban-greenlight-data") return;
    fetching = false;
    if (!e.data.data) { msg = "追綠光網站上還沒有你的資料：請先在同一個瀏覽器填完問卷、走到完成頁。"; render(); return; }
    try {
      const before = data ? data.rows121.length + data.refs.length : 0;
      data = merge(parse(JSON.stringify(e.data.data))); save();
      const doneN = Object.values(data.done).filter(Boolean).length;
      msg = `✓ 已讀取最新資料：${data.rows121.length} 筆 121、${data.refs.length} 筆引薦` + (before && doneN ? `（其中 ${doneN} 筆之前已完成）` : "");
    } catch { msg = "資料格式不對，請回追綠光網站重新走到完成頁。"; }
    render();
  });

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function render() {
    // 重畫前記住清單捲到哪裡，重畫後捲回去（勾選、標記完成時不要跳回最上面）
    const prevBody = root.querySelector(".body");
    const keepScroll = prevBody ? prevBody.scrollTop : 0;
    renderInner();
    const body = root.querySelector(".body");
    if (body) body.scrollTop = keepScroll;
  }
  function renderInner() {
    const list = data ? (tab === "121" ? data.rows121 : data.refs) : [];
    const doneN = k => (data ? (k === "121" ? data.rows121 : data.refs).filter((_, i) => data.done[`${k}-${i}`]).length : 0);
    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; }
        .box { width: 300px; max-height: calc(100vh - 100px); display: flex; flex-direction: column; background: #fff; color: #17231c;
          border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.25); overflow: hidden; border: 2px solid #107b39; }
        .hd { background: #107b39; color: #fff; padding: 9px 10px 9px 14px; display: flex; gap: 6px; align-items: center;
          cursor: move; user-select: none; touch-action: none; }
        .hd b { font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hd button { background: rgba(0,0,0,.18); border: 0; color: #fff; font-size: 15px; cursor: pointer; line-height: 1;
          width: 26px; height: 26px; border-radius: 8px; flex: none; }
        .hd button:hover { background: rgba(0,0,0,.32); }
        .box.min { width: auto; }
        .box.min .body { display: none; }
        .body { padding: 12px 14px; overflow: auto; }
        .tabs { display: flex; gap: 6px; margin-bottom: 10px; }
        .tabs button { flex: 1; padding: 7px; border-radius: 99px; border: 1px solid #cfe3d5; background: #fff; cursor: pointer; font-size: 13px; }
        .tabs button.on { background: #107b39; color: #fff; border-color: #107b39; font-weight: 700; }
        .hint { font-size: 12.5px; color: #5d6f64; margin: 0 0 10px; line-height: 1.5; }
        .msg { font-size: 13px; background: #fff7e0; border-radius: 10px; padding: 8px 10px; margin: 0 0 10px; line-height: 1.5; }
        .msg.ok { background: #e3f6ea; }
        .it { border: 1px solid #dbe6de; border-radius: 12px; padding: 8px 10px; margin-bottom: 8px; font-size: 13px; }
        .it .t { font-weight: 700; font-size: 14px; }
        .it .s { color: #5d6f64; margin: 2px 0 6px; line-height: 1.4; word-break: break-all; }
        .row { display: flex; gap: 6px; align-items: center; }
        .fill { flex: 1; padding: 7px; border: 0; border-radius: 10px; background: #107b39; color: #fff; font-weight: 700; cursor: pointer; }
        label { font-size: 12.5px; color: #5d6f64; display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; }
        .big { width: 100%; padding: 10px; border: 0; border-radius: 12px; background: #107b39; color: #fff; font-weight: 700; cursor: pointer; font-size: 14px; }
        textarea { width: 100%; height: 70px; margin: 8px 0; border-radius: 10px; border: 1px solid #dbe6de; padding: 8px; font-size: 12px; }
        .link { background: none; border: 0; color: #5d6f64; text-decoration: underline; cursor: pointer; font-size: 12px; padding: 0; }
        a { color: #0f7a37; }
        .sum { background: #f4f8f5; border-radius: 12px; padding: 8px 10px; margin-bottom: 10px; font-size: 12.5px; }
        .st { display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: baseline; padding: 3px 0; }
        .st + .st { border-top: 1px dashed #dbe6de; }
        .st b { width: 2.6em; color: #0f7a37; }
        .st em { font-style: normal; font-weight: 700; color: #17231c; }
        .st em.left { color: #b45309; }
        .st .tot { color: #5d6f64; margin-left: auto; }
        .bar { display: flex; align-items: center; justify-content: space-between; margin: 0 0 8px; }
        .auto { width: 100%; padding: 10px; border: 0; border-radius: 12px; background: #0f7a37; color: #fff; font-weight: 700;
          cursor: pointer; font-size: 14px; margin-bottom: 10px; }
        .auto:disabled { background: #53685a; cursor: default; }
        .panel { border: 2px solid #f2d36b; background: #fffbea; border-radius: 12px; padding: 10px; margin-bottom: 10px; font-size: 13px; line-height: 1.5; }
        .panel .btns { display: flex; gap: 6px; margin-top: 8px; }
        .panel .btns button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid #dbe6de; background: #fff; cursor: pointer; font-weight: 700; }
        .panel .btns .go { background: #107b39; color: #fff; border-color: #107b39; }
        .panel.running { border-color: #107b39; background: #e3f6ea; }
        .it { display: grid; grid-template-columns: auto 1fr; gap: 0 8px; }
        .it > .pick { grid-row: 1 / span 3; padding-top: 2px; }
        .it.done { background: #f4f8f5; }
        :focus-visible { outline: 3px solid #9b5800; outline-offset: 2px; }
        .badge { color: #0f7a37; font-weight: 700; font-size: 12.5px; margin-left: 6px; }
        .note { color: #a15c00; font-size: 12px; grid-column: 2; margin-bottom: 4px; }
      </style>
      <div class="box ${ui.min ? "min" : ""}">
        <div class="hd" id="hd" title="拖曳可以移動面板">
          <b>🟢 追綠光${run ? `　⏳ ${run.i}/${run.n}` : ""}${ui.min && data && !run ? `　121 ${doneN("121")}/${data.rows121.length} · 引薦 ${doneN("ref")}/${data.refs.length}` : " · 一鍵帶入"}</b>
          <button id="min" title="${ui.min ? "展開" : "縮小"}">${ui.min ? "▢" : "－"}</button>
          <button id="x" title="關閉面板（再點一次書籤會回來）">×</button>
        </div>
        <div class="body">
          ${msg ? `<p class="msg ${msg.startsWith("✓") ? "ok" : ""}">${msg}</p>` : ""}
          ${data && fetching ? `<p class="hint">⏳ 正在讀取最新資料…</p>` : ""}
          ${!data ? `
            <p class="hint">${fetching ? "⏳ 正在讀取追綠光網站上的資料…" : `先在同一個瀏覽器到 <a href="${SITE}" target="_blank">追綠光網站</a> 填完問卷、走到完成頁，再按下面的按鈕。`}</p>
            <button class="big" id="fetch">🔄 讀取最新資料</button>
            <p class="hint" style="margin-top:10px">還是讀不到的話：在完成頁按「複製 key 單資料」，再<button class="link" id="read">從剪貼簿讀取</button>，或貼在這裡：</p>
            <textarea id="paste" placeholder="在這裡貼上"></textarea>
            <button class="big" id="usePaste">使用貼上的資料</button>
          ` : `
            ${(() => {
              const stat = kind => {
                const list = kind === "121" ? data.rows121 : data.refs;
                const keys = list.map((_, i) => `${kind}-${i}`);
                const done = keys.filter(k => data.done[k]).length, dup = keys.filter(k => data.done[k] && data.dupe?.[k]).length;
                return `<div class="st"><b>${kind === "121" ? "121" : "引薦"}</b>
                  <span>新送出 <em>${done - dup}</em></span>
                  ${kind === "121" ? `<span>BNI 已有紀錄 <em>${dup}</em></span>` : ""}
                  <span>還沒完成 <em class="${keys.length - done ? "left" : ""}">${keys.length - done}</em></span>
                  <span class="tot">共 ${keys.length}</span></div>`;
              };
              return `<div class="sum">${stat("121")}${stat("ref")}</div>`;
            })()}
            <div class="tabs">
              <button data-tab="121" class="${tab === "121" ? "on" : ""}">121（${doneN("121")}/${data.rows121.length}）</button>
              <button data-tab="ref" class="${tab === "ref" ? "on" : ""}">引薦（${doneN("ref")}/${data.refs.length}）</button>
            </div>
            ${run ? `<div class="panel running">⏳ 自動 key 中：第 ${run.i} / ${run.n} 筆「${esc(run.cur)}」…<br>請不要操作 BNI Connect 畫面。
                <div class="btns"><button id="pause">${run.paused ? "這筆送完就停…" : "⏸ 暫停"}</button></div></div>`
            : confirming ? (() => {
                const keys = [...sel].filter(k => k.startsWith(tab + "-"));
                const ext = keys.filter(k => list[+k.split("-")[1]].ext).length;
                return `<div class="panel">確定要自動送出 <b>${keys.length}</b> 筆${tab === "121" ? " 121" : "引薦"}到 BNI Connect 嗎？
                  ${ext ? `<br>其中外分會 ${ext} 筆會自動跨分會查找；找不到或找到不只一位的，會跳過留給你處理。` : ""}
                  <br>每筆會先檢查欄位，對不上就停。送出後要到 BNI Connect「卡片 ▸ 提供的」才能修改或刪除。
                  <div class="btns"><button id="cancel">取消</button><button class="go" id="go">確認，開始</button></div></div>`;
              })() : ""}
            ${(() => {
              const open = list.map((_, i) => `${tab}-${i}`).filter(k => !data.done[k] && !data.pending?.[k]);
              const n = open.filter(k => sel.has(k)).length;
              return `<div class="bar">
                  <label><input type="checkbox" id="all" ${open.length && n === open.length ? "checked" : ""} ${run || !open.length ? "disabled" : ""}>全選未完成的</label>
                  <span class="hint" style="margin:0">已選 ${n} 筆</span>
                </div>
                <button class="auto" id="auto" ${!n || run || confirming ? "disabled" : ""}>▶ 自動 key 已勾選的 ${n} 筆</button>`;
            })()}
            <p class="hint">也可以按某一筆的「填入」，檢查後自己按「提交」，再勾「已完成」。面板擋到畫面時，拖曳綠色標題列移開，或按「－」縮小。</p>
            ${(() => {
              const doneN = list.filter((_, i) => data.done[`${tab}-${i}`]).length;
              return doneN === list.length && list.length ? `<p class="msg ok">🎉 這一類 ${list.length} 筆全部完成了！</p>` : "";
            })()}
            ${list.map((r, i) => {
              const k = `${tab}-${i}`, done = !!data.done[k], pending = !!data.pending?.[k];
              if (done && !showDone) return "";   // 已完成的不顯示
              const sub = tab === "121"
                ? `${esc(r.date)} · ${esc(r.place)} · ${esc(r.topic)}${r.ext ? ` · ${esc(r.chapter)}` : ""}`
                : `${esc(r.type)} · 被引薦人 ${esc(r.referredName)} · ${esc(r.content)} · ${esc(r.phone)}${r.ext ? ` · ${esc(r.chapter)}` : ""}`;
              return `<div class="it ${done ? "done" : ""}">
                <input type="checkbox" class="pick" data-sel="${k}" ${sel.has(k) && !done && !pending ? "checked" : ""} ${done || pending || run ? "disabled" : ""} title="勾選要自動 key">
                <div class="t">${i + 1}. ${esc(r.name)}${done ? `<span class="badge">✓ 已完成</span>` : pending ? `<span class="badge">待確認</span>` : ""}</div>
                <div class="s">${sub}</div>
                ${data.note?.[k] ? `<div class="note">${done ? "ℹ️" : "⚠️"} ${esc(data.note[k])}</div>` : ""}
                <div class="row" style="grid-column:2">
                  <button class="fill" data-fill="${i}" ${run || done || pending ? "disabled" : ""}>填入</button>
                  <label><input type="checkbox" data-done="${k}" ${done ? "checked" : ""} ${run ? "disabled" : ""}>已完成</label>
                  ${pending && !done ? `<button class="link" data-clear-pending="${k}" ${run ? "disabled" : ""}>確認未送出，重新開放</button>` : ""}
                </div>
              </div>`;
            }).join("")}
            ${!list.length ? `<p class="hint">這一類沒有要 key 的。</p>` : ""}
            ${(() => {
              const doneN = list.filter((_, i) => data.done[`${tab}-${i}`]).length;
              return doneN ? `<p><button class="link" id="toggleDone">${showDone ? "隱藏" : "顯示"}已完成的 ${doneN} 筆</button></p>` : "";
            })()}
            <button class="link" id="fetch">🔄 讀取最新資料</button>
          `}
        </div>
      </div>`;
  }

  root.addEventListener("click", async e => {
    const t = e.target;
    if (t.id === "x") { host.style.display = "none"; return; }
    if (t.id === "min") { ui.min = !ui.min; saveUi(); render(); place(); return; }
    if (t.dataset.tab) {
      if (run) return;
      tab = t.dataset.tab; msg = ""; confirming = false;
      const b = root.querySelector(".body"); if (b) b.scrollTop = 0;
      render(); return;
    }
    if (t.id === "auto") { confirming = true; msg = ""; render(); return; }
    if (t.id === "cancel") { confirming = false; render(); return; }
    if (t.id === "go") {
      confirming = false;
      const keys = [...sel].filter(k => k.startsWith(tab + "-")).sort((a, b) => +a.split("-")[1] - +b.split("-")[1]);
      runBatch(tab, keys); return;
    }
    if (t.id === "pause") { if (run) run.paused = true; render(); return; }
    if (t.id === "toggleDone") { showDone = !showDone; render(); return; }
    if (t.dataset.clearPending) {
      const k = t.dataset.clearPending;
      delete data.pending[k]; if (data.note) delete data.note[k];
      save(); render(); return;
    }
    if (t.id === "fetch") { if (!run) fetchLatest(false); return; }
    if (t.id === "read" || t.id === "usePaste") {
      try {
        const txt = t.id === "read" ? await navigator.clipboard.readText() : root.getElementById("paste").value;
        data = merge(parse(txt)); save();
        msg = `✓ 讀到 ${data.rows121.length} 筆 121、${data.refs.length} 筆引薦`;
      } catch (err) {
        msg = t.id === "read" ? "讀不到剪貼簿（可能沒允許）。請用下面的貼上方式。" : "資料格式不對，請回追綠光網站重新複製。";
      }
      render(); return;
    }
    if (t.dataset.fill !== undefined) {
      const i = +t.dataset.fill, want = tab === "121" ? "121" : "ref";
      stopWatch();
      t.disabled = true; t.textContent = "填入中…";
      const d = await formFor(want);
      if (!d) {
        msg = `打不開「${want === "121" ? "一對一會面" : "提供引薦"}」表單。請先關掉畫面上其他的表單，回到 BNI Connect 首頁（儀表板）再按填入。`;
        render(); return;
      }
      const r = (want === "121" ? data.rows121 : data.refs)[i];
      try {
        const notes = want === "121" ? await fill121(d, r) : await fillRef(d, r);
        msg = `✓ 已填入第 ${i + 1} 筆「${esc(r.name)}」。請檢查後自己按「提交」，送出成功會自動打勾。` + (notes.length ? "<br>⚠️ " + notes.map(esc).join("<br>⚠️ ") : "");
        watchSubmit(d, want, `${want}-${i}`, r.name);
      } catch (err) {
        msg = "填入時出錯了，請手動填這一筆。";
      }
      render();
    }
  });
  root.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "all") {
      const list = tab === "121" ? data.rows121 : data.refs;
      list.forEach((_, i) => { const k = `${tab}-${i}`; if (!data.done[k] && !data.pending?.[k]) t.checked ? sel.add(k) : sel.delete(k); });
      render(); return;
    }
    if (t.dataset.sel) { t.checked ? sel.add(t.dataset.sel) : sel.delete(t.dataset.sel); render(); return; }
    const k = t.dataset.done;
    if (!k) return;
    data.done[k] = t.checked; if (t.checked) { sel.delete(k); delete data.pending[k]; }
    if (!t.checked) { if (data.dupe) delete data.dupe[k]; if (data.note) delete data.note[k]; }
    save(); render();
  });

  let drag = null;
  root.addEventListener("pointerdown", e => {
    const hd = e.target.closest?.("#hd");
    if (!hd || e.target.closest("button")) return;
    const r = host.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    hd.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", e => {
    if (!drag) return;
    ui.x = e.clientX - drag.dx; ui.y = e.clientY - drag.dy; place();
  });
  root.addEventListener("pointerup", () => { if (drag) { drag = null; saveUi(); } });

  // 再點一次書籤：把面板叫出來並重新讀取最新資料（關面板用右上角的 ×）
  window.__huaGreenlight = { toggle() {
    host.style.display = "";
    if (!run) fetchLatest(true);
  } };
  render();
  place();
  fetchLatest(true);
})();
