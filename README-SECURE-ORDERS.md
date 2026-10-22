# Neuro Shakti Plus — Secure Google Sheets Orders

This branch adds a Google Apps Script order receiver and removes the public Google Sheets URL configuration bar from the customer page.

## Files
- `index.html`: existing landing page with Cloudflare Turnstile challenge and a form submission that does not expose the Turnstile secret.
- `google-apps-script/Code.gs`: validates orders, verifies Turnstile server-side and hostname, throttles repeat phone submissions, guards duplicate orders, and appends orders to a private Sheet.
- `google-apps-script/README.md`: short setup reference.

## 1. Create the Google Sheet
1. Create a new Google Sheet owned by the account that will own the Apps Script.
2. Copy the spreadsheet ID from its URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
3. Keep the Sheet private; do not publish it or share it with customers.

## 2. Set up Cloudflare Turnstile
1. In Cloudflare Dashboard, open Turnstile and add a widget for your landing-page domain (include your GitHub Pages host and/or custom domain).
2. Choose **Managed** mode. Copy the **Site key** and **Secret key**.
3. The Site key is public and belongs in HTML. The Secret key must only be stored in Apps Script Script Properties.

## 3. Create Apps Script endpoint
1. Open https://script.google.com/ and create a new project.
2. Copy all code from `google-apps-script/Code.gs` into `Code.gs`.
3. Open **Project Settings → Script properties** and add these three properties:
   - `SPREADSHEET_ID` = your Google Sheet ID
   - `TURNSTILE_SECRET` = Cloudflare Turnstile secret key
   - `ALLOWED_HOSTNAME` = exact public website hostname, for example `adyguru4455-max.github.io` (no `https://` or path). If you serve multiple approved hostnames, separate them with commas.
4. Save the project. After setting the properties, select `setup` in the function picker and run it once. Approve the requested Google permissions; this creates the `Orders` tab and its headers.
5. Click **Deploy → New deployment → Web app**.
   - **Execute as:** Me (the Sheet owner)
   - **Who has access:** Anyone (the public order page must be able to submit orders)
6. Deploy and copy the URL ending in `/exec`. Do not use the test `/dev` URL.

> The endpoint must be public for customer submissions, so it is not a private API. Turnstile server-side verification, hostname checking, validation, throttling, and deduplication reduce abuse, but no public endpoint can be made completely abuse-proof. Monitor Apps Script executions and quotas.

## 4. Configure the site key and endpoint in `index.html`
Search for these constants in the JavaScript section and replace their placeholder values:
- `TURNSTILE_SITE_KEY = 'PASTE_CLOUDFLARE_SITE_KEY_HERE'`
- `ORDER_ENDPOINT_URL = 'PASTE_APPS_SCRIPT_EXEC_URL_HERE'`

These are intentionally public configuration values; **never paste the Turnstile secret into HTML or GitHub**.

## 5. Publish the website
1. Commit/merge the changes to your website branch. If using GitHub Pages, enable it in **Settings → Pages** and select the intended branch/folder.
2. Add the deployed domain to the Turnstile widget's allowed hostnames.
3. Ensure the hostname configured in Apps Script `ALLOWED_HOSTNAME` matches the hostname that Turnstile returns exactly.

## 6. Test before advertising
1. Open the live site in a private/incognito window.
2. Submit a valid test order and complete the Turnstile challenge.
3. Check the private Sheet's `Orders` tab. The first valid submission creates the tab and header row; the order should be appended with status `New`.
4. Test invalid phone/pincode, a bot challenge failure, and repeated submissions.
5. Remove test customer data before going live.

## Important browser limitation
The static GitHub Pages site cannot reliably read the Apps Script response cross-origin with this simple `no-cors` submission pattern. The page therefore says the request was sent for processing, **not that the Sheet row is definitively saved**. During testing, verify the row in Google Sheets. For an authoritative success/failure message, put a same-origin backend/proxy with CORS configured in front of Apps Script, or implement and test a form/iframe response flow.

## Data privacy
The form collects personal information (name, phone, and delivery address). Link a privacy notice on the live page, restrict Sheet access to staff who need it, and set a retention/deletion policy. The optional selected-problem field can reveal health information; consider removing it if you do not need it for order processing.
