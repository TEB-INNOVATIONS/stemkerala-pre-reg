/**
 * =========================================================================
 * STEM KERALA — SCHOOL REGISTRATION SYSTEM (GOOGLE APPS SCRIPT BACKEND)
 * File: codeforschool.gs
 * =========================================================================
 * 
 * Instructions:
 * 1. Create a dedicated Google Sheet for School Registrations (e.g., 'STEM Kerala Schools').
 * 2. In that Google Sheet, go to Extensions -> Apps Script.
 * 3. Paste this complete code into `Code.gs` of that dedicated Apps Script project.
 * 4. Fill in the CONFIGURATION section below (Spreadsheet ID & Sheet name).
 * 5. Click 'Deploy' -> 'New deployment'.
 * 6. Select type: 'Web app'.
 * 7. Set 'Execute as': 'Me' (your account).
 * 8. Set 'Who has access': 'Anyone' (IMPORTANT: allows public school registrations).
 * 9. Click Deploy, authorize access, and copy the Web App URL.
 * 10. Paste that Web App URL into `SCHOOL_SCRIPT_URL` in `script.js` when ready.
 * =========================================================================
 */

// =========================================================================
// CONFIGURATION (Configurable placeholders for future deployment)
// =========================================================================
var SCHOOL_CONFIG = {
  // Leave empty string to bind automatically to the active container spreadsheet,
  // or insert specific target Spreadsheet ID: e.g. '1BxiMVs0XRX5nUyVPZbz...'
  SPREADSHEET_ID: '',

  // Target Tab Name
  SHEET_NAME: 'school_responses',

  // Concurrency Lock Timeout (30 seconds)
  LOCK_TIMEOUT_MS: 30000,

  // Sequential ID Prefix
  ID_PREFIX: 'STEM-SCH-'
};

// Formatted Sheet Column Headers
var SCHOOL_HEADERS = [
  'Timestamp',
  'School Registration ID',
  'School Name',
  'District',
  'Mentor Name',
  'Mentor Phone Number',
  'Number of Students',
  'Principal Name',
  'Principal Contact Number',
  'School Email',
  'Registration Status'
];

/**
 * Handle HTTP GET Requests
 * Supports:
 * - Ping test: ?action=ping
 * - Stats: ?action=stats
 * - JSONP: ?callback=myCallback
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'stats';
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  try {
    var sheet = getOrCreateSchoolSheet();
    var lastRow = sheet.getLastRow();
    var totalSchools = Math.max(0, lastRow - 1);

    var responsePayload = {
      status: 'success',
      service: 'STEM Kerala School Registration Backend',
      action: action,
      totalSchoolsRegistered: totalSchools,
      timestamp: new Date().toISOString()
    };

    return createSchoolOutput(responsePayload, callback);
  } catch (err) {
    return createSchoolOutput({
      status: 'error',
      message: 'Failed to retrieve school stats: ' + err.toString()
    }, callback);
  }
}

/**
 * Handle HTTP POST Requests
 * Processes school registration submissions with concurrency lock, validation,
 * automatic timestamp, sequential ID generation, and structured response.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  try {
    // 1. Acquire lock to prevent race conditions during concurrent submissions
    var hasLock = lock.tryLock(SCHOOL_CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return createSchoolOutput({
        status: 'error',
        message: 'The server is currently processing high traffic. Please try again in a few moments.'
      }, callback);
    }

    // 2. Extract payload
    var data = extractSchoolPayload(e);

    // 3. Anti-spam honeypot check
    if (data.website_check && String(data.website_check).trim() !== '') {
      return createSchoolOutput({
        status: 'error',
        message: 'Bot submission detected.'
      }, callback);
    }

    // 4. Server-side validation
    var validation = validateSchoolInput(data);
    if (!validation.valid) {
      return createSchoolOutput({
        status: 'validation_error',
        errors: validation.errors,
        message: 'Validation failed: ' + validation.errors.join(', ')
      }, callback);
    }

    var sheet = getOrCreateSchoolSheet();

    // 5. Generate unique sequential School Registration ID
    // Generate unique school ID in SK-EBO-SH- format
    var regId = (data.regId && String(data.regId).indexOf('SK-EBO-SH-') === 0)
      ? data.regId
      : (data.regNo && String(data.regNo).indexOf('SK-EBO-SH-') === 0)
        ? data.regNo
        : generateUniqueSchoolId(sheet, data.schoolName, cleanPhoneNumber(data.mentorPhone));

    var timestamp = new Date();

    // 6. Append new row to dedicated school sheet
    sheet.appendRow([
      timestamp,
      regId,
      data.schoolName.trim(),
      data.district.trim(),
      data.mentorName.trim(),
      cleanPhoneNumber(data.mentorPhone),
      parseInt(data.studentCount, 10),
      data.principalName.trim(),
      cleanPhoneNumber(data.principalContact),
      (data.schoolEmail || '').trim(),
      'Confirmed'
    ]);

    SpreadsheetApp.flush();

    // 7. Structured Success Response
    var responsePayload = {
      status: 'success',
      type: 'school',
      message: 'School registration successfully received and confirmed!',
      regId: regId,
      schoolName: data.schoolName.trim(),
      district: data.district.trim(),
      mentorName: data.mentorName.trim(),
      studentCount: parseInt(data.studentCount, 10),
      timestamp: timestamp.toISOString()
    };

    return createSchoolOutput(responsePayload, callback);

  } catch (err) {
    return createSchoolOutput({
      status: 'error',
      message: 'Server error processing school registration: ' + err.toString()
    }, callback);

  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

/**
 * Validate School Input Data
 */
