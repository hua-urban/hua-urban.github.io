# 產業群島維運交接

文件整理日期：2026-11-08。內容基準為本機 `b2f5cd7` 版本及既有記錄；文件發布驗證見下方，網站互動未於本次重新驗收。

## 來源與訪客入口

- 正式程式：[hua-urban/hua-urban.github.io](https://github.com/hua-urban/hua-urban.github.io/tree/master/industry-islands)，沿用 `master`／根目錄 GitHub Pages。
- 訪客由 [個人頁成果區](https://yitsen-sites.yitsenliuai.chatgpt.site/resources) 進入 [群島總覽](https://hua-urban.com/industry-islands/)，再選五組；個人頁不另存群島程式。
- 五組已開放。原交接內「A／C 預留」是當時狀態，完整原文移至 [截至 2026-11-05 的交接歷史](history/industry-islands-handoff-through-20261105.md)，追溯時才讀。

## 依任務接手

- 一般維護從 [README](../industry-islands/README.md) 選當次檔案；功能驗收與發布讀 [驗收與發布](industry-islands-verification.md)。
- 個人頁仍由既有 Sites 發布，成果卡來源為 `yitsen-sites-portal` 的 `dist/sites.json` 三筆 `category=bni` 卡片。僅新增或更換入口網址時，才執行該專案的 `node build-site.mjs` 及既有 Sites source workflow；網址不變時無需重發個人頁。
- 個人頁須有擁有者或合法編輯權限；華都更倉庫權限不自動授予個人頁權限。群島送 PR 不需要 API 金鑰、共享 token 或密碼，Pages 及網域沿用官網管理者設定。

## 保留的維護限制

- 既有交接記載 B／C／D／E 採低角度導覽，可停止；手動拖曳停止自動導覽。導覽與場景動作分離，系統減少動態時初始不自動導覽；A 組導覽設定未於本次確認。
- E 組三隻貓的移動與互動維持暫停、減少動態、頁面隱藏及 dispose 邊界；WebAudio 只在使用者點擊後建立，停止條件沿用既有控制。
- 原始照片、影片、Drive 清冊、財務、案場及私人紀錄不進公開倉庫。模型、場景及協作內容不代表真實設備效果或已完成合作。
- 個人首頁與 LINE 製作洽詢僅 E 組保留，不新增追蹤、表單、付費或外部套件。

## 最近接手重點

本機版本 `b2f5cd7` 的 E 組企劃記錄：尾翼橘色、立扇桌以外馬達炭黑、坦克扇與壁掛扇護網中心炭黑、移除中網招牌專屬近看但保留招牌；五組上方產業群島入口自動展開群島區塊。D／E 共用設備限制見 [E 組企劃](../industry-islands/e/project-brief.md)。

2026-11-08 文件整理經 [PR #47](https://github.com/hua-urban/hua-urban.github.io/pull/47) 合併至 `master`（`7ac8fdd`），[Pages 建置與部署](https://github.com/hua-urban/hua-urban.github.io/actions/runs/42490744808) 成功，總覽及 D／E 組公開入口均回傳 HTTP 200。這次只有 Markdown 文件變更，未修改網站功能；HTTP 檢查不等於完整互動驗收。接續工作前仍須確認工作樹及實際來源版本。
