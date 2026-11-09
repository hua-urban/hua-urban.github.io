# 服務目錄中的拉斐爾動畫模擬

此資料夾是獨立的 `/admin/raphael-preview/` 頁面，模擬現行管理中心服務目錄：頁首、服務文案、搜尋、分類與服務連結沿用 `admin/` 的靜態公開內容；僅將主視覺右側 BNI 圓章替換成裝飾性的拉斐爾。桌面保留約 310px 的獨立空間，窄螢幕移至主視覺文案下方，動畫不覆蓋服務卡片。沒有吉祥物控制項或預覽說明文案。

## 重建

在專案根目錄執行：

```sh
node scripts/build-raphael-layout-preview.mjs
```

腳本讀取 `admin/index.html`、`admin/admin.css`、`admin/admin.js` 與本資料夾的 `raphael.svg`，輸出 `index.html`、`directory.css`、`directory.js`。修改目錄內容後可重新執行，不應直接維護輸出副本。若來源關鍵結構改變，腳本會中止並要求調整擷取位置。

`mascot.css`、`mascot.js` 與 `raphael.svg` 是手工維護的動畫來源。SVG 直接嵌入 HTML，`mask-type` 放在外部 CSS；沒有 inline style 或 inline script，沿用嚴格 CSP 並將 `connect-src` 限制為 `none`。所有相對服務連結轉成 `https://hua-urban.com/admin/` 下的正式網址，點擊會前往實際服務及其原有登入流程。

## 動畫與素材

保留已確認的大羽翼寫實圖 `assets/raphael-grand-wings-v4.webp`，167,146 bytes，SHA-256：

```text
f5b4dab049a2e14cbefb087c52e91f66ba4c41972d1e659ccc56898afb5c41ec
```

圖像未重新生成或變形；SVG 重用同一透明 WebP，以分層遮罩做 2D 羽翼開合。左翼在 `+6deg / scaleX(.92)` 與 `-4deg / scaleX(1.03)` 間變化，右翼鏡像，週期 4 秒；另有小幅身體浮動、暖色光暈與 6 秒流光。靜止身體遮罩保留較寬的翼根重疊，降低開合時出現缺口的機會。舊 v3 圖保留供既有快取與回復。

此獨立模擬預設自動播放，並保留 `prefers-reduced-motion: reduce`：偏好減少動態時停用羽翼、浮動及流光，只保留靜態光暈。主代理已檢查現有瀏覽器並未啟用減少動態，原動畫不易察覺的原因是振幅只有 0.8 度；本次將振幅擴大為 10 度的開合範圍。未改動 OS、瀏覽器設定或正式管理中心。沒有閃爍、頻繁明暗切換或動畫套件；吉祥物離開畫面或分頁進入背景時暫停。

## 模擬範圍與驗證

這是公開靜態快照，不載入 `site-content.js` 或試算表設定，不讀取私人來源、不呼叫後端、不進行寫入。目錄搜尋與分類由複製的原始目錄程式在瀏覽器操作。它不能代表正式服務的登入、權限或業務流程已驗收；連結仍由原服務處理。

已執行重建、三個 JavaScript 檔的 `node --check`、素材與 Git 原檔位元組比對、相對連結與 inline script/style 靜態檢查。390px／1280px 版面及視覺動作由主代理另行瀏覽器驗收。正式管理中心未修改；發布範圍僅限獨立預覽頁。
