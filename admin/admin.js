"use strict";

const SERVICES = [
  {
    title: "自動檢查狀態",
    category: "系統維護",
    description: "後端網址與各服務部署檢查；異常由華都更 LINE 小幫手通知資訊長。",
    use: [{label: "查看自動檢查結果", href: "./system-checks/"}],
    data: [{status: "約每15分鐘巡檢部署異常，每日11:43完整核對"}],
    maintenance: [{label: "資訊組更新日誌", href: "./updates/"}]
  },
  {
    title: "房地產協作平台",
    category: "會員與分組",
    description: "填報房屋或土地的整合、出租、出售與貸款活化需求；已填報的案件、圖片與媒合紀錄由授權人員登入管理。",
    use: [{ label: "會員需求填報", href: "https://hua-urban.com/property-platform/", showUrl: true }, { status: "填報完成頁與確認信會提供本次物件的專屬查看連結。" }],
    data: [{ label: "管理已填報案件、圖片與媒合紀錄", href: "https://hua-urban.com/admin/property-platform/", showUrl: true }, { status: "使用授權姓名＋Email 登入；案件資料不對一般會員或外部公開。" }],
    maintenance: [{ label: "建置與交接紀錄", href: "https://hua-urban.com/admin/updates/#property-platform-20261105", showUrl: true }, { label: "平台完整原始碼（私有 GitHub）", href: "https://github.com/hua-urban/huadu-property-platform", showUrl: true }, { status: "私有原始碼需既有 GitHub 權限。" }]
  },
  {
    title: "會員名單",
    category: "會員與分組",
    description: "使用姓名與 Email 登入，管理中央會員名冊、分組與官網內容。",
    use: [{ label: "會員與內容管理", href: "./members/" }],
    data: [{ label: "公開產業鏈分組頁", href: "https://hua-urban.com/bni-pt-groups/" }],
    maintenance: [{ label: "會員名單更新紀錄", href: "./updates/#member-registry-20261103" }, { status: "真實入會日待官方資料確認" }]
  },
  {
    title: "產業鏈分組",
    category: "會員與分組",
    description: "公開產業鏈分組名冊已上線，與官網會員資料使用同一中央來源；組長個別管理帳號仍待授權。",
    use: [{ label: "開啟產業鏈分組", href: "https://hua-urban.com/bni-pt-groups/" }],
    data: [{ status: "會員及分組資料由中央名冊同步" }],
    maintenance: [{ label: "分組系統更新紀錄", href: "./updates/#pt-registry-20261103" }, { label: "公開 GitHub 專案", href: "https://github.com/hua-urban/bni-pt-groups" }]
  },
  {
    title: "官網與活動牆",
    category: "活動與來賓",
    description: "華都更公開官網及活動資訊。公告、分會介紹、組聚時間與服務連結可由授權後臺編輯。",
    use: [{ label: "開啟華都更官網", href: "https://hua-urban.com/" }],
    data: [{ label: "編輯官網內容", href: "./members/#site" }],
    maintenance: [{ label: "公開官網原始碼", href: "https://github.com/hua-urban/hua-urban.github.io" }]
  },
  {
    title: "來賓報名",
    category: "活動與來賓",
    description: "來賓報名頁與報名紀錄管理。",
    use: [{ label: "開啟來賓報名", href: "https://hua-urban.com/guest/" }],
    data: [{ label: "來賓後台紀錄表", href: "https://docs.google.com/spreadsheets/d/1YYTsOkPYuFXCphzIADMTQqbifFPKTZbqbjDbNj5LBTk/edit#gid=2004818885" }],
    maintenance: [{ status: "登入後台後查看" }]
  },
  {
    title: "新人茶敘",
    category: "活動與來賓",
    description: "查看服務內容與目前提供的功能。",
    use: [{ label: "開啟新人茶敘", href: "https://hua-urban.com/huadu-tea/" }],
    data: [{ label: "新人茶敘後台紀錄表", href: "https://docs.google.com/spreadsheets/d/1hciQzhe8K8oN9gPpwHPNWk5nthdP2D7vHATrPsbe9tc/edit#gid=170565218" }],
    maintenance: [{ label: "公開 GitHub 專案", href: "https://github.com/hua-urban/huadu-tea" }]
  },
  {
    title: "培訓進度回報",
    category: "新人與培訓",
    description: "查看服務內容與目前提供的功能。",
    use: [{ label: "開啟培訓進度回報", href: "https://hua-urban.com/bni-training/" }],
    data: [{ status: "資料管理入口待核對" }],
    maintenance: [{ label: "公開 GitHub 專案", href: "https://github.com/hua-urban/bni-training" }]
  },
  {
    title: "新人保溫箱",
    category: "新人與培訓",
    description: "查看服務內容與目前提供的功能。",
    use: [{ label: "開啟新人保溫箱", href: "https://hua-urban.com/bni-warmbox/" }],
    data: [{ status: "資料管理入口待核對" }],
    maintenance: [{ label: "公開 GitHub 專案", href: "https://github.com/hua-urban/bni-warmbox" }]
  },
  {
    title: "紅綠燈統計",
    category: "紅綠燈與追綠光",
    description: "查看紅綠燈公開統計；PALMS 上傳仍由原入口處理。",
    use: [{ label: "開啟紅綠燈統計", href: "https://hua-urban.com/traffic-light/?v=est" }],
    data: [{ label: "PALMS 上傳入口", href: "https://hua-urban.com/traffic-light/upload.html" }],
    maintenance: [{ label: "PALMS 更新紀錄", href: "./updates/#palms-period-20261029" }, { label: "公開官網原始碼", href: "https://github.com/hua-urban/hua-urban.github.io" }]
  },
  {
    title: "追綠光",
    category: "紅綠燈與追綠光",
    description: "公開追綠光服務已上線，直接讀取官方最新 PALMS；維護紀錄由會員登入入口查看。",
    use: [{ label: "開啟追綠光", href: "https://hua-urban.com/greenlight/" }],
    data: [{ status: "直接使用官方最新 PALMS" }],
    maintenance: [{ label: "追綠光更新紀錄", href: "./updates/#greenlight-palms-20261028" }, { label: "維護紀錄（會員登入）", href: "./members/" }]
  },
  {
    title: "AI 應用問卷",
    category: "活動與來賓",
    description: "填寫 AI 應用需求問卷，或查看目前的統計結果。",
    use: [
      { label: "開啟 AI 應用問卷", href: "https://hua-urban.com/bni-ai-survey/" },
      { label: "開啟統計頁", href: "https://hua-urban.com/bni-ai-survey/stats.html" }
    ],
    data: [{ status: "管理資料入口待核對" }],
    maintenance: [{ label: "公開 GitHub 專案", href: "https://github.com/hua-urban/bni-ai-survey" }]
  },
  {
    title: "晨光抽獎",
    category: "活動與來賓",
    description: "查看服務內容與目前提供的功能。",
    use: [{ label: "開啟晨光抽獎", href: "https://hua-urban.com/lottery/" }],
    data: [{ status: "抽獎資料管理入口待核對" }],
    maintenance: [{ status: "登入後台後查看" }]
  },
  {
    title: "LINE 小幫手",
    category: "LINE 與系統維護",
    description: "LINE 官方帳號的日常使用及技術設定由各自的 LINE 平台管理。",
    use: [{ status: "官方帳號使用入口待核對" }],
    data: [{ label: "LINE Official Account Manager", href: "https://manager.line.biz/" }],
    maintenance: [{ label: "LINE Developers Console", href: "https://developers.line.biz/console/" }]
  },
  {
    title: "每週會員簡報",
    category: "週會與簡報",
    description: "每週簡報的協作入口尚待正式核對；本公開目錄不放簡報或雲端檔案連結。",
    use: [{ status: "簡報使用入口待核對" }],
    data: [{ status: "資料入口待核對" }],
    maintenance: [{ status: "維護入口待核對" }]
  },
  {
    title: "總簡報整合",
    category: "週會與簡報",
    description: "總簡報合併與 PDF 匯出作業。登入管理後台可查看簡報、來源資料與執行紀錄。",
    use: [{ status: "總簡報入口待核對" }],
    data: [{ status: "來源資料入口待核對" }],
    maintenance: [{ label: "簡報流程更新紀錄", href: "./updates/#pdf-workflow-20261028" }, { label: "登入查看執行紀錄", href: "./members/" }]
  },
  {
    title: "教育訓練跨分會查詢",
    category: "新人與培訓",
    description: "外部查詢服務；不屬於華都更管理後台。",
    use: [{ label: "開啟外部查詢服務", href: "https://bni-train.autolab.cloud/explorer/" }],
    data: [{ status: "外部服務資料由服務提供方管理" }],
    maintenance: [{ status: "非本會維護專案" }]
  },
  {
    title: "E 組九宮格",
    category: "會員與分組",
    description: "查看服務內容與目前提供的功能。",
    use: [{ label: "開啟 E 組九宮格", href: "https://hua-urban.com/e-team-grid/" }],
    data: [{ status: "資料管理入口待核對" }],
    maintenance: [{ label: "公開 GitHub 專案", href: "https://github.com/hua-urban/e-team-grid" }]
  },
  {
    title: "Power Team 舊服務",
    category: "會員與分組",
    description: "公開入口與專案可達；是否仍啟用、是否與產業鏈看板重複，尚待確認。",
    use: [{ label: "開啟 Power Team 舊服務（用途待確認）", href: "https://hua-urban.com/bni-powerteam/" }],
    data: [{ status: "封存／待確認" }],
    maintenance: [{ label: "公開 GitHub 專案（用途待確認）", href: "https://github.com/hua-urban/bni-powerteam" }]
  },
  {
    title: "部署與系統維護",
    category: "LINE 與系統維護",
    description: "官方管理平台根入口。登入後依帳號既有權限操作；此索引不代為授權。",
    use: [{ status: "非一般服務入口" }],
    data: [{ status: "平台內專案入口依授權查看" }],
    maintenance: [
      { label: "官網公開 GitHub 專案", href: "https://github.com/hua-urban/hua-urban.github.io" },
      { label: "Google Cloud Console", href: "https://console.cloud.google.com/" },
      { label: "Vercel Dashboard", href: "https://vercel.com/dashboard" }
    ]
  },
  {
    title: "資訊組更新日誌",
    category: "LINE 與系統維護",
    description: "依日期整理已上線服務、程式更新與待確認事項，只列業務摘要及公開提交證據。",
    use: [{ label: "查看資訊組更新日誌", href: "./updates/" }],
    data: [{ status: "公開更新摘要與查核來源" }],
    maintenance: [{ label: "會員登入入口", href: "./members/" }]
  }
];

