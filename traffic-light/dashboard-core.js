(function (rootObject, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(rootObject);
  else rootObject.TrafficDashboard = factory(rootObject);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  'use strict';

  // Public updates retain revision conflict protection; no CAPTCHA or upload quota.
  function createSecurityClient(options = {}) {
    const fetcher = options.fetchImpl || (global.fetch && global.fetch.bind(global));
    const apiUrl = options.apiUrl || 'https://htl-api.vercel.app/api/upload';

    async function prepareRevision() {
      if (typeof fetcher !== 'function') throw new Error('無法連線取得資料版本');
      const response = await fetcher(apiUrl + '?revision=1', {method: 'GET', cache: 'no-store'});
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok !== true ||
          typeof data.baseRevision !== 'string' || !/^[0-9a-f]{40}$/i.test(data.baseRevision)) {
        throw new Error('無法取得資料版本，請重新載入頁面後再試。');
      }
      return data.baseRevision;
    }

    async function postProtected(payload, baseRevision) {
      if (!/^[0-9a-f]{40}$/i.test(String(baseRevision || ''))) {
        throw new Error('沒有可用的資料版本，請重新預覽後再送出。');
      }
      const response = await fetcher(apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...payload, baseRevision})
      });
      const data = await response.json().catch(() => ({}));
      return {response, data};
    }

    return {prepareRevision, postProtected};
  }

  function describeWriteFailure(response, data) {
    if (response.status === 429) {
      const bodySeconds = data && data.retryAfter != null ? Number(data.retryAfter) : NaN;
      const headerSeconds = Number(response.headers && response.headers.get && response.headers.get('Retry-After'));
      const seconds = Number.isFinite(bodySeconds) && bodySeconds >= 0
        ? Math.min(3600, Math.ceil(bodySeconds))
        : Number.isFinite(headerSeconds) && headerSeconds >= 0
          ? Math.min(3600, Math.ceil(headerSeconds)) : null;
      return {status: 429, retryAfter: seconds, message: seconds === null
        ? '更新太頻繁，請稍後再試。' : `更新太頻繁，請等待 ${seconds} 秒後再試。`};
    }
    if (response.status === 409) {
      return {status: 409, message: '資料版本已變更，請重新載入頁面並重新預覽、確認後再送出。'};
    }
    if (!response.ok || !data || data.ok !== true) {
      const message = data && typeof data.error === 'string' ? data.error.slice(0, 500) : '更新失敗';
      return {status: response.status, message};
    }
    return null;
  }

  function showWriteFailure(response, data, element) {
    const failure = describeWriteFailure(response, data);
    if (failure && element) element.textContent = failure.message;
    return failure;
  }

  async function confirmAndPostChapterUpdate({confirmFn, reportMonth, score, prepareRevision, postProtected, payload}) {
    if (typeof confirmFn !== 'function' ||
        !confirmFn(`找到「${String(reportMonth ?? '')}」分會報告（得分 ${String(score ?? '')}）。要更新網站上的七項分會指標嗎？`)) {
      return {confirmed: false};
    }
    const baseRevision = await prepareRevision();
    return Object.assign({confirmed: true}, await postProtected(payload, baseRevision));
  }

  function mount(root, input, settings) {
    if (!root || typeof root.querySelector !== 'function') throw new TypeError('A dashboard root element is required');
    settings = settings || {};
    const VIEW = Object.assign({toggle:false, est:false, offPeriod:null, estPeriod:null}, settings.view || {});
    const LATEST_OFFICIAL_CHAPTER = settings.latestOfficialChapter || null;
    const DATA_URL = settings.dataUrl || 'data.json';
    const RAW = Array.isArray(input && input.members) ? input.members : [];
    const CH = input && input.chapter || {};
    const updatedAt = input && input.updatedAt || null;
    const PREV = input && input.prev || null;
    const LEFTRAW = Array.isArray(input && input.leftMembers) ? input.leftMembers : [];

    if (root.__trafficDashboardController) root.__trafficDashboardController.abort();
    const controller = new AbortController();
    root.__trafficDashboardController = controller;
    root.classList.add('traffic-dashboard');
    root.classList.toggle('is-compact', !!settings.compact);
    if (typeof global.TrafficDashboardTemplate !== 'function') {
      throw new Error('Dashboard template did not load');
    }
    root.innerHTML = global.TrafficDashboardTemplate();
    const $id = id => root.querySelector('#' + id);
    const $q = selector => root.querySelector(selector);
    const $qa = selector => root.querySelectorAll(selector);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);




/* ---------- 計分規則（照 Excel「評分」分頁還原，57 人逐欄驗證吻合） ---------- */
const TIER = {
  absent : [[0,20],[1,15],[2,10]],                                  // 缺席次數（少者高分）
  ref    : [[0.75,5],[1,10],[1.2,15],[1.5,20]],                     // 每週提供引薦
  vis    : [[1,10],[2,15]],                                         // 每 4 週來賓
  o2o    : [[0.5,5],[1,10],[2,15]],                                 // 每週一對一
  ceu    : [[2,5],[4,10],[6,15]],                                   // 分會教育單位
  tyfcb  : [[400000,5],[800000,10],[2000000,15]]                    // 交易價值
};
const GREEN = 70, AMBER = 50, RED = 30;

/* 分會層級的數字不在會員檔裡，來自 BNI 官方《分會紅綠燈報告》。
   這裡先放 2026-07 的實際值示範，正式版由每月那份分會報告帶入。 */
const CHAPTER = {
  period: '2026 年 7 月',
  score: 65, prevScore: 70,
  gyPct: 30, prevGyPct: 20,
  delta: null,   // 與上一期的燈號人數差，boot 時從 prev 算
  moves: null,   // 會員得分升降人數，boot 時從 prev 算
  /* BNI Accelerate《分會紅綠燈計算方式》官方計分表。
     拿全區 25 分會 × 2 個月共 50 筆驗證，45 筆完全命中，華都更兩個月都分毫不差。 */
  official: [
    {k:'分會大小',              v:57,     unit:'人',   tiers:[[31,15],[26,10],[21,5],[0,0]],
     label:['31 以上','26–30','21–25','20 以下'], note:'月底回報的會員人數'},
    {k:'會員成長（6 個月）',     v:57,     unit:'人',   tiers:[[5,15],[3,10],[1,5],[0,0]],
     label:['5 以上','3–4','1–2','1 以下'], note:'過去 6 個月會員總數的變化'},
    {k:'保留率（12 個月）',      v:0,      unit:'%',    tiers:[[70,15],[60,10],[50.01,5],[0,0]],
     label:['70% 以上','60–69.99%','50.01–59.99%','50% 以下'], note:'入會滿 12 個月的會員裡，還留在 BNI 的比例'},
    {k:'會員每週引薦數（6 個月）',v:0.34,   unit:'件',   tiers:[[1.11,15],[0.91,10],[0.71,5],[0,0]],
     label:['1.11 以上','0.91–1.1','0.71–0.9','0.7 以下'], note:'每位會員每週平均給出的引薦'},
    {k:'每週來賓數（6 個月）',   v:1.77,   unit:'位',   tiers:[[2.01,15],[1.51,10],[1.01,5],[0,0]],
     label:['2.01 以上','1.51–2','1.01–1.5','1 以下'], note:'期間內來賓總數 ÷ 會議次數'},
    {k:'轉換率（6 個月）',       v:247.83, unit:'%',    tiers:[[20.01,10],[10.01,5],[0,0]],
     label:['20.01% 以上','10.01–20%','10% 以下'], note:'6 個月內入會人數 ÷ 參與會議的來賓數'},
    {k:'缺席率（6 個月）',       v:0.84,   unit:'%',    low:1, tiers:[[5,15],[10,10],[12,5],[999,0]],
     label:['少於 5%','5–9.99%','10–11.99%','12% 以上'], note:'越低越好'}
  ],
  metrics: [
    ['分會規模',        '56',     '57',     'up'],
    ['會員增長（6 個月）','56',     '57',     'up'],
    ['保留率 %',        '0',      '0',      'flat'],
    ['引薦數／週',      '0.39',   '0.34',   'down'],
    ['來賓數／週',      '2.38',   '1.77',   'down'],
    ['轉換率 %',        '294.74', '247.83', 'down'],
    ['缺席率 %',        '0.47',   '0.84',   'down'],
    ['分會得分',        '70',     '65',     'down']
  ]
};


/* 線上資料覆蓋分會那七項與月份 */
(() => {
  if (!CH) return;
  if (typeof CH.score === 'number') CHAPTER.score = CH.score;
  if (typeof CH.prevScore === 'number') CHAPTER.prevScore = CH.prevScore;
  if (CH.period) CHAPTER.period = CH.period;
  const MAP = {'分會大小':'size','會員成長':'growth','保留率':'retention',
               '會員每週引薦數':'ref','每週來賓數':'vis','轉換率':'conv','缺席率':'absent'};
  CHAPTER.official.forEach(m => {
    for (const pre in MAP) if (m.k.indexOf(pre) === 0 && typeof CH[MAP[pre]] === 'number') m.v = CH[MAP[pre]];
  });
  const tag = $q('.demo-tag');
  if (tag) {
    // 還沒上傳過任何資料時不要顯示寫在程式裡的示範月份，會被誤認成真的
    if (CH.period) tag.textContent = CH.period;
    else if (!RAW || !RAW.length) tag.textContent = '尚未上傳資料';
  }
  const r = CH.range || rangeFromPeriod(CH.period);
  if (r) $qa('.period b, .foot-range').forEach(el => el.textContent = r);
  CHAPTER.chapterMonth = CH.chapterMonth || null;
  CHAPTER.chapterStale = !!CH.chapterStale;
  CHAPTER.chapterFetchedAt = CH.chapterFetchedAt || null;
  // 官方會員紅綠燈還沒出來時，先用 PALMS 摘要換算的暫定版；正式檔上傳後這個欄位就不存在，提示自動消失
  CHAPTER.provisional = CH.provisional || null;
  if (CHAPTER.provisional) {
    const scope = $q('header .period');
    if (scope) scope.insertAdjacentHTML('afterend',
      `<div class="note note-watch"><b>暫定換算版</b>　${esc(CHAPTER.provisional)}</div>`);
  }
  if (VIEW.toggle) {
    const scope = $q('header .period');
    if (scope) scope.insertAdjacentHTML('afterend', `<nav class="vtoggle" aria-label="切換版本">
      <a href="./dashboard.html" class="${VIEW.est ? '' : 'on'}">LTnA 官方版 · ${esc(VIEW.offPeriod)}</a>
      <a href="./dashboard.html?v=est" class="${VIEW.est ? 'on' : ''}">暫定換算版 · ${esc(VIEW.estPeriod)}</a></nav>`);
  }
})();

function rangeFromPeriod(p){
  const m = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(p||'');
  if (!m) return '';
  const y = +m[1], mo = +m[2];
  const end = new Date(Date.UTC(y, mo, 0));            // 該月最後一天
  const start = new Date(Date.UTC(y, mo - 6, 1));      // 往前算 6 個月的第一天
  const f = d => d.toISOString().slice(0,10);
  return f(start) + ' – ' + f(end);
}
const scoreAbsent = a => a===0?20 : a===1?15 : a===2?10 : 0;
const byRate = (val, tiers) => tiers.reduce((s,[t,p]) => val >= t-1e-9 ? p : s, 0);

