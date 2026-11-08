# 產業群島與個人頁交接

更新：2026-11-05（Asia/Taipei）。

訪客從劉羿岑個人頁 `/resources` 的成果卡，進入 `hua-urban.com/industry-islands/` 總覽，再選 a/、b/、c/、d/ 或 e/。成果原始碼與正式發布均在華都更既有 Git 倉庫，沿用 master/root GitHub Pages；個人頁只作展示入口，不另存一套成果程式。

## 維運入口

- 原始碼：https://github.com/hua-urban/hua-urban.github.io/tree/master/industry-islands
- 正式總覽：https://hua-urban.com/industry-islands/
- 個人頁：https://yitsen-sites.yitsenliuai.chatgpt.site/resources
- 個人頁仍由既有 Sites 發布；來源是 yitsen-sites-portal 專案 `dist/sites.json` 的三筆 category=bni 公開成果卡。新增入口後以 `node build-site.mjs` 及既有 Sites source workflow 發布。個人頁需要擁有者或合法編輯權限，華都更 repo 權限不自動授予個人頁權限。

維護群島只需正常 GitHub 協作權限送 PR，不需要 API 金鑰、共享個人 token 或密碼。Pages及網域沿用官網管理者設定。

## 更新與交接

1. feature branch 修改 industry-islands/ 對應內容與場景。
2. 執行 README 的語法、結構、桌機和手機核心流程檢查。
3. PR 說明內容來源、驗證與回復點；合併後確認 Pages build。
4. 檢查總覽、五島及各條雙向連線。網址不變時，個人頁無需重新發布。
5. 僅新增或更換成果入口時，才修改個人頁成果卡。

2026-11-05已依擁有者確認，永久刪除本次建立的D/E舊版ChatGPT Sites；正式維運集中在華都更GitHub Pages。

## B組新增

2026-11-05在同一架構加入B組；不新增後端或獨立部署服務。B組內容企劃在industry-islands/b/project-brief.md，群島註冊及跨組對應集中在groups.js，A/C繼續預留。個人頁的群島總覽入口網址維持不變，即可找到B組。

## E組虎斑貓

2026-11-05新增原創低多邊形虎斑貓，僅於E組scene.js中建立角色並沿既有道路活動。概念參考readper/heart-island-me（MIT），未引入其使用者腳本、統計程式或角色捏人面板。無新增套件、外部素材、資料保存或控制按鈕；沿用既有暫停／減少動態。變更後同步更新E組index.html的app版本及app.js的scene版本，避免舊模組快取。

B/D/E同次更新為低角度預設自動導覽；按原有「自動導覽」可停止／恢復，手動拖曳會停止導覽。導覽與場景動作分開，系統減少動態初始不自動導覽。

2026-11-05依擁有者三張貓咪照片校正E組角色：暖棕金毛、近黑虎斑、琥珀大瞳孔、棕色腳掌、奶油下巴；停留時抬胸及輕歪頭。照片未放入公開倉庫。無新增依賴或控制介面。

## A組新增

2026-11-05加入a/地主改建協作島，原始資料保留於Drive原權限，不提交原始清冊、財務、案場及私人紀錄。資料來源、邊界及架構見a/project-brief.md。共用註冊groups.js新增A，C保留，cross-group.js快取版本a1；BDE僅更新共用導覽參照。個人頁原總覽網址不變，不需重新發布個人頁。

## E組新增兩隻貓

2026-11-05依擁有者照片新增奶茶白貓及另一隻虎斑，原有虎斑保留，島上共三隻。新角色分別在e/cream-cat.js、e/photo-tabby.js；透過scene.js共用幾何、材質追蹤及道路，全部動作由既有moving分支驅動，遵守暫停／減少動態／頁面隱藏。新增虎斑採共用幾何獨立關節副本，沒有改動原有角色。照片不放入公開Git，無找貓按鈕或新增相機操作。

## 貓咪移動方向修正

2026-11-05修正倒退及側滑：複製角色清除繼承的X/Z旋轉，三角色改用e/cat-walker.js。控制器分開移動、停留、原地轉向，對準實際下一步位移再前進，不再用絕對時間推進位置同時滯後插值朝向。回歸指令：node scripts/check-cat-locomotion.mjs，實際三角色與島內道路的移動方向一致性。

## 三隻貓咪互動

2026-11-05加入隨機抓癢及點擊翻肚。互動集中在e/cat-interactions.js；動作期間凍結角色路線，完成後精確恢復原姿態。依擁有者影片調整為放低身體、側躺、露出肚子、收回側躺再起身，頭部及四肢獨立銜接，不整體旋轉180度。每次手勢按所在道路高度支撐身體。影片與照片均不提交。

呼嚕以本機WebAudio合成，僅在使用者點擊後建立音訊；暫停、減少動態、頁面隱藏及dispose停止聲音。無外部音檔、API或新依賴。回歸指令：node scripts/check-cat-interactions.mjs；另執行check-cat-locomotion.mjs確認實際三角色道路轉向。

頭部跟隨身體同側翻躺，僅保留小幅頸部側傾，避免反向抵消身體旋轉造成頭部直立。

翻肚互動延長至14.6秒：2.2秒完成翻躺後，放鬆停留約7秒；9.2秒開始收回肚子，10.8秒起前腳先落地、撐起胸口，後腳稍晚伸開，14.6秒回復原姿態與路線。頭仍隨身體轉動，整段沿用暫停／減少動態。

## 島嶼製作洽詢入口

依擁有者更新要求，僅E組頁底部保留靜態引流區，樣式共用industry-islands/island-contact.css；不需額外JavaScript。個人首頁與LINE網址沿用擁有者首頁的公開入口。總覽及A/B/C/D組不放製作洽詢引流區。未加入追蹤、表單、付費或外部套件。

## C組新增

2026-11-05加入c/傳承安居協作島，詳見c/project-brief.md。五組已連通；C的五條跨組需求連結集中在groups.js，其他組只更新共用導覽快取版本。島內有八主題、三種四步驟引薦情境，低角度預設導覽可關閉，暫停與減少動態沿用共用操作方式。附件與私人來源僅留本機工作目錄，不提交公開倉庫。個人頁總覽入口不變；製作洽詢首頁與LINE僅E組顯示。
