/**
 * AI Drug Tutor Google Sheets web app (protocol v3).
 *
 * Deploy this as the app's existing /exec web app. A Sheet-bound script uses
 * its active spreadsheet. A standalone script must set the SPREADSHEET_ID
 * Script Property; SHEET_NAME is optional in either setup.
 */

const DRUG_SHEET_PROTOCOL_VERSION = 3;
const DRUG_UPDATE_PROTOCOL_VERSION = 2;
const DEFAULT_DRUG_HEADERS = [
  'name',
  'generic_name',
  'brand_name',
  'class',
  'class_zh_hk',
  'system',
  'system_zh_hk',
  'indication',
  'indication_zh_hk',
  'SideEffects',
  'side_effects_zh_hk',
  'nursing',
  'nursing_zh_hk',
  'effect_of_drug',
  'effect_of_drug_zh_hk',
  'data_source',
  'verified_at',
  'ai_modified'
];
const BILINGUAL_DRUG_HEADERS = [
  'class_zh_hk',
  'system_zh_hk',
  'indication_zh_hk',
  'side_effects_zh_hk',
  'nursing_zh_hk',
  'effect_of_drug_zh_hk'
];
const DRUG_METADATA_HEADERS = ['data_source', 'verified_at', 'ai_modified'];
const AI_USAGE_HEADERS = [
  'request_id',
  'timestamp',
  'feature',
  'model',
  'mode',
  'success',
  'prompt_tokens',
  'cache_hit_tokens',
  'cache_miss_tokens',
  'completion_tokens',
  'total_tokens',
  'retry_count',
  'estimated_usd',
  'pricing_period',
  'pricing_version',
  'error'
];

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').toLowerCase();
  if (action === 'capabilities') {
    return jsonResponse_({
      ok: true,
      service: 'ai-drug-tutor-sheet',
      supports_add: true,
      supports_update: true,
      supports_usage_log: true,
      bilingual_fields: true,
      languages: ['en', 'zh-HK'],
      usage_sheet: 'AI_Usage',
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
  if (action === 'log_ai_usage') {
    if (Number(payload.protocol_version || 0) < DRUG_SHEET_PROTOCOL_VERSION) {
      return jsonResponse_({ ok: false, error: 'protocol_mismatch', message: 'AI usage logging requires protocol v3.' });
    }
    const usageLock = LockService.getScriptLock();
    try {
      usageLock.waitLock(10000);
      return logAIUsage_(payload);
    } catch (error) {
      return jsonResponse_({
        ok: false,
        error: 'server_error',
        message: String(error && error.message || error || 'Unknown server error')
      });
    } finally {
      if (usageLock.hasLock()) usageLock.releaseLock();
    }
  }
  if (action !== 'add' && action !== 'update') {
    return jsonResponse_({ ok: false, error: 'unsupported_action', message: 'Only add, update and log_ai_usage are supported.' });
  }
  if (!String(payload.name || '').trim()) {
    return jsonResponse_({ ok: false, error: 'missing_name', message: 'A drug name is required.' });
  }
  if (action === 'update' && Number(payload.protocol_version || 0) < DRUG_UPDATE_PROTOCOL_VERSION) {
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

function getTargetSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = String(properties.getProperty('SPREADSHEET_ID') || '').trim();
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No spreadsheet is configured. Set the SPREADSHEET_ID Script Property.');
  }
  return spreadsheet;
}

function getTargetDrugSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheet = getTargetSpreadsheet_();
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
  const normalizedHeaders = headers.map(normalizeHeader_);
  const requiredExtraHeaders = BILINGUAL_DRUG_HEADERS.concat(DRUG_METADATA_HEADERS);
  const missingBilingualHeaders = requiredExtraHeaders.filter(function (header) {
    return normalizedHeaders.indexOf(normalizeHeader_(header)) === -1;
  });
  if (missingBilingualHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, missingBilingualHeaders.length).setValues([missingBilingualHeaders]);
    return headers.concat(missingBilingualHeaders);
  }
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
    classzhhk: 'class_zh_hk',
    classzh: 'class_zh_hk',
    classcantonese: 'class_zh_hk',
    system: 'system',
    bodysystem: 'system',
    systemzhhk: 'system_zh_hk',
    systemzh: 'system_zh_hk',
    systemcantonese: 'system_zh_hk',
    indication: 'indication',
    indications: 'indication',
    use: 'indication',
    uses: 'indication',
    indicationzhhk: 'indication_zh_hk',
    indicationzh: 'indication_zh_hk',
    indicationcantonese: 'indication_zh_hk',
    sideeffect: 'side_effects',
    sideeffects: 'side_effects',
    adverseeffect: 'side_effects',
    adverseeffects: 'side_effects',
    sideeffectszhhk: 'side_effects_zh_hk',
    sideeffectszh: 'side_effects_zh_hk',
    sideeffectscantonese: 'side_effects_zh_hk',
    nursing: 'nursing',
    nursingcare: 'nursing',
    nursingzhhk: 'nursing_zh_hk',
    nursingcarezhhk: 'nursing_zh_hk',
    nursingzh: 'nursing_zh_hk',
    nursingcantonese: 'nursing_zh_hk',
    effect: 'effect_of_drug',
    effects: 'effect_of_drug',
    drugeffect: 'effect_of_drug',
    effectofdrug: 'effect_of_drug',
    quiz: 'effect_of_drug',
    effectofdrugzhhk: 'effect_of_drug_zh_hk',
    drugeffectzhhk: 'effect_of_drug_zh_hk',
    effectzhhk: 'effect_of_drug_zh_hk',
    effectofdrugzh: 'effect_of_drug_zh_hk',
    drugeffectcantonese: 'effect_of_drug_zh_hk',
    datasource: 'data_source',
    source: 'data_source',
    verifiedat: 'verified_at',
    lastverified: 'verified_at',
    aimodified: 'ai_modified',
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

function getAIUsageSheet_() {
  const spreadsheet = getTargetSpreadsheet_();
  const properties = PropertiesService.getScriptProperties();
  const sheetName = String(properties.getProperty('AI_USAGE_SHEET_NAME') || 'AI_Usage').trim() || 'AI_Usage';
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureAIUsageHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, AI_USAGE_HEADERS.length).setValues([AI_USAGE_HEADERS]);
    return;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(function (header) { return normalizeHeader_(header); });
  const valid = AI_USAGE_HEADERS.every(function (header, index) {
    return headers[index] === normalizeHeader_(header);
  });
  if (!valid) throw new Error('AI_Usage has incompatible headers. Rename it or restore the v3 header row.');
}

