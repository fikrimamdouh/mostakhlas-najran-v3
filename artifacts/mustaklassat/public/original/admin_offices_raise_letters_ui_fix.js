// ===================================================================
// Admin Offices Raise Letters UI Fix — SAFE V8
// Scope: admin_offices_attendance.html / original-viewer page
// تنظيف: لا يوجد تعديل جماعي قديم داخل هذا الملف.
// يحمل النسخ الحالية من التعديل الجماعي وطباعة الموقع قبل أي Loader قديم.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
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
    let style = document.getElementById('admin-offices-raise-letters-screen-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'admin-offices-raise-letters-screen-css';
      document.head.appendChild(style);
    }
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
      @media print{#raise-letters-overlay.settings-overlay{display:none!important}}
    `;
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

  function loadScriptOnce(id, src, label) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.onload = function () { console.info(label + ' loaded'); setTimeout(ensureOverlayEnhancements, 120); setTimeout(fixIndividualStatementButtons, 250); };
    script.onerror = function () { console.warn(label + ' failed to load'); };
    document.body.appendChild(script);
  }

  function loadCurrentCoreModules() {
    loadScriptOnce('admin-offices-bulk-status-grid-print-fix', '/original/admin_offices_bulk_status_grid_print_fix.js?v=20260624_bulk_grid_v3', '[Admin Offices Bulk Grid V3]');
    loadScriptOnce('admin-offices-site-print-performance-fit', '/original/admin_offices_site_print_performance_fit.js?v=20260624_site_bundle_v5', '[Admin Offices Site Print V5]');
  }

  function loadExtraDocsOnlyWhenOverlayExists() {
    if (!document.getElementById('raise-letters-overlay')) return;
    loadScriptOnce('admin-offices-extra-docs-script', '/original/admin_offices_raise_letters_extra_docs.js?v=20260623_extra_docs_safe_v10', '[Admin Offices Extra Docs]');
  }

  function callSaveDialogSilently() {
    try {
      if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.saveDialog === 'function') window.AdminOfficesRaiseLetters.saveDialog(true);
    } catch (_) {}
  }
  let saveTimer = null;
  function scheduleAutoSave() { clearTimeout(saveTimer); saveTimer = setTimeout(callSaveDialogSilently, 350); }

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
          if (typeof window.AdminOfficesExtraDocs.printEditableStatement === 'function') window.AdminOfficesExtraDocs.printEditableStatement(type);
          else if (typeof window.AdminOfficesExtraDocs.openEditableStatement === 'function') window.AdminOfficesExtraDocs.openEditableStatement(type);
          else alert('لم يتم تحميل دالة البيان بعد. أغلق خطابات الرفع وافتحها مرة أخرى.');
        } catch (err) {
          console.error('[Admin Offices Extra Docs] statement button failed:', err);
          alert('تعذر فتح البيان. راجع Console.');
        }
      };
    };
    bind('بيان الغيابات', 'absence');
    bind('بيان الإجازات', 'vacation');
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
    loadCurrentCoreModules();
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

  console.info('[Admin Offices Raise Letters UI Styling] installed v8 no legacy bulk + current modules');
})();