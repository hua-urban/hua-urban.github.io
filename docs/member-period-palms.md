# 個別會員 PALMS 起算

這是本機批次產生工具，不會上傳、提交 Git 或覆蓋網站資料。既有單一報告匯入流程保持原樣。正式更新端仍須防止一般單一報告覆蓋已核對的個別週期資料。

每人的起日取「滾動六個月起日、2026-05-01、會期清冊 latestCycleMonth 的月份首日」最晚者。latestCycleMonth 是 BNI Connect 清冊的會期起算月份，不推定實際入會日。每個必要起日都須有一份相同週三截止的 PALMS 原報告。每人的週數、出席、缺席、替代人、引薦、來賓、一對一、教育及交易價值整列取自同一份報告，不從六個月累計按比例縮減。

```sh
node scripts/build-member-period-palms.mjs PRIVATE_POLICY_JSON SOURCE_DATA_JSON ROSTER_JSON YYYY-MM-DD NEW_OUTPUT_JSON REPORT.xls ...
node --test scripts/member-period-palms.test.mjs scripts/greenlight-palms.test.mjs
```

PRIVATE_POLICY_JSON 使用本機非公開 `{members:[{memberNo,name,latestCycleMonth}]}`；ROSTER_JSON 使用既有 defaults.json。路徑以參數傳入，工具不把會期清冊或原始 XLS 複製到 repo。輸出必須是不存在的新檔，權限 0600；建議輸出至 repo 外的非公開資料夾。產生工具使用 repo 既有 XLSX 讀取器，沒有新增依賴。

缺少會員政策、姓名變動、重複姓名、缺報告、錯誤截止日期、非結算週三、來源數字無效或分母不符時，整批拒絕，不產生部分結果。來源截止須與既有 chapter.est.chapter.asOf 一致；不得對較新資料回滾。從其他管道取得的 source JSON 仍須在發布前重新核對其版本，工具不提供遠端併發鎖。

候選資料的 chapter.est.chapter.memberPeriodEvidence 記錄規則版本、共用截止、滾動起日、分會起日、各起日報告的 SHA-256 與使用人數、會員分派摘要雜湊和整批成績雜湊。它不含私有月份清冊、逐人起日、原報告檔名與本機路徑。持有原報告與私有清冊者可重跑驗證；雜湊本身不是第三方認證或 PALMS 已提交證明。

分會指標保留既有報告的期間與值，不能以不同個人期間的成績混算分會平均。共用 chapter.range 描述原有分會報告期間；個人成績的來源範圍由 memberPeriodEvidence 描述。原有顯示若只標示共用六個月期間，還須在使用個別成績的介面補充這項說明。

下次每週更新須重新提供當週所有必要起日的報告；隨滾動六個月起日往後，必要起日也會改變。缺一份就保留已發布資料並標示待更新。這個工具不會自行下載 BNI Connect 報告、推定副主席提交狀態或繞過網站更新保護。

## 從舊 baseline 準備當週單次提交

`build-weekly-member-payload.mjs` 支援舊 baseline，不必先以單一報告覆蓋網站。它讀取當週共同六個月 PALMS 重算分會大小、引薦、來賓與缺席率，從最新 `monthly.json` 繼承成長、保留率及轉換率並依既有級距重算分會得分。個人成績仍取各有效起日的獨立報告。新會員沒有私有會期紀錄時會停止，要求重新匯出 BNI Connect 會員會期報告，不能預填。

週次更新以當週共同 PALMS 的正週數明細與目前 roster 唯一配對，採共同報告顯示姓名；roster 中每人都必須有唯一明細。新會員具會期政策及來源報告即可加入，已不在目前 roster 的舊 baseline 列不會殘留。個別期間數字重建後，依現有會員計分規則重新排名，同分使用原有 `localeCompare` 姓名排序。共同報告的總數列、BNI 列及來賓列不當作會員。前述僅修正同一期數字的舊工具仍保留 baseline 順序；週次更新應使用此新 payload 工具。

```sh
node scripts/build-weekly-member-payload.mjs LOCAL_CONFIG_JSON NEW_PAYLOAD_JSON
node --test scripts/member-period-palms.test.mjs scripts/weekly-member-payload.test.mjs scripts/greenlight-palms.test.mjs
```

本機 config 欄位為 `sourcePath`、`policyPath`、`rosterPath`、`monthlyPath`、`commonPath`、`reportPaths`（陣列）、`baseRevision`、`uploadedBy`、`submission: {lastSubmittedMeeting,lastSubmittedMeetingSource}` 及 `confirmed: true`。確認值只能在實際核對 BNI Connect 完成狀態及該週出席報告後填入。config 與 payload 都應放在 repo 外非公開資料夾，不得用測試用確認資料產生正式提交。

`sourcePath` 必須保存 GitHub `traffic-light/data.json` blob 的原始位元組，`baseRevision` 使用同次預覽取得的 blob SHA。工具按 Git blob 格式重新計算 SHA-1；位元組與版本不符即拒絕，避免把新版本鎖搭配舊資料。GitHub Contents API 的 base64 content 解碼可取得原始位元組，重新 JSON 格式化會改變 SHA。

產生結果為既有更新 API 的一次 POST payload：`{baseRevision, chapterOnly:true, chapter, uploadedBy}`，不自行送出。核對的 `hua-urban/htl-api` `api/upload.js` 在 POST 讀取目前 GitHub blob SHA，比對 `baseRevision`，並在 Contents PUT 附同一 SHA，提供 CAS；衝突時應重新讀取並重建，不能只替換 payload 的 revision。

本機工具能驗證提交證據的格式、時序及明確確認，無法替代人員實際查閱 BNI Connect，也不能認證使用者填寫的來源真實性。沒有當週已提交證據時，應停止產生並保留線上既有資料。端到端寫入未執行。
