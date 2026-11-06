/* Native website intake; Google handles data in the background. No account credentials. */
(() => {
  "use strict";
  const endpoint = document.body.dataset.publicApiUrl;
  if (!endpoint) return;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))
    throw new Error("登錄服務網址設定錯誤");
  const allowed = new Set(["startSubmission", "bootstrap", "createCase", "uploadImage", "finalizeCase", "getReceipt", "getReceiptImage"]);
  window.HUADU_PUBLIC_ADAPTER = {
    async rpc(request) {
      if (!request || !allowed.has(request.action))
        return { ok: false, error: { code: "FORBIDDEN", message: "請由領導團隊後臺處理管理操作。" } };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify(request),
          mode: "cors",
          credentials: "omit",
          redirect: "follow",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("http");
        const result = await response.json();
        if (!result || typeof result.ok !== "boolean") throw new Error("response");
        return result;
      } catch (error) {
        return { ok: false, error: { code: "NETWORK_ERROR", message: error.name === "AbortError" ? "連線等候逾時，資料可能已保存；請保留此頁後再試，避免重複登錄。" : "暫時無法連線，請保留此頁並稍後重試。" } };
      } finally { clearTimeout(timer); }
    },
  };
})();
