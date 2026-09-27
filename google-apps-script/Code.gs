/**
 * AI Drug Tutor Google Sheets web app (protocol v2).
 *
 * Deploy this as the app's existing /exec web app. A Sheet-bound script uses
 * its active spreadsheet. A standalone script must set the SPREADSHEET_ID
 * Script Property; SHEET_NAME is optional in either setup.
 */

const DRUG_SHEET_PROTOCOL_VERSION = 2;
const DEFAULT_DRUG_HEADERS = [
  'name',
  'generic_name',
  'brand_name',
  'class',
  'system',
  'indication',
  'SideEffects',
  'nursing',
  'effect_of_drug'
];

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').toLowerCase();
  if (action === 'capabilities') {
    return jsonResponse_({
      ok: true,
      service: 'ai-drug-tutor-sheet',
      supports_add: true,
      supports_update: true,
      protocol_version: DRUG_SHEET_PROTOCOL_VERSION
    });
  }
  return jsonResponse_({
    ok: true,
    service: 'ai-drug-tutor-sheet',
    protocol_version: DRUG_SHEET_PROTOCOL_VERSION
  });
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(String(e && e.postData && e.postData.contents || ''));
  } catch (error) {
    return jsonResponse_({ ok: false, error: 'invalid_json', message: 'The request body must be valid JSON.' });
  }

  const action = String(payload.action || 'add').toLowerCase();
  if (action !== 'add' && action !== 'update') {
    return jsonResponse_({ ok: false, error: 'unsupported_action', message: 'Only add and update are supported.' });
  }
  if (!String(payload.name || '').trim()) {
    return jsonResponse_({ ok: false, error: 'missing_name', message: 'A drug name is required.' });
  }
  if (action === 'update' && Number(payload.protocol_version || 0) < DRUG_SHEET_PROTOCOL_VERSION) {
    return jsonResponse_({ ok: false, error: 'protocol_mismatch', message: 'Update protocol v2 is required.' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getTargetDrugSheet_();
    const headers = ensureDrugHeaders_(sheet);
    return action === 'update'
      ? updateDrugRow_(sheet, headers, payload)
      : addDrugRow_(sheet, headers, payload);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: 'server_error',
      message: String(error && error.message || error || 'Unknown server error')
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getTargetDrugSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = String(properties.getProperty('SPREADSHEET_ID') || '').trim();
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No spreadsheet is configured. Set the SPREADSHEET_ID Script Property.');
  }

  const sheetName = String(properties.getProperty('SHEET_NAME') || '').trim();
  const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('The configured SHEET_NAME was not found.');
  return sheet;
}

function ensureDrugHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, DEFAULT_DRUG_HEADERS.length).setValues([DEFAULT_DRUG_HEADERS]);
    return DEFAULT_DRUG_HEADERS.slice();
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(function (header) { return String(header || '').trim(); });
  if (!headers.some(Boolean)) throw new Error('The first row must contain column headers.');
  return headers;
}

function addDrugRow_(sheet, headers, payload) {
  const row = headers.map(function (header) {
    const field = payloadFieldForHeader_(header, payload);
    return field.known ? field.value : '';
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return jsonResponse_({
    ok: true,
    action: 'added',
    added: true,
    row: sheet.getLastRow(),
    protocol_version: DRUG_SHEET_PROTOCOL_VERSION
  });
}

function updateDrugRow_(sheet, headers, payload) {
  const nameColumn = headers.findIndex(function (header) {
    return ['name', 'drug', 'drugname', 'medication', 'medicinename'].indexOf(normalizeHeader_(header)) !== -1;
  });
  if (nameColumn < 0) {
    return jsonResponse_({ ok: false, error: 'missing_name_column', message: 'No drug name column was found.' });
  }

  const originalKey = normalizeDrugKey_(payload.original_key || payload.original_name || '');
  if (!originalKey) {
    return jsonResponse_({ ok: false, error: 'missing_original_key', message: 'The original drug name is required.' });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse_({ ok: false, error: 'not_found', matched_rows: 0, message: 'No matching drug row was found.' });
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const matches = [];
  rows.forEach(function (row, index) {
    if (normalizeDrugKey_(row[nameColumn]) === originalKey) matches.push(index);
  });

  if (matches.length === 0) {
    return jsonResponse_({ ok: false, error: 'not_found', matched_rows: 0, message: 'No matching drug row was found.' });
  }
  if (matches.length > 1) {
    return jsonResponse_({
      ok: false,
      error: 'multiple_matches',
      matched_rows: matches.length,
      message: 'More than one matching drug row exists; no row was changed.'
    });
  }

  const matchedIndex = matches[0];
  const updatedRow = rows[matchedIndex].slice();
  headers.forEach(function (header, columnIndex) {
    const field = payloadFieldForHeader_(header, payload);
    if (field.known) updatedRow[columnIndex] = field.value;
  });
  const sheetRow = matchedIndex + 2;
  sheet.getRange(sheetRow, 1, 1, headers.length).setValues([updatedRow]);
  SpreadsheetApp.flush();
  return jsonResponse_({
    ok: true,
    action: 'updated',
    updated: true,
    matched_rows: 1,
    row: sheetRow,
    protocol_version: DRUG_SHEET_PROTOCOL_VERSION
  });
}

function payloadFieldForHeader_(header, payload) {
  const key = normalizeHeader_(header);
  const aliases = {
    name: 'name',
    drug: 'name',
    drugname: 'name',
    medication: 'name',
    medicinename: 'name',
    generic: 'generic_name',
    genericname: 'generic_name',
    brand: 'brand_name',
    brandname: 'brand_name',
    class: 'class',
    drugclass: 'class',
    system: 'system',
    bodysystem: 'system',
    indication: 'indication',
    indications: 'indication',
    use: 'indication',
    uses: 'indication',
    sideeffect: 'side_effects',
    sideeffects: 'side_effects',
    adverseeffect: 'side_effects',
    adverseeffects: 'side_effects',
    nursing: 'nursing',
    nursingcare: 'nursing',
    effect: 'effect_of_drug',
    effects: 'effect_of_drug',
    drugeffect: 'effect_of_drug',
    effectofdrug: 'effect_of_drug',
    quiz: 'effect_of_drug',
    holdparam: 'hold_param',
    holdparameter: 'hold_param',
    admintype: 'admin_type',
    administrationtype: 'admin_type'
  };
  const payloadKey = aliases[key];
  if (!payloadKey) return { known: false, value: '' };
  const value = payloadKey === 'side_effects'
    ? payload.side_effects || payload.SideEffects || ''
    : payload[payloadKey];
  return { known: true, value: value == null ? '' : String(value).trim() };
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeDrugKey_(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
