# 產業群島驗收與發布

功能修改或發布時才讀；純文件整理檢查引用與語意即可。沿用上層事件觸發的環境與資安規則。

## 本機驗收

從倉庫根目錄執行，不需 npm install 或建置。僅啟動必要的本機服務，記錄程序並於驗收後停止自己啟動的服務。

```sh
python3 -m http.server 8775 --bind 127.0.0.1
node scripts/check-industry-islands.mjs
node scripts/check-label-stability.cjs
node scripts/check-cat-locomotion.mjs
node scripts/check-cat-interactions.mjs
```

預覽 `/industry-islands/`。依改動選擇相關檢查；發布前確認整體核心流程：五組各八主題、A／B／C／E 各三情境、D 四情境、registry 雙向連線、日夜、暫停、減少動態及手機無溢出。手機效能仍依實際裝置確認。跨組連結指向正式網址，發布後實測完整跳轉。

修改 E 組模組時，同步核對 `index.html` 的 app 版本、`app.js` 的 scene 版本及受影響的模組引用，避免舊快取。貓咪移動與互動分別由對應兩支檢查驗證；標題穩定性檢查涵蓋真實模型、三種尺寸與完整一圈投影。

## 發布與回復

沿用 feature branch → PR 審閱 → merge master → 確認 Pages build 與公開網址。PR 說明來源、驗證及回復點；官網資料同步 workflow 不變。是否發布仍以當次授權為準。

發布後確認總覽、五島與雙向連線。只有成果入口網址改變時才更新個人頁；個人頁權限與操作見 [維運交接](industry-islands-handoff.md)。

回復使用 revert PR 撤銷 merge commit；squash 則撤銷該提交，合回 master 並確認 Pages build，不 force push。此靜態網站沒有資料庫遷移。
