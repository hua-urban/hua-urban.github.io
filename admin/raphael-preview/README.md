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

圖像未重新生成。修正分層旋轉造成的羽翼裂縫：僅渲染一張完整透明圖，以 SVG `feDisplacementMap` 與 `wing-field.svg` 的連續漸層做水平展翼。中央身體與權杖維持中性色位移場，底座逐漸歸零；位移場向四周延伸 300px，避免負向變形時採樣到透明邊界產生碎片。無羽翼裁切、拼接或身體扣除遮罩。

JavaScript 每秒最多更新 30 次，4 秒完成開合，位移 scale 在 -80～120 間變化。保留小幅浮動與暖色光暈，不使用額外動畫套件。離開畫面或分頁進入背景時暫停；`prefers-reduced-motion: reduce` 將位移歸零並停用 CSS 動畫。沒有吉祥物控制按鈕或說明。

## 模擬範圍與驗證

這是公開靜態快照，不載入 `site-content.js` 或試算表設定，不讀取私人來源、不呼叫後端、不進行寫入。目錄搜尋與分類由複製的原始目錄程式在瀏覽器操作。它不能代表正式服務的登入、權限或業務流程已驗收；連結仍由原服務處理。

已執行重建與 JavaScript 語法檢查。羽翼接縫是渲染後的視覺問題，採瀏覽器連續截圖檢查完整週期及張開／收合端點；不以 DOM 結構檢查代替視覺驗收。正式管理中心未修改；發布範圍僅限獨立預覽頁。
