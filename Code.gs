/**
 * =========================================================================
 * STEM KERALA PRE-REGISTRATION SYSTEM — UNIFIED APPS SCRIPT BACKEND v3.0
 * =========================================================================
 * 
 * Supports both:
 * 1. Student Pre-Registration (Sheet: 'responses')
 *    - Strict first-200 20% discount server-side assignment
 *    - Sequential Student ID: STEM-2026-XXXX
 *    - Duplicate phone number prevention
 * 2. School Registration (Sheet: 'school_responses')
 *    - Distinct school registration tracking
 *    - Sequential School ID: STEM-SCH-XXXX
 *    - Independent of the first-200 student discount count
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. In your target Google Sheet, go to Extensions -> Apps Script.
 * 2. Replace all existing code in Code.gs with this complete file.
 * 3. Click 'Save' (Ctrl+S).
 * 4. Click 'Deploy' -> 'New deployment' (or Manage deployments -> Edit -> New version).
 * 5. Select type: 'Web app'.
 * 6. Set 'Execute as': 'Me' (your account).
 * 7. Set 'Who has access': 'Anyone' (CRITICAL: enables public registration without Google login).
 * 8. Authorize permissions and copy the new Web App URL.
 * =========================================================================
 */

var STUDENT_SHEET_NAME = 'responses';
var SCHOOL_SHEET_NAME = 'school_responses';
var EARLY_BIRD_MAX_SLOTS = 200;
var LOCK_TIMEOUT_MS = 30000;

var STUDENT_HEADERS = [
  'Timestamp',
  'Registration Number',
  'Full Name',
  'Class',
  'Parent Name',
  'Phone Number',
  'School Name',
  'District',
  'Discount Eligibility',
  'Registration Status'
];

var SCHOOL_HEADERS = [
  'Timestamp',
  'School Registration ID',
  'School Name',
  'District',
  'Mentor Name',
  'Mentor Phone',
  'Number of Students',
  'Principal Name',
  'Principal Contact',
  'School Email',
  'Registration Status'
];

/**
 * Handle HTTP GET Requests
 * Supports:
 * - ?action=stats (Live remaining student discount slots and confirmed totals)
 * - ?action=ping (Health check)
 * - ?callback=... (JSONP callback support)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'stats';
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  try {
    var studentSheet = getOrCreateSheet(STUDENT_SHEET_NAME, STUDENT_HEADERS);
    var stats = calculateStudentStats(studentSheet);

    var responsePayload = {
      status: 'success',
      action: action,
      totalStudentRegistrations: stats.totalConfirmed,
      earlyBirdMax: EARLY_BIRD_MAX_SLOTS,
      claimedSlots: stats.eligibleCount,
      remainingSlots: Math.max(0, EARLY_BIRD_MAX_SLOTS - stats.eligibleCount),
      offerOpen: stats.eligibleCount < EARLY_BIRD_MAX_SLOTS,
      timestamp: new Date().toISOString()
    };

    return createOutput(responsePayload, callback);
  } catch (err) {
    return createOutput({
      status: 'error',
      message: 'Failed to retrieve stats: ' + err.toString()
    }, callback);
  }
}

/**
 * Handle HTTP POST Requests
 * Routes either student registration or school registration based on 'type' or 'registrationType'
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;

  try {
    var hasLock = lock.tryLock(LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return createOutput({
        status: 'error',
        message: 'The server is currently processing high traffic. Please try again in a few moments.'
      }, callback);
    }

    var raw = extractRawPayload(e);

    // Spam honeypot detection
    if (raw.website_check && String(raw.website_check).trim() !== '') {
      return createOutput({
        status: 'error',
        message: 'Spam submission detected.'
      }, callback);
    }

    var formType = (raw.registrationType || raw.type || 'student').toLowerCase();

    if (formType === 'school') {
      return handleSchoolRegistration(raw, callback);
    } else {
      return handleStudentRegistration(raw, callback);
    }

  } catch (err) {
    return createOutput({
      status: 'error',
      message: 'Server error processing registration: ' + err.toString()
    }, callback);
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

/**
 * Student Pre-Registration Handler
 */
