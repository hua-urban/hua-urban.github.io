# Greenlight 測試版資料同步

公開入口 `/greenlight-test/` 在同一分頁導向 Cloud Run 完整服務 `https://hua-greenlight-umydisxveq-de.a.run.app`，保留查詢參數與 hash。此目錄的 JSON 仍提供官網每週同步資料，Cloud Run 會讀取這些公開快照。BNI 帳密只送到 Cloud Run 同源 API。

GitHub Actions 每週三 10:00（台灣時間）執行 `greenlight-test-data-sync.yml`，從華都更公開網站更新測試版快照：

- 會員名冊：讀取官網首頁 `tr[data-n][data-p]` 名冊表格。
- PALMS 與月報：讀取官網 `/traffic-light/data.json`、`/traffic-light/monthly.json`，PALMS 只保留與現任名冊相符的會員列。
- 活動：使用官網首頁設定的 Apps Script「行事曆」資料來源，排除官網另有專區的例會與組聚，保留所有未來活動及最近五筆過去活動。

活動來源只提供活動資料，沒有實際出席者名單。同步時會把現任會員列為問卷候選人，填寫者自行勾選曾互動的會員；這些候選人不代表已確認出席。

若來源格式錯誤、名冊不足 40 人、PALMS 可配對資料不足 40 筆，或活動資料端點失敗，同步程式會停止，保留原快照。成功且檔案有變更時，Actions 會提交快照並呼叫 Pages 建置 API，因為 GITHUB_TOKEN 提交不會自動觸發 Pages 建置。沒有資料變更時不新增提交。

培訓報名紀錄目前是 `greenlight-test/training.json` 快照，來源為 `bni-train.autolab.cloud/explorer/`；它不屬於 `hua-urban.com` 的上述資料端點，也沒有納入這個週三工作流程。當前快照標示更新時間為 2026-10-15 20:09。教育分數仍只採用 PALMS 已入帳 CEU，不從報名筆數推算。
