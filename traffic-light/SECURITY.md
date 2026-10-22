# Traffic light update verification

`security-config.json` contains the public Cloudflare Turnstile site key used by this page. Set `turnstileSiteKey` to the site key for the deployed traffic-light host before enabling public updates. The checked-in empty value intentionally blocks every write and displays「更新驗證尚未設定，請聯絡維護者」. Viewing scores and previewing a local workbook remain available.

Only the public site key belongs in this file. Never add the Turnstile secret key, `HTL_UPLOAD_TOKEN`, or any other server credential to frontend files. The API must verify each fresh Turnstile token and enforce write quotas on the server; browser checks do not replace those controls.

Each write preview captures the API's base revision before submission. A `409` means the underlying data changed: reload and review the latest data before submitting again. A `429` displays the server-provided retry delay.