function handleStudentRegistration(data, callback) {
  var fullName = (data.fullName || data.name || '').trim();
  var studentClass = (data.studentClass || data.class || '').trim();
  var parentName = (data.parentName || '').trim();
  var rawPhone = data.phoneNumber || data.phone || '';
  var schoolName = (data.schoolName || data.school || '').trim();
  var district = (data.district || '').trim();

  // Validate required student fields
  var errors = [];
  if (!fullName || fullName.length < 2) errors.push('Valid student name required');
  if (!studentClass) errors.push('Class grade required');
  if (!parentName || parentName.length < 2) errors.push('Valid parent name required');
  var cleanPhone = cleanPhoneNumber(rawPhone);
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) errors.push('Valid 10-digit Indian mobile number required');
  if (!schoolName || schoolName.length < 2) errors.push('Valid school name required');
  if (!district) errors.push('District is required');

  if (errors.length > 0) {
    return createOutput({
      status: 'validation_error',
      errors: errors,
      message: 'Validation failed: ' + errors.join(', ')
    }, callback);
  }

  var sheet = getOrCreateSheet(STUDENT_SHEET_NAME, STUDENT_HEADERS);

  // Duplicate phone check
  var duplicate = checkStudentDuplicate(sheet, cleanPhone);
  if (duplicate.isDuplicate) {
    return createOutput({
      status: 'duplicate',
      message: 'A registration already exists with this phone number (+91 ' + cleanPhone + ').',
      regNo: duplicate.regNo,
      name: duplicate.name,
      discountStatus: duplicate.discountStatus,
      discountEligible: duplicate.discountEligible
    }, callback);
  }

  // Calculate current confirmed student count
  var stats = calculateStudentStats(sheet);
  var nextIndex = stats.totalConfirmed + 1;

  // Strict server-side first-200 discount assignment
  var isDiscountEligible = stats.eligibleCount < EARLY_BIRD_MAX_SLOTS;
  var discountStatusText = isDiscountEligible
    ? '20% Discount Eligible (Early Bird)'
    : 'Standard Registration (Early Bird Limit Reached)';

  var regNumber = (data.regNo && String(data.regNo).indexOf('SK-EBO-SU-') === 0)
    ? data.regNo 
    : generateUniqueStudentId(sheet, fullName, cleanPhone);

  var timestamp = new Date();

  sheet.appendRow([
    timestamp,
    regNumber,
    fullName,
    studentClass,
    parentName,
    cleanPhone,
    schoolName,
    district,
    discountStatusText,
    'Confirmed'
  ]);

  SpreadsheetApp.flush();

  return createOutput({
    status: 'success',
    type: 'student',
    message: 'Student pre-registration successfully confirmed!',
    regNo: regNumber,
    name: fullName,
    studentClass: studentClass,
    district: district,
    discountEligible: isDiscountEligible,
    discountStatus: discountStatusText,
    remainingSlots: Math.max(0, EARLY_BIRD_MAX_SLOTS - (stats.eligibleCount + (isDiscountEligible ? 1 : 0)))
  }, callback);
}

/**
 * School Registration Handler
 */
