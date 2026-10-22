/**
 * Neuro Shakti Plus — Google Sheets order endpoint.
 *
 * Set Script Property SPREADSHEET_ID to the ID of the destination spreadsheet.
 * Deploy as a Web App executing as the owner. Public web endpoints can be abused;
 * validation and basic throttling below reduce, but do not eliminate, abuse.
 */

const SHEET_NAME = 'Orders';
const REQUIRED_FIELDS = ['fullName', 'mobileNumber'];

function doGet() {
  return json_({ ok: true, service: 'Neuro Shakti Plus order endpoint' });
}

function doPost(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};

    // Honeypot: real customers should leave this field blank.
    if (String(p.website || '').trim() !== '') {
      return json_({ ok: false, error: 'Rejected' });
    }

    const submittedAt = Number(p.formStartedAt || 0);
    const ageMs = Date.now() - submittedAt;
    if (!submittedAt || ageMs < 2000 || ageMs > 2 * 60 * 60 * 1000) {
      return json_({ ok: false, error: 'Invalid submission timing' });
    }

    const fullName = clean_(p.fullName, 100);
    const mobileNumber = String(p.mobileNumber || '').replace(/\D/g, '');
    const address = clean_(p.address, 500);
    const city = clean_(p.city, 100);
    const pincode = String(p.pincode || '').replace(/\D/g, '');
    const selectedProblems = clean_(p.selectedProblems, 1000);

    if (!fullName || !/^\d{10}$/.test(mobileNumber)) {
      return json_({ ok: false, error: 'Invalid name or mobile number' });
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return json_({ ok: false, error: 'Invalid pincode' });
    }

    // Basic per-phone throttling. This is not a substitute for CAPTCHA/server-side
    // abuse protection, and users can evade it with different phone numbers.
    const cache = CacheService.getScriptCache();
    const throttleKey = 'order_' + mobileNumber;
    if (cache.get(throttleKey)) {
      return json_({ ok: false, error: 'Please wait before submitting again' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!spreadsheetId) throw new Error('Missing Script Property: SPREADSHEET_ID');

      const ss = SpreadsheetApp.openById(spreadsheetId);
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'Timestamp (IST)', 'Full Name', 'Mobile Number', 'Address',
          'City', 'Pincode', 'Selected Problems', 'Product', 'Payment'
        ]);
      }

      sheet.appendRow([
        new Date(),
        fullName,
        mobileNumber,
        address,
        city,
        pincode,
        selectedProblems || 'None selected',
        'Neuro Shakti Plus (200g Powder)',
        'Cash on Delivery'
      ]);
      cache.put(throttleKey, '1', 120);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'Unable to save order' });
  }
}

function clean_(value, maxLength) {
  // Remove control characters and cap lengths. Prefix formula-like strings so
  // user input cannot become a spreadsheet formula.
  let s = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  s = s.slice(0, maxLength);
  if (/^[=+@]/.test(s) || /^-/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
