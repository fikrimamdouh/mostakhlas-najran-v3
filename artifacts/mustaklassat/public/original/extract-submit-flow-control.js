// extract-submit-flow-control.js
// Official submit-flow control: no auto payment/month mutation, optional update existing extract.
(function () {
  'use strict';
  if (window.__NAJRAN_EXTRACT_SUBMIT_FLOW_CONTROL__) return;
  window.__NAJRAN_EXTRACT_SUBMIT_FLOW_CONTROL__ = true;

  var SUMMARY_KEY = 'najran_last_submitted_summary_v1';

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
      periodMonth: clean([e.extractMonth || localStorage.getItem('extractMonth') || '', e.extractYear || localStorage.getItem('extractYear') || ''].filter(Boolean).join(' '))
    };
  }
  function latestDoneLock() {
    var best = null;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('najran_submit_done_') !== 0) continue;
        var v = safeJson(localStorage.getItem(k), null);
        if (!v || !v.submittedAt) continue;
        if (!best || Number(v.submittedAt) > Number(best.submittedAt || 0)) best = Object.assign({ key: k }, v);
      }
    } catch (_) {}
    return best;
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
  function goTrack() { location.href = '/extracts/track'; }
  function goSettings() { location.href = '/original/settings_main.html'; }
  function triggerSubmitAgain() {
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
  function showDuplicateChoiceModal() {
    removeOldDuplicateModal();
    var info = latestDoneLock() || {};
    var existingId = clean(info.resultId || info.existingId || '');
    var cd = contractData();
    var overlay = document.createElement('div');
    overlay.id = 'najran-submit-duplicate-choice-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
    overlay.innerHTML = '<div style="background:#fff;border-radius:18px;max-width:560px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.32);overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#7c2d12,#b45309);color:#fff;padding:18px 22px"><h3 style="margin:0;font-size:18px;font-weight:950">هذا المستخلص مرفوع مسبقًا</h3><p style="margin:6px 0 0;font-size:12px;opacity:.9;line-height:1.7">لن يتم تغيير رقم الدفعة أو الشهر تلقائيًا. اختر الإجراء الصحيح.</p></div>' +
      '<div style="padding:18px 22px;color:#334155;font-size:13px;line-height:1.9">' +
        '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px;margin-bottom:14px">' +
          '<b>الشركة:</b> ' + esc(cd.companyName || '—') + '<br>' +
          '<b>النطاق:</b> ' + esc(isAdmin() ? 'المقر الرئيسي — تجمع نجران الصحي' : (cd.hospitalName || '—')) + '<br>' +
          '<b>الفترة:</b> ' + esc(cd.periodMonth || [cd.extractMonth, cd.extractYear].filter(Boolean).join(' ') || '—') + '<br>' +
          '<b>الدفعة:</b> ' + esc(cd.paymentNumber || '—') +
          (existingId ? '<br><b>رقم المستخلص الموجود:</b> ' + esc(existingId) : '') +
        '</div>' +
        '<p style="margin:0 0 12px;color:#475569">لو تريد تعديل نفس المستخلص الموجود، اختر <b>تحديث المستخلص القائم</b>. لو تريد مستخلصًا جديدًا، غيّر رقم الدفعة أو الشهر من الإعدادات أولًا.</p>' +
        (isAdmin() ? '<div style="margin:0 0 12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;padding:9px 11px;font-weight:800">رفع الأدمن يبقى تحت نطاق المقر الرئيسي ولا يؤثر على مواقع المستخدمين.</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">' +
          '<button data-action="update" ' + (existingId ? '' : 'disabled') + ' style="padding:10px 13px;border:0;border-radius:10px;background:' + (existingId ? '#166534' : '#94a3b8') + ';color:#fff;font-weight:900;cursor:' + (existingId ? 'pointer' : 'not-allowed') + ';font-family:inherit">تحديث المستخلص القائم</button>' +
          '<button data-action="track" style="padding:10px 13px;border:0;border-radius:10px;background:#1e3c72;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">الذهاب للمتابعة</button>' +
          '<button data-action="settings" style="padding:10px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#334155;font-weight:900;cursor:pointer;font-family:inherit">فتح الإعدادات لتغيير الدفعة</button>' +
          '<button data-action="cancel" style="padding:10px 13px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#64748b;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>' +
        '</div>' +
      '</div>' +
    '</div>';
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
    document.body.appendChild(overlay);
  }
  function installDuplicateModalObserver() {
    var mo = new MutationObserver(function () {
      var old = document.getElementById('dup-resubmit-retry');
      if (!old) return;
      showDuplicateChoiceModal();
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  function rememberSubmitResult(method, url, init, res) {
    try {
      var u = new URL(String(url || ''), location.origin);
      if (u.origin !== location.origin) return;
      if (!/^\/api\/submitted-extracts(?:\/\d+)?$/.test(u.pathname)) return;
      if (method !== 'POST' && method !== 'PUT') return;
      if (!res || !res.ok) return;
      var body = safeJson(init && init.body, {}) || {};
      res.clone().json().then(function (row) {
        var cd = contractData();
        var id = clean((row && (row.id || row.extractId)) || u.pathname.split('/').pop() || '');
        var action = method === 'PUT' ? 'update' : 'new';
        var summary = {
          schema: 'najran_last_submitted_summary_v1',
          action: action,
          id: id,
          extractType: clean(body.extractType || row.extractType || ''),
          companyName: clean(body.companyName || row.companyName || cd.companyName || ''),
          hospitalName: clean(isAdmin() ? 'المقر الرئيسي — تجمع نجران الصحي' : (body.hospitalName || row.hospitalName || cd.hospitalName || '')),
          contractNumber: clean(body.contractNumber || row.contractNumber || cd.contractNumber || ''),
          periodMonth: clean(body.periodMonth || row.periodMonth || cd.periodMonth || ''),
          extractMonth: clean(body.extractMonth || cd.extractMonth || ''),
          extractYear: clean(body.extractYear || cd.extractYear || ''),
          paymentNumber: clean(body.paymentNumber || cd.paymentNumber || ''),
          status: clean(row.status || 'submitted'),
          isAdmin: isAdmin(),
          at: new Date().toISOString()
        };
        localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
        localStorage.setItem('najran_current_extract_submitted', 'true');
        if (id) localStorage.setItem('najran_last_submitted_extract_id', id);
      }).catch(function () {});
    } catch (_) {}
  }
  function patchFetchForSubmitSummary() {
    if (window.__NAJRAN_SUBMIT_FLOW_FETCH_PATCHED__) return;
    window.__NAJRAN_SUBMIT_FLOW_FETCH_PATCHED__ = true;
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var raw = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      return nativeFetch.apply(this, arguments).then(function (res) {
        rememberSubmitResult(method, raw, init || {}, res);
        return res;
      });
    };
  }

  installDuplicateModalObserver();
  patchFetchForSubmitSummary();
  window.NajranExtractSubmitFlowControl = { showDuplicateChoiceModal: showDuplicateChoiceModal, latestDoneLock: latestDoneLock, setUpdateMode: setUpdateMode };
  console.info('[ExtractSubmitFlowControl] installed v1 no-auto-resubmit + update-existing');
})();
