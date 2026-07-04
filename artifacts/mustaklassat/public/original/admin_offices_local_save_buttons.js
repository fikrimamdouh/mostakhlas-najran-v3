// ===================================================================
// Admin Offices Local Save Buttons — V1
// Scope: admin_offices_attendance.html + admin_offices_consumables.html
// يحفظ لقطة محلية منفصلة لعمالة المكاتب ومستهلكات المكاتب بدون خلط نفس الدفعة.
// ===================================================================
(function () {
  'use strict';
  var pageSig = location.pathname + location.search;
  if (!/admin_offices_(attendance|consumables)\.html/.test(pageSig)) return;
  if (window.__ADMIN_OFFICES_LOCAL_SAVE_BUTTONS_V1__) return;
  window.__ADMIN_OFFICES_LOCAL_SAVE_BUTTONS_V1__ = true;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function part() { return /admin_offices_consumables\.html/.test(pageSig) ? 'consumables' : 'labor'; }
  function partLabel(p) { return p === 'consumables' ? 'مستهلكات المكاتب' : 'عمالة المكاتب'; }
  function pageForPart(p) { return p === 'consumables' ? '/original/admin_offices_consumables.html' : '/original/admin_offices_attendance.html'; }
  function countRows(obj) {
    var total = 0;
    obj = obj || {};
    Object.keys(obj).forEach(function (k) { if (Array.isArray(obj[k])) total += obj[k].length; });
    return total;
  }
  function rowsByPart(p, complete) {
    if (p === 'consumables') {
      var c = complete && complete.consumables;
      var tables = (c && c.tables) || {};
      return Object.keys(tables).reduce(function (s, k) { return s + (Array.isArray(tables[k]) ? tables[k].length : 0); }, 0);
    }
    return countRows(readJson('adminOfficesAttendanceData_v1', {}));
  }
  function amountByPart(p, complete) {
    if (p === 'consumables') {
      return Number(localStorage.getItem('finalConsumablesCost') || (complete && complete.consumables && complete.consumables.totals && complete.consumables.totals.finalConsumablesCost) || 0) || 0;
    }
    var raw = localStorage.getItem('grand-net-total-admin') || localStorage.getItem('finalLaborCost') || '0';
    return Number(String(raw).replace(/,/g, '').replace(/[^0-9.\-]/g, '')) || 0;
  }
  function buildKey(p, info) {
    return [
      'admin_offices', p,
      clean(info.hospitalName), clean(info.companyName), clean(info.contractDetails),
      clean(info.paymentNumber), clean(info.extractMonth), clean(info.extractYear)
    ].join('|');
  }
  function info() {
    var e = readJson('persistentExtractData', {});
    var c = readJson('persistentContractData', {});
    return {
      paymentNumber: e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '',
      extractMonth: e.extractMonth || localStorage.getItem('extractMonth') || '',
      extractYear: e.extractYear || localStorage.getItem('extractYear') || '',
      extractStart: e.extractStart || localStorage.getItem('extractStart') || '',
      extractEnd: e.extractEnd || localStorage.getItem('extractEnd') || '',
      hospitalName: c.hospitalName || localStorage.getItem('hospitalName') || 'المكاتب الإدارية والمرافق الصحية',
      companyName: c.companyName || localStorage.getItem('companyName') || '',
      contractDetails: c.contractDetails || c.contractNumber || localStorage.getItem('contractDetails') || ''
    };
  }
  function subsetFromComplete(complete) {
    var out = {};
    try {
      if (complete && complete.localStorageSubset) Object.assign(out, complete.localStorageSubset);
      if (complete) {
        out.najran_admin_offices_complete_submit_snapshot_v1 = complete;
        if (complete.labor) out.najran_admin_offices_labor_submit_snapshot_v1 = complete.labor;
        if (complete.consumables) out.najran_admin_offices_consumables_submit_snapshot_v1 = complete.consumables;
        if (complete.meta) out.najran_admin_offices_submit_meta_v1 = complete.meta;
      }
    } catch (_) {}
    return out;
  }
  function fallbackSubset() {
    var keys = [
      'persistentExtractData','persistentContractData','adminOfficesAttendanceData_v1','adminOfficesAttendanceData_v1_localBackup','adminOfficesAttendanceData_v1_lastGood',
      'adminOfficesLaborDataSafe_v2','adminOfficeNames_v1','adminOfficeAffiliations_v1','admin_offices_consumables_v1.0','finalLaborCost','finalConsumablesCost','grand-net-total-admin',
      'adminOfficePerformanceDeductions_v1','performanceDeductions','adminOfficesRaiseLettersSettings_v1','adminOfficesConsumablesRaiseLetterSettings_v1'
    ];
    var out = {};
    keys.forEach(function (k) { try { var raw = localStorage.getItem(k); if (raw != null) out[k] = readJson(k, raw); } catch (_) {} });
    return out;
  }
  function archiveGet() {
    if (typeof window.getExtractArchive === 'function') return window.getExtractArchive() || [];
    return readJson('extractArchive', []);
  }
  function archiveSet(list) {
    if (typeof window.setExtractArchive === 'function') return window.setExtractArchive(list || []);
    try { localStorage.setItem('extractArchive', JSON.stringify((list || []).slice(0, 15))); return true; } catch (_) { return false; }
  }
  function captureComplete(p) {
    try {
      if (typeof window.captureUIData === 'function') window.captureUIData();
      if (typeof window.saveAllData === 'function') window.saveAllData();
      if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal();
      if (typeof window.getAttendanceData === 'function' && typeof window.saveAttendanceData === 'function') window.saveAttendanceData(window.getAttendanceData());
    } catch (_) {}
    try {
      if (window.AdminOfficesFullSubmitSnapshot && typeof window.AdminOfficesFullSubmitSnapshot.capture === 'function') {
        return window.AdminOfficesFullSubmitSnapshot.capture('manual-local-save-' + p);
      }
    } catch (e) { console.warn('[Admin Offices Local Save] full capture failed', e); }
    return null;
  }
  function saveAdminOfficesLocalSnapshot(p, source) {
    p = p || part();
    var meta = info();
    var complete = captureComplete(p);
    var data = subsetFromComplete(complete);
    if (!data || !Object.keys(data).length) data = fallbackSubset();
    var draftKey = buildKey(p, meta);
    var snap = {
      id: String(Date.now()),
      draftKey: draftKey,
      savedAt: new Date().toISOString(),
      source: source || ('manual-admin-offices-' + p),
      canResume: true,
      compact: false,
      extractType: 'admin_offices',
      adminOfficePart: p,
      draftPart: p,
      currentPage: pageForPart(p),
      extractData: data,
      paymentNumber: meta.paymentNumber,
      extractMonth: meta.extractMonth,
      extractYear: meta.extractYear,
      extractStart: meta.extractStart,
      extractEnd: meta.extractEnd,
      hospitalName: meta.hospitalName,
      companyName: meta.companyName,
      contractDetails: meta.contractDetails,
      totalEmployees: p === 'labor' ? rowsByPart(p, complete) : 0,
      totalRows: rowsByPart(p, complete),
      totalNetAmount: amountByPart(p, complete),
      label: partLabel(p)
    };
    var archive = archiveGet().filter(function (s) {
      return s && String(s.draftKey || '') !== draftKey && !(s.extractType === 'admin_offices' && s.adminOfficePart === p && String(s.paymentNumber || '') === String(meta.paymentNumber || '') && String(s.extractMonth || '') === String(meta.extractMonth || '') && String(s.extractYear || '') === String(meta.extractYear || ''));
    });
    archive.unshift(snap);
    if (!archiveSet(archive)) return null;
    try {
      localStorage.setItem('najran_last_local_snapshot_key', draftKey);
      localStorage.setItem('najran_last_local_snapshot_admin_office_part', p);
    } catch (_) {}
    console.info('[Admin Offices Local Save] saved separated snapshot', { part: p, key: draftKey, rows: snap.totalRows, amount: snap.totalNetAmount });
    return snap;
  }
  window.saveAdminOfficesLocalSnapshot = saveAdminOfficesLocalSnapshot;

  function showSaved(snap) {
    if (!snap) { alert('تعذر الحفظ المحلي.'); return; }
    var old = document.getElementById('admin-offices-local-save-ok');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'admin-offices-local-save-ok';
    ov.className = 'no-print';
    ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px;padding:26px 34px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);max-width:430px;border-top:7px solid #166534">' +
      '<h3 style="margin:0 0 10px;color:#166534;font-size:20px;font-weight:950">تم الحفظ المحلي</h3>' +
      '<p style="margin:0;color:#334155;font-weight:800;line-height:1.8">تم حفظ لقطة منفصلة: <b>' + partLabel(snap.adminOfficePart) + '</b><br>الدفعة: ' + (snap.paymentNumber || '—') + ' — الأيام: ' + (snap.extractStart || '—') + ' إلى ' + (snap.extractEnd || '—') + '</p>' +
      '<button style="margin-top:18px;background:#166534;color:#fff;border:0;border-radius:12px;padding:10px 30px;font-weight:900;cursor:pointer;font-family:inherit" onclick="this.closest(\'#admin-offices-local-save-ok\').remove()">حسنًا</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    setTimeout(function () { if (ov.parentNode) ov.remove(); }, 7000);
  }
  function addButton() {
    var p = part();
    var bar = document.querySelector('.std-action-bar,.main-action-buttons,.action-btns');
    if (!bar || document.getElementById('admin-offices-local-save-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'admin-offices-local-save-btn';
    btn.className = 'ab ab-archive btn btn-backup no-print';
    btn.style.cssText = 'background:linear-gradient(135deg,#166534,#16a34a)!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:9px 16px!important;font-weight:900!important;cursor:pointer!important;font-family:inherit!important;';
    btn.innerHTML = '<i class="fas fa-archive"></i> حفظ محلي — ' + partLabel(p);
    btn.onclick = function () { showSaved(saveAdminOfficesLocalSnapshot(p, 'manual-button-' + p)); };
    bar.appendChild(btn);
  }
  function boot() { addButton(); setTimeout(addButton, 500); setTimeout(addButton, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  console.info('[Admin Offices Local Save Buttons] installed v1 separated labor/consumables');
})();