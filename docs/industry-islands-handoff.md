# 產業群島與個人頁交接

更新：2026-11-05（Asia/Taipei）。

訪客從劉羿岑個人頁 `/resources` 的成果卡，進入 `hua-urban.com/industry-islands/` 總覽，再選 b/、d/ 或 e/。成果原始碼與正式發布均在華都更既有 Git 倉庫，沿用 master/root GitHub Pages；個人頁只作展示入口，不另存一套成果程式。

## 維運入口

- 原始碼：https://github.com/hua-urban/hua-urban.github.io/tree/master/industry-islands
- 正式總覽：https://hua-urban.com/industry-islands/
- 個人頁：https://yitsen-sites.milkyhawk32.chatgpt.site/resources
- 個人頁仍由既有 Sites 發布；來源是 yitsen-sites-portal 專案 `dist/sites.json` 的三筆 category=bni 公開成果卡。新增入口後以 `node build-site.mjs` 及既有 Sites source workflow 發布。個人頁需要擁有者或合法編輯權限，華都更 repo 權限不自動授予個人頁權限。

維護群島只需正常 GitHub 協作權限送 PR，不需要 API 金鑰、共享個人 token 或密碼。Pages及網域沿用官網管理者設定。

## 更新與交接

1. feature branch 修改 industry-islands/ 對應內容與場景。
2. 執行 README 的語法、結構、桌機和手機核心流程檢查。
3. PR 說明內容來源、驗證與回復點；合併後確認 Pages build。
4. 檢查總覽、三島及各條雙向連線。網址不變時，個人頁無需重新發布。
5. 僅新增或更換成果入口時，才修改個人頁成果卡。

原 ChatGPT Sites D/E 網址暫保留且不自動同步。正式維運集中在華都更官網；若要退役舊址，另行決定轉址或停止發布。

## B組新增

2026-11-05在同一架構加入B組；不新增後端或獨立部署服務。B組內容企劃在industry-islands/b/project-brief.md，群島註冊及跨組對應集中在groups.js，A/C繼續預留。個人頁的群島總覽入口網址維持不變，即可找到B組。

## E組虎斑貓

2026-11-05新增原創低多邊形虎斑貓，僅於E組scene.js中建立角色並沿既有道路活動。概念參考readper/heart-island-me（MIT），未引入其使用者腳本、統計程式或角色捏人面板。無新增套件、外部素材、資料保存或控制按鈕；沿用既有暫停／減少動態。變更後同步更新E組index.html的app版本及app.js的scene版本，避免舊模組快取。

B/D/E同次更新為低角度預設自動導覽；按原有「自動導覽」可停止／恢復，手動拖曳會停止導覽。導覽與場景動作分開，系統減少動態初始不自動導覽。
