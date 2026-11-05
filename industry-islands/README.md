# 華都更產業群島

正式總覽：https://hua-urban.com/industry-islands/

## 原始碼與發布

唯一正式來源為 `hua-urban/hua-urban.github.io` 的 `industry-islands/`。沿用現有 GitHub Pages：`master` 分支、根目錄 `/`、自訂網域 `hua-urban.com`；純靜態，不新增帳戶、資料庫、AI API 或部署服務。建議 feature branch → PR 審閱 → merge master → 確認 Pages build 和公開網址。官網既有資料同步 workflow 不變。

個人頁 `/resources` 成果卡連到本官網，交接見 `../docs/industry-islands-handoff.md`。本次建立的D/E舊版ChatGPT Sites已刪除；正式成果集中維護於官網GitHub Pages。

## 檔案

- `index.html`：群島總覽、五組架構與跨組需求直達入口。
- `cross-group.js`、`cross-group.css`：五島共用切換、展開式群島總覽與跨組卡片。
- `a/`、`b/`、`c/`、`d/`、`e/`：各組獨立 HTML、style、data、app、scene、企劃。
- `data.js`：八主題、服務、夥伴、需求提問、協作情境。
- `scene.js`：各組不同岸線、位置、建築、地標、配色與動態；保留 createIsland 控制器。
- `app.js`：URL topic 選取、日夜、暫停、導覽、減少動態及需求提問。
- `lib/`：共用 Three.js 0.187.0、OrbitControls、MIT 授權。採 lib 名稱避免沿用 Jekyll 時 vendor 排除。更新需重新核對來源和安全公告。

跨組連線由groups.js統一管理；原D/E需求串聯保留，並加入A/B/C相關主題。URL `?topic=<id>#explore` 選中主題，跨組在目前分頁整頁導航。

## 本機驗收

從倉庫根目錄執行，不需 npm install 或建置：

```sh
python3 -m http.server 8775 --bind 127.0.0.1
node scripts/check-industry-islands.mjs
node scripts/check-label-stability.cjs
node scripts/check-cat-locomotion.mjs
node scripts/check-cat-interactions.mjs
```

預覽 `/industry-islands/`。跨組連結指向正式網址，因此發布後應實測完整跳轉。檢查五組各八主題、A/B/C/E各三情境與D四情境、registry中的雙向連線、日夜／暫停／減少動態、手機無溢出。手機效能仍依實際裝置確認。

## 擴充及回復

五組已開放；後續更新各組內容時，同步核對總覽和共用groups.js的sites/routes。每組採獨立地形、位置和建築；內容完成、審閱及驗收後才啟用連結。預留位置不連到空頁。

不提交 Drive 原始逐字稿、私人聯絡、客戶識別資料或後台。分享與構想不當作共同實績，更新時同步來源和狀態。場景是協作示意。

回復使用 revert PR 撤銷 merge commit（squash 則撤銷該提交），合回 master 並確認 Pages build；不 force push。靜態網站無資料庫遷移。

B組於2026-11-05加入，內容依8/28、9/11、10/23簡報整理，14位夥伴依10/23所列。資源缺口與專業能力分別呈現，不採收入挑戰或個案數字作成效承諾。跨組導航集中在groups.js，cross-group.js負責介面。

2026-11-05新增A組地主改建協作島，依9/3、10/1、10/15組聚資料表重整。A三情境／八主題，新增A transition↔B assets、A construction↔D materials、A funding↔E finance三條雙向整頁連線。新增當時ABDE已開放、C預留；目前五組均已開放，群島摘要由groups.js產生。

2026-11-05加入C組傳承安居協作島：依所提供介紹簡報與08/10、09/14紀錄整理八主題、三情境，09/28標示B組的混放資料未當作C組近況。C島採紫藤奶油色庭院、彎月海灣、住宅島與材料工作港。新增C finance↔E finance、C rental↔B assets、C owners↔A owners、C design↔D design、C supply↔E industry五條需求連結。個人首頁與LINE引流區僅E組保留。
