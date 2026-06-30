// ===================================================================
// Admin Offices Full Submit Snapshot Guard — V3
// Scope: admin_offices_attendance.html + admin_offices_consumables.html
// يحفظ صورة تشغيل كاملة قابلة للاسترجاع عند التعديل، لكن يرسلها كـ flat snapshot
// بدون نسخ localStorage الضخمة والمتداخلة التي كانت تسبب 413 Content Too Large.
// لا يغير الحسابات أو مفاتيح الحفظ الأصلية.
// ===================================================================
(function () {
  'use strict';

  var page = (location.pathname || '').split('/').pop() || '';
  if (!/admin_offices_(attendance|consumables)\.html/.test(page)) return;
  if (window.__ADMIN_OFFICES_FULL_SUBMIT_SNAPSHOT_GUARD_V3__) return;
  window.__ADMIN_OFFICES_FULL_SUBMIT_SNAPSHOT_GUARD_V3__ = true;

  var SNAPSHOT_KEY = 'najran_admin_offices_complete_submit_snapshot_v1';
  var LABOR_KEY = 'najran_admin_offices_labor_submit_snapshot_v1';
  var CONSUMABLES_KEY = 'najran_admin_offices_consumables_submit_snapshot_v1';
  var META_KEY = 'najran_admin_offices_submit_meta_v1';
  var submitting = false;

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function readLocal(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (_) {}
    if (raw == null) return null;
    return safeJsonParse(raw, raw);
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('[Admin Offices Full Submit Snapshot] failed to write', key, e); }
  }

  function isOwnSnapshotKey(key) {
    return key === SNAPSHOT_KEY || key === LABOR_KEY || key === CONSUMABLES_KEY || key === META_KEY;
  }

  function shouldCaptureKey(key) {
    if (!key || isOwnSnapshotKey(key)) return false;
    if (/^(najran_session|__clerk|clerk_|loglevel|amplitude|chakra|persist:)/.test(key)) return false;

    return (
      /adminOffice/i.test(key) ||
      /adminOffices/i.test(key) ||
      /admin_offices/i.test(key) ||
      /raise.*letter/i.test(key) ||
      /letter/i.test(key) ||
      /signature/i.test(key) ||
      /grand/i.test(key) ||
      /title/i.test(key) ||
      /performance/i.test(key) ||
      /subcontractors_data_/i.test(key) ||
      /water_supply_data_/i.test(key) ||
      /laundry_supply_data_/i.test(key) ||
      /sewage_disposal_data_/i.test(key) ||
      /summary_data_/i.test(key) ||
      /signatures_data_/i.test(key) ||
      /print_titles_data_/i.test(key) ||
      /notes_data_/i.test(key) ||
      key === 'persistentContractData' ||
      key === 'persistentExtractData' ||
      key === 'finalLaborCost' ||
      key === 'finalConsumablesCost' ||
      key === 'grand-net-total-admin' ||
      key === 'companyName' ||
      key === 'hospitalName' ||
      key === 'contractDetails' ||
      key === 'extractMonth' ||
      key === 'extractYear' ||
      key === 'paymentNumber' ||
      key === 'extractNumber' ||
      key === 'extractStart' ||
      key === 'extractEnd' ||
      key === 'extractFromDate' ||
      key === 'extractToDate'
    );
  }

  function getSession() {
    return readLocal('najran_session') || {};
  }

  function getContractData() {
    var c = readLocal('persistentContractData') || {};
    var e = readLocal('persistentExtractData') || {};
    var extractMonth = e.extractMonth || localStorage.getItem('extractMonth') || '';
    var extractYear = e.extractYear || localStorage.getItem('extractYear') || new Date().getFullYear();
    var paymentNumber = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '';
    var extractStart = e.extractStart || e.extractFromDate || localStorage.getItem('extractStart') || localStorage.getItem('extractFromDate') || '';
    var extractEnd = e.extractEnd || e.extractToDate || localStorage.getItem('extractEnd') || localStorage.getItem('extractToDate') || '';
    return {
      companyName: localStorage.getItem('companyName') || c.companyName || c.company || '',
      contractNumber: c.contractNumber || localStorage.getItem('contractDetails') || '',
      hospitalName: c.hospitalName || localStorage.getItem('hospitalName') || '',
      extractMonth: extractMonth,
      extractYear: String(extractYear || ''),
      paymentNumber: paymentNumber,
      extractStart: extractStart,
      extractEnd: extractEnd,
      periodMonth: String((extractMonth || '') + ' ' + (extractYear || '')).trim()
    };
  }

  function forceSaveCurrentScreen() {
    try { if (typeof window.captureUIData === 'function') window.captureUIData(); } catch (_) {}
    try { if (typeof window.saveAllData === 'function') window.saveAllData(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try {
      if (typeof window.getAttendanceData === 'function' && typeof window.saveAttendanceData === 'function') {
        window.saveAttendanceData(window.getAttendanceData());
      }
    } catch (_) {}
  }

  function countRows(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') {
      return Object.values(value).reduce(function (sum, rows) {
        return sum + (Array.isArray(rows) ? rows.length : 0);
      }, 0);
    }
    return 0;
  }

  function tableCountForPrefix(prefix) {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        out[key] = countRows(readLocal(key));
      }
    } catch (_) {}
    return out;
  }

  function collectRelevantLocalStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!shouldCaptureKey(key)) continue;
        out[key] = readLocal(key);
      }
    } catch (_) {}
    return out;
  }

  function collectByPattern(pattern) {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || isOwnSnapshotKey(key)) continue;
        if (pattern.test(key)) out[key] = readLocal(key);
      }
    } catch (_) {}
    return out;
  }

  function buildLaborSnapshot() {
    var data = readLocal('adminOfficesAttendanceData_v1') || {};
    var names = readLocal('adminOfficeNames_v1') || {};
    var affiliations = readLocal('adminOfficeAffiliations_v1') || {};
    var officeKeys = Object.keys(names || {});
    var officeRows = {};
    officeKeys.forEach(function (key) { officeRows[key] = Array.isArray(data[key]) ? data[key].length : 0; });

    return {
      type: 'admin_offices_labor',
      capturedAt: new Date().toISOString(),
      page: page,
      officeCount: officeKeys.length,
      employeeRows: countRows(data),
      officeRows: officeRows,
      names: names,
      affiliations: affiliations,
      attendanceData: data,
      positionsSetup: readLocal('adminOfficesPositionsSetup_v1'),
      signatures: collectByPattern(/signature|adminOffice.*sign|grand/i),
      letters: collectByPattern(/raise.*letter|letter/i),
      titles: collectByPattern(/title/i),
      totals: {
        finalLaborCost: readLocal('finalLaborCost'),
        grandNetTotalAdmin: readLocal('grand-net-total-admin')
      }
    };
  }

  function buildConsumablesSnapshot() {
    return {
      type: 'admin_offices_consumables',
      capturedAt: new Date().toISOString(),
      page: page,
      tables: {
        subcontractors: collectByPattern(/^subcontractors_data_/i),
        performance: collectByPattern(/^performance_data_/i),
        water: collectByPattern(/^water_supply_data_/i),
        laundry: collectByPattern(/^laundry_supply_data_/i),
        sewage: collectByPattern(/^sewage_disposal_data_/i),
        summary: collectByPattern(/^summary_data_/i),
        notes: collectByPattern(/^notes_data_/i),
        signatures: collectByPattern(/^signatures_data_/i),
        titles: collectByPattern(/^print_titles_data_/i)
      },
      rowCounts: {
        subcontractors: tableCountForPrefix('subcontractors_data_'),
        performance: tableCountForPrefix('performance_data_'),
        water: tableCountForPrefix('water_supply_data_'),
        laundry: tableCountForPrefix('laundry_supply_data_'),
        sewage: tableCountForPrefix('sewage_disposal_data_'),
        summary: tableCountForPrefix('summary_data_')
      },
      totals: {
        finalConsumablesCost: readLocal('finalConsumablesCost')
      }
    };
  }

  function buildCompleteSnapshot(trigger) {
    forceSaveCurrentScreen();

    var labor = buildLaborSnapshot();
    var consumables = buildConsumablesSnapshot();
    var relevantLocalStorage = collectRelevantLocalStorage();

    var complete = {
      schema: 'admin_offices_complete_submit_snapshot_v3',
      capturedAt: new Date().toISOString(),
      trigger: trigger || 'manual',
      page: page,
      contract: readLocal('persistentContractData'),
      extract: readLocal('persistentExtractData'),
      labor: labor,
      consumables: consumables,
      localStorageSubset: relevantLocalStorage,
      keyManifest: Object.keys(relevantLocalStorage).sort()
    };

    writeLocal(LABOR_KEY, labor);
    writeLocal(CONSUMABLES_KEY, consumables);
    writeLocal(SNAPSHOT_KEY, complete);

    console.info('[Admin Offices Full Submit Snapshot] captured', {
      trigger: trigger,
      offices: labor.officeCount,
      employees: labor.employeeRows,
      keys: complete.keyManifest.length
    });

    return complete;
  }

  function put(out, key, value) {
    if (!key || value == null) return;
    out[key] = value;
  }

  function copyMap(out, map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (key) {
      if (!key || isOwnSnapshotKey(key)) return;
      if (out[key] === undefined) out[key] = map[key];
    });
  }

  function stripLargeInlineAssets(value) {
    if (typeof value === 'string') {
      if (/^data:image\//i.test(value) && value.length > 500000) {
        return '[large-inline-image-omitted-from-submit-payload]';
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(stripLargeInlineAssets);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = stripLargeInlineAssets(value[key]);
      });
      return out;
    }
    return value;
  }

  function buildFlatSubmitExtractData(complete, contractData, part) {
    var out = {};
    var labor = complete.labor || {};
    var consumables = complete.consumables || {};
    var extract = complete.extract || readLocal('persistentExtractData') || {};
    var contract = complete.contract || readLocal('persistentContractData') || {};

    put(out, 'persistentContractData', contract);
    put(out, 'persistentExtractData', extract);
    put(out, 'companyName', contractData.companyName || contract.companyName || contract.company || '');
    put(out, 'hospitalName', contractData.hospitalName || contract.hospitalName || '');
    put(out, 'contractDetails', contractData.contractNumber || contract.contractNumber || '');
    put(out, 'extractMonth', contractData.extractMonth || extract.extractMonth || '');
    put(out, 'extractYear', contractData.extractYear || extract.extractYear || '');
    put(out, 'paymentNumber', contractData.paymentNumber || extract.paymentNumber || extract.extractNumber || '');
    put(out, 'extractNumber', contractData.paymentNumber || extract.extractNumber || extract.paymentNumber || '');
    put(out, 'extractStart', contractData.extractStart || extract.extractStart || extract.extractFromDate || '');
    put(out, 'extractEnd', contractData.extractEnd || extract.extractEnd || extract.extractToDate || '');
    put(out, 'extractFromDate', contractData.extractStart || extract.extractFromDate || extract.extractStart || '');
    put(out, 'extractToDate', contractData.extractEnd || extract.extractToDate || extract.extractEnd || '');

    put(out, 'adminOfficesAttendanceData_v1', labor.attendanceData || readLocal('adminOfficesAttendanceData_v1') || {});
    put(out, 'adminOfficeNames_v1', labor.names || readLocal('adminOfficeNames_v1') || {});
    put(out, 'adminOfficeAffiliations_v1', labor.affiliations || readLocal('adminOfficeAffiliations_v1') || {});
    put(out, 'adminOfficesPositionsSetup_v1', labor.positionsSetup || readLocal('adminOfficesPositionsSetup_v1'));

    copyMap(out, labor.signatures);
    copyMap(out, labor.letters);
    copyMap(out, labor.titles);

    if (consumables.tables) {
      copyMap(out, consumables.tables.subcontractors);
      copyMap(out, consumables.tables.performance);
      copyMap(out, consumables.tables.water);
      copyMap(out, consumables.tables.laundry);
      copyMap(out, consumables.tables.sewage);
      copyMap(out, consumables.tables.summary);
      copyMap(out, consumables.tables.notes);
      copyMap(out, consumables.tables.signatures);
      copyMap(out, consumables.tables.titles);
    }

    put(out, 'finalLaborCost', labor.totals ? labor.totals.finalLaborCost : readLocal('finalLaborCost'));
    put(out, 'finalConsumablesCost', consumables.totals ? consumables.totals.finalConsumablesCost : readLocal('finalConsumablesCost'));
    put(out, 'grand-net-total-admin', labor.totals ? labor.totals.grandNetTotalAdmin : readLocal('grand-net-total-admin'));

    copyMap(out, complete.localStorageSubset);

    out[META_KEY] = {
      schema: 'admin_offices_flat_submit_snapshot_v3',
      capturedAt: complete.capturedAt,
      sourcePage: page,
      submittedPart: part,
      offices: labor.officeCount || 0,
      employees: labor.employeeRows || 0,
      keys: Object.keys(out).length
    };

    return out;
  }

  function shrinkPayloadIfNeeded(payload) {
    try {
      var size = JSON.stringify(payload).length;
      if (size <= 18 * 1024 * 1024) return payload;
      var clone = Object.assign({}, payload, {
        extractData: stripLargeInlineAssets(payload.extractData || {})
      });
      console.warn('[Admin Offices Full Submit Snapshot] payload trimmed only for oversized inline image assets', {
        beforeBytes: size,
        afterBytes: JSON.stringify(clone).length
      });
      return clone;
    } catch (_) {
      return payload;
    }
  }

  function numericLocal(keys) {
    for (var i = 0; i < keys.length; i++) {
      var n = parseFloat(String(localStorage.getItem(keys[i]) || '').replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  }

  function getAdminOfficePart() {
    return page.indexOf('consumables') > -1 ? 'consumables' : 'labor';
  }

  function getPartTotal(part) {
    if (part === 'consumables') {
      return numericLocal(['finalConsumablesCost']) || 0;
    }
    return numericLocal(['grand-net-total-admin', 'finalLaborCost']) || 0;
  }

  async function getToken() {
    var session = getSession();
    var token = session.clerkToken || null;
    try {
      if (window.najranGetFreshToken) {
        var fresh = await Promise.race([
          window.najranGetFreshToken(),
          new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 1200); })
        ]);
        if (fresh) token = fresh;
      }
    } catch (_) {}
    return token;
  }

  async function submitAdminOffices(part) {
    if (submitting) return;
    submitting = true;

    var label = part === 'consumables' ? 'مستهلكات المكاتب' : 'عمالة المكاتب';
    var btn = document.getElementById('_najran_approve_btn_inner');
    var oldHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.innerHTML = '<span>جاري رفع ' + label + '...</span>'; }

    try {
      var complete = buildCompleteSnapshot('forced-admin-offices-submit-' + part);
      var contractData = getContractData();
      var extractData = buildFlatSubmitExtractData(complete, contractData, part);
      var total = getPartTotal(part);
      var sourceModule = part === 'consumables' ? 'admin_offices_consumables' : 'admin_offices_attendance';
      var revisionId = localStorage.getItem('najran_revision_extract_id') || localStorage.getItem('najran_editing_submitted_extract_id') || '';
      var isRevision = (localStorage.getItem('najran_revision_mode') === 'true' && revisionId) || (localStorage.getItem('najran_editing_submitted_extract_mode') === 'true' && revisionId);

      var payload = Object.assign({}, contractData, {
        extractType: 'admin_offices',
        totalAmount: total,
        adminOfficeExtract: true,
        adminOfficePart: part,
        adminOfficeLabor: part === 'labor',
        adminOfficeConsumables: part === 'consumables',
        sourceModule: sourceModule,
        reviewScope: part === 'labor' ? 'admin_offices_labor_only' : 'admin_offices_consumables_only',
        extractData: extractData
      });
      payload = shrinkPayloadIfNeeded(payload);

      var token = await getToken();
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;

      var res = await fetch(isRevision ? '/api/submitted-extracts/' + encodeURIComponent(revisionId) : '/api/submitted-extracts', {
        method: isRevision ? 'PUT' : 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || 'تعذر رفع مستخلص المكاتب');
      }
      var result = await res.json().catch(function () { return {}; });
      try {
        localStorage.setItem('najran_last_submitted_extract_id', String(result.id || result.extractId || ''));
        localStorage.setItem('najran_last_submitted_extract_type', 'admin_offices');
        localStorage.setItem('najran_last_submitted_admin_office_part', part);
        localStorage.setItem('najran_last_submitted_period', String(contractData.periodMonth || ''));
        localStorage.setItem('najran_last_submitted_payment', String(contractData.paymentNumber || ''));
        localStorage.setItem('najran_last_submitted_at', new Date().toISOString());
        var mk = String(contractData.extractYear || '') + '_' + String(contractData.extractMonth || '').trim();
        if (mk !== '_') localStorage.setItem(part === 'consumables' ? 'najran_admin_offices_consumables_locked_' + mk : 'najran_admin_offices_labor_locked_' + mk, '1');
      } catch (_) {}
      window.location.href = '/extracts/track';
    } catch (e) {
      alert('حدث خطأ: ' + (e && e.message ? e.message : e));
      submitting = false;
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = oldHtml || '<span>رفع مستخلص المكاتب للاعتماد</span><span style="font-size:1.2rem">←</span>'; }
    }
  }

  function isAdminOfficesSubmitButton(target) {
    var btn = target && target.closest && target.closest('#_najran_approve_btn_inner, #_najran_approve_btn button');
    if (!btn) return false;
    var text = String(btn.textContent || '');
    return /رفع\s+مستخلص\s+(عمالة|مستهلكات)\s+المكاتب/.test(text) || /جاري\s+رفع\s+مستخلص\s+(عمالة|مستهلكات)\s+المكاتب/.test(text);
  }

  document.addEventListener('click', function (e) {
    if (!isAdminOfficesSubmitButton(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    var part = getAdminOfficePart();
    var msg = part === 'consumables'
      ? 'هل تريد رفع مستخلص مستهلكات المكاتب الإدارية للاعتماد؟\n\nسيتم تصنيفه كمستخلص مكاتب إدارية حتى تظهر المراجعة الصحيحة.'
      : 'هل تريد رفع مستخلص عمالة المكاتب الإدارية للاعتماد؟\n\nسيتم تصنيفه كمستخلص مكاتب إدارية حتى تظهر كل المكاتب في المراجعة.';
    if (!confirm(msg)) return false;
    submitAdminOffices(part);
    return false;
  }, true);

  window.AdminOfficesFullSubmitSnapshot = {
    capture: buildCompleteSnapshot,
    submit: submitAdminOffices,
    keys: { complete: SNAPSHOT_KEY, labor: LABOR_KEY, consumables: CONSUMABLES_KEY, meta: META_KEY }
  };

  setTimeout(function () { buildCompleteSnapshot('page-ready'); }, 1200);

  console.info('[Admin Offices Full Submit Snapshot Guard] installed v3 compact flat submit payload');
})();