function scoreOf(m){
  const W = m.weeks || 1;
  return {
    absent: scoreAbsent(m.A),
    ref   : byRate(m.RG / W, TIER.ref),
    vis   : byRate(m.V / W * 4, TIER.vis),
    o2o   : byRate(m.O2O / W, TIER.o2o),
    ceu   : byRate(m.CEU, TIER.ceu),
    tyfcb : byRate(m.TYFCB, TIER.tyfcb)
  };
}
const lightOf = t => t >= GREEN ? 'green' : t >= AMBER ? 'amber' : t >= RED ? 'red' : 'grey';
const LIGHT = {
  green:{name:'綠燈', cls:'tone-green', color:'--green-line'},
  amber:{name:'黃燈', cls:'tone-amber', color:'--amber-line'},
  red  :{name:'紅燈', cls:'tone-red',   color:'--red-line'},
  grey :{name:'黑燈', cls:'tone-grey',  color:'--grey-line'}
};
const nf = n => n.toLocaleString('en-US');

/* ---------- 下一步建議：找出補到綠燈最省力的組合 ---------- */
const COST = {ref:3, vis:14, o2o:2, ceu:1, tyfcb:3};   // 每一單位的相對力氣
function optionsFor(m, sc){
  const W = m.weeks || 1, out = [];
  const push = (key,gain,need,text,detail) => {
    if (gain <= 0 || need <= 0) return;
    out.push({key, gain, need, text, detail, cost: need * COST[key] / gain});
  };
  TIER.ref.forEach(([r,p]) => push('ref', p - sc.ref, Math.ceil(r*W - 1e-9) - m.RG,
    `再給出 N 件引薦`, `目前 ${m.RG} 件，每週 ${(m.RG/W).toFixed(2)} 件`));
  TIER.vis.forEach(([r,p]) => push('vis', p - sc.vis, Math.ceil(r*W/4 - 1e-9) - m.V,
    `再帶 N 位來賓`, `目前 ${m.V} 位`));
  TIER.o2o.forEach(([r,p]) => push('o2o', p - sc.o2o, Math.ceil(r*W - 1e-9) - m.O2O,
    `再約 N 次一對一`, `目前 ${m.O2O} 次，每週 ${(m.O2O/W).toFixed(2)} 次`));
  TIER.ceu.forEach(([t,p]) => push('ceu', p - sc.ceu, t - m.CEU,
    `再上 N 個分會教育單位`, `目前 ${m.CEU} 個`));
  TIER.tyfcb.forEach(([t,p]) => push('tyfcb', p - sc.tyfcb, Math.ceil((t - m.TYFCB)/10000),
    `交易價值再進 N 萬`, `目前 ${nf(m.TYFCB)} 元`));
  return out;
}
function planFor(m, sc, total){
  const need = GREEN - total;
  if (need <= 0) return [];
  const opts = optionsFor(m, sc).sort((a,b) => a.cost - b.cost);
  const picked = [], used = new Set();
  let got = 0;
  for (const o of opts){
    if (got >= need || picked.length >= 3) break;   // 最多給三步，多了沒人做
    if (used.has(o.key)) continue;
    used.add(o.key); picked.push(o); got += o.gain;
  }
  // 收尾：能換成同項目較低一階仍夠用的，就換掉，省力氣
  for (let i = picked.length - 1; i >= 0 && picked.length; i--){
    const p = picked[i];
    const smallestEnough = optionsFor(m, sc)
      .filter(o => o.key === p.key && o.gain < p.gain)
      .sort((a,b) => a.gain - b.gain)
      .find(o => got - p.gain + o.gain >= need);
    if (smallestEnough){
      got = got - p.gain + smallestEnough.gain;
      picked[i] = smallestEnough;
    }
  }
  return picked.map(p => ({...p, text: p.text.replace('N', p.need)}));
}

// 跟上一期比對不能用編號——有人退會後 BNI 會把後面的人編號往前遞補，
// 用編號比會整組錯位（例：42 號退會，原本的 43 號變成 42 號，就被拿去跟退會那位比）。
//
// 也不能用完整姓名——會員在系統裡補上或改掉英文名是常事
// （實例：2026-05「黃建嘉」→ 2026-08「黃建嘉 CHIENCHIA HUANG」，同一人）。
// 用完整姓名比會把他算成「一位退會＋一位新進」。
// 所以取中文姓名當比對鍵；沒有中文名的（外籍會員）才退回完整字串。
const nameKey = n => {
  const s = String(n || '').trim();
  const m = s.match(/^[一-龥]{2,4}/);
  return m ? m[0] : s.replace(/\s+/g, '').toLowerCase();
};

/* ---------- 組資料 ---------- */
// 退會的人 BNI 官方成績表不會拿掉（實例：楊淑媛 2026-07-28 退會，8 月成績表仍列在編號 55），
// 所以由分會自己標。標了就不列入任何統計與名單，但資料留著，隨時可以取消標記。
const LEFT = new Set((Array.isArray(LEFTRAW) ? LEFTRAW : []).map(nameKey));

const ALL = RAW.map(r => {
  const m = {no:r[0], name:r[1], weeks:r[2], P:r[3], A:r[4], L:r[5], Med:r[6], S:r[7],
             RG:r[8], RR:r[9], V:r[10], O2O:r[11], CEU:r[12], TYFCB:r[13]};
  m.sc = scoreOf(m);
  m.total = Object.values(m.sc).reduce((a,b) => a+b, 0);
  m.light = lightOf(m.total);
  m.plan = planFor(m, m.sc, m.total);
  m.attend = Math.round((m.P + m.S) / (m.weeks||1) * 100);
  // 再缺席一次會怎樣
  const nextTotal = m.total - m.sc.absent + scoreAbsent(m.A + 1);
  m.riskDrop = m.total - nextTotal;
  m.riskLight = lightOf(nextTotal);
  m.shortName = m.name.split(/[\s（(]/)[0];
  m.hasLeft = LEFT.has(nameKey(m.name));
  return m;
}).sort((a,b) => b.total - a.total || a.no - b.no);

// 分會現況只算現任會員；退會的另存一份，只在「更新資料」分頁看得到
const M = ALL.filter(m => !m.hasLeft);
const LEFT_M = ALL.filter(m => m.hasLeft);

/* 沿用頁面已計算的 M，避免搜尋或燈號篩選讓下載漏掉會員。 */
const exportButton = $id('exportWorkbook');
const exportStatus = $id('exportStatus');
const exportVersion = VIEW.est ? 'PALMS 暫定換算版' : 'LTnA 官方版';
$id('exportHint').textContent =
  `${CHAPTER.period || '月份未標'} · ${exportVersion} · 全部 ${M.length} 位現任會員`;
exportButton.disabled = !M.length;
exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  exportButton.textContent = '正在產生試算表…';
  exportStatus.classList.remove('is-error');
  exportStatus.textContent = '正在整理完整會員數據…';
  try {
    await loadSheetJS();
    if (!window.TrafficLightExport) throw new Error('匯出功能未載入，請重新整理頁面');
    const {workbook, filename} = TrafficLightExport.createWorkbook(XLSX, {
      members: M, chapter: {...CHAPTER, range: CH.range || rangeFromPeriod(CHAPTER.period)},
      metrics: CHAPTER.official,
      version: exportVersion, updatedAt, leftMembers: LEFTRAW,
      sourceUrl: location.origin + location.pathname + (VIEW.est ? '?v=est' : ''),
      dataUrl: new URL(DATA_URL, location.href).href
    });
    XLSX.writeFile(workbook, filename, {compression:true});
    exportStatus.textContent = `已產生 ${filename}，請查看瀏覽器下載。`;
  } catch (e) {
    exportStatus.classList.add('is-error');
    exportStatus.textContent = `匯出失敗：${e.message}。請稍後再按一次匯出。`;
  } finally {
    exportButton.disabled = !M.length;
    exportButton.textContent = '匯出試算表（.xlsx）';
  }
});

/* 週數最多的人＝待滿整個計分區間；比他少代表這半年才入會 */
const FULL_WEEKS = Math.max(...M.map(m => m.weeks));

/* PALMS 只提供累計次數；不能假設每週連續計入，再倒推首次例會日期。 */
(() => {
  const el = $q('.period-note');
  if (!el || !Number.isFinite(FULL_WEEKS)) return;
  el.textContent = `依 PALMS 報告實際計入次數計算，會員最多 ${FULL_WEEKS} 次例會；各會員依自己的計入週數換算`;
  if (VIEW.est && !settings.compact) {
    const status = document.createElement('p');
    status.className = 'period';
    status.textContent = WeeklyPeriod.submissionStatus(CH);
    el.closest('.period').after(status);
  }
})();

M.forEach(m => {
  m.isNew = m.weeks < FULL_WEEKS;
  m.zeroCount = Object.values(m.sc).filter(v => v === 0).length;
});

/* 上一期資料：畫面上所有「跟上個月比」的敘述都由這裡算，沒有上一期就不顯示 */
const PREVM = (PREV && Array.isArray(PREV.members)) ? PREV.members : null;
const PREVC = (PREV && PREV.chapter) ? PREV.chapter : null;

function scoreOfRow(row){
  const m = {weeks:row[2], A:row[4], RG:row[8], V:row[10], O2O:row[11], CEU:row[12], TYFCB:row[13]};
  const sc = scoreOf(m);
  return Object.values(sc).reduce((a,b) => a+b, 0);
}

/* ---------- 分布條 ---------- */
const ORDER = ['green','amber','red','grey'];
const counts = Object.fromEntries(ORDER.map(k => [k, M.filter(m => m.light===k).length]));

(() => {
  if (!PREVM) return;
  // 上一期也要排除已退會的人，否則「黑燈 -1」會被誤讀成有人進步，
  // 實際上只是那個人不在分會了
  const prevScores = new Map(
    PREVM.filter(r => !LEFT.has(nameKey(r[1])))
         .map(r => [nameKey(r[1]), scoreOfRow(r)]));
  const prevCounts = Object.fromEntries(ORDER.map(k => [k, 0]));
  prevScores.forEach(v => prevCounts[lightOf(v)]++);
  CHAPTER.delta = Object.fromEntries(ORDER.map(k => [k, counts[k] - prevCounts[k]]));
  let up = 0, down = 0, flat = 0, joined = 0;
  const seen = new Set();
  M.forEach(m => {
    const k = nameKey(m.name);
    seen.add(k);
    if (!prevScores.has(k)) { joined++; return; }
    const d = m.total - prevScores.get(k);
    if (d > 0) up++; else if (d < 0) down++; else flat++;
  });
  // 上一期有、這一期不在名單裡的，就是退會或離開分會的人
  let left = 0;
  prevScores.forEach((_, k) => { if (!seen.has(k)) left++; });
  CHAPTER.moves = {up, down, flat, joined, left};
})();
$id('distBar').innerHTML = ORDER.map(k => {
  const pct = counts[k] / M.length * 100;
  return `<div class="dist-seg" style="width:${pct}%;background:var(${LIGHT[k].color})">${pct >= 9 ? Math.round(pct)+'%' : ''}</div>`;
}).join('');
$id('distLegend').innerHTML = ORDER.map(k => {
  const d = CHAPTER.delta ? CHAPTER.delta[k] : 0;
  const tail = d === 0 ? '' : ` <span class="num" style="color:var(--text-3)">(${d > 0 ? '+' : ''}${d})</span>`;
  return `<span><i class="dot" style="background:var(${LIGHT[k].color})"></i>${LIGHT[k].name} <b class="num">${counts[k]}</b> 人${tail}</span>`;
}).join('');
// 還沒上傳過任何成績表時 M.length 是 0，不除零
const pctOf = n => M.length ? Math.round(n / M.length * 100) : 0;
const greenPct = pctOf(counts.green);
const gyPct = pctOf(counts.green + counts.amber);
const avg = M.reduce((a,m) => a + m.total, 0) / M.length;
const avgLight = lightOf(avg);
const needGreen = Math.ceil(M.length * 0.6) - counts.green;   // 綠燈目標 60%
const needAmber = M.length - counts.green - counts.amber;     // 綠 60 + 黃 40 = 全員至少黃燈

