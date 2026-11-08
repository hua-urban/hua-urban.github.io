# 華都更產業群島

正式總覽：[華都更產業群島](https://hua-urban.com/industry-islands/)。本文件是維護入口，不代表已重新確認線上狀態。

## 來源與架構

唯一正式來源是 `hua-urban/hua-urban.github.io` 的 `industry-islands/`。沿用 GitHub Pages 的 `master` 分支、根目錄及 `hua-urban.com`；純靜態，不新增帳戶、資料庫、AI API 或部署服務，既有資料同步 workflow 不變。

五組均已開放，群島摘要由 `groups.js` 產生。各組維持獨立地形、建築與內容；擴充連結前先完成內容、審閱與驗收，不連到空頁。

| 當次任務 | 必要入口 |
| --- | --- |
| 接續工作、維運或個人頁成果入口 | [維運交接](../docs/industry-islands-handoff.md) |
| 修改單組服務、成員或場景 | 對應的 [A](a/project-brief.md)、[B](b/project-brief.md)、[C](c/project-brief.md)、[D](d/project-brief.md) 或 [E](e/project-brief.md) 企劃，只讀當次組別 |
| 修改總覽與跨組導航 | `index.html`、`groups.js`、`cross-group.js` 及 `cross-group.css` |
| 功能驗收或準備發布 | [驗收與發布](../docs/industry-islands-verification.md) |
| 追溯加入各組與舊版決策 | [README 歷史附記](../docs/history/industry-islands-readme-history-20261105.md) |

各組 `data.js` 保存八主題、夥伴、需求提問及情境；`scene.js` 保存場景與 `createIsland` 控制器；`app.js` 保存主題選取、導覽及動態控制。D 組四情境，其餘各組三情境。

跨組連線統一由 `groups.js` 管理；`?topic=<id>#explore` 選中主題，跨組採目前分頁整頁導航。更新各組時同步核對總覽與 sites/routes。

`lib/` 沿用 Three.js 0.187.0、OrbitControls 及 MIT 授權，使用 lib 名稱避免 Jekyll 排除 vendor。更新版本時才重新核對來源與安全公告。

## 固定邊界

不提交 Drive 原始逐字稿、私人聯絡、客戶識別資料或後台。分享與構想不當作共同實績，更新時同步來源和狀態；場景僅為協作示意。

個人首頁與 LINE 製作洽詢引流區僅 E 組保留；總覽與 A／B／C／D 不新增。原有 D／E 舊版 ChatGPT Sites 的刪除紀錄見交接歷史，正式成果集中維護於官網。
