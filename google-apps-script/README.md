# Google Apps Script endpoint

Copy `Code.gs` into a new project at https://script.google.com/. Add Script Properties:
- `SPREADSHEET_ID`: private Google Sheet ID
- `TURNSTILE_SECRET`: Cloudflare Turnstile secret (never put this in HTML)
- `ALLOWED_HOSTNAME`: exact hostname of the live landing page, such as `adyguru4455-max.github.io`

Deploy as a Web App executing as the owner with access set to Anyone. Copy the deployed `/exec` URL and configure it in the landing page. Full steps: `README-SECURE-ORDERS.md`.