const chapLight = lightOf(CHAPTER.score);
const chapDiff = CHAPTER.score - CHAPTER.prevScore;
const arrow = d => d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '—';

$id('chapterStats').innerHTML = `
  <div class="stat s-${chapLight}">
    <p class="stat-label">分會得分 · ${VIEW.est ? 'PALMS 推算' : 'BNI 官方'}</p>
    <div class="stat-value">${esc(CHAPTER.score)}<small>分 · ${LIGHT[chapLight].name}</small></div>
    <p class="stat-note">上月 <b>${esc(CHAPTER.prevScore)}</b> 分　${arrow(chapDiff)}</p>
    <p class="stat-src" id="chapterSrc"></p>
  </div>
  <div class="stat s-green">
    <p class="stat-label">綠燈比例</p>
    <div class="stat-value">${greenPct}<small>% · 目標 60%</small></div>
    <p class="stat-note">距離目標還有 <b>${needGreen}</b> 人</p>
  </div>
  <div class="stat s-amber">
    <p class="stat-label">綠燈加黃燈</p>
    <div class="stat-value">${gyPct}<small>% · 上月 ${esc(CHAPTER.prevGyPct)}%</small></div>
    <p class="stat-note">紅燈與黑燈 <b>${needAmber}</b> 人</p>
  </div>`;

// 分會那七項的來源與更新鈕。抓取只在有人按下時發生，沒有排程。
function fmtWhen(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}

function renderChapterSrc(){
  const box = $id('chapterSrc');
  if (!box) return;
  if (VIEW.est) {   // 暫定版的七項是推算的，不提供抓官方報告的按鈕，免得寫進官方資料
    box.textContent = '由 PALMS 摘要推算，正式分數以 LTnA 公布為準';
    return;
  }
  const m = CHAPTER.chapterMonth;
  const when = fmtWhen(CHAPTER.chapterFetchedAt);
  let txt;
  if (!m) {
    txt = '分會報告來源未記錄';
  } else if (CHAPTER.chapterStale) {
    txt = `這七項是 <b>${esc(m)}</b> 的分會報告${when ? `，${when} 取得` : ''}`;
  } else {
    txt = `分會報告 <b>${esc(m)}</b>${when ? `，${when} 取得` : ''}`;
  }
  box.innerHTML = txt + ' <button id="refreshChapter" type="button">看看有沒有新的</button>';
  $id('refreshChapter').addEventListener('click', refreshChapter);
}

async function refreshChapter(){
  const btn = $id('refreshChapter');
  const box = $id('chapterSrc');
  const mm = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(CHAPTER.period || '');
  if (!mm) return;
  btn.disabled = true; btn.textContent = '查詢中…';
  try {
    const r = await fetch(CHAPTER_API + '?year=' + mm[1] + '&month=' + mm[2]);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || '取不到');

    // 跟現在畫面上的比，一樣就不必寫入
    if (d.reportMonth === CHAPTER.chapterMonth && d.chapter.score === CHAPTER.score) {
      addChapterAction(`分會報告 ${d.reportMonth} 還是最新的，沒有變。`, '再查一次', refreshChapter);
      return;
    }

    btn.textContent = '更新中…';
    const chapter = Object.assign({}, d.chapter, {
      period: CHAPTER.period,
      range: CHAPTER.range || rangeFromPeriod(CHAPTER.period),
      chapterMonth: d.reportMonth,
      chapterStale: !!d.stale,
      chapterFetchedAt: new Date().toISOString(),
    });
    if (CH.est) chapter.est = CH.est;   // 只換官方七項，暫定版原樣留著
    const chapterPayload = {chapterOnly: true, chapter, uploadedBy: ''};
    const update = await confirmAndPostChapterUpdate({
      confirmFn: typeof global.confirm === 'function' ? global.confirm.bind(global) : null,
      reportMonth: d.reportMonth,
      score: d.chapter.score,
      prepareRevision: securityClient.prepareRevision,
      postProtected: securityClient.postProtected,
      payload: chapterPayload
    });
    if (!update.confirmed) {
      addChapterAction(`已找到 ${d.reportMonth} 的分會報告，尚未更新。`, '重新查詢', refreshChapter);
      return;
    }
    const {response, data} = update;
    const failure = showWriteFailure(response, data, box);
    if (failure) {
      if (failure.status === 409) await showRevisionConflict(box);
      else {
        const retry = addChapterAction(failure.message, '再試一次', refreshChapter);
        if (failure.status === 429) waitForRetry(retry, failure.retryAfter, '再試一次');
      }
      return;
    }
    box.textContent = `✅ 已換成 ${d.reportMonth} 的分會報告（得分 ${d.chapter.score}）。重新整理這一頁就會看到新的數字。`;
  } catch (e) {
    addChapterAction(`查詢或更新失敗：${e.message}。`, '再試一次', refreshChapter);
  }
}

renderChapterSrc();

$id('goalNote').innerHTML =
  `分會目標：<b>綠燈 60%、黃燈 40%</b>。目前紅燈與黑燈合計 `+
  `<b class="num">${counts.red + counts.grey}</b> 人。`+
  (CHAPTER.moves
    ? `本月會員得分<b>上升 ${CHAPTER.moves.up} 人、下降 ${CHAPTER.moves.down} 人、`+
      `持平 ${CHAPTER.moves.flat} 人、新進 ${CHAPTER.moves.joined} 人</b>。`+
      (CHAPTER.moves.left
        ? `上一期有 <b>${CHAPTER.moves.left}</b> 位不在這次的名單裡（退會或轉出），已不列入。`
        : '')
    : '');

/* ---------- 卡片牆 ---------- */
let filter = 'all', query = '';
$id('filters').innerHTML =
  [['all','清除'],...ORDER.map(k => [k, LIGHT[k].name])]
  .map(([k,label]) => `<button class="chip" data-f="${k}" aria-pressed="${k==='all'}">${label}${k!=='all'?` ${counts[k]}`:''}</button>`)
  .join('');

function render(){
  const grid = $id('grid');
  const cnt = $id('count');

  // 沒輸入姓名、也沒選燈號時不列出任何人
  if (!query && filter === 'all'){
    cnt.textContent = '';
    grid.innerHTML = `<p class="hint">
        <b>輸入姓名查個人，或點上方燈號看該組名單。</b>
        <span>共 ${M.length} 位會員。</span></p>`;
    return;
  }

  const list = M.filter(m =>
    (filter === 'all' || m.light === filter) &&
    (!query || m.name.toLowerCase().includes(query))
  );
  cnt.textContent = `顯示 ${list.length} 人`;
  grid.innerHTML = list.map(m => {
    const L = LIGHT[m.light];
    const gap = m.total >= GREEN
      ? `<span class="gap">已達綠燈</span>`
      : `<span class="gap">離綠燈 <b>${GREEN - m.total}</b> 分</span>`;
    const aria = `${m.shortName}，${L.name}，${m.total} 分，${m.total >= GREEN ? '已達綠燈' : `離綠燈 ${GREEN - m.total} 分`}`;
    return `<button class="card ${L.cls}" data-name="${esc(m.name)}" aria-label="${esc(aria)}">
      <div class="card-top"><span class="name">${esc(m.shortName)}</span><span class="rank num">#${m.no}</span></div>
      <div class="score num">${m.total}<small>/100</small></div>
      <div class="card-bot"><span class="pill">${L.name}</span>${gap}</div>
    </button>`;
  }).join('') || `<p class="empty">找不到這個名字。</p>`;
}
$id('q').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
$id('filters').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filter = b.dataset.f;
  [...$qa('[data-f]')].forEach(x => x.setAttribute('aria-pressed', x === b));
  render();
});
render();

/* ---------- 個人明細 ---------- */
const METRICS = [
  {key:'absent', name:'出席（看缺席次數）', max:20, unit:'次',
   cur:m => `缺席 ${m.A} 次`},
  {key:'ref', name:'提供引薦', max:20, unit:'件',
   cur:m => `目前 ${m.RG} 件，每週 ${(m.RG/m.weeks).toFixed(2)} 件`},
  {key:'vis', name:'帶來賓', max:15, unit:'位',
   cur:m => `目前 ${m.V} 位，每 4 週 ${(m.V/m.weeks*4).toFixed(2)} 位`},
  {key:'o2o', name:'一對一會面', max:15, unit:'次',
   cur:m => `目前 ${m.O2O} 次，每週 ${(m.O2O/m.weeks).toFixed(2)} 次`},
  {key:'ceu', name:'分會教育單位', max:15, unit:'個',
   cur:m => `目前 ${m.CEU} 個`},
  {key:'tyfcb', name:'交易價值', max:15, unit:'萬',
   cur:m => `目前 ${nf(m.TYFCB)} 元`}
];

/* 每一項的狀態：滿分 / 還能加 / 完全沒分 / 補不回來 */
function metricState(m, def){
  const got = m.sc[def.key];
  const next = optionsFor(m, m.sc)
    .filter(o => o.key === def.key)
    .sort((a,b) => a.gain - b.gain)[0] || null;
  const cls = !next ? (got === def.max ? 'is-max' : 'is-lost')
                    : (got === 0 ? 'is-zero' : 'is-part');
  return {got, next, cls, headroom: next ? def.max - got : 0};
}