function logAIUsage_(payload) {
  const requestId = String(payload.request_id || '').trim();
  if (!requestId) {
    return jsonResponse_({ ok: false, error: 'missing_request_id', message: 'A request_id is required.' });
  }
  const sheet = getAIUsageSheet_();
  ensureAIUsageHeaders_(sheet);
  if (sheet.getLastRow() > 1) {
    const existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    const duplicate = existingIds.some(function (row) { return String(row[0] || '').trim() === requestId; });
    if (duplicate) {
      return jsonResponse_({ ok: true, action: 'usage_exists', duplicate: true, request_id: requestId, protocol_version: DRUG_SHEET_PROTOCOL_VERSION });
    }
  }
  const numericFields = {
    prompt_tokens: true,
    cache_hit_tokens: true,
    cache_miss_tokens: true,
    completion_tokens: true,
    total_tokens: true,
    retry_count: true,
    estimated_usd: true
  };
  const row = AI_USAGE_HEADERS.map(function (header) {
    if (header === 'success') return payload.success === true || String(payload.success).toLowerCase() === 'true';
    if (numericFields[header]) {
      const number = Number(payload[header] || 0);
      return isFinite(number) && number >= 0 ? number : 0;
    }
    return String(payload[header] == null ? '' : payload[header]).trim();
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return jsonResponse_({
    ok: true,
    action: 'usage_logged',
    logged: true,
    request_id: requestId,
    row: sheet.getLastRow(),
    protocol_version: DRUG_SHEET_PROTOCOL_VERSION
  });
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
