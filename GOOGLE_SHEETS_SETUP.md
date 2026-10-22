# Neuro Shakti Plus — Google Sheets order setup

## Files
- `index.html`: sales page. Sends order fields to the Apps Script endpoint.
- `Code.gs`: copy this into a Google Apps Script project attached to your Google account. It validates fields and writes rows to the `Orders` tab.
- The Apps Script endpoint URL is public in browser code. Do not treat it as a secret.

## Setup

1. Create/open the Google Sheet that should receive orders.
2. Copy the spreadsheet ID from its URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
3. Go to https://script.google.com/ and create a project. Paste `Code.gs` into the editor.
4. In **Project Settings → Script Properties**, add:
   - Property: `SPREADSHEET_ID`
   - Value: your spreadsheet ID
5. Save. From **Deploy → New deployment → Web app**:
   - **Execute as:** Me (the spreadsheet owner)
   - **Who has access:** Anyone (the order form is public)
   - Deploy, authorize spreadsheet access, and copy the URL ending in `/exec`.
6. In `index.html`, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with that `/exec` URL. Commit and publish the updated site.
7. Submit one test order using your own test details. Confirm the row appears in the `Orders` sheet. Then test an invalid phone number and a repeat submission.

## Important security and reliability notes

- A public order form cannot keep a shared secret in HTML. The endpoint URL is visible to visitors, so do not add an API key or secret to the page.
- The script applies server-side field validation, a hidden honeypot, a minimum form-fill time, a per-phone 2-minute throttle, and spreadsheet formula-injection mitigation. These are basic controls, not complete bot protection. For production advertising traffic, add a CAPTCHA such as Cloudflare Turnstile with server-side verification, and monitor abuse/quotas.
- Browser `fetch(..., { mode: 'no-cors' })` cannot read the Apps Script response. The page therefore cannot reliably prove that a row was saved; always verify in the sheet during testing. A robust, machine-verifiable success state needs a backend/proxy that supports CORS or a different integration.
- Keep customer data access restricted in Google Sheets. Do not publish the sheet itself.
- This setup is for order/lead collection, not medical diagnosis or treatment records.