function openSheet(name){
  const m = M.find(x => x.name === name); if (!m) return;
  const L = LIGHT[m.light];
  const rows = METRICS.map(def => ({def, st: metricState(m, def)}));
  const canGain = rows.filter(r => r.st.next).sort((a,b) => b.st.headroom - a.st.headroom);
  const settled = rows.filter(r => !r.st.next);

  const drawRow = ({def, st}) => {
    const {got, next, cls} = st;
    const tick = next ? `<u style="left:min(calc(${(got + next.gain) / def.max * 100}% - 1px), calc(100% - 2px))"></u>` : '';
    const badge = next ? `+${next.gain}` : (cls === 'is-max' ? '滿分' : '不可回補');
    const hint = next
      ? `<b>${next.text.replace('N', next.need)} → +${next.gain} 分</b>`
      : (cls === 'is-max' ? '已達最高階' : '缺席分數不可回補');
    return `<div class="metric ${cls}">
      <span class="metric-name">${def.name}</span>
      <span class="metric-val"><b>${got}</b> / ${def.max} 分<em class="mstat">${badge}</em></span>
      <span class="track"><i style="width:${got / def.max * 100}%"></i>${tick}</span>
      <span class="metric-note">${def.cur(m)}　·　${hint}</span>
    </div>`;
  };

  const metrics =
    (canGain.length ? `<div class="mgroup"><p class="mgroup-title">尚有空間 ${canGain.length} 項</p>${canGain.map(drawRow).join('')}</div>` : '') +
    (settled.length ? `<div class="mgroup"><p class="mgroup-title">已達上限</p>${settled.map(drawRow).join('')}</div>` : '');

  const ladder = (() => {
    if (m.total >= GREEN) return `<p class="ok-note">總分 ${m.total} 分，已達綠燈門檻 70 分。</p>`;
    if (!m.plan.length)   return `<p class="ok-note">六項都已達最高階。</p>`;
    let acc = m.total;
    const steps = m.plan.map((p, i) => {
      acc += p.gain;
      const lt = lightOf(acc), reached = lt === 'green';
      return `<div class="rung ${reached ? 'rung-goal' : 'rung-step'} r-${lt}">
        <span class="rung-mark">${reached ? '✓' : i + 1}</span>
        <span class="rung-body">${p.text}<small>${p.detail}</small></span>
        <span class="rung-after"><b>${acc}</b> 分<em class="rung-pill">${LIGHT[lt].name}</em></span>
      </div>`;
    }).join('');
    const done = acc >= GREEN;
    const note = done
      ? `每一項是分開計分的，完成一項就加一次分。`
      : `這 ${m.plan.length} 項全部完成後為 ${acc} 分（${LIGHT[lightOf(acc)].name}）。`;
    return `<div class="ladder">
        <div class="rung rung-now r-${m.light}">
          <span class="rung-mark">●</span>
          <span class="rung-body">目前</span>
          <span class="rung-after"><b>${m.total}</b> 分<em class="rung-pill">${L.name}</em></span>
        </div>${steps}
      </div>
      <p class="ladder-note">${note}</p>`;
  })();

  const risk = (() => {
    if (m.riskDrop <= 0) return '';                       // 已經扣到底，沒有更低了
    const drops = m.riskLight !== m.light;
    if (m.A === 0){                                       // 全勤：是恭喜加提醒，不是警告
      return drops
        ? `<div class="note note-watch">${m.weeks} 週<b>全勤</b>，出席項 20 分（滿分）。
             此區間內每缺席 1 次減 5 分，減分後為${LIGHT[m.riskLight].name}。</div>`
        : `<div class="note note-ok">${m.weeks} 週<b>全勤</b>，出席項 20 分（滿分）。</div>`;
    }
    return `<div class="note note-warn">缺席 <b>${m.A}</b> 次。再缺席 1 次減 ${m.riskDrop} 分`
         + (drops ? `，減分後為${LIGHT[m.riskLight].name}。` : `。`) + `</div>`;
  })();

  $id('sheet').className = `sheet ${L.cls}`;
  $id('sheet').innerHTML = `
    <div class="sheet-head">
      <div class="row">
        <div>
          <h2 class="sheet-name" id="sheetName">${esc(m.name)}</h2>
          <p class="sheet-sub">會員編號 ${m.no}　·　這段期間計入 ${m.weeks} 週　·　${
            m.A === 0 ? '沒缺席過' : `缺席 ${m.A} 次（出席率 ${m.attend}%）`}</p>
        </div>
        <div style="display:flex; gap:12px; align-items:flex-start">
          <div class="sheet-score num">${m.total}<small>${L.name}</small></div>
          <button class="closebtn" id="closeBtn" aria-label="關閉">×</button>
        </div>
      </div>
    </div>
    <div class="sheet-body">
      <div>
        <p class="sec-title">${m.total >= GREEN ? '目前狀態' : '到綠燈的差距'}</p>
        <div class="actions">${ladder}</div>
        ${risk}
      </div>
      <div>
        <p class="sec-title">六項分數</p>
        ${metrics}
      </div>
    </div>`;
  $id('overlay').hidden = false;
  $id('closeBtn').focus();
}
function closeSheet(){ $id('overlay').hidden = true; }
root.addEventListener('click', e => {
  const card = e.target.closest('[data-name]');
  if (card) return openSheet(card.dataset.name);
  if (e.target.id === 'overlay' || e.target.id === 'closeBtn') closeSheet();
}, {signal:controller.signal});
root.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); }, {signal:controller.signal});

/* ---------- 導師協調人：要盯的人 ---------- */
const nearGreen = M.filter(m => m.light === 'amber' && GREEN - m.total <= 10)
                   .sort((a,b) => (GREEN-a.total) - (GREEN-b.total));
const willDrop  = M.filter(m => m.riskLight !== m.light && m.light !== 'grey')
                   .sort((a,b) => b.total - a.total);
// 灰燈：待滿整個區間還在灰燈的排前面，那才是真的需要有人去找他
const greyList  = M.filter(m => m.light === 'grey')
                   .sort((a,b) => (a.isNew - b.isNew) || (a.total - b.total));
const easyWin   = M.filter(m => m.light === 'red')
                   .map(m => ({...m, effort: m.plan[0] ? m.plan[0].need * COST[m.plan[0].key] : 1e9}))
                   .sort((a,b) => a.effort - b.effort).slice(0, 10);

function listBlock(title, sub, arr, why){
  const rows = arr.length ? arr.map(m => {
    const {tag, how} = why(m);
    return `<button class="li ${LIGHT[m.light].cls}" data-name="${esc(m.name)}" aria-label="${esc(`${m.shortName}，${m.total} 分，${tag}，${how.replace(/<[^>]+>/g,'')}`)}">
      <span class="li-score num">${m.total}</span>
      <span class="li-name">${esc(m.shortName)}</span>
      <span class="li-tag">${tag}</span>
      <span class="li-how">${how}</span>
    </button>`;
  }).join('') : `<p class="empty">目前沒有人在這一類。</p>`;
  return `<div class="list"><div class="list-head"><h3>${title}</h3><p>${sub}</p></div><div class="list-body">${rows}</div></div>`;
}
$id('lists').innerHTML =
  listBlock('黑燈', `${greyList.length} 人，總分 25 分以下。其中 ${greyList.filter(m => !m.isNew).length} 位待滿整個計分區間。`, greyList,
            m => ({
              tag: m.isNew ? `入會 ${m.weeks} 週` : '待滿全期',
              how: m.isNew
                ? `計分週數 ${m.weeks} 週，少於全期 ${FULL_WEEKS} 週${m.plan[0] ? `　·　${m.plan[0].text}` : ''}`
                : `計分 ${m.weeks} 週，六項中有 <b>${m.zeroCount} 項為 0 分</b>${m.plan[0] ? `　·　${m.plan[0].text}` : ''}`
            })) +
  listBlock('距綠燈 10 分以內', `${nearGreen.length} 人。`, nearGreen,
            m => ({
              tag: `差 ${GREEN - m.total} 分`,
              how: m.plan.length === 1
                ? `<b>${m.plan[0].text}</b> → 達綠燈`
                : `需 ${m.plan.length} 項，其一：<b>${m.plan[0].text}</b>（+${m.plan[0].gain} 分）`
            })) +
  listBlock('再缺席一次會掉燈', `${willDrop.length} 人。缺席分數不可回補。`, willDrop,
            m => ({
              tag: `會掉到${LIGHT[m.riskLight].name}`,
              how: `${m.total} 分${m.A === 0 ? '，全勤' : `，缺席 ${m.A} 次`}　·　再缺 1 次減 ${m.riskDrop} 分`
            })) +
  listBlock('紅燈中跨階所需增量最小的', `紅燈 ${counts.red} 人中的 ${easyWin.length} 位。`, easyWin,
            m => ({
              tag: m.plan[0] ? `+${m.plan[0].gain} 分` : '—',
              how: m.plan[0] ? `<b>${m.plan[0].text}</b>　${m.plan[0].detail}` : ''
            }));

/* ---------- 計分規則 ---------- */
const RULE_CARDS = [
  {t:'出席（缺席次數）', s:'滿分 20 分　缺席分數不可回補', rows:[['沒缺席','20'],['缺席 1 次','15'],['缺席 2 次','10'],['缺席 3 次以上','0']]},
  {t:'提供引薦', s:'滿分 20 分　算每週平均（分會內外都算）', rows:[['每週 1.5 件以上','20'],['每週 1.2 件以上','15'],['每週 1 件以上','10'],['每週 0.75 件以上','5'],['低於 0.75 件','0']]},
  {t:'帶來賓', s:'滿分 15 分　算每 4 週平均', rows:[['每 4 週 2 位以上','15'],['每 4 週 1 位以上','10'],['不到 1 位','0']]},
  {t:'一對一會面', s:'滿分 15 分　算每週平均', rows:[['每週 2 次以上','15'],['每週 1 次以上','10'],['每週 0.5 次以上','5'],['低於 0.5 次','0']]},
  {t:'分會教育單位', s:'滿分 15 分　看累計個數', rows:[['6 個以上','15'],['4 個以上','10'],['2 個以上','5'],['0 到 1 個','0']]},
  {t:'交易價值', s:'滿分 15 分　看累計金額', rows:[['200 萬以上','15'],['80 萬以上','10'],['40 萬以上','5'],['不到 40 萬','0']]}
];
$id('rules').innerHTML =
  RULE_CARDS.map(c => `<div class="rule"><h3>${c.t}</h3><p class="sub">${c.s}</p><table><tbody>${
    c.rows.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table></div>`).join('') +
  `<div class="rule-foot">
     六項加起來滿分 100 分。<b>70 分以上綠燈、50 到 65 分黃燈、30 到 45 分紅燈、25 分以下黑燈。</b><br>
     分數為<b>往前 6 個月</b>的累計，非單月。每週平均的分母是該期間實際計入的週數，
     新入會者週數較少，計算上不受入會時間影響。<br>
     這套規則是從主席副主席那張表的第二個分頁還原出來的，
     拿全分會 57 人重算，<b>每個人的六項分數與總分都跟原表完全一致</b>。
   </div>
   <div class="rule-foot">
     <b>分會得分和個人得分是兩套，不要混在一起。</b>
     上面那六項算的是「每一位會員」的分數。頁面最上方那個 <b>${esc(CHAPTER.score)} 分</b>
     是 BNI 官方《分會紅綠燈計算方式》給整個分會的成績，看的是下面這七項，跟個人六項無關。
     <div class="mtable-wrap"><table class="mtable">
       <thead><tr><th>官方指標</th><th>15 分</th><th>10 分</th><th>5 分</th><th>0 分</th></tr></thead>
       <tbody>${CHAPTER.official.map(m => {
         const cells = m.label.length === 3
           ? ['—', m.label[0], m.label[1], m.label[2]]   // 轉換率只有三階，最高 10 分
           : m.label;
         return `<tr><td>${esc(m.k)}</td>${cells.map(c => `<td class="num" style="text-align:right">${esc(c)}</td>`).join('')}</tr>`;
       }).join('')}
       </tbody>
     </table></div>
     <p style="margin:10px 0 0">七項加起來滿分 100 分（轉換率只有三階、最高 10 分）。
     <b>70 分以上就是綠燈分會。</b>缺席率那一列是越低越好。
     這張表是 BNI Accelerate 官方版本，拿全區 25 個分會兩個月共 50 筆資料驗證過，45 筆完全命中。
     這七個數字不在會員成績表裡，要另外從分會紅綠燈報告帶進來。</p>
   </div>`;

