/* review-generic-tables.js
 * V2: شاشة اعتماد المستخلصات.
 * يضيف معاينة تشغيلية حقيقية لمستخلص المكاتب الإدارية بدل الملخص العام فقط.
 * لا يغير الحسابات ولا حالة الاعتماد؛ يعرض فقط محتوى extractData المرفوع.
 */
(function(){
  'use strict';
  if (window.__NAJRAN_ADMIN_OFFICES_APPROVAL_PREVIEW_V2__) return;
  window.__NAJRAN_ADMIN_OFFICES_APPROVAL_PREVIEW_V2__ = true;

  function parseMaybe(value, fallback) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (_) { return fallback; }
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function meaningful(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    var s = String(value).trim();
    return !!s && s !== '{}' && s !== '[]' && s !== '0';
  }

  function mergeTrackedCopies(snapshot) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var bundle = parseMaybe(snapshot.__submittedExtractArchiveBundle_v1, {});
    var tracked = parseMaybe(bundle.trackedKeyCopies, {});
    Object.keys(tracked || {}).forEach(function (key) {
      if (snapshot[key] === undefined) snapshot[key] = tracked[key];
    });
    return snapshot;
  }

  function normalizeExtractData(e) {
    var raw = {};
    try {
      if (typeof window.parseExtractData === 'function') raw = window.parseExtractData(e);
      else raw = e && e.extractData ? parseMaybe(e.extractData, {}) : {};
    } catch (_) {
      raw = e && e.extractData ? parseMaybe(e.extractData, {}) : {};
    }
    return mergeTrackedCopies(raw || {});
  }

  function countRows(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce(function (sum, key) {
        return sum + (Array.isArray(value[key]) ? value[key].length : 0);
      }, 0);
    }
    return 0;
  }

  function countSignatureKeys(data) {
    return Object.keys(data || {}).filter(function (key) {
      return /^sb_(sigs|prefs)_/.test(key) || /^healthCenters_Signatures_/.test(key) || key === 'signatures_data_consumables_v27';
    }).length;
  }

  function hasAnyKey(data, patterns) {
    return Object.keys(data || {}).some(function (key) {
      return patterns.some(function (p) { return p.test(key); }) && meaningful(data[key]);
    });
  }

  function buildAdminOfficesPreview(e) {
    var data = normalizeExtractData(e);
    var names = parseMaybe(data.adminOfficeNames_v1, {}) || {};
    var attendance = parseMaybe(data.adminOfficesAttendanceData_v1 || data.adminOfficesAttendanceData_v1_localBackup || data.adminOfficesLaborDataSafe_v2, {}) || {};
    var perf = parseMaybe(data.adminOfficePerformanceDeductions_v1 || data.performanceDeductions || data.performanceData_v4, {}) || {};
    var achievement = parseMaybe(data.achievementData || data.achievementTitles_v1 || data.achievementItemNames, {}) || {};
    var offices = Object.keys(names || {});
    if (!offices.length && attendance && typeof attendance === 'object') offices = Object.keys(attendance);

    var bundle = parseMaybe(data.__submittedExtractArchiveBundle_v1, {});
    var integrity = parseMaybe(bundle.integrity, {});
    var officeCount = offices.length || Number(integrity.adminOfficesSites || 0) || 0;
    var employees = countRows(attendance) || Number(integrity.adminOfficesEmployees || 0) || 0;
    var sigCount = countSignatureKeys(data) || Number(integrity.signatureKeysCount || 0) || 0;
    var hasLetters = hasAnyKey(data, [/raise.*letter/i, /adminOfficesRaiseLetters/i, /adminOfficesLetterScoped/i]);
    var hasPerformance = meaningful(perf) || Number(integrity.adminOfficesPerformanceKeys || 0) > 0;
    var hasAchievement = meaningful(achievement) || integrity.hasAchievement === true;

    var rows = offices.map(function (key, idx) {
      var rowsCount = Array.isArray(attendance[key]) ? attendance[key].length : 0;
      var officeName = names[key] || key;
      var perfExists = meaningful(perf[key]) || meaningful(perf['performance-' + key]) || meaningful(perf['admin_' + key]);
      var achExists = meaningful(achievement[key]) || meaningful(achievement['achievement-' + key]) || meaningful(achievement['admin_' + key]);
      return '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td style="text-align:right;font-weight:800;color:#1e293b">' + esc(officeName) + '</td>' +
        '<td>' + rowsCount + '</td>' +
        '<td>' + (rowsCount > 0 ? '✓' : '—') + '</td>' +
        '<td>' + (perfExists || hasPerformance ? '✓' : '—') + '</td>' +
        '<td>' + (achExists || hasAchievement ? '✓' : '—') + '</td>' +
      '</tr>';
    }).join('');

    if (!rows) {
      rows = '<tr><td colspan="6" style="padding:14px;color:#b45309">لا توجد أسماء مكاتب داخل snapshot المرفوع. راجع نسخة الرفع.</td></tr>';
    }

    return '<div id="admin-offices-preview-details" style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:18px">' +
      '<p class="preview-section-title">تفاصيل مستخلص المكاتب الإدارية</p>' +
      '<div class="preview-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">' +
        '<div class="preview-cell"><div class="lbl">عدد المكاتب</div><div class="val">' + officeCount + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">عدد الموظفين</div><div class="val">' + employees + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">الأداء</div><div class="val">' + (hasPerformance ? 'موجود' : 'غير ظاهر') + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">الإنجاز</div><div class="val">' + (hasAchievement ? 'موجود' : 'غير ظاهر') + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">التواقيع</div><div class="val">' + (sigCount ? sigCount + ' مفتاح' : 'غير ظاهرة') + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">الخطابات</div><div class="val">' + (hasLetters ? 'موجودة' : 'غير ظاهرة') + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">مصدر المراجعة</div><div class="val">' + esc(data.__najranSourceModule || data.sourceModule || '—') + '</div></div>' +
        '<div class="preview-cell"><div class="lbl">مفاتيح محفوظة</div><div class="val">' + Object.keys(data).length + '</div></div>' +
      '</div>' +
      '<div style="overflow:auto;border:1px solid #e2e8f0;border-radius:14px;max-height:360px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;text-align:center;background:white">' +
          '<thead><tr style="background:#eff6ff;color:#1e3c72">' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe">م</th>' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe;text-align:right">المكتب / المرفق</th>' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe">الموظفون</th>' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe">الحضور</th>' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe">الأداء</th>' +
            '<th style="padding:9px;border-bottom:1px solid #dbeafe">الإنجاز</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  function patchTypeMaps() {
    try {
      if (typeof TYPE_LABELS !== 'undefined') TYPE_LABELS.admin_offices = 'مستخلص المكاتب الإدارية';
      if (typeof TYPE_PARTS !== 'undefined') TYPE_PARTS.admin_offices = ['عمالة المكاتب الإدارية', 'الأداء', 'شهادة الإنجاز', 'مستهلكات المكاتب الإدارية'];
      if (typeof TYPE_PAGES !== 'undefined') TYPE_PAGES.admin_offices = '/original/admin_offices_attendance.html';
    } catch (_) {}
  }

  function installPreviewPatch() {
    patchTypeMaps();
    if (typeof openPreview !== 'function') return false;
    if (openPreview.__adminOfficesPreviewV2) return true;
    var original = openPreview;
    window.openPreview = openPreview = function patchedOpenPreview(id) {
      original.apply(this, arguments);
      try {
        var e = null;
        try { if (typeof allExtracts !== 'undefined') e = (allExtracts || []).find(function (x) { return String(x.id) === String(id); }); } catch (_) {}
        if (!e || String(e.extractType) !== 'admin_offices') {
          var old = document.getElementById('admin-offices-preview-details');
          if (old) old.remove();
          return;
        }
        var parts = document.getElementById('prev-parts');
        if (!parts) return;
        var oldDetails = document.getElementById('admin-offices-preview-details');
        if (oldDetails) oldDetails.remove();
        parts.insertAdjacentHTML('afterend', buildAdminOfficesPreview(e));
      } catch (err) {
        console.warn('[Admin Offices Approval Preview] failed', err);
      }
    };
    window.openPreview.__adminOfficesPreviewV2 = true;
    console.info('[Admin Offices Approval Preview] installed v2');
    return true;
  }

  var tries = 0;
  function retry() {
    tries++;
    if (installPreviewPatch()) return;
    if (tries < 60) setTimeout(retry, 200);
  }

  retry();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry);
})();