const GROUPS = [
  ["use", "使用入口"],
  ["data", "管理資料"],
  ["maintenance", "維護系統"]
];

const listNode = document.getElementById("service-list");
const searchNode = document.getElementById("service-search");
const countNode = document.getElementById("result-count");
const emptyNode = document.getElementById("empty-state");
const filterNode = document.getElementById("category-filters");
let activeCategory = "all";

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEntries(entries, showUrls = false) {
  const list = makeElement("ul", "entry-list");
  entries.forEach((entry) => {
    const item = makeElement("li");
    if (entry.href) {
      const link = makeElement("a", "entry-link", entry.label);
      link.href = entry.href;
      if (entry.href.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      if (entry.showUrl || showUrls) {
        link.classList.add("entry-link-full");
        link.append(makeElement("span", "entry-url", entry.href));
      }
      item.append(link);
    } else {
      item.append(makeElement("span", "entry-status", entry.status || "待核對"));
    }
    list.append(item);
  });
  return list;
}

function renderService(service) {
  const card = makeElement("article", "service-card");
  const top = makeElement("div", "card-topline");
  const heading = makeElement("h3", "", service.title);
  const category = makeElement("span", "category-label", service.category);
  top.append(heading, category);
  card.append(top, makeElement("p", "service-description", service.description));

  const groups = makeElement("div", "entry-groups");
  GROUPS.forEach(([key, label]) => {
    const group = makeElement("section", "entry-group");
    group.append(makeElement("h4", "", label));
    group.append(renderEntries(service[key], service.siteServiceId === "propertyPlatform" || service.title === "房地產協作平台"));
    groups.append(group);
  });
  card.append(groups);
  return card;
}

function updateDirectory() {
  const query = searchNode.value.trim().toLocaleLowerCase("zh-Hant");
  const visible = SERVICES.filter((service) => {
    const categoryMatches = activeCategory === "all" || service.category === activeCategory;
    const searchable = [service.title, service.category, service.description]
      .concat(...GROUPS.map(([key]) => service[key].map((entry) => entry.label || entry.status)))
      .join(" ")
      .toLocaleLowerCase("zh-Hant");
    return categoryMatches && (!query || searchable.includes(query));
  });

  const fragment = document.createDocumentFragment();
  visible.forEach((service) => fragment.append(renderService(service)));
  listNode.replaceChildren(fragment);
  countNode.textContent = "顯示 " + visible.length + " 項服務";
  emptyNode.hidden = visible.length !== 0;
}

filterNode.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  filterNode.querySelectorAll("button[data-category]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  updateDirectory();
});

searchNode.addEventListener("input", updateDirectory);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchNode.focus();
  }
});

updateDirectory();


// Public display settings are maintained in the chapter spreadsheet.
if(window.HuaSiteContent){HuaSiteContent.load().then(function(data){HuaSiteContent.applyDirectory(SERVICES,data);updateDirectory();}).catch(function(){/* Retain the verified service defaults if the settings source is unavailable. */});}