/* ---------- tabs ---------- */
/* ---------- 怎麼上綠燈分會（依 BNI 官方計分表） ---------- */
(() => {
  const O = CHAPTER.official;
  const pts = m => {
    for (const [th, p] of m.tiers) if (m.low ? m.v < th : m.v >= th) return p;
    return 0;
  };
  const maxOf = m => Math.max(...m.tiers.map(t => t[1]));
  const total = O.reduce((a, m) => a + pts(m), 0);
  const ceilingNow = O.reduce((a, m) => a + (m.k.startsWith('保留率') ? 0 : maxOf(m)), 0);

  const rows = O.map(m => {
    const got = pts(m), max = maxOf(m), full = got === max;
    // 下一階：分數比現在高、且最接近的一階
    const up = [...m.tiers].filter(t => t[1] > got).sort((a, b) => a[1] - b[1])[0];
    const cls = full ? 'v-good' : got === 0 ? 'v-bad' : 'v-mid';
    const tag = full ? '滿分' : got === 0 ? '掛零' : `還能 +${up[1] - got}`;
    const idx = m.tiers.findIndex(t => t[1] === got);
    return `<tr>
      <td>${esc(m.k)}<div style="font-size:12px;color:var(--text-3);margin-top:1px">${esc(m.note)}</div></td>
      <td class="n">${esc(m.v)}${esc(m.unit)}</td>
      <td>${esc(m.label[idx] || '—')}</td>
      <td class="n"><b>${got}</b> / ${max}</td>
      <td><span class="verdict ${cls}">${tag}</span></td>
    </tr>`;
  }).join('');

  /* ── 以下敘述全部由資料算出，換月份不用改任何文字 ── */
  const W = M[0] ? M[0].weeks : 13;                        // 計分週數
  const N = M.length;                                       // 會員數
  const sumV = M.reduce((a, m) => a + m.V, 0);              // 來賓總數
  const sumRG = M.reduce((a, m) => a + m.RG, 0);            // 引薦總數
  const visWithScore = M.filter(m => m.sc.vis > 0).length;  // 個人端來賓有得分的人數

  // 每一項「升到下一階」要補多少，換算成看得懂的量
  const gaps = O.map(m => {
    const got = pts(m), max = maxOf(m);
    if (got === max) return null;
    const up = [...m.tiers].filter(t => t[1] > got).sort((a, b) => a[1] - b[1])[0];
    if (!up) return null;
    const th = up[0], gain = up[1] - got;
    let need = '';
    if (m.k.indexOf('每週來賓數') === 0) {
      const total = Math.ceil(th * W), now = Math.round(m.v * W);
      need = `6 個月來賓總數需達 <b>${total} 位</b>，目前約 ${now} 位，差 <b>${total - now} 位</b>`;
    } else if (m.k.indexOf('會員每週引薦數') === 0) {
      const total = Math.ceil(th * W * N), diff = total - sumRG;
      need = `6 個月需達 <b>${total} 件</b>，目前 ${sumRG} 件，差 <b>${diff} 件</b>，平均每人 ${(diff / N).toFixed(1)} 件`;
    } else if (m.k.indexOf('保留率') === 0) {
      need = `需達 <b>${th}%</b>`;
    } else {
      need = `需達 <b>${th}${m.unit}</b>（目前 ${m.v}${m.unit}）`;
    }
    return {m, th, gain, need, unit: m.unit};
  }).filter(Boolean);

  // 跟上一期比，是哪幾項造成分數變化
  let changeLine = '';
  if (PREVC) {
    const prevPts = {};
    O.forEach(m => {
      const key = m.k;
      const pv = PREVC[({'分會大小':'size','會員成長':'growth','保留率':'retention',
                         '會員每週引薦數':'ref','每週來賓數':'vis','轉換率':'conv','缺席率':'absent'})[
                        Object.keys({'分會大小':1,'會員成長':1,'保留率':1,'會員每週引薦數':1,
                                     '每週來賓數':1,'轉換率':1,'缺席率':1}).find(k => key.indexOf(k) === 0)]];
      if (typeof pv !== 'number') return;
      const before = (() => { for (const [th, p] of m.tiers) if (m.low ? pv < th : pv >= th) return p; return 0; })();
      if (before !== pts(m)) prevPts[key] = {before, after: pts(m), pv, v: m.v};
    });
    const keys = Object.keys(prevPts);
    if (keys.length) {
      changeLine = '差異來自' + keys.map(k => {
        const c = prevPts[k];
        return `${esc(k.replace(/（.*/, ''))}（${esc(c.pv)} → ${esc(c.v)}，${esc(c.before)} 分 → ${esc(c.after)} 分）`;
      }).join('、') + '。';
    } else if (typeof PREVC.score === 'number' && PREVC.score === CHAPTER.score) {
      changeLine = '七項得分與上一期相同。';
    }
  }

  // 排序看「離下一階門檻多遠」，不是看能加幾分——保留率從 0 起跳，實務上最遠
  const distance = g => {
    if (g.m.low) return g.m.v <= g.th ? 0 : (g.m.v - g.th) / Math.max(g.m.v, 1);
    return g.th > 0 ? Math.max(0, (g.th - g.m.v) / g.th) : 1;
  };
  gaps.sort((x, y) => distance(x) - distance(y));
  const cheapest = gaps[0];
  const toGreen = GREEN - total;

  $id('chapterPanel').innerHTML = `
    <div class="cbox">
      <h3>目前與綠燈分會的差距</h3>
      <p class="sub">依 BNI 官方《分會紅綠燈計算方式》七項逐格對出來的：
        華都更 <b>${total} 分</b>，七項中 ${O.filter(m => pts(m) === maxOf(m)).length} 項已達滿分。
        ${PREVC && typeof PREVC.score === 'number'
          ? `上一期 ${PREVC.score} 分，本期 ${CHAPTER.score} 分。${changeLine}` : ''}</p>
      ${toGreen > 0 && cheapest ? `
      <div class="target" style="border-bottom:0;padding-top:4px">
        <span class="target-num" style="background:var(--green-line)">→</span>
        <div>
          <p class="target-h">${esc(cheapest.m.k.replace(/（.*/, ''))}達 ${esc(cheapest.th)}${esc(cheapest.unit === '%' ? '%' : ' '+cheapest.unit)} 以上 → 總分 ${esc(total + cheapest.gain)} 分${total + cheapest.gain >= GREEN ? '（綠燈）' : ''}</p>
          <p class="target-b">${cheapest.need}。<br>
            距綠燈門檻 70 分還差 <b>${toGreen} 分</b>，可加分的項目共 ${gaps.length} 項，列於下方。</p>
        </div>
      </div>` : `<p class="ok-note">已達綠燈分會門檻。</p>`}
    </div>

    <div class="cbox">
      <h3>七項逐格對照</h3>
      <div class="ctable-wrap"><table class="ctable">
        <thead><tr><th>官方指標</th><th style="text-align:right">我們的數字</th><th>落在哪一格</th><th style="text-align:right">得分</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="sub" style="margin:14px 0 0">滿分 100 分（轉換率三階、最高 10 分，其餘六項各 15 分）。
        <b>70 分以上為綠燈分會。</b>現階段總分上限 ${ceilingNow} 分。</p>
    </div>

    ${gaps.length ? `
    <div class="cbox">
      <h3>可加分的項目</h3>
      ${gaps.map(g => `
      <div class="target">
        <span class="target-num" style="background:var(--amber-line)">+${g.gain}</span>
        <div>
          <p class="target-h">${esc(g.m.k.replace(/（.*/, ''))}：達 ${esc(g.th)}${esc(g.unit === '%' ? '%' : ' '+g.unit)} 可得 ${esc(pts(g.m) + g.gain)} 分</p>
          <p class="target-b">${g.need}。${
            g.m.k.indexOf('保留率') === 0
              ? '<br>分會成立未滿 12 個月，尚無會員符合此項計算條件，本期為 0。'
              : ''}</p>
        </div>
      </div>`).join('')}
    </div>` : ''}

    <div class="cbox">
      <h3>與個人分數的關聯</h3>
      <p class="sub">分會分數與個人分數是兩套算法，但<b>引薦與來賓兩項在兩邊都計分</b>。
        目前全分會 ${W} 週共 ${sumRG} 件引薦、${sumV} 位來賓；
        個人端「帶來賓」有得分的為 ${visWithScore} 人。</p>
    </div>

    <p class="caveat"><b>這頁的計分表是 BNI Accelerate 官方版本。</b>
      拿全區 25 個分會、兩個月共 50 筆實際資料回推驗證，<b>45 筆完全命中</b>，
      華都更 2026-06 的 70 分與 2026-07 的 65 分都逐項對得起來。
      （5 筆對不上的分會差 5～10 分，推測是區報告顯示的數字四捨五入後跨過門檻。）</p>`;
})();

/* ---------- 更新資料 ---------- */
$id('uploadPanel').innerHTML = `
  <div class="cbox">
    <h3>更新這個月的數字</h3>
    <p class="sub">主席、副主席、導師協調人皆可操作。<b>約 2 分鐘</b>，不需登入或密碼。</p>
    <div class="steps">
      <div class="step"><span class="step-n">1</span><span class="step-t">到 BNI 官方系統下載<b>會員成績表</b><small>不需開啟或修改檔案</small></span></div>
      <div class="step"><span class="step-n">2</span><span class="step-t">在下方選擇該檔<small>畫面會先顯示讀取結果供核對</small></span></div>
      <div class="step"><span class="step-n">3</span><span class="step-t">依《分會紅綠燈報告》填寫七項數字，按更新<small>僅分會七項需手動填寫，會員資料為自動解析</small></span></div>
    </div>
    <div class="note note-watch" style="margin-top:16px">
      <b>官方成績表還沒出來？</b>　可以先放 BNI 的 <b>PALMS 摘要報告</b>（.xls），系統會自動換算成「暫定換算版」。
      <br>・兩種檔都放在下面同一個框，<b>系統會自己認出是哪一種</b>，讀完會先告訴你。
      <br>・會員成績表 → 更新<b>官方版</b>；PALMS 摘要報告 → 只更新<b>暫定換算版</b>，官方版完全不會被動到。
      <br>・暫定版會出現在網頁頂端的切換鈕裡，並標明「正式分數以 LTnA 區域領導會議發布為準」。
      <br>・暫定版按週獨立保留；官方月報更新後仍可查看實際統計截止日。
      <br>・下載 PALMS 時，期間請選<b>以上週三為截止日的滾動六個月</b>；每週三更新，平均值仍以各會員實際計入週數計算。
    </div>
  </div>

  <div class="drop" id="dropZone">
    <div class="drop-icon">📄</div>
    <h3>選擇會員成績表或 PALMS 摘要報告</h3>
    <p>BNI 下載的會員成績表（.xlsx）或 PALMS 摘要報告（.xls）都可以，也可以直接把檔案拖進這個框</p>
    <div class="drop-row">
      <input type="file" id="fileInput" accept=".xlsx,.xls" hidden>
      <button class="btn ghost" id="pickFile">選擇檔案</button>
    </div>
    <p class="fake" id="fileMsg">還沒選檔案</p>
  </div>

  <div class="cbox" id="previewBox" hidden>
    <h3>讀到的內容</h3>
    <div id="previewBody"></div>
  </div>

  <div class="cbox" id="chapterBox" hidden>
    <h3>分會那七項</h3>
    <p class="sub" id="chapterNote">這七項不在會員成績表內，系統會自動去《分會紅綠燈報告》取得。取不到才需要自己填。</p>
    <div class="fgrid" id="chapterForm"></div>
    <fieldset id="submissionFields" hidden>
      <legend>PALMS 例會完成狀態</legend>
      <p class="sub">請另開 BNI Connect PALMS 管理核對；只有副主席已提交、狀態顯示「完成」，且出席報告含該週時，才能修改此紀錄。日期與查核來源會隨本次報告一起儲存。</p>
      <label for="submittedMeeting">已向 BNI Connect 核對的最新已提交例會日期</label>
      <input type="date" id="submittedMeeting">
      <label for="submissionSource">查核來源（系統頁面、查閱日期與完成狀態）</label>
      <input type="text" id="submissionSource" maxlength="1000" style="width:100%">
      <label><input type="checkbox" id="submissionConfirmed">我已核對 BNI Connect 顯示該週「完成」，且出席報告含該週</label>
    </fieldset>
    <div class="drop-row" style="margin-top:18px; justify-content:flex-start">
      <input class="pw" id="uploaderName" placeholder="你的名字（選填）" aria-label="上傳者姓名" style="width:190px">
      <button class="btn" id="doUpload">確認更新</button>
    </div>
    <p class="fake" id="uploadMsg" hidden></p>
  </div>

  <div class="cbox" id="leaveBox">
    <h3>退會的人</h3>
    <p class="sub" id="leaveNote">BNI 官方成績表不會把退會的人拿掉，要在這裡標。
      標了就不會出現在名單與統計裡，資料仍保留，隨時可以取消。</p>
    <div id="leaveList" class="leave-list"></div>
    <div class="drop-row" style="margin-top:16px; justify-content:flex-start">
      <button class="btn" id="doLeave">儲存</button>
    </div>
    <p class="fake" id="leaveMsg" hidden></p>
  </div>
`;

