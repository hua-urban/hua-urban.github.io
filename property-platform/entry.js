"use strict";
(async () => {
  const status = document.getElementById("service-status"),
    launch = document.getElementById("launch"),
    admin = document.body.dataset.entryKind === "admin";
  try {
    const response = await fetch(
      document.body.dataset.configUrl || "config.json",
      { cache: "no-store" },
    );
    if (!response.ok) throw Error("config");
    const config = await response.json(),
      value = admin
        ? config.adminWebAppUrl
        : config.publicWebAppUrl || config.webAppUrl;
    if (!value) {
      status.textContent = admin
        ? "管理入口尚未完成啟用，請洽資訊組。"
        : "登錄服務準備中，請稍後再試。";
      return;
    }
    const url = new URL(value);
    if (
      url.origin !== "https://script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw Error("invalid-url");
    if (admin) url.searchParams.set("admin", "1");
    launch.href = url.href;
    launch.hidden = false;
    status.hidden = true;
  } catch {
    status.textContent = "目前無法確認服務入口，請稍後重試或聯絡資訊組。";
  }
})();