function handleSchoolRegistration(data, callback) {
  var schoolName = (data.schoolName || data.school || '').trim();
  var district = (data.district || '').trim();
  var mentorName = (data.mentorName || '').trim();
  var rawMentorPhone = data.mentorPhone || data.mentorPhoneNumber || '';
  var studentCount = parseInt(data.studentCount || data.numberOfStudents || '0', 10);
  var principalName = (data.principalName || '').trim();
  var rawPrincipalPhone = data.principalContact || data.principalPhone || '';
  var schoolEmail = (data.schoolEmail || data.email || '').trim();

  // Validate required school fields
  var errors = [];
  if (!schoolName || schoolName.length < 2) errors.push('Valid school name required');
  if (!district) errors.push('District is required');
  if (!mentorName || mentorName.length < 2) errors.push('Mentor / Teacher coordinator name required');
  var cleanMentorPhone = cleanPhoneNumber(rawMentorPhone);
  if (!/^[6-9]\d{9}$/.test(cleanMentorPhone)) errors.push('Valid 10-digit mentor phone number required');
  if (isNaN(studentCount) || studentCount <= 0) errors.push('Number of interested students must be greater than zero');
  if (!principalName || principalName.length < 2) errors.push('Principal name required');
  var cleanPrincipalPhone = cleanPhoneNumber(rawPrincipalPhone);
  if (!/^[6-9]\d{9}$/.test(cleanPrincipalPhone)) errors.push('Valid 10-digit principal contact number required');

  if (errors.length > 0) {
    return createOutput({
      status: 'validation_error',
      errors: errors,
      message: 'Validation failed: ' + errors.join(', ')
    }, callback);
  }

  var sheet = getOrCreateSheet(SCHOOL_SHEET_NAME, SCHOOL_HEADERS);
  var lastRow = sheet.getLastRow();
  var schoolCount = Math.max(0, lastRow - 1);
  var nextIndex = schoolCount + 1;

  var regNumber = (data.regNo && String(data.regNo).indexOf('SK-EBO-SH-') === 0)
    ? data.regNo
    : generateUniqueSchoolId(sheet, schoolName, cleanMentorPhone);
  var timestamp = new Date();

  sheet.appendRow([
    timestamp,
    regNumber,
    schoolName,
    district,
    mentorName,
    cleanMentorPhone,
    studentCount,
    principalName,
    cleanPrincipalPhone,
    schoolEmail,
    'Confirmed'
  ]);

  SpreadsheetApp.flush();

  return createOutput({
    status: 'success',
    type: 'school',
    message: 'School registration successfully submitted!',
    regNo: regNumber,
    schoolName: schoolName,
    district: district,
    mentorName: mentorName,
    studentCount: studentCount
  }, callback);
}

/**
 * Calculate Student Stats from 'responses' sheet
 */
function calculateStudentStats(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { totalConfirmed: 0, eligibleCount: 0 };
  }

  var discountColumnValues = sheet.getRange(2, 9, lastRow - 1, 1).getValues();
  var totalConfirmed = lastRow - 1;
  var eligibleCount = 0;

  for (var i = 0; i < discountColumnValues.length; i++) {
    var val = String(discountColumnValues[i][0]).toLowerCase();
    if (val.indexOf('20%') !== -1 || val.indexOf('early bird') !== -1) {
      eligibleCount++;
    }
  }

  return {
    totalConfirmed: totalConfirmed,
    eligibleCount: eligibleCount
  };
}

/**
 * Check if a student with the same phone number already registered
 */
function checkStudentDuplicate(sheet, cleanPhone) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { isDuplicate: false };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var phoneInRow = cleanPhoneNumber(row[5]);
    if (phoneInRow === cleanPhone && cleanPhone !== '') {
      var discountText = String(row[8] || '');
      var isEligible = discountText.indexOf('20%') !== -1 || discountText.indexOf('Early Bird') !== -1;
      return {
        isDuplicate: true,
        regNo: row[1],
        name: row[2],
        discountStatus: discountText,
        discountEligible: isEligible
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Extract parameters from POST event
 */
function extractRawPayload(e) {
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

  return data;
}

/**
 * Normalize Indian phone numbers to 10 digits
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
 * Helper to ensure a sheet exists with specified headers
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);

    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#00512E');
    headerRange.setFontColor('#FFE500');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 160);
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
function createOutput(payload, callback) {
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
 * Generate Student Registration ID: SK-EBO-SU-
 * Checks against existing IDs in sheet to prevent collision.
 */
function generateUniqueStudentId(sheet, fullName, phone) {
  var cleanName = (fullName || 'ST').replace(/[^a-zA-Z]/g, '').toUpperCase();
  var first2 = (cleanName.length >= 2 ? cleanName.substring(0, 2) : (cleanName + 'X').substring(0, 2));
  var cleanDigits = (phone || '00').replace(/[^0-9]/g, '');
  var last2 = cleanDigits.length >= 2 ? cleanDigits.substring(cleanDigits.length - 2) : '00';
  
  var existingIds = getExistingColumnValues(sheet, 2); // Column 2 is Registration Number
  var attempts = 0;
  var candidateId = '';

  do {
    var random3 = generateRandomLetters(3);
    candidateId = 'SK-EBO-SU-' + first2 + last2 + random3;
    attempts++;
  } while (existingIds[candidateId] && attempts < 20);

  return candidateId;
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

  var existingIds = getExistingColumnValues(sheet, 2); // Column 2 is Registration Number
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

function getExistingColumnValues(sheet, colIndex) {
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