/* ---------- 上傳流程 ---------- */
const API = 'https://htl-api.vercel.app/api/upload';
const CHAPTER_API = 'https://htl-api.vercel.app/api/chapter';
const securityClient = createSecurityClient({
  fetchImpl: global.fetch && global.fetch.bind(global),
  documentObject: global.document,
  windowObject: global.window || global,
  apiUrl: API,
  configUrl: 'security-config.json'
});
let previewBaseRevision = null;
let leaveBaseRevision = null;
function waitForRetry(button, seconds, label) {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    button.disabled = false;
    button.textContent = label;
    return;
  }
  let remaining = Math.min(seconds, 3600);
  button.disabled = true;
  const tick = () => {
    if (remaining <= 0) {
      button.disabled = false;
      button.textContent = label;
      return;
    }
    button.textContent = `請等待 ${remaining} 秒`;
    remaining--;
    setTimeout(tick, 1000);
  };
  tick();
}
function addChapterAction(message, label, callback) {
  const box = $id('chapterSrc');
  box.textContent = String(message ?? '');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', callback);
  box.append(document.createTextNode(' '), button);
  return button;
}
async function showRevisionConflict(element) {
  element.textContent = '資料版本已變更，正在取得最新版本…';
  const latest = await securityClient.prepareRevision().catch(() => null);
  element.textContent = latest
    ? `資料版本已變更（${latest.slice(0, 8)}）。請重新載入頁面並重新預覽、確認後再送出。`
    : '資料版本已變更，請重新載入頁面並重新預覽、確認後再送出。';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = '重新載入並重新確認';
  reload.addEventListener('click', () => {
    if (global.location && typeof global.location.reload === 'function') global.location.reload();
  });
  element.append(document.createElement('br'), reload);
}
const CH_FIELDS = [
  {k:'score',      label:'分會得分',        hint:'本月'},
  {k:'prevScore',  label:'分會得分（上月）', hint:'上個月的分數'},
  {k:'size',       label:'分會大小',        hint:'月底回報的會員人數'},
  {k:'growth',     label:'會員成長 6 個月',  hint:'過去 6 個月的變化'},
  {k:'retention',  label:'保留率 %',        hint:'12 個月'},
  {k:'ref',        label:'每週引薦數',      hint:'每位會員每週'},
  {k:'vis',        label:'每週來賓數',      hint:'全分會每週'},
  {k:'conv',       label:'轉換率 %',        hint:'6 個月'},
  {k:'absent',     label:'缺席率 %',        hint:'越低越好'}
];
let parsedMembers = null;
let pendingPeriod = null;
let pendingRange = null;
let periodSource = '';
let chapterMeta = null;
let pendingKind = 'official';   // 'official'＝會員成績表，'palms'＝PALMS 摘要報告（換算成暫定版）
let palmsChapter = null;
const PROVISIONAL_TEXT = p => `每週三更新，採上週三截止的滾動六個月 PALMS 報告（${p}），沿用現有計分規則；正式分數以 LTnA 公布為準。`;

// 從成績表檔名抓計分月份，例如「…(2026-08).xlsx」「…2026年8月…」；抓不到就回上一個月
function periodFromFilename(name){
  let m = /(20\d{2})[-_./年\s]*(\d{1,2})\s*月?/.exec(name || '');
  if (m) {
    const mo = +m[2];
    if (mo >= 1 && mo <= 12) return +m[1] + ' 年 ' + mo + ' 月';
  }
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
}

(() => {
  const cur = {score: CHAPTER.score, prevScore: CHAPTER.prevScore};
  const MAP = {'分會大小':'size','會員成長':'growth','保留率':'retention',
               '會員每週引薦數':'ref','每週來賓數':'vis','轉換率':'conv','缺席率':'absent'};
  CHAPTER.official.forEach(m => { for (const pre in MAP) if (m.k.indexOf(pre) === 0) cur[MAP[pre]] = m.v; });
  $id('chapterForm').innerHTML = CH_FIELDS.map(f =>
    '<label class="fitem"><span class="flabel">' + f.label + '<small>' + f.hint + '</small></span>'
    + '<input class="finput" type="number" step="any" id="ch-' + f.k + '" value="' + cur[f.k] + '"></label>').join('');
})();

// 那七項去《分會紅綠燈報告》拿。對方晚發佈時端點會自動退回上一期，並回報 stale。
// PALMS 換算：能算的四項帶推算值，其餘三項沿用目前官方版，分會得分照官方計分表重算
function fillPalmsChapter(){
  const off = {score: CHAPTER.score};
  const MAP = {'分會大小':'size','會員成長':'growth','保留率':'retention',
               '會員每週引薦數':'ref','每週來賓數':'vis','轉換率':'conv','缺席率':'absent'};
  CHAPTER.official.forEach(m => { for (const pre in MAP) if (m.k.indexOf(pre) === 0) off[MAP[pre]] = m.v; });
  if (LATEST_OFFICIAL_CHAPTER) Object.assign(off, LATEST_OFFICIAL_CHAPTER.chapter);
  const v = Object.assign({}, off, palmsChapter);
  v.score = chapterScoreOf(v);
  v.prevScore = off.score;
  for (const f of CH_FIELDS){
    const el = $id('ch-' + f.k);
    if (el && typeof v[f.k] === 'number') el.value = v[f.k];
  }
  chapterMeta = {reportMonth: 'PALMS 推算（' + pendingPeriod + '）', stale: false};
  $id('chapterNote').innerHTML =
    '這七項是<b>推算的</b>：分會大小、每週引薦數、每週來賓數、缺席率由 PALMS 算出；'
    + '會員成長、保留率、轉換率 PALMS 沒有，<b>沿用官方 ' + esc(LATEST_OFFICIAL_CHAPTER?.period || CHAPTER.period) + '</b> 的數字；'
    + '分會得分照官方計分表重算，「上月」填的是官方 ' + esc(LATEST_OFFICIAL_CHAPTER?.period || CHAPTER.period) + ' 的分數。都可以手動改。';
}

async function fetchChapter(period){
  const note = $id('chapterNote');
  const m = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(period || '');
  if (!m) return;
  note.textContent = '正在取得分會那七項…';
  try {
    const r = await fetch(CHAPTER_API + '?year=' + m[1] + '&month=' + m[2]);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || '取不到');
    for (const f of CH_FIELDS){
      const el = $id('ch-' + f.k);
      if (el && typeof d.chapter[f.k] === 'number') el.value = d.chapter[f.k];
    }
    chapterMeta = {reportMonth: d.reportMonth, stale: !!d.stale, source: d.source};
    note.innerHTML = d.stale
      ? '⚠️ <b>' + esc(period) + '</b> 的分會報告還沒發佈，以下填的是 <b>' + esc(d.reportMonth)
        + '</b> 的數字。等對方發佈後再上傳一次就會更新，或直接改下面的欄位。'
      : '✅ 已自動帶入 <b>' + esc(d.reportMonth) + '</b> 的分會報告數字，核對一下即可。';
  } catch (e) {
    note.textContent = '取不到分會報告（' + e.message + '），下面七格請照《分會紅綠燈報告》自己填，欄位是上次的數值。';
  }
}

let sheetJSPromise = null;
function loadSheetJS(){
  if (window.XLSX) return Promise.resolve();
  if (sheetJSPromise) return sheetJSPromise;
  sheetJSPromise = new Promise((ok, bad) => {
    const el = document.createElement('script');
    el.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    const timer = setTimeout(() => fail(), 20000);
    function fail(){
      clearTimeout(timer); el.remove(); sheetJSPromise = null;
      bad(new Error('讀取試算表工具失敗，請檢查網路'));
    }
    el.onload = () => { if (!window.XLSX) return fail(); clearTimeout(timer); ok(); };
    el.onerror = fail;
    document.head.appendChild(el);
  });
  return sheetJSPromise;
}

const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

