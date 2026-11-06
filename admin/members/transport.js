/* Native fetch adapter for the official administrator API. */
(() => {
  "use strict";

  const SESSION_KEY = "huaduOfficialAdminV1";
  const endpoint = document.body.dataset.registryApiUrl || "";
  const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const allowedActions = new Set([
    "nameEmailLogin",
    "adminLoad",
    "adminSubmit",
    "adminInitialize",
    "siteLoad",
    "siteSave",
    "logout",
  ]);

  if (!endpointPattern.test(endpoint)) {
    throw new Error("管理服務網址設定錯誤。");
  }

  function ApiError(code, message) {
    this.name = "ApiError";
    this.code = code || "REQUEST_FAILED";
    this.message = message || "暫時無法完成操作，請稍後再試。";
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function getToken() {
    try {
      return sessionStorage.getItem(SESSION_KEY) || "";
    } catch (ignore) {
      return "";
    }
  }

  function storeToken(token) {
    if (typeof token !== "string" || !token) throw new Error("登入服務未回傳有效工作階段。");
    sessionStorage.setItem(SESSION_KEY, token);
  }

  function clearToken() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (ignore) { /* Storage may be disabled. */ }
  }

  function showLoginForExpiredSession() {
    clearToken();
    window.dispatchEvent(new CustomEvent("registry:auth-required"));
  }

  async function request(action, payload, tokenOverride) {
    if (!allowedActions.has(action)) throw new ApiError("FORBIDDEN", "不支援此管理操作。");

    const token = tokenOverride !== undefined
      ? tokenOverride
      : (action === "nameEmailLogin" ? null : getToken());
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ action, payload: payload || {}, token }),
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new ApiError("NETWORK_ERROR", "暫時無法連線，表單內容仍保留，請稍後再試。");

      let result;
      try { result = await response.json(); }
      catch (ignore) { throw new ApiError("NETWORK_ERROR", "服務回應無法讀取，表單內容仍保留，請稍後再試。"); }

      if (!result || typeof result.ok !== "boolean") {
        throw new ApiError("NETWORK_ERROR", "服務回應格式不正確，表單內容仍保留，請稍後再試。");
      }
      if (!result.ok) {
        const error = result.error || {};
        const apiError = new ApiError(error.code, error.message);
        if (apiError.code === "UNAUTHORIZED") showLoginForExpiredSession();
        throw apiError;
      }
      return result.data;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new ApiError("TIMEOUT", "連線等候逾時；表單內容與原儲存識別碼仍保留，請檢查後再重送。");
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError("NETWORK_ERROR", "暫時無法連線，表單內容仍保留，請稍後再試。");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function makeRunner(successHandler, failureHandler) {
    function invoke(action, payload) {
      const pending = request(action, payload);
      if (typeof successHandler !== "function" && typeof failureHandler !== "function") return pending;
      return pending.then(
        (value) => { if (typeof successHandler === "function") successHandler(value); },
        (error) => { if (typeof failureHandler === "function") failureHandler(error); },
      );
    }
    return {
      withSuccessHandler(handler) { return makeRunner(handler, failureHandler); },
      withFailureHandler(handler) { return makeRunner(successHandler, handler); },
      registryAdminLoad() { return invoke("adminLoad", {}); },
      registryAdminSubmit(command, csrf) { return invoke("adminSubmit", { command, csrf }); },
      registryAdminInitialize(csrf) { return invoke("adminInitialize", { csrf }); },
    };
  }

  window.registryBackend = makeRunner(null, null);
  window.registryApi = {
    request,
    getToken,
    storeToken,
    clearToken,
    hasSession() { return !!getToken(); },
    login(name, email) { return request("nameEmailLogin", { name, email }, null); },
    logout(token) { return request("logout", {}, token); },
  };
  window.registryAdminSessionReady = () => !!getToken();
})();
