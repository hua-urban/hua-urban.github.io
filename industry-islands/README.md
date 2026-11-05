# 華都更產業群島

正式總覽：https://hua-urban.com/industry-islands/

## 原始碼與發布

唯一正式來源為 `hua-urban/hua-urban.github.io` 的 `industry-islands/`。沿用現有 GitHub Pages：`master` 分支、根目錄 `/`、自訂網域 `hua-urban.com`；純靜態，不新增帳戶、資料庫、AI API 或部署服務。建議 feature branch → PR 審閱 → merge master → 確認 Pages build 和公開網址。官網既有資料同步 workflow 不變。

個人頁 `/resources` 成果卡連到本官網，交接見 `../docs/industry-islands-handoff.md`。原 ChatGPT Sites B/D/E 網址暫保留，不與此倉庫自動同步；後續請集中維護官網版。

## 檔案

- `index.html`：群島總覽、五組架構與跨組需求直達入口。
- `cross-group.js`、`cross-group.css`：四島共用切換、展開式群島總覽與跨組卡片。
- `a/`、`b/`、`d/`、`e/`：各組獨立 HTML、style、data、app、scene、企劃。
- `data.js`：八主題、服務、夥伴、需求提問、協作情境。
- `scene.js`：各組不同岸線、位置、建築、地標、配色與動態；保留 createIsland 控制器。
- `app.js`：URL topic 選取、日夜、暫停、導覽、減少動態及需求提問。
- `lib/`：共用 Three.js 0.187.0、OrbitControls、MIT 授權。採 lib 名稱避免沿用 Jekyll 時 vendor 排除。更新需重新核對來源和安全公告。

三條跨組連線：D energy ↔ E industry；D leasing ↔ E land；D digital ↔ E ai。URL `?topic=<id>#explore` 選中主題，跨組在目前分頁整頁導航。

## 本機驗收

從倉庫根目錄執行，不需 npm install 或建置：

```sh
python3 -m http.server 8775 --bind 127.0.0.1
node scripts/check-industry-islands.mjs
```

預覽 `/industry-islands/`。跨組連結指向正式網址，因此發布後應實測完整跳轉。檢查三組八主題、B三情境／D四情境／E三情境、三條雙向連線、日夜／暫停／減少動態、手機無溢出。手機效能仍依實際裝置確認。

## 擴充及回復

新增 `c/` 的各組內容，再更新總覽和共用 groups.js 的 sites/routes。每組採獨立地形、位置和建築；內容完成、審閱及驗收後才啟用連結。預留位置不連到空頁。

不提交 Drive 原始逐字稿、私人聯絡、客戶識別資料或後台。分享與構想不當作共同實績，更新時同步來源和狀態。場景是協作示意。

回復使用 revert PR 撤銷 merge commit（squash 則撤銷該提交），合回 master 並確認 Pages build；不 force push。靜態網站無資料庫遷移。

B組於2026-11-05加入，內容依8/28、9/11、10/23簡報整理，14位夥伴依10/23所列。資源缺口與專業能力分別呈現，不採收入挑戰或個案數字作成效承諾。跨組導航集中在groups.js，cross-group.js負責介面。

2026-11-05新增A組地主改建協作島，依9/3、10/1、10/15組聚資料表重整。A三情境／八主題，新增A transition↔B assets、A construction↔D materials、A funding↔E finance三條雙向整頁連線。ABDE已開放，C保留；群島摘要由groups.js產生。
