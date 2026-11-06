# 後端網址更換檢查

正本在官網專案 `automation/backend-contracts.json`。網址更換時，先將舊部署識別碼加入 retired，並將 current 改為新端點；所有依賴服務與排程須在同一維護期間更新。

部署檢查會掃描目前版本的程式與 workflow，出現任何 retired 識別碼即失敗。即時核對會檢查培訓頁使用 current、後端可讀且名冊與中央名冊一致。跨專案檢查使用既有的唯讀存取憑證，核對各專案預設分支及 repository variables；權限不足與來源無法取得都算未完成，不會顯示通過。

```sh
node automation/check-backend-contracts.mjs --root . --source-only
node automation/check-backend-contracts.mjs --root .
BACKEND_AUDIT_TOKEN=... node automation/check-backend-contracts.mjs --github-all
```

憑證只從環境變數讀取，不貼入指令歷史。輸出只包含檔案／變數名稱、服務狀態與數量，不輸出命中的原始行或 Secret 值。報告請存於私有維護資料夾。

忽略 `.git`、依賴套件、歷史 evidence、測試 fixtures、Markdown／文字文件與登錄檔自身；因此這些檔案不能用來保存正式執行設定。正式程式、HTML、JSON、腳本與 GitHub workflow 均納入。

部署前使用 `--source-only`，避免更新尚未發布時以舊線上前端誤擋。部署後與每日跨專案檢查再執行完整即時核對。外部手動部署必須先執行相同指令，GitHub 檢查不會攔截任意人直接使用 Cloud Run、Apps Script 編輯器或其他雲端管理介面部署。

Secrets 隱藏值、Apps Script 使用者／文件屬性及其他雲端專案，無法由這個 GitHub 工作流程全面讀回；需保留專用的雲端查核步驟，不能宣稱全域自動保證。
