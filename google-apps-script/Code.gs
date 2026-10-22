/**
 * Neuro Shakti Plus order receiver.
 * Deploy as a Web App executing as the owner.
 *
 * Required Script Properties (Project Settings > Script properties):
 * SPREADSHEET_ID = ID of the destination Google Sheet
 * TURNSTILE_SECRET = Cloudflare Turnstile secret key
 */
const CONFIG = {
  SHEET_NAME: 'Orders',
  MAX_TEXT: 500,
  MIN_FORM_SECONDS: 2,
  PHONE_COOLDOWN_SECONDS: 60,
  DUPLICATE_WINDOW_SECONDS: 300
};

function doGet() {
  return json_({ ok: true, service: 'Neuro Shakti Plus order endpoint' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.parameter || !e.parameter.payload) {
      return json_({ ok: false, error: 'Missing order payload' });
    }

    const data = JSON.parse(e.parameter.payload);
    const turnstileToken = String(e.parameter.turnstileToken || '');
    const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

    if (!secret || !spreadsheetId) {
      console.error('Missing SPREADSHEET_ID or TURNSTILE_SECRET script property.');
      return json_({ ok: false, error: 'Server is not configured' });
    }

    // Bot challenge is verified server-side; never trust the browser alone.
    if (!turnstileToken || !verifyTurnstile_(turnstileToken, secret)) {
      return json_({ ok: false, error: 'Bot verification failed' });
    }

    const order = validateOrder_(data);
    if (!order) return json_({ ok: false, error: 'Invalid order details' });

    lock.waitLock(10000);
    try {
      const props = PropertiesService.getScriptProperties();
      const now = Math.floor(Date.now() / 1000);
      const phoneKey = 'last_' + order.mobileNumber;
      const lastAt = Number(props.getProperty(phoneKey) || 0);
      if (now - lastAt < CONFIG.PHONE_COOLDOWN_SECONDS) {
        return json_({ ok: false, error: 'Please wait before submitting again' });
      }

      const sheet = getOrdersSheet_(spreadsheetId);
      // Secondary duplicate guard for identical phone + address submitted recently.
      const fingerprint = Utilities.base64EncodeWebSafe(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
          order.mobileNumber + '|' + order.address + '|' + order.city + '|' + order.pincode)
      ).slice(0, 32);
      const duplicateKey = 'order_' + fingerprint;
      const duplicateAt = Number(props.getProperty(duplicateKey) || 0);
      if (now - duplicateAt < CONFIG.DUPLICATE_WINDOW_SECONDS) {
        return json_({ ok: false, error: 'Duplicate order detected' });
      }

      sheet.appendRow([
        new Date(),
        safeCell_(order.fullName),
        "'" + order.mobileNumber,
        safeCell_(order.address),
        safeCell_(order.city),
        "'" + order.pincode,
        safeCell_(order.selectedProblems),
        'COD',
        'New'
      ]);
      props.setProperty(phoneKey, String(now));
      props.setProperty(duplicateKey, String(now));
      return json_({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'Could not save order' });
  }
}

function validateOrder_(d) {
  if (!d || typeof d !== 'object') return null;
  const fullName = cleanText_(d.fullName, 80);
  const mobileNumber = String(d.mobileNumber || '').replace(/\D/g, '');
  const address = cleanText_(d.address, 300);
  const city = cleanText_(d.city, 80);
  const pincode = String(d.pincode || '').replace(/\D/g, '');
  const selectedProblems = cleanText_(d.selectedProblems, 300);
  const elapsed = Number(d.elapsedSeconds || 0);

  if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobileNumber)) return null;
  if (address.length > 300 || city.length > 80) return null;
  if (pincode && !/^\d{6}$/.test(pincode)) return null;
  if (elapsed < CONFIG.MIN_FORM_SECONDS) return null;
  return { fullName, mobileNumber, address, city, pincode, selectedProblems };
}

function cleanText_(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || CONFIG.MAX_TEXT);
}

function safeCell_(value) {
  // Prevent spreadsheet formula injection in user-controlled fields.
  const s = cleanText_(value, CONFIG.MAX_TEXT);
  return /^[=+@\-]/.test(s) ? "'" + s : s;
}

function verifyTurnstile_(token, secret) {
  const response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return false;
  const result = JSON.parse(response.getContentText() || '{}');
  return result.success === true;
}

function getOrdersSheet_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'Timestamp', 'Full Name', 'Mobile Number', 'Address', 'City',
      'Pincode', 'Selected Problems', 'Payment', 'Order Status'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