// PALMS 摘要報告：BNI 匯出的「分會 - PALMS摘要報告」，跟會員成績表欄位不同，要換算。
// 規則（2026-10-02 拿官方 8 月檔驗過會員分數 57 人零誤差、分會四項全對上）：
//   週數＝出席＋缺席＋病假＋替代人；提供引薦＝內部＋外部；收到引薦同理
//   分會指標用「總數」列（含已不在名單的人，官方也算他們）；沒有總數列才用名單加總＋「BNI」列來賓
function isPalms(rows){
  return rows.slice(0, 4).some(r => r && r.some(c => typeof c === 'string' && /PALMS/i.test(c)));
}
function palmsDate(v){
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const m = /(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(v || ''));
  return m ? pad(m[1], m[2], m[3]) : null;
}
function parsePalms(rows){
  const hi = rows.findIndex(r => r && r[0] === '姓氏' && r[1] === '名字');
  if (hi < 0) throw new Error('看起來是 PALMS 報告，但找不到「姓氏／名字」那一列');
  const H = rows[hi].map(h => String(h || '').trim());
  const col = name => { const i = H.indexOf(name); if (i < 0) throw new Error('PALMS 報告少了「' + name + '」欄'); return i; };
  const C = {P:col('出席'), A:col('缺席'), L:col('遲到'), Med:col('病假'), S:col('替代人'),
             RGi:col('提供內部引薦'), RGo:col('提供外部引薦'), RRi:col('收到內部引薦'), RRo:col('收到外部引薦'),
             V:col('來賓'), O2O:col('一對一會面'), TY:col('交易價值'), CEU:col('分會教育單位')};
  const n = (r, k) => num(typeof r[C[k]] === 'string' ? parseFloat(r[C[k]]) : r[C[k]]);
  const list = [];
  let total = null, bni = null;
  for (const r of rows.slice(hi + 1)){
    if (!r || r[0] == null) continue;
    const a = String(r[0]).trim();
    if (a === '總數') { total = r; continue; }
    if (a === 'BNI') { bni = r; continue; }
    if (a === '來賓') continue;
    const name = (a + String(r[1] || '').trim()).trim();
    if (name.length > 200) throw new Error('會員姓名超過 200 字元');
    const W = n(r,'P') + n(r,'A') + n(r,'Med') + n(r,'S');
    if (!name || W <= 0) continue;
    list.push([0, name, W, n(r,'P'), n(r,'A'), n(r,'L'), n(r,'Med'), n(r,'S'),
               n(r,'RGi') + n(r,'RGo'), n(r,'RRi') + n(r,'RRo'), n(r,'V'), n(r,'O2O'), n(r,'CEU'), n(r,'TY')]);
  }
  if (!list.length) throw new Error('PALMS 報告裡讀不到會員');
  // 照分數排名當編號，跟官方成績表一樣
  const sc = m => Object.values(scoreOf({weeks:m[2], A:m[4], RG:m[8], V:m[10], O2O:m[11], CEU:m[12], TYFCB:m[13]})).reduce((x, y) => x + y, 0);
  list.sort((x, y) => sc(y) - sc(x) || x[1].localeCompare(y[1]));
  list.forEach((m, i) => m[0] = i + 1);

  let from = null, to = null;
  for (const r of rows.slice(0, hi)){
    if (!r) continue;
    const v = r.slice(1).find(c => c != null && c !== '');   // 日期放在合併儲存格後面那一格，不一定是第 2 欄
    if (/^從/.test(String(r[0] || ''))) from = palmsDate(v);
    if (/^至/.test(String(r[0] || ''))) to = palmsDate(v);
  }
  const range = from && to ? {start: from, end: to, endYear: +to.slice(0, 4), endMonth: +to.slice(5, 7)} : null;

  // 分會指標：能從 PALMS 算的四項用推算值，其餘沿用目前官方版（fillPalmsChapter）
  const W = Math.max(...list.map(m => m[2]));
  const sum = i => list.reduce((s, m) => s + m[i], 0);
  const tot = total
    ? {P: n(total,'P'), A: n(total,'A'), Med: n(total,'Med'), S: n(total,'S'),
       RG: n(total,'RGi') + n(total,'RGo'), V: n(total,'V')}
    : {P: sum(3), A: sum(4), Med: sum(6), S: sum(7), RG: sum(8), V: sum(10) + (bni ? n(bni,'V') : 0)};
  const r2 = v => Math.round(v * 100) / 100;
  palmsChapter = {size: list.length, ref: r2(tot.RG / list.length / W), vis: r2(tot.V / W),
                  absent: r2(tot.A / (tot.P + tot.A + tot.Med + tot.S) * 100)};
  return {sheet: 'PALMS 摘要報告', members: list, range, kind: 'palms'};
}

// 分會七項 → 分會得分（BNI 官方計分表，與「怎麼上綠燈分會」同一份 tiers）
function chapterScoreOf(v){
  const MAP = {'分會大小':'size','會員成長':'growth','保留率':'retention',
               '會員每週引薦數':'ref','每週來賓數':'vis','轉換率':'conv','缺席率':'absent'};
  return CHAPTER.official.reduce((s, m) => {
    const k = MAP[Object.keys(MAP).find(pre => m.k.indexOf(pre) === 0)];
    const x = v[k];
    const t = m.low ? m.tiers.find(([th]) => x < th) : m.tiers.find(([th]) => x >= th - 1e-9);
    return s + (t ? t[1] : 0);
  }, 0);
}

function parseWorkbook(wb){
  if (!wb || !Array.isArray(wb.SheetNames) || wb.SheetNames.length === 0 || wb.SheetNames.length > 50 ||
      wb.SheetNames.some(name => typeof name !== 'string' || name.length > 128)) {
    throw new Error('工作表數量或名稱不符合限制');
  }
  const rowsFromSheet = name => {
    const sheet = wb.Sheets && wb.Sheets[name];
    if (!sheet) throw new Error('找不到工作表');
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      if (range.e.r - range.s.r + 1 > 5000 || range.e.c - range.s.c + 1 > 100) {
        throw new Error('工作表超過 5000 列或 100 欄');
      }
    }
    const rows = XLSX.utils.sheet_to_json(sheet, {header: 1, defval: null, raw: true});
    if (!Array.isArray(rows) || rows.length > 5000 || rows.some(row => Array.isArray(row) && row.length > 100)) {
      throw new Error('工作表超過 5000 列或 100 欄');
    }
    return rows;
  };
  {
    const first = rowsFromSheet(wb.SheetNames[0]);
    if (isPalms(first)) return parsePalms(first);
  }
  const name = wb.SheetNames.find(n => /traffic|紅綠燈/i.test(n)) || wb.SheetNames[0];
  const rows = rowsFromSheet(name);
  const out = [];
  for (const r of rows){
    if (!r) continue;
    const no = r[0], nm = r[1];
    if (typeof no !== 'number' || !nm || typeof nm !== 'string' || !nm.trim()) continue;
    const memberName = nm.trim();
    if (memberName.length > 200) throw new Error('會員姓名超過 200 字元');
    out.push([no, memberName, num(r[3]), num(r[12]), num(r[13]), num(r[14]), num(r[15]), num(r[16]),
              num(r[17]), num(r[18]), num(r[19]), num(r[20]), num(r[21]), num(r[22])]);
  }
  return {sheet: name, members: out, range: findRangeInRows(rows), kind: 'official'};
}

