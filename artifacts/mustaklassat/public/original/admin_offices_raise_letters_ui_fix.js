// ===================================================================
// Admin Offices Raise Letters UI Fix — SAFE V7
// Scope: admin_offices_attendance.html / original-viewer page
// إصلاح آمن بدون مراقبة DOM عامة وبدون تحميل ثقيل أثناء فتح الصفحة.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function firstValue() { for (const v of arguments) { const s = clean(v); if (s && !['غير محدد', 'undefined', 'null', '—'].includes(s)) return s; } return ''; }

  function paymentNo() {
    const e = readJson('persistentExtractData', {});
    const raw = firstValue(e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, e.batchNumber, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'), localStorage.getItem('extractNo'), localStorage.getItem('batchNumber')) || '—';
    return /^\d+$/.test(raw) ? raw.padStart(2, '0') : raw;
  }

  function suffixEndCss() {
    return `
      .to{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;width:100%!important;gap:18px!important;direction:rtl!important}
      .to .recipient-name{display:block!important;max-width:78%!important;white-space:normal!important;text-align:right!important}
      .to .recipient-suffix{display:block!important;margin:0!important;padding:0!important;min-width:72px!important;white-space:nowrap!important;text-align:left!important}
      .final-to{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;width:100%!important;gap:18px!important;direction:rtl!important}
      .final-to span:first-child{display:block!important;max-width:78%!important;text-align:right!important}
      .final-to span:last-child{display:block!important;min-width:72px!important;white-space:nowrap!important;text-align:left!important;margin:0!important;padding:0!important}
      .recipient-suffix{white-space:nowrap!important}
    `;
  }

  function injectCss() {
    if (document.getElementById('admin-offices-raise-letters-screen-css')) return;
    const style = document.createElement('style');
    style.id = 'admin-offices-raise-letters-screen-css';
    style.textContent = `
      #raise-letters-overlay.settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif}
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay{position:static!important;inset:auto!important;display:block!important;background:transparent!important;padding:22px!important;min-height:100vh!important;z-index:auto!important}
      #raise-letters-overlay .settings-dialog{width:min(1220px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:20px;box-shadow:0 25px 70px rgba(0,0,0,.30);color:#0f172a}
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{width:min(1280px,96vw)!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;box-shadow:0 18px 55px rgba(15,23,42,.16)!important}
      #raise-letters-overlay .settings-dialog h2{margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;color:#003087;font-weight:900;text-align:center;font-size:24px}
      #raise-letters-overlay .btn-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0 16px}
      #raise-letters-overlay .btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(15,23,42,.08)}
      #raise-letters-overlay .btn-primary{background:#003087;color:#fff}
      #raise-letters-overlay .btn-gold{background:#d4af37;color:#111827}
      #raise-letters-overlay .btn-light{background:#f1f5f9;color:#111827;border:1px solid #cbd5e1}
      #raise-letters-overlay .section-box{border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-top:14px;background:#f8fafc}
      #raise-letters-overlay .section-box h3{margin:0 0 12px;color:#003087;font-weight:900;font-size:18px;text-align:center}
      #raise-letters-overlay .settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
      #raise-letters-overlay .field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
      #raise-letters-overlay .field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}
      #raise-letters-overlay .field input,#raise-letters-overlay .field select,#raise-letters-overlay .field textarea{width:100%;min-height:36px;padding:8px 9px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-weight:700;background:#fff}
      #raise-letters-overlay .readonly-box{min-height:38px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:900;line-height:1.8}
      #raise-letters-overlay .site-checks{max-height:270px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-top:10px}
      #raise-letters-overlay .site-check{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800;line-height:1.4}
      #raise-letters-overlay .site-check input{width:auto!important;min-height:auto!important}
      ${suffixEndCss()}
      #raise-letters-overlay .rl-section-save-row{display:flex;justify-content:center;margin:14px 0 2px}
      #raise-letters-overlay .rl-section-save-row .btn{min-width:190px}
      #admin-extra-docs-section{border:2px solid #d4af37!important;background:#fffbeb!important}
      .payment-number-wrapper{white-space:nowrap}.paymentNumber{font-weight:900;color:#003087}
      .admin-bulk-top-grid{display:grid!important;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;margin-bottom:14px}
      .admin-bulk-row-actions{justify-content:flex-start!important;margin:8px 0!important}
      .admin-bulk-centers-grid{max-height:220px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
      .admin-bulk-center-row{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font-weight:800}
      .admin-bulk-employees-list{max-height:360px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
      .admin-bulk-emp-group{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
      .admin-bulk-emp-head{display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px}
      .admin-bulk-emp-row{display:grid;grid-template-columns:24px 1fr;gap:4px 8px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;margin:6px 0}
      .admin-bulk-emp-row input{grid-row:1 / span 2;margin-top:4px}.admin-bulk-emp-row .emp-name{font-weight:900}.admin-bulk-emp-row small{color:#64748b}.admin-bulk-empty{padding:10px;color:#64748b;background:#fff;border-radius:8px;border:1px dashed #cbd5e1}
      @media print{#raise-letters-overlay.settings-overlay{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function installPaymentNumberDisplay() {
    const box = document.querySelector('.page-contract-info-v2 p');
    if (!box) return;
    if (!box.querySelector('.paymentNumber')) {
      const separator = document.createElement('span');
      separator.className = 'separator payment-number-separator';
      separator.textContent = '|';
      const wrapper = document.createElement('span');
      wrapper.className = 'payment-number-wrapper';
      wrapper.innerHTML = '<strong>رقم الدفعة:</strong> <span class="paymentNumber">—</span>';
      const startEl = box.querySelector('#extract-start-date');
      const directChild = startEl ? Array.from(box.children).find(ch => ch.contains(startEl)) : null;
      if (directChild && directChild.parentNode === box) {
        box.insertBefore(separator, directChild);
        box.insertBefore(wrapper, directChild);
      } else {
        box.appendChild(separator);
        box.appendChild(wrapper);
      }
    }
    document.querySelectorAll('.paymentNumber').forEach(el => { el.textContent = paymentNo(); });
  }

  function callSaveDialogSilently() {
    try {
      if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.saveDialog === 'function') {
        window.AdminOfficesRaiseLetters.saveDialog(true);
      }
    } catch (_) {}
  }

  let saveTimer = null;
  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(callSaveDialogSilently, 350);
  }

  function installSavedSettingsSaveButton() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    const boxes = Array.from(overlay.querySelectorAll('.section-box'));
    const target = boxes.find(box => ((box.querySelector('h3')?.textContent || '').includes('إعدادات الخطاب') || (box.querySelector('h3')?.textContent || '').includes('إعدادات الخطابات المحفوظة')));
    if (target && !target.querySelector('#raise-letters-save-settings-section-btn')) {
      const row = document.createElement('div');
      row.className = 'rl-section-save-row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'raise-letters-save-settings-section-btn';
      btn.className = 'btn btn-primary';
      btn.innerHTML = '<i class="fas fa-save"></i> حفظ إعدادات الخطابات';
      btn.onclick = callSaveDialogSilently;
      row.appendChild(btn);
      target.appendChild(row);
    }
    if (!overlay.__raiseLettersAutoSaveInstalled) {
      overlay.__raiseLettersAutoSaveInstalled = true;
      overlay.addEventListener('input', function (e) { if (e.target && e.target.matches('[data-rl-setting]')) scheduleAutoSave(); }, true);
      overlay.addEventListener('change', function (e) { if (e.target && e.target.matches('[data-rl-setting]')) scheduleAutoSave(); }, true);
      overlay.addEventListener('blur', function (e) { if (e.target && e.target.matches('[data-rl-setting]')) scheduleAutoSave(); }, true);
    }
  }

  function moveExtraDocsToTop() {
    const overlay = document.getElementById('raise-letters-overlay');
    const section = document.getElementById('admin-extra-docs-section');
    const dialog = overlay && overlay.querySelector('.settings-dialog');
    if (!dialog || !section) return;
    const firstDataBox = Array.from(dialog.querySelectorAll('.section-box')).find(box => !box.id && (box.querySelector('h3')?.textContent || '').includes('بيانات المستخلص'));
    if (firstDataBox && section.nextElementSibling !== firstDataBox) dialog.insertBefore(section, firstDataBox);
  }

  function fixIndividualStatementButtons() {
    const section = document.getElementById('admin-extra-docs-section');
    if (!section || !window.AdminOfficesExtraDocs) return;
    const bind = (label, type) => {
      const btn = Array.from(section.querySelectorAll('button')).find(b => clean(b.textContent) === label);
      if (!btn || btn.dataset.statementDirectPrint === '1') return;
      btn.dataset.statementDirectPrint = '1';
      btn.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        try {
          if (typeof window.AdminOfficesExtraDocs.printEditableStatement === 'function') {
            window.AdminOfficesExtraDocs.printEditableStatement(type);
          } else if (typeof window.AdminOfficesExtraDocs.openEditableStatement === 'function') {
            window.AdminOfficesExtraDocs.openEditableStatement(type);
          } else {
            alert('لم يتم تحميل دالة البيان بعد. أغلق خطابات الرفع وافتحها مرة أخرى.');
          }
        } catch (err) {
          console.error('[Admin Offices Extra Docs] statement button failed:', err);
          alert('تعذر فتح البيان. راجع Console.');
        }
      };
    };
    bind('بيان الغيابات', 'absence');
    bind('بيان الإجازات', 'vacation');
  }

  function getNamesSafe() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getDataSafe() { const list = []; try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {} list.push(readJson('adminOfficesAttendanceData_v1', {}), readJson('adminOfficesAttendanceData_v1_localBackup', {}), readJson('adminOfficesAttendanceData', {})); const count = obj => Object.values(obj || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0); return list.reduce((best, item) => count(item) > count(best) ? item : best, {}); }
  function saveDataSafe(data) { try { if (typeof window.saveAttendanceData === 'function') window.saveAttendanceData(data || {}); } catch (_) {} writeJson('adminOfficesAttendanceData_v1', data || {}); writeJson('adminOfficesAttendanceData_v1_localBackup', data || {}); }
  function getPeriodSafe() { try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {} const e = readJson('persistentExtractData', {}); const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now()); const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now()); const safeStart = Number.isNaN(start.getTime()) ? new Date() : start; const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end; return { startDate: safeStart, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30) }; }
  function orderedKeysForBulk() { const names = getNamesSafe(), data = getDataSafe(); return Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})])).filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k])).sort((a, b) => { if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10); if (/^center_\d+$/.test(a)) return -1; if (/^center_\d+$/.test(b)) return 1; return String(a).localeCompare(String(b), 'ar'); }); }
  function activeCenterKey() { try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {} return document.querySelector('.tab-link.active[data-center-key]')?.dataset?.centerKey || ''; }
  function statusOptionsHtml() { const src = window.STATUS_CODES || { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تأخير' }, 'ب': { name: 'بديل' }, 'ن': { name: 'نقل' }, 'غ•': { name: 'غياب بدون حسم' } }; return Object.keys(src).filter(code => code !== 'default').map(code => `<option value="${esc(code)}">${esc(code)} — ${esc(src[code]?.name || code)}</option>`).join(''); }
  function dayOptionsHtml() { const p = getPeriodSafe(); return Array.from({ length: p.daysInExtract }, (_, i) => { const d = new Date(p.startDate); d.setDate(p.startDate.getDate() + i); return `<option value="${i}">اليوم ${i + 1} — ${d.toLocaleDateString('en-CA')}</option>`; }).join(''); }

  function renderBulkEmployees() {
    const box = document.getElementById('admin-bulk-employees-list');
    if (!box) return;
    const names = getNamesSafe(), data = getDataSafe();
    const selectedCenters = Array.from(document.querySelectorAll('.admin-office-bulk-center:checked')).map(cb => cb.value);
    if (!selectedCenters.length) { box.innerHTML = '<div class="admin-bulk-empty">اختر مكتبًا أو مرفقًا لعرض أسماء الموظفين.</div>'; return; }
    box.innerHTML = selectedCenters.map(centerKey => {
      const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
      const employees = rows.length ? rows.map((emp, idx) => `<label class="admin-bulk-emp-row"><input type="checkbox" class="admin-office-bulk-employee" value="${esc(centerKey)}::${idx}" data-center="${esc(centerKey)}" checked><span class="emp-name">${esc(emp.name || 'بدون اسم')}</span><small>${esc(emp.jobTitle || '')}${emp.iqamaId ? ' — ' + esc(emp.iqamaId) : ''}</small></label>`).join('') : '<div class="admin-bulk-empty">لا توجد أسماء موظفين في هذا الموقع.</div>';
      return `<div class="admin-bulk-emp-group"><div class="admin-bulk-emp-head"><strong>${esc(names[centerKey] || centerKey)}</strong><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.toggleCenterEmployees('${esc(centerKey)}', true)">تحديد موظفي الموقع</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.toggleCenterEmployees('${esc(centerKey)}', false)">إلغاء موظفي الموقع</button></div>${employees}</div>`;
    }).join('');
  }

  function openBulkAttendanceDialogInline() {
    const names = getNamesSafe(), keys = orderedKeysForBulk(), active = activeCenterKey(), defaultKey = active || keys[0] || '';
    const centerChecks = keys.map(key => `<label class="admin-bulk-center-row"><input type="checkbox" class="admin-office-bulk-center" value="${esc(key)}" ${key === defaultKey ? 'checked' : ''} onchange="AdminOfficesBulkInline.renderBulkEmployees()"><span>${esc(names[key] || key)}</span></label>`).join('');
    const content = `<div class="dialog-header"><h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور والانصراف</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div><div class="dialog-body"><p class="info-text">اختر المكاتب ثم اختر أسماء الموظفين المطلوب تعديلهم فقط.</p><div class="form-grid admin-bulk-top-grid"><div class="form-group"><label>من يوم:</label><select id="admin-bulk-start-day">${dayOptionsHtml()}</select></div><div class="form-group"><label>إلى يوم:</label><select id="admin-bulk-end-day">${dayOptionsHtml()}</select></div><div class="form-group"><label>الحالة الجديدة:</label><select id="admin-bulk-status">${statusOptionsHtml()}</select></div></div><fieldset><legend>1. اختيار المكاتب والمرافق</legend><div class="btn-row admin-bulk-row-actions"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.selectAllCenters(true)">تحديد كل المكاتب</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.selectAllCenters(false)">إلغاء كل المكاتب</button></div><div class="admin-bulk-centers-grid">${centerChecks}</div></fieldset><fieldset><legend>2. اختيار الموظفين</legend><div class="btn-row admin-bulk-row-actions"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.selectAllEmployees(true)">تحديد كل الموظفين المعروضين</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkInline.selectAllEmployees(false)">إلغاء كل الموظفين المعروضين</button></div><div id="admin-bulk-employees-list" class="admin-bulk-employees-list"></div></fieldset></div><div class="dialog-footer"><button class="btn btn-secondary" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button><button class="btn btn-success" onclick="AdminOfficesBulkInline.applyBulkAttendance()"><i class="fas fa-check"></i> تطبيق التعديل</button></div>`;
    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true);
    setTimeout(renderBulkEmployees, 60);
  }

  function applyBulkAttendanceInline() {
    const startIndex = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0', 10);
    const endIndex = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0', 10);
    const newStatus = document.getElementById('admin-bulk-status')?.value || 'ح';
    const selectedEmployees = Array.from(document.querySelectorAll('.admin-office-bulk-employee:checked')).map(cb => cb.value);
    if (startIndex > endIndex) return alert('مدى الأيام غير صحيح. يوم البداية أكبر من يوم النهاية.');
    if (!selectedEmployees.length) return alert('اختر موظفًا واحدًا على الأقل.');
    const data = getDataSafe(), p = getPeriodSafe(); let affected = 0;
    selectedEmployees.forEach(token => {
      const [centerKey, rawIdx] = token.split('::');
      const idx = parseInt(rawIdx, 10);
      const emp = data[centerKey] && data[centerKey][idx];
      if (!emp) return;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      for (let i = startIndex; i <= endIndex && i < p.daysInExtract; i++) days[i] = newStatus;
      emp.days = days;
      affected++;
    });
    saveDataSafe(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { const active = activeCenterKey(); if (active && typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable(active); else if (active && typeof window.populateAttendanceTableBody === 'function') window.populateAttendanceTableBody(active); } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert('تم تطبيق التعديل الجماعي بنجاح.\nعدد الموظفين المتأثرين: ' + affected);
  }

  function installBulkInline() {
    window.AdminOfficesBulkInline = {
      renderBulkEmployees,
      toggleCenterEmployees: function (centerKey, checked) { document.querySelectorAll(`.admin-office-bulk-employee[data-center="${centerKey}"]`).forEach(cb => { cb.checked = !!checked; }); },
      selectAllCenters: function (checked) { document.querySelectorAll('.admin-office-bulk-center').forEach(cb => { cb.checked = !!checked; }); renderBulkEmployees(); },
      selectAllEmployees: function (checked) { document.querySelectorAll('.admin-office-bulk-employee').forEach(cb => { cb.checked = !!checked; }); },
      applyBulkAttendance: applyBulkAttendanceInline
    };
    window.openAdminOfficesBulkAttendanceDialog = openBulkAttendanceDialogInline;
  }

  function loadScriptOnce(id, src, label) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.onload = function () { console.info(label + ' loaded'); setTimeout(ensureOverlayEnhancements, 120); setTimeout(fixIndividualStatementButtons, 250); };
    script.onerror = function () { console.warn(label + ' failed to load'); };
    document.body.appendChild(script);
  }

  function loadExtraDocsOnlyWhenOverlayExists() {
    if (!document.getElementById('raise-letters-overlay')) return;
    loadScriptOnce('admin-offices-extra-docs-script', '/original/admin_offices_raise_letters_extra_docs.js?v=20260623_extra_docs_safe_v10', '[Admin Offices Extra Docs]');
  }

  function ensureOverlayEnhancements() {
    installSavedSettingsSaveButton();
    moveExtraDocsToTop();
    loadExtraDocsOnlyWhenOverlayExists();
    fixIndividualStatementButtons();
  }

  function boot() {
    injectCss();
    installPaymentNumberDisplay();
    installBulkInline();
    ensureOverlayEnhancements();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 700);
  setTimeout(boot, 1800);
  setTimeout(boot, 3200);
  document.addEventListener('click', function () {
    setTimeout(ensureOverlayEnhancements, 120);
    setTimeout(ensureOverlayEnhancements, 650);
  }, true);

  console.info('[Admin Offices Raise Letters UI Styling] installed v7 statement buttons fixed');
})();