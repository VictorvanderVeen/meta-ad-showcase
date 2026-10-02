/**
 * Meta Ad Showcase — ontvanger voor klantbeoordelingen.
 *
 * Web app bound to the Google Sheet. The showcase site POSTs decisions here
 * and GETs them back on load.
 *
 *   Beoordelingen — one row per ad, always the latest decision (newest wins)
 *   Log           — append-only history of every change, never overwritten
 *
 * @OnlyCurrentDoc
 */

const SHEET = 'Beoordelingen';
const LOG = 'Log';
const HEADER = ['ad_id', 'naam', 'merk', 'status', 'opmerking', 'bijgewerkt'];

const STATUS_LABEL = {
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  pending: 'Nog te beoordelen',
};
const STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(STATUS_LABEL).map(([key, label]) => [label, key])
);

const MAX_ITEMS = 200;
const MAX_TEXT = 2000;

function doGet() {
  const rows = getSheet(SHEET).getDataRange().getDisplayValues().slice(1);
  const decisions = {};
  for (const [id, , , label, comment, updatedAt] of rows) {
    if (!id) continue;
    decisions[id] = {
      status: STATUS_BY_LABEL[label] || 'pending',
      comment: unguard(comment),
      updatedAt,
    };
  }
  return json({ decisions });
}

function doPost(e) {
  let items;
  try {
    items = JSON.parse(e.postData.contents).decisions;
  } catch (err) {
    return json({ ok: false, error: 'invalid json' });
  }
  if (!Array.isArray(items) || items.length > MAX_ITEMS) {
    return json({ ok: false, error: 'invalid payload' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(SHEET);
    const log = getSheet(LOG);
    const existing = sheet.getDataRange().getDisplayValues();
    const ids = existing.map((row) => row[0]);
    const stamps = existing.map((row) => row[5]);

    for (const item of items) {
      const id = text(item.id, 200);
      if (!id || !STATUS_LABEL[item.status]) continue;
      const updatedAt = text(item.updatedAt, 40) || new Date().toISOString();
      const row = [
        guard(id),
        guard(text(item.name, 300)),
        guard(text(item.brand, 100)),
        STATUS_LABEL[item.status],
        guard(text(item.comment, MAX_TEXT)),
        updatedAt,
      ];

      log.appendRow(row);

      const index = ids.indexOf(id);
      if (index === -1) {
        sheet.appendRow(row);
        ids.push(id);
        stamps.push(updatedAt);
      } else if (updatedAt >= stamps[index]) {
        sheet.getRange(index + 1, 1, 1, HEADER.length).setValues([row]);
        stamps[index] = updatedAt;
      }
    }
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true });
}

/** Returns the tab, creating it with a header row on first use. */
function getSheet(name) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
    // Plain text, so ISO timestamps survive the round trip untouched.
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADER.length).setNumberFormat('@');
  }
  return sheet;
}

function text(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

// The endpoint is public: stop Sheets from reading user text as a formula.
function guard(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function unguard(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** Run once from the editor to grant access and create both tabs. */
function setup() {
  getSheet(SHEET);
  getSheet(LOG);
}