// 成績表表頭有「2026-03-01 - 2026-08-31 (6個月)」這行，優先採用它
function findRangeInRows(rows){
  for (let i = 0; i < Math.min(rows.length, 12); i++){
    const r = rows[i]; if (!r) continue;
    for (const cell of r){
      if (typeof cell !== 'string') continue;
      const m = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\s*[-–~至]\s*(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(cell);
      if (m) return {start: pad(m[1],m[2],m[3]), end: pad(m[4],m[5],m[6]),
                     endYear: +m[4], endMonth: +m[5]};
    }
  }
  return null;
}
function pad(y,m,d){ return y + '-' + String(+m).padStart(2,'0') + '-' + String(+d).padStart(2,'0'); }

async function handleFile(file){
  const msg = $id('fileMsg');
  parsedMembers = null;
  previewBaseRevision = null;
  const uploadButton = $id('doUpload');
  uploadButton.disabled = true;
  $id('previewBox').hidden = true;
  $id('chapterBox').hidden = true;
  if (!file || !Number.isFinite(file.size) || file.size > 5 * 1024 * 1024) {
    msg.textContent = '檔案不能超過 5 MB。';
    return;
  }
  msg.textContent = '讀取中…';
  try {
    await loadSheetJS();
    const buf = await file.arrayBuffer();
    const parsed = parseWorkbook(XLSX.read(buf, {type: 'array'}));
    if (settings.uploadOnly && parsed.kind !== 'palms') throw new Error('請選擇 BNI Connect 下載的 PALMS 概要報告。');
    if (parsed.kind === 'palms') {
      WeeklyPeriod.validate(parsed.range);
      WeeklyPeriod.preventRollback(parsed.range, CH.est?.chapter || CH);
    }
    const members = parsed.members;
    if (members.length < 10) throw new Error('只讀到 ' + members.length + ' 位會員，這可能不是會員成績表');
    parsedMembers = members;
    pendingKind = parsed.kind;
    if (parsed.range){
      pendingPeriod = parsed.range.endYear + ' 年 ' + parsed.range.endMonth + ' 月';
      pendingRange  = parsed.range.start + ' – ' + parsed.range.end;
      periodSource  = parsed.kind === 'palms' ? 'PALMS 報告內的期間' : '成績表內的計分期間';
    } else {
      pendingPeriod = periodFromFilename(file.name);
      pendingRange  = rangeFromPeriod(pendingPeriod);
      periodSource  = /20\d{2}/.test(file.name) ? '檔名' : '推算（檔名沒有月份，帶上一個月）';
    }
    msg.textContent = '已讀取 ' + file.name;

    const top = members.slice(0, 3).map(m => m[1].split(/[\s（(]/)[0] + '（第 ' + m[0] + ' 位）').join('、');
    const kindNote = parsed.kind === 'palms'
      ? '<div class="note note-watch" style="margin:0 0 12px"><b>這是 PALMS 摘要報告</b>，不是官方會員成績表。'
        + '<br>會換算成「<b>暫定換算版</b>」，放在網頁頂端的切換鈕裡；<b>官方版不會被動到</b>。'
        + '<br>正式分數仍以 LTnA 區域領導會議發布的會員紅綠燈為準。</div>'
      : '<div class="note note-ok" style="margin:0 0 12px"><b>這是官方會員成績表</b>，會更新<b>官方版</b>。</div>';
    $id('previewBody').innerHTML = kindNote +
      '<p class="target-b" style="margin:0 0 12px">從「' + esc(parsed.sheet) + '」' + (parsed.kind === 'palms' ? '' : '分頁') + '讀到 <b>'
      + members.length + ' 位會員</b>，計分週數 <b>' + members[0][2] + ' 週</b>。<br>前三位是：'
      + esc(top) + '。<br>計分月份：<b>' + esc(pendingPeriod) + '</b>　計分期間 <b>' + esc(pendingRange) + '</b>'
      + '<br><span style="color:var(--text-2)">（月份取自' + esc(periodSource) + '）</span>'
      + '<br>核對無誤後，於下方填寫七項數字並按更新。</p>'
      + '<p id="previewRevision" class="sub">正在取得資料版本…</p>';
    if (settings.uploadOnly) {
      $id('previewBody').textContent = '共 ' + members.length + ' 位會員，' + members[0][2] + ' 週；報告查詢期間 ' + pendingRange + '。查詢截止日不代表該日例會已提交；最新已提交例會日期預設沿用已確認紀錄；如有新實證，請在下方填寫日期、查核來源並勾選確認。';
      const revisionNote = document.createElement('p');
      revisionNote.id = 'previewRevision';
      revisionNote.className = 'sub';
      revisionNote.textContent = '正在取得資料版本…';
      $id('previewBody').append(revisionNote);
    }
    $id('previewBox').hidden = false;
    $id('chapterBox').hidden = false;
    $id('submissionFields').hidden = parsed.kind !== 'palms';
    $id('chapterBox').scrollIntoView({behavior: 'smooth', block: 'start'});
    const upBtn = $id('doUpload');
    if (parsed.kind === 'palms') {
      upBtn.textContent = settings.uploadOnly ? '確認更新最新週期統計' : '放進暫定換算版';
      fillPalmsChapter();
    } else {
      upBtn.textContent = '確認更新';
      fetchChapter(pendingPeriod);
    }
    securityClient.prepareRevision().then(revision => {
      if (parsedMembers !== members) return;
      previewBaseRevision = revision;
      const note = $id('previewRevision');
      if (note) note.textContent = '預覽版本：' + revision.slice(0, 8);
      upBtn.disabled = false;
    }).catch(() => {
      if (parsedMembers !== members) return;
      previewBaseRevision = null;
      const note = $id('previewRevision');
      if (note) note.textContent = '無法取得資料版本，不能提交；請重新載入頁面後再預覽。';
      upBtn.disabled = true;
    });
  } catch (e) {
    parsedMembers = null; pendingKind = 'official';
    previewBaseRevision = null;
    pendingPeriod = null; pendingRange = null; periodSource = '';
    msg.textContent = '讀不到：' + e.message;
    $id('previewBox').hidden = true;
    $id('chapterBox').hidden = true;
  }
}

const initialSubmission = WeeklyPeriod.submissionEvidence(CH.est?.chapter || CH);
$id('submittedMeeting').value = initialSubmission.lastSubmittedMeeting || '';
$id('submittedMeeting').max = WeeklyPeriod.latestWednesday();
$id('submissionSource').value = initialSubmission.lastSubmittedMeetingSource || '';
function selectedSubmissionEvidence(){
  return WeeklyPeriod.uploadEvidence(CH.est?.chapter || CH, {
    lastSubmittedMeeting:$id('submittedMeeting').value,
    lastSubmittedMeetingSource:$id('submissionSource').value.trim()
  }, $id('submissionConfirmed').checked);
}

/* ---------- 標記退會 ---------- */
// 官方成績表不會把退會的人拿掉（實例：楊淑媛 2026-07-28 退會，8 月成績表仍列在編號 55），
// 所以由分會自己勾。勾了就不列入名單與統計，但資料留著，取消勾選就回來。
function renderLeaveList(){
  const box = $id('leaveList');
  if (!box) return;
  if (!ALL.length) {
    box.innerHTML = '<p class="empty" style="padding:8px">還沒有會員資料，先上傳一次成績表。</p>';
    return;
  }
  box.innerHTML = ALL.slice()
    .sort((a, b) => a.no - b.no)
    .map(m => `<label class="leave-item${m.hasLeft ? ' on' : ''}">
        <input type="checkbox" data-leave="${esc(m.name)}"${m.hasLeft ? ' checked' : ''}>
        <span class="lno">#${m.no}</span><span>${esc(m.shortName)}</span>
      </label>`).join('');
}

$id('leaveList').addEventListener('change', e => {
  const cb = e.target.closest('[data-leave]');
  if (cb) cb.closest('.leave-item').classList.toggle('on', cb.checked);
});

$id('doLeave').addEventListener('click', async () => {
  const btn = $id('doLeave');
  const msg = $id('leaveMsg');
  msg.hidden = false;
  if (!leaveBaseRevision) {
    msg.textContent = '沒有可用的資料版本，不能儲存；請重新載入頁面並重新確認名單。';
    return;
  }
  const picked = [...$qa('#leaveList [data-leave]')]
    .filter(cb => cb.checked).map(cb => cb.dataset.leave);
  if (picked.length >= ALL.length) {
    msg.textContent = '不能把所有人都標成退會。'; return;
  }
  btn.disabled = true; btn.textContent = '儲存中…';
  msg.textContent = '正在儲存，請不要關掉這一頁…';
  try {
    const chapter = Object.assign({}, CH, {period: CHAPTER.period});
    const {response, data} = await securityClient.postProtected(
      {chapterOnly: true, chapter, leftMembers: picked, uploadedBy: ''}, leaveBaseRevision);
    const failure = showWriteFailure(response, data, msg);
    if (failure) {
      if (failure.status === 409) {
        leaveBaseRevision = null;
        btn.disabled = true;
        btn.textContent = '請重新載入頁面';
        await showRevisionConflict(msg);
      } else if (failure.status === 429) {
        waitForRetry(btn, failure.retryAfter, '儲存');
      } else {
        btn.disabled = false;
        btn.textContent = '儲存';
      }
      return;
    }
    msg.textContent = picked.length
      ? `✅ 已標記 ${picked.length} 位退會，他們不會再出現在名單與統計裡。重新整理這一頁就會看到。`
      : '✅ 已清空退會標記，所有人都會列入。重新整理這一頁就會看到。';
    btn.textContent = '已儲存';
  } catch (e) {
    msg.textContent = '儲存失敗：' + e.message + '　資料沒有被改動，可以再試一次。';
    btn.disabled = false; btn.textContent = '儲存';
  }
});

renderLeaveList();
if (!VIEW.est && !settings.compact && !settings.uploadOnly) {
  $id('doLeave').disabled = true;
  securityClient.prepareRevision().then(revision => {
    leaveBaseRevision = revision;
    $id('doLeave').disabled = false;
  }).catch(() => {
    leaveBaseRevision = null;
    const msg = $id('leaveMsg');
    msg.hidden = false;
    msg.textContent = '無法取得資料版本，不能儲存；請重新載入頁面並重新確認名單。';
  });
}

$id('pickFile').addEventListener('click', () => $id('fileInput').click());
$id('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handleFile(file);
});
const dz = $id('dropZone');
['dragover','dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; }));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = ''; }));
dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

$id('doUpload').addEventListener('click', async () => {
  const btn = $id('doUpload');
  const msg = $id('uploadMsg');
  msg.hidden = false;
  if (!parsedMembers) { msg.textContent = '還沒選檔案。'; return; }
  if (!previewBaseRevision) {
    msg.textContent = '沒有可用的資料版本，不能提交；請重新載入頁面後再預覽。';
    btn.disabled = true;
    return;
  }
  const chapter = {};
  for (const f of CH_FIELDS){
    const v = parseFloat($id('ch-' + f.k).value);
    if (!isFinite(v)) { msg.textContent = '「' + f.label + '」沒有填數字。'; return; }
    chapter[f.k] = v;
  }
  chapter.period = pendingPeriod || CHAPTER.period;
  if (pendingRange) chapter.range = pendingRange;
  if (chapterMeta) {
    chapter.chapterMonth = chapterMeta.reportMonth;   // 那七項來自哪一期的分會報告
    chapter.chapterStale = chapterMeta.stale;
  }
  chapter.chapterFetchedAt = new Date().toISOString();
  const isP = pendingKind === 'palms';
  const who = $id('uploaderName').value.trim();
  let payload;
  if (isP) {
    const dates = pendingRange.match(/\d{4}-\d{2}-\d{2}/g);
    let verifiedSubmission;
    try {
      verifiedSubmission = selectedSubmissionEvidence();
      WeeklyPeriod.validateUpload({start:dates[0],end:dates[1]}, verifiedSubmission, new Date(), CH.est?.chapter || CH);
    }
    catch (error) { msg.textContent = error.message; return; }
    chapter.asOf = dates[1];
    chapter.frequency = 'weekly';
    // Store separately verified evidence atomically with the report. The file
    // range never populates the submission date or verification controls.
    Object.assign(chapter, verifiedSubmission);
    chapter.officialBaseline = LATEST_OFFICIAL_CHAPTER?.period || CHAPTER.period;
    chapter.provisional = PROVISIONAL_TEXT(pendingRange ? pendingRange.replace(' – ', ' 至 ') : chapter.period);
    // 官方那七項原封不動，暫定版整包掛在 est 底下
    const official = Object.assign({}, CH);
    delete official.est;
    official.est = {updatedAt: new Date().toISOString(), uploadedBy: who, chapter, members: parsedMembers};
    payload = {chapterOnly: true, chapter: official, uploadedBy: who ? who + '（PALMS 換算版）' : 'PALMS 換算版'};
  } else {
    // 官方檔上傳後，比它舊或同月的暫定版就沒用了；比它新的暫定版才留著
    const ymOf = x => { const m = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(x || ''); return m ? +m[1] * 12 + +m[2] : 0; };
    if (CH.est?.chapter) chapter.est = CH.est;
    payload = {members: parsedMembers, chapter, uploadedBy: who};
  }
  btn.disabled = true; btn.textContent = '更新中…';
  msg.textContent = '正在寫入，請不要關掉這一頁…';
  try {
    const {response, data} = await securityClient.postProtected(payload, previewBaseRevision);
    const failure = showWriteFailure(response, data, msg);
    if (failure) {
      if (failure.status === 409) {
        previewBaseRevision = null;
        btn.disabled = true;
        btn.textContent = '請重新載入頁面';
        await showRevisionConflict(msg);
      } else if (failure.status === 429) {
        waitForRetry(btn, failure.retryAfter, settings.uploadOnly
          ? '確認更新最新週期統計' : (pendingKind === 'palms' ? '放進暫定換算版' : '確認更新'));
      } else {
        btn.disabled = false;
        btn.textContent = settings.uploadOnly
          ? '確認更新最新週期統計' : (pendingKind === 'palms' ? '放進暫定換算版' : '確認更新');
      }
      return;
    }
    const doneMessage = isP
      ? '✅ 已放進「暫定換算版」，' + parsedMembers.length + ' 位會員。官方版沒有被動到。'
        + '\n30 秒後重新整理，在網頁頂端按「暫定換算版」就看得到。'
      : '✅ ' + String(data.message ?? '').slice(0, 500)
        + '\n這一頁 30 秒後重新整理就會看到新的數字。';
    msg.textContent = doneMessage;
    if (settings.uploadOnly) {
      msg.textContent = '已更新 ' + parsedMembers.length + ' 位會員的最新週期統計。網站發布約需 1 分鐘。';
      const link = document.createElement('a');
      link.href = './?v=est';
      link.textContent = '返回最新週期統計';
      msg.append(document.createElement('br'), link);
    }
    btn.textContent = '已更新';
  } catch (e) {
    msg.textContent = '更新失敗：' + e.message + '　資料沒有被改動，可以再試一次。';
    btn.disabled = false;
    btn.textContent = settings.uploadOnly
      ? '確認更新最新週期統計' : (pendingKind === 'palms' ? '放進暫定換算版' : '確認更新');
  }
});

$q('.tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (!t) return;
  $qa('.tab').forEach(x => {
    const on = x === t;
    x.setAttribute('aria-selected', on);
    $id(x.getAttribute('aria-controls')).hidden = !on;
  });
});

// 暫定版只供瀏覽：更新資料與退會標記都會寫進官方資料，必須在官方版操作
if (VIEW.est) {
  const up = $id('uploadPanel');
  [...up.children].forEach(el => el.hidden = true);
  up.insertAdjacentHTML('afterbegin', '<div class="cbox"><p class="sub" style="margin:0">'
    + '現在看的是<b>暫定換算版</b>。要上傳成績表或標記退會，請先切回 <a href="./dashboard.html">原始資料管理</a>。</p></div>');
}

if (settings.uploadOnly) {
  const panel = $id('p-upload');
  panel.hidden = false;
  panel.removeAttribute('role');
  panel.removeAttribute('aria-labelledby');
  root.replaceChildren(panel);
  $q('#uploadPanel > .cbox').remove();
  $id('leaveBox').remove();
  $q('#dropZone h3').textContent = '選擇 PALMS 概要報告';
  $q('#dropZone > p').textContent = '選擇從 BNI Connect 下載的 .xls 或 .xlsx 檔案，或拖曳到這裡。';
  $q('#previewBox h3').textContent = '核對資料';
  $q('#chapterBox h3').textContent = '確認更新';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '查看或調整分會指標';
  details.append(summary, $id('chapterForm'));
  $id('chapterNote').after(details);
}
  }

  return {mount, createSecurityClient, describeWriteFailure, showWriteFailure, confirmAndPostChapterUpdate};
});