function validateSchoolInput(data) {
  var errors = [];

  if (!data.schoolName || data.schoolName.trim().length < 2) {
    errors.push('Valid school name is required (at least 2 characters)');
  }

  if (!data.district || data.district.trim().length === 0) {
    errors.push('District is required');
  }

  if (!data.mentorName || data.mentorName.trim().length < 2) {
    errors.push('Mentor / Coordinating teacher name is required');
  }

  var mentorPhone = cleanPhoneNumber(data.mentorPhone);
  if (!/^[6-9]\d{9}$/.test(mentorPhone)) {
    errors.push('Valid 10-digit Indian mobile number required for mentor');
  }

  var count = parseInt(data.studentCount, 10);
  if (isNaN(count) || count <= 0) {
    errors.push('Number of interested students must be greater than zero');
  }

  if (!data.principalName || data.principalName.trim().length < 2) {
    errors.push('Principal full name is required');
  }

  var principalPhone = cleanPhoneNumber(data.principalContact);
  if (!/^[6-9]\d{9}$/.test(principalPhone)) {
    errors.push('Valid 10-digit Indian contact number required for Principal');
  }

  if (data.schoolEmail && data.schoolEmail.trim().length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.schoolEmail.trim())) {
      errors.push('Invalid school email address format');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Extract parameters from POST event (handles urlencoded and json)
 */
function extractSchoolPayload(e) {
  var data = {};
  if (!e) return data;

  if (e.parameter) {
    for (var k in e.parameter) {
      data[k] = e.parameter[k];
    }
  }

  if (e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      for (var key in json) {
        data[key] = json[key];
      }
    } catch (ignored) {}
  }

  return {
    schoolName: data.schoolName || data.school || '',
    district: data.district || '',
    mentorName: data.mentorName || data.coordinatorName || '',
    mentorPhone: data.mentorPhone || data.mentorPhoneNumber || '',
    studentCount: data.studentCount || data.numberOfStudents || '',
    principalName: data.principalName || '',
    principalContact: data.principalContact || data.principalPhone || '',
    schoolEmail: data.schoolEmail || data.email || '',
    website_check: data.website_check || ''
  };
}

/**
 * Normalize Indian mobile numbers
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  var cleaned = String(phone).replace(/[^\d]/g, '');
  if (cleaned.length === 12 && cleaned.indexOf('91') === 0) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.length === 11 && cleaned.indexOf('0') === 0) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Helper to ensure dedicated school sheet exists with formatted headers
 */
function getOrCreateSchoolSheet() {
  var ss;
  if (SCHOOL_CONFIG.SPREADSHEET_ID && SCHOOL_CONFIG.SPREADSHEET_ID.trim() !== '') {
    ss = SpreadsheetApp.openById(SCHOOL_CONFIG.SPREADSHEET_ID.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName(SCHOOL_CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SCHOOL_CONFIG.SHEET_NAME);
    sheet.appendRow(SCHOOL_HEADERS);

    var headerRange = sheet.getRange(1, 1, 1, SCHOOL_HEADERS.length);
    headerRange.setBackground('#003B22');
    headerRange.setFontColor('#FFE500');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    for (var i = 1; i <= SCHOOL_HEADERS.length; i++) {
      sheet.setColumnWidth(i, 175);
    }
  }

  return sheet;
}

/**
 * Format sequential IDs
 */
function padNumber(num, size) {
  var s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

/**
 * Output helper (JSON / JSONP)
 */
function createSchoolOutput(payload, callback) {
  var outputText;
  var mimeType;

  if (callback) {
    var cleanCallback = callback.replace(/[^a-zA-Z0-9_]/g, '');
    outputText = cleanCallback + '(' + JSON.stringify(payload) + ');';
    mimeType = ContentService.MimeType.JAVASCRIPT;
  } else {
    outputText = JSON.stringify(payload);
    mimeType = ContentService.MimeType.JSON;
  }

  return ContentService.createTextOutput(outputText).setMimeType(mimeType);
}

/**
 * Generate School Registration ID: SK-EBO-SH-
 * Checks against existing IDs in sheet to prevent collision.
 */
function generateUniqueSchoolId(sheet, schoolName, mentorPhone) {
  var cleanSchool = (schoolName || 'SC').replace(/[^a-zA-Z]/g, '').toUpperCase();
  var first2 = (cleanSchool.length >= 2 ? cleanSchool.substring(0, 2) : (cleanSchool + 'X').substring(0, 2));
  var cleanDigits = (mentorPhone || '00').replace(/[^0-9]/g, '');
  var last2 = cleanDigits.length >= 2 ? cleanDigits.substring(cleanDigits.length - 2) : '00';

  var existingIds = getExistingSchoolIds(sheet, 2); // Column 2 is School Registration ID
  var attempts = 0;
  var candidateId = '';

  do {
    var random3 = generateRandomLetters(3);
    candidateId = 'SK-EBO-SH-' + first2 + last2 + random3;
    attempts++;
  } while (existingIds[candidateId] && attempts < 20);

  return candidateId;
}

function generateRandomLetters(length) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getExistingSchoolIds(sheet, colIndex) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var val = String(values[i][0]).trim();
      if (val) map[val] = true;
    }
  }
  return map;
}
