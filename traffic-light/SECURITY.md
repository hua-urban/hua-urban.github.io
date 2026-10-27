# Traffic light public updates

As requested by the site owner on 2026-10-27, public updates no longer require Cloudflare Turnstile and the upload API no longer enforces application-level write quotas. This applies to the shared PALMS, chapter update, and departure-list endpoint. There is no member authentication; anyone able to call the public endpoint can attempt an update.

File size, format and weekly date checks remain. The API retains JSON/body bounds, data validation and optimistic revision checks. A `409` still requires reloading and reviewing the latest data; submitting an outdated preview must not overwrite a newer update.

The legacy `security-config.json` public site key is no longer read. Existing provider credentials and quota infrastructure are not deleted by this change. Never add server credentials to frontend files. Hosting-provider limits may still apply independently.
