// extract-submit-flow-control.js
// Official submit-flow control: confirmation, verified duplicate handling, no auto payment/month mutation, update existing, and durable submit summary.
(function () {
  'use strict';
  if (window.__NAJRAN_EXTRACT_SUBMIT_FLOW_CONTROL_V4__) return;
  window.__NAJRAN_EXTRACT_SUBMIT_FLOW_CONTROL_V4__ = true;

  var SUMMARY_KEY = 'najran_last_submitted_summary_v1';
  var WORK_CONTEXT_KEY = 'najran_work_context_v1';
  var allowNextSubmitClick = false;
  var skipConfirmUntil = 0;

  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function safeJson(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function session() { return safeJson(localStorage.getItem('najran_session'), {}) || {}; }
  function isAdmin() { var r = String(session().role || '').toLowerCase(); return r === 'admin' || r === 'super_admin' || r === 'administrator'; }
  function contractData() {
    var c = safeJson(localStorage.getItem('persistentContractData'), {}) || {};
    var e = safeJson(localStorage.getItem('persistentExtractData'), {}) || {};
    return {
      companyName: clean(localStorage.getItem('companyName') || c.companyName || c.company || ''),
      hospitalName: clean(c.hospitalName || localStorage.getItem('hospitalName') || ''),
      contractNumber: clean(c.contractNumber || localStorage.getItem('contractNumber') || localStorage.getItem('contractDetails') || ''),
      extractMonth: clean(e.extractMonth || localStorage.getItem('extractMonth') || ''),
      extractYear: clean(e.extractYear || localStorage.getItem('extractYear') || ''),
      paymentNumber: clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || ''),
      periodMonth: clean([e.extractMonth || localStorage.getItem('extractMonth') || '', e.extractYear || localStorage.getItem('extractYear') || ''].filter(Boolean).join(' ')),
      totalAmount: clean(localStorage.getItem('finalConsumablesCost') || localStorage.getItem('finalLaborCost') || e.totalCost || '')
    };
  }
  function submitTypeFromPageAndText(text) {
    var p = location.pathname;
    text = clean(text);
    if (p.indexOf('spare_parts') > -1 || /قطع الغيار/.test(text)) return 'spare_parts';
    if (p.indexOf('health_centers') > -1 || /المراكز/.test(text)) return 'health_centers';
    if (p.indexOf('consumables') > -1 || /مستهلكات/.test(text)) return 'consumables';
    return 'labor';
  }
  function typeFromButtonText(text) {
    text = clean(text);
    if (/مستهلكات/.test(text)) return 'مستخلص المستهلكات';
    if (/قطع الغيار/.test(text)) return 'مستخلص قطع الغيار';
    if (/المراكز/.test(text)) return 'مستخلص المراكز الصحية';
    if (/المكاتب/.test(text)) return /مستهلكات/.test(text) ? 'مستهلكات المكاتب الإدارية' : 'عمالة المكاتب الإدارية';
    if (/العمالة|الحضور/.test(text)) return 'مستخلص العمالة';
    return 'مستخلص';
  }
  function isEditingExisting() {
    return !!(
      localStorage.getItem('najran_revision_mode') === 'true' ||
      localStorage.getItem('najran_revision_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_mode') === 'true'
    );
  }
  function doneLockMatches(v, type) {
    if (!v || !v.submittedAt) return false;
    var cd = contractData();
    var ageOk = Date.now() - Number(v.submittedAt || 0) < 24 * 60 * 60 * 1000;
    if (!ageOk) return false;
    if (type && v.type && clean(v.type) !== clean(type)) return false;
    if (v.month && clean(v.month) !== clean(cd.extractMonth)) return false;
    if (v.year && clean(v.year) !== clean(cd.extractYear)) return false;
    if (v.payment && clean(v.payment) !== clean(cd.paymentNumber)) return false;
    return true;
  }
  function currentDoneLock(type) {
    var cd = contractData();
    var key = [
      'najran_submit_done_submitted_extract',
      type || '',
      cd.companyName || '',
      cd.hospitalName || localStorage.getItem('hospitalName') || '',
      cd.extractYear || '',
      cd.extractMonth || '',
      cd.paymentNumber || ''
    ].join('__');
    var direct = safeJson(localStorage.getItem(key), null);
    if (doneLockMatches(direct, type)) return Object.assign({ key: key }, direct);
    var best = null;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('najran_submit_done_') !== 0) continue;
        var v = safeJson(localStorage.getItem(k), null);
        if (!doneLockMatches(v, type)) continue;
        if (!best || Number(v.submittedAt || 0) > Number(best.submittedAt || 0)) best = Object.assign({ key: k }, v);
      }
    } catch (_) {}
    return best;
  }
  function latestDoneLock() { return currentDoneLock('') || null; }
  function clearDoneLock(lock) {
    try { if (lock && lock.key) localStorage.removeItem(lock.key); } catch (_) {}
  }
  function setUpdateMode(existingId) {
    existingId = clean(existingId);
    if (!existingId) return false;
    try {
      localStorage.setItem('najran_editing_submitted_extract_id', existingId);
      localStorage.setItem('najran_editing_submitted_extract_mode', 'true');
      localStorage.setItem('najran_editing_submitted_extract_started_at', new Date().toISOString());
      localStorage.setItem('najran_revision_mode', 'true');
      localStorage.setItem('najran_revision_extract_id', existingId);
      localStorage.setItem('najran_revision_started_at', new Date().toISOString());
      localStorage.setItem('najran_revision_source', 'submit-flow-update-existing');
      return true;
    } catch (_) { return false; }
  }
  function clearActiveRevisionAfterSuccess(summary) {
    try {
      if (!summary || summary.action !== 'update') return;
      [
        'najran_revision_mode','najran_revision_extract_id','najran_revision_extract_type','najran_revision_started_at','najran_revision_source','najran_revision_snapshot','najran_revision_snapshot_summary','najran_revision_boot_lock',
        'najran_editing_submitted_extract_id','najran_editing_submitted_extract_mode','najran_editing_submitted_extract_started_at'
      ].forEach(function (k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (_) {} });
    } catch (_) {}
  }
  async function getFreshToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') return await window.najranGetFreshToken({ skipCache: true });
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') return await window.parent.najranGetFreshToken({ skipCache: true });
    } catch (_) {}
    var s = session();
    return s.clerkToken || '';
  }
  async function apiJson(url, options) {
    options = options || {};
    var token = await getFreshToken();
    var headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', 'Bearer ' + token);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    var res = await fetch(url, Object.assign({}, options, { headers: headers, credentials: 'include' }));
    var data = null;
    try { data = await res.clone().json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data };
  }
  async function verifyExistingExtract(existingId) {
    existingId = clean(existingId);
    if (!existingId) return { exists: false, reason: 'no-id' };
    var r = await apiJson('/api/submitted-extracts/' + encodeURIComponent(existingId), {});
    if (r.ok && r.data) return { exists: true, row: r.data };
    return { exists: false, status: r.status, reason: 'server-not-found-or-hidden' };
  }
  function goTrack() { location.href = '/extracts/track'; }
  function goSettings() { location.href = '/original/settings_main.html'; }
  function enableNativeSubmitBypass() {
    allowNextSubmitClick = true;
    skipConfirmUntil = Date.now() + 12000;
    window.__NAJRAN_SKIP_NATIVE_SUBMIT_CONFIRM_UNTIL__ = skipConfirmUntil;
  }
  function triggerSubmitAgain() {
    enableNativeSubmitBypass();
    setTimeout(function () {
      var btn = document.getElementById('_najran_approve_btn_inner');
      if (btn) btn.click();
    }, 120);
  }
  function removeOldDuplicateModal() {
    try {
      Array.prototype.slice.call(document.querySelectorAll('div')).forEach(function (d) {
        if (d.querySelector && d.querySelector('#dup-resubmit-retry')) d.remove();
      });
    } catch (_) {}
  }
  function modalShell(id, title, subtitle, bodyHtml) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
    overlay.innerHTML = '<div style="background:#fff;border-radius:18px;max-width:620px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.32);overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#123b6d,#1e88e5);color:#fff;padding:18px 22px"><h3 style="margin:0;font-size:18px;font-weight:950">' + esc(title) + '</h3><p style="margin:6px 0 0;font-size:12px;opacity:.9;line-height:1.7">' + esc(subtitle || '') + '</p></div>' +
      '<div style="padding:18px 22px;color:#334155;font-size:13px;line-height:1.9">' + bodyHtml + '</div>' +
    '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }
  function summaryBlock(existingId, label) {
    var cd = contractData();
    return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px">' +
      '<b>الشركة:</b> ' + esc(cd.companyName || '—') + '<br>' +
      '<b>النطاق:</b> ' + esc(isAdmin() ? 'المقر الرئيسي — تجمع نجران الصحي' : (cd.hospitalName || '—')) + '<br>' +
      '<b>الفترة:</b> ' + esc(cd.periodMonth || [cd.extractMonth, cd.extractYear].filter(Boolean).join(' ') || '—') + '<br>' +
      '<b>الدفعة:</b> ' + esc(cd.paymentNumber || '—') +
      (cd.totalAmount ? '<br><b>الإجمالي:</b> ' + esc(cd.totalAmount) : '') +
      (existingId ? '<br><b>' + esc(label || 'المستخلص الموجود في النظام: سجل رقم') + ':</b> ' + esc(existingId) : '') +
    '</div>';
  }
  function showConfirmSubmitModal(originalButton) {
    var text = clean(originalButton && originalButton.textContent || 'رفع مستخلص');
    var type = submitTypeFromPageAndText(text);
    if (!isEditingExisting()) {
      var lock = currentDoneLock(type);
      if (lock) {
        showDuplicateChoiceModal(lock.resultId || lock.existingId || '', lock);
        return;
      }
    }
    var overlay = modalShell('najran-submit-confirm-modal', 'تأكيد رفع المستخلص', 'راجع البيانات قبل الرفع. بعد الرفع لا تكرر نفس البيانات إلا من خلال تحديث المستخلص القائم.',
      summaryBlock('') +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 11px;color:#9a3412;font-weight:800;margin-bottom:12px">' +
      'نوع العملية: ' + esc(typeFromButtonText(text)) + '<br>لو تريد مستخلصًا جديدًا بعد الرفع، غيّر رقم الدفعة أو الشهر من الإعدادات أولًا.' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">' +
      '<button data-action="submit" style="padding:10px 13px;border:0;border-radius:10px;background:#166534;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">رفع الآن</button>' +
      '<button data-action="review" style="padding:10px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155;font-weight:900;cursor:pointer;font-family:inherit">مراجعة البيانات</button>' +
      '<button data-action="cancel" style="padding:10px 13px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#64748b;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>' +
      '</div>'
    );
    overlay.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'cancel' || action === 'review') { overlay.remove(); return; }
      if (action === 'submit') {
        overlay.remove();
        var lock = currentDoneLock(type);
        if (!isEditingExisting() && lock) {
          showDuplicateChoiceModal(lock.resultId || lock.existingId || '', lock);
          return;
        }
        enableNativeSubmitBypass();
        setTimeout(function () { originalButton.click(); }, 80);
      }
    });
  }
  function showStaleLockModal(lock, existingId, verify) {
    removeOldDuplicateModal();
    var overlay = modalShell('najran-submit-stale-lock-modal', 'قفل رفع محلي قديم', 'الجهاز يتذكر محاولة رفع سابقة، لكن السجل غير ظاهر في السيرفر أو لا يمكن الوصول له من القائمة الحالية.',
      summaryBlock(existingId || '', 'رقم محفوظ محليًا') +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;color:#9a3412;font-weight:800;margin-bottom:12px">' +
      'لم يتم العثور على السجل في السيرفر أثناء التحقق. هذا لا يمس بيانات الحضور أو المستخلص؛ هو قفل محلي فقط لمنع التكرار.' +
      (verify && verify.status ? '<br>كود التحقق: ' + esc(verify.status) : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">' +
      '<button data-action="clear-retry" style="padding:10px 13px;border:0;border-radius:10px;background:#166534;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">مسح القفل المحلي فقط والمحاولة من جديد</button>' +
      '<button data-action="track" style="padding:10px 13px;border:0;border-radius:10px;background:#1e3c72;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">الذهاب للمتابعة</button>' +
      '<button data-action="settings" style="padding:10px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155;font-weight:900;cursor:pointer;font-family:inherit">فتح الإعدادات لتغيير الدفعة</button>' +
      '<button data-action="cancel" style="padding:10px 13px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#64748b;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>' +
      '</div>'
    );
    overlay.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'cancel') { overlay.remove(); return; }
      if (action === 'track') { goTrack(); return; }
      if (action === 'settings') { goSettings(); return; }
      if (action === 'clear-retry') {
        clearDoneLock(lock);
        overlay.remove();
        triggerSubmitAgain();
      }
    });
  }
  async function showDuplicateChoiceModal(explicitExistingId, explicitLock) {
    removeOldDuplicateModal();
    var info = explicitLock || latestDoneLock() || {};
    var existingId = clean(explicitExistingId || info.resultId || info.existingId || '');
    if (existingId) {
      try {
        var verified = await verifyExistingExtract(existingId);
        if (!verified.exists) {
          showStaleLockModal(info, existingId, verified);
          return;
        }
      } catch (e) {
        showStaleLockModal(info, existingId, { status: 'verify-failed' });
        return;
      }
    }
    var overlay = modalShell('najran-submit-duplicate-choice-modal', 'هذا المستخلص مرفوع مسبقًا', 'لن يتم تغيير رقم الدفعة أو الشهر تلقائيًا. اختر الإجراء الصحيح.',
      summaryBlock(existingId, 'المستخلص الموجود في النظام: سجل رقم') +
      '<p style="margin:0 0 12px;color:#475569">لو تريد تعديل نفس المستخلص الموجود، اختر <b>تحديث المستخلص القائم</b>. لو تريد مستخلصًا جديدًا، غيّر رقم الدفعة أو الشهر من الإعدادات أولًا.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">' +
      '<button data-action="update" ' + (existingId ? '' : 'disabled') + ' style="padding:10px 13px;border:0;border-radius:10px;background:' + (existingId ? '#166534' : '#94a3b8') + ';color:#fff;font-weight:900;cursor:' + (existingId ? 'pointer' : 'not-allowed') + ';font-family:inherit">تحديث المستخلص القائم</button>' +
      '<button data-action="track" style="padding:10px 13px;border:0;border-radius:10px;background:#1e3c72;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">الذهاب للمتابعة</button>' +
      '<button data-action="settings" style="padding:10px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155;font-weight:900;cursor:pointer;font-family:inherit">فتح الإعدادات لتغيير الدفعة</button>' +
      '<button data-action="cancel" style="padding:10px 13px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#64748b;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>' +
      '</div>'
    );
    overlay.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'cancel') { overlay.remove(); return; }
      if (action === 'track') { goTrack(); return; }
      if (action === 'settings') { goSettings(); return; }
      if (action === 'update') {
        if (!existingId) return;
        setUpdateMode(existingId);
        overlay.remove();
        triggerSubmitAgain();
      }
    });
  }
  function installNativeConfirmPatch() {
    if (window.__NAJRAN_NATIVE_SUBMIT_CONFIRM_PATCHED__) return;
    window.__NAJRAN_NATIVE_SUBMIT_CONFIRM_PATCHED__ = true;
    var nativeConfirm = window.confirm;
    window.confirm = function (msg) {
      try {
        var text = clean(msg || '');
        var until = Math.max(Number(skipConfirmUntil || 0), Number(window.__NAJRAN_SKIP_NATIVE_SUBMIT_CONFIRM_UNTIL__ || 0));
        if (Date.now() < until && (/رفع مستخلص|رفع للاعتماد|للاعتماد/.test(text))) return true;
      } catch (_) {}
      return nativeConfirm.apply(window, arguments);
    };
  }
  function installSubmitConfirmCapture() {
    if (window.__NAJRAN_SUBMIT_CONFIRM_CAPTURE__) return;
    window.__NAJRAN_SUBMIT_CONFIRM_CAPTURE__ = true;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#_najran_approve_btn_inner,button');
      if (!btn) return;
      var text = clean(btn.textContent || '');
      if (text.indexOf('رفع مستخلص') === -1 && text.indexOf('رفع للاعتماد') === -1) return;
      if (allowNextSubmitClick || Date.now() < skipConfirmUntil) { allowNextSubmitClick = false; return; }
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      showConfirmSubmitModal(btn);
      return false;
    }, true);
  }
  function installDuplicateOverride() {
    window.showDuplicateResubmitModal = function () {
      showDuplicateChoiceModal();
    };
  }
  function installDuplicateModalObserver() {
    var mo = new MutationObserver(function () {
      var old = document.getElementById('dup-resubmit-retry');
      if (!old) return;
      showDuplicateChoiceModal();
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  function buildSummary(method, url, init, row) {
    var body = safeJson(init && init.body, {}) || {};
    var u = new URL(String(url || ''), location.origin);
    var cd = contractData();
    var id = clean((row && (row.id || row.extractId)) || u.pathname.split('/').pop() || '');
    var action = method === 'PUT' ? 'update' : 'new';
    return {
      schema: 'najran_last_submitted_summary_v1',
      action: action,
      id: id,
      extractType: clean(body.extractType || (row && row.extractType) || ''),
      companyName: clean(body.companyName || (row && row.companyName) || cd.companyName || ''),
      hospitalName: clean(isAdmin() ? 'المقر الرئيسي — تجمع نجران الصحي' : (body.hospitalName || (row && row.hospitalName) || cd.hospitalName || '')),
      contractNumber: clean(body.contractNumber || (row && row.contractNumber) || cd.contractNumber || ''),
      periodMonth: clean(body.periodMonth || (row && row.periodMonth) || cd.periodMonth || ''),
      extractMonth: clean(body.extractMonth || cd.extractMonth || ''),
      extractYear: clean(body.extractYear || cd.extractYear || ''),
      paymentNumber: clean(body.paymentNumber || cd.paymentNumber || ''),
      status: clean((row && row.status) || 'submitted'),
      isAdmin: isAdmin(),
      at: new Date().toISOString()
    };
  }
  async function rememberSubmitResult(method, url, init, res) {
    try {
      var u = new URL(String(url || ''), location.origin);
      if (u.origin !== location.origin) return;
      if (!/^\/api\/submitted-extracts(?:\/\d+)?$/.test(u.pathname)) return;
      if (method !== 'POST' && method !== 'PUT') return;
      if (!res) return;
      if (res.status === 409) {
        try {
          var dup = await res.clone().json();
          if (dup && dup.duplicate) setTimeout(function () { showDuplicateChoiceModal(dup.existingId || dup.id || ''); }, 80);
        } catch (_) {}
        return;
      }
      if (!res.ok) return;
      var row = await res.clone().json();
      var summary = buildSummary(method, url, init || {}, row || {});
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
      localStorage.setItem('najran_current_extract_submitted', 'true');
      if (summary.id) localStorage.setItem('najran_last_submitted_extract_id', summary.id);
      localStorage.setItem(WORK_CONTEXT_KEY, JSON.stringify({
        mode: summary.action === 'update' ? 'updated_locked' : (summary.isAdmin ? 'admin_submitted_locked' : 'submitted_locked'),
        extractId: summary.id,
        label: summary.action === 'update' ? 'تم تحديث المستخلص القائم' : 'تم رفع المستخلص',
        companyName: summary.companyName,
        hospitalName: summary.hospitalName,
        periodMonth: summary.periodMonth,
        paymentNumber: summary.paymentNumber,
        canSubmit: false,
        mustChangePeriodOrPayment: summary.action !== 'update',
        sameExtractUpdated: summary.action === 'update',
        affectsUserSites: !summary.isAdmin,
        at: summary.at
      }));
      clearActiveRevisionAfterSuccess(summary);
      console.warn('[ExtractSubmitFlowControl] submit summary saved', summary);
    } catch (err) {
      console.warn('[ExtractSubmitFlowControl] failed to remember submit result', err);
    }
  }
  function patchFetchForSubmitSummary() {
    if (window.__NAJRAN_SUBMIT_FLOW_FETCH_PATCHED__) return;
    window.__NAJRAN_SUBMIT_FLOW_FETCH_PATCHED__ = true;
    var nativeFetch = window.fetch;
    window.fetch = async function (input, init) {
      var raw = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var res = await nativeFetch.apply(this, arguments);
      await rememberSubmitResult(method, raw, init || {}, res);
      return res;
    };
  }

  installNativeConfirmPatch();
  installSubmitConfirmCapture();
  installDuplicateOverride();
  installDuplicateModalObserver();
  patchFetchForSubmitSummary();
  window.NajranExtractSubmitFlowControl = { showDuplicateChoiceModal: showDuplicateChoiceModal, latestDoneLock: latestDoneLock, setUpdateMode: setUpdateMode, currentDoneLock: currentDoneLock, verifyExistingExtract: verifyExistingExtract, clearDoneLock: clearDoneLock };
  console.info('[ExtractSubmitFlowControl] installed v4 verified duplicate lock + stale-lock recovery');
})();
