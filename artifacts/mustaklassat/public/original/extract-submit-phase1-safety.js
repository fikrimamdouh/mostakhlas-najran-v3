// Phase 1 submit safety guard — 2026-07-12
// Loaded immediately after the preserved extract-submit implementation.
(function () {
  'use strict';

  if (window.__NAJRAN_PHASE1_SUBMIT_SAFETY_V1__) return;
  window.__NAJRAN_PHASE1_SUBMIT_SAFETY_V1__ = true;

  var SUBMIT_LOCK_PREFIX = 'najran_submit_lock_';
  var SUBMIT_DONE_PREFIX = 'najran_submit_done_';
  var LOCK_TTL_MS = 120000;
  var lastAuthModalAt = 0;

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function showSafetyModal(options) {
    options = options || {};
    var old = document.getElementById('najran-phase1-submit-safety-modal');
    if (old) old.remove();

    var type = options.type || 'warning';
    var palette = {
      warning: { color: '#b45309', bg: '#fffbeb', icon: '!' },
      danger: { color: '#b91c1c', bg: '#fef2f2', icon: '×' },
      info: { color: '#1d4ed8', bg: '#eff6ff', icon: 'i' }
    }[type] || { color: '#1d4ed8', bg: '#eff6ff', icon: 'i' };

    var overlay = document.createElement('div');
    overlay.id = 'najran-phase1-submit-safety-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.64);display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
    overlay.innerHTML =
      '<div role="dialog" aria-modal="true" style="width:min(560px,94vw);background:#fff;border-radius:20px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.34);border-top:7px solid ' + palette.color + ';text-align:right">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:48px;height:48px;border-radius:15px;background:' + palette.bg + ';color:' + palette.color + ';display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:950">' + palette.icon + '</div>' +
          '<h2 style="margin:0;color:#0f172a;font-size:20px;font-weight:950">' + escapeHtml(options.title || 'تعذر تنفيذ الرفع') + '</h2>' +
        '</div>' +
        '<div style="color:#334155;font-size:14px;line-height:1.95;white-space:pre-line;margin:12px 0 18px">' + escapeHtml(options.message || '') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button data-action="close" style="background:' + palette.color + ';color:#fff;border:0;border-radius:11px;padding:11px 22px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer">' + escapeHtml(options.buttonText || 'حسنًا') + '</button>' +
          (options.showTrack ? '<button data-action="track" style="background:#475569;color:#fff;border:0;border-radius:11px;padding:11px 20px;font-family:inherit;font-size:14px;font-weight:850;cursor:pointer">متابعة المستخلصات</button>' : '') +
        '</div>' +
      '</div>';

    overlay.addEventListener('click', function (event) {
      var button = event.target && event.target.closest && event.target.closest('button[data-action]');
      if (!button) return;
      if (button.getAttribute('data-action') === 'track') {
        window.location.href = '/extracts/track';
        return;
      }
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function currentContract() {
    var contract = safeJson(localStorage.getItem('persistentContractData'), {}) || {};
    var extract = safeJson(localStorage.getItem('persistentExtractData'), {}) || {};
    return {
      companyName: clean(localStorage.getItem('companyName') || contract.companyName || contract.company || ''),
      hospitalName: clean(contract.hospitalName || localStorage.getItem('hospitalName') || ''),
      contractNumber: clean(contract.contractNumber || localStorage.getItem('contractDetails') || ''),
      extractMonth: clean(extract.extractMonth || localStorage.getItem('extractMonth') || ''),
      extractYear: clean(extract.extractYear || localStorage.getItem('extractYear') || ''),
      paymentNumber: clean(extract.paymentNumber || extract.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '')
    };
  }

  function typeFromPageAndText(text) {
    var path = String(location.pathname || '');
    text = clean(text);
    if (path.indexOf('spare_parts') > -1 || /قطع الغيار/.test(text)) return 'spare_parts';
    if (path.indexOf('health_centers') > -1 || /المراكز الصحية/.test(text)) return 'health_centers';
    if (path.indexOf('admin_offices') > -1) return /مستهلكات/.test(text) ? 'consumables' : 'labor';
    if (path.indexOf('consumables') > -1 || /مستهلكات/.test(text)) return 'consumables';
    return 'labor';
  }

  function isEditingExisting() {
    return !!(
      localStorage.getItem('najran_revision_mode') === 'true' ||
      localStorage.getItem('najran_revision_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_mode') === 'true'
    );
  }

  function submitKey(prefix, type, data) {
    data = data || currentContract();
    return [
      prefix,
      type || '',
      data.companyName || '',
      data.hospitalName || localStorage.getItem('hospitalName') || '',
      data.extractYear || '',
      data.extractMonth || '',
      data.paymentNumber || ''
    ].join('__');
  }

  function activeLockFor(type) {
    var key = submitKey('submitted_extract', type);
    var fullKey = SUBMIT_LOCK_PREFIX + key;
    var value = safeJson(sessionStorage.getItem(fullKey), null);
    if (!value || !value.startedAt) return null;
    if (Date.now() - Number(value.startedAt) >= LOCK_TTL_MS) {
      try { sessionStorage.removeItem(fullKey); } catch (_) {}
      return null;
    }
    return { key: fullKey, value: value };
  }

  function doneLockFor(type) {
    var key = submitKey('submitted_extract', type);
    var fullKey = SUBMIT_DONE_PREFIX + key;
    var value = safeJson(localStorage.getItem(fullKey), null);
    if (!value || !value.submittedAt) return null;
    if (Date.now() - Number(value.submittedAt) >= 24 * 60 * 60 * 1000) return null;
    return { key: fullKey, value: value };
  }

  function clearMatchingActiveLocks(body, type) {
    var contract = currentContract();
    var extractData = body && body.extractData && typeof body.extractData === 'object' ? body.extractData : {};
    var persistent = extractData.persistentExtractData && typeof extractData.persistentExtractData === 'object' ? extractData.persistentExtractData : {};
    var data = {
      companyName: clean((body && body.companyName) || contract.companyName),
      hospitalName: clean((body && body.hospitalName) || contract.hospitalName),
      extractYear: clean((body && body.extractYear) || persistent.extractYear || extractData.extractYear || contract.extractYear),
      extractMonth: clean((body && body.extractMonth) || persistent.extractMonth || extractData.extractMonth || contract.extractMonth),
      paymentNumber: clean((body && (body.paymentNumber || body.extractNumber)) || persistent.paymentNumber || persistent.extractNumber || extractData.paymentNumber || extractData.extractNumber || contract.paymentNumber)
    };
    var exact = SUBMIT_LOCK_PREFIX + submitKey('submitted_extract', type || (body && body.extractType) || '', data);
    try { sessionStorage.removeItem(exact); } catch (_) {}

    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var key = sessionStorage.key(i);
        if (!key || key.indexOf(SUBMIT_LOCK_PREFIX) !== 0) continue;
        var lock = safeJson(sessionStorage.getItem(key), null);
        if (!lock || !lock.startedAt || Date.now() - Number(lock.startedAt) >= LOCK_TTL_MS) {
          sessionStorage.removeItem(key);
          continue;
        }
        if (
          clean(lock.type || '') === clean(type || (body && body.extractType) || '') &&
          clean(lock.month || '') === data.extractMonth &&
          clean(lock.year || '') === data.extractYear &&
          clean(lock.payment || '') === data.paymentNumber
        ) sessionStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function revisionMismatch() {
    if (!isEditingExisting()) return null;
    try {
      var raw = localStorage.getItem('najran_revision_snapshot');
      var snapshot = safeJson(raw, {}) || {};
      var oldExtractRaw = snapshot.persistentExtractData;
      var oldExtract = typeof oldExtractRaw === 'string' ? safeJson(oldExtractRaw, {}) : (oldExtractRaw || {});
      var now = currentContract();
      var oldMonth = clean(oldExtract.extractMonth || '');
      var oldYear = clean(oldExtract.extractYear || '');
      var oldPayment = clean(oldExtract.paymentNumber || oldExtract.extractNumber || '');
      var changed =
        (oldMonth && now.extractMonth && oldMonth !== now.extractMonth) ||
        (oldYear && now.extractYear && oldYear !== now.extractYear) ||
        (oldPayment && now.paymentNumber && oldPayment !== now.paymentNumber);
      if (!changed) return null;
      return {
        oldMonth: oldMonth,
        oldYear: oldYear,
        oldPayment: oldPayment,
        newMonth: now.extractMonth,
        newYear: now.extractYear,
        newPayment: now.paymentNumber
      };
    } catch (_) {
      return { invalidSnapshot: true };
    }
  }

  function isSubmitButton(target) {
    var button = target && target.closest && target.closest('#_najran_approve_btn_inner, button');
    if (!button) return null;
    var text = clean(button.textContent || '');
    if (!/رفع\s+مستخلص|رفع\s+للاعتماد/.test(text)) return null;
    return { button: button, text: text, type: typeFromPageAndText(text) };
  }

  function resetSubmitButton(button) {
    try {
      if (!button) return;
      button.disabled = false;
      button.style.opacity = '1';
    } catch (_) {}
  }

  document.addEventListener('click', function (event) {
    var info = isSubmitButton(event.target);
    if (!info) return;

    var mismatch = revisionMismatch();
    if (mismatch) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      resetSubmitButton(info.button);
      showSafetyModal({
        type: 'danger',
        title: 'تم إيقاف الرفع لحماية المستخلص',
        message: mismatch.invalidSnapshot
          ? 'تعذر التحقق من بيانات المستخلص القديم. لم يتم الرفع ولم يتم قفل الشهر.'
          : 'أنت تعدّل مستخلصًا قديمًا، لكن الشهر أو السنة أو رقم الدفعة الحالية مختلفة عن بياناته.\n\nالقديم: ' + [mismatch.oldMonth, mismatch.oldYear, mismatch.oldPayment ? 'دفعة ' + mismatch.oldPayment : ''].filter(Boolean).join(' — ') + '\nالحالي: ' + [mismatch.newMonth, mismatch.newYear, mismatch.newPayment ? 'دفعة ' + mismatch.newPayment : ''].filter(Boolean).join(' — ') + '\n\nاخرج من وضع التعديل لإنشاء مستخلص جديد.',
        showTrack: true
      });
      return false;
    }

    var active = activeLockFor(info.type);
    if (active) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      resetSubmitButton(info.button);
      showSafetyModal({
        type: 'warning',
        title: 'الرفع ما زال قيد التنفيذ',
        message: 'توجد محاولة رفع لنفس المستخلص بدأت منذ أقل من دقيقتين. لم يتم تنفيذ ضغط جديد ولم يتم قفل الشهر. انتظر نتيجة المحاولة الحالية أو أعد المحاولة بعد انتهاء المهلة.'
      });
      return false;
    }

    if (!isEditingExisting()) {
      var done = doneLockFor(info.type);
      if (done) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        resetSubmitButton(info.button);
        if (window.NajranExtractSubmitFlowControl && typeof window.NajranExtractSubmitFlowControl.showDuplicateChoiceModal === 'function') {
          window.NajranExtractSubmitFlowControl.showDuplicateChoiceModal(done.value.resultId || done.value.existingId || '', done.value);
        } else if (typeof window.showDuplicateResubmitModal === 'function') {
          window.showDuplicateResubmitModal(function () {});
        } else {
          showSafetyModal({
            type: 'warning',
            title: 'هذا المستخلص مرفوع مسبقًا',
            message: 'لم يتم رفع نسخة أخرى ولم يتم قفل الشهر مجددًا. افتح صفحة المتابعة لتعديل المستخلص القائم، أو غيّر الشهر أو رقم الدفعة لإنشاء مستخلص جديد.',
            showTrack: true
          });
        }
        return false;
      }
    }
  }, true);

  function isSubmitRequest(url, method) {
    try {
      var parsed = new URL(String(url || ''), location.origin);
      return parsed.origin === location.origin && /^\/api\/submitted-extracts(?:\/\d+)?$/.test(parsed.pathname) && (method === 'POST' || method === 'PUT');
    } catch (_) { return false; }
  }

  function promoteSubmitExtraData(body) {
    if (!body || typeof body !== 'object') return body;
    var extractData = body.extractData && typeof body.extractData === 'object' ? body.extractData : {};
    var extra = extractData.submitExtraData && typeof extractData.submitExtraData === 'object' ? extractData.submitExtraData : {};
    var known = [
      'totalAmount', 'notes', 'adminOfficeExtract', 'adminOfficePart',
      'adminOfficeLabor', 'adminOfficeConsumables', 'sourceModule', 'reviewScope'
    ];
    known.forEach(function (key) {
      if (body[key] == null && extra[key] != null) body[key] = extra[key];
      if (extractData[key] == null && extra[key] != null) extractData[key] = extra[key];
    });
    body.extractData = extractData;
    return body;
  }

  if (!window.__NAJRAN_PHASE1_FETCH_SAFETY_PATCHED__) {
    window.__NAJRAN_PHASE1_FETCH_SAFETY_PATCHED__ = true;
    var nativeFetch = window.fetch;
    window.fetch = async function (input, init) {
      var rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (!isSubmitRequest(rawUrl, method)) return nativeFetch.apply(this, arguments);

      var nextInit = init ? Object.assign({}, init) : {};
      var body = null;
      try {
        body = safeJson(nextInit.body, null);
        if (body && typeof body === 'object') {
          body = promoteSubmitExtraData(body);
          nextInit.body = JSON.stringify(body);
        }
      } catch (_) {}

      try {
        var response = await nativeFetch.call(this, input, nextInit);
        if (!response.ok) clearMatchingActiveLocks(body, clean(body && body.extractType));
        if (response.status === 401) {
          clearMatchingActiveLocks(body, clean(body && body.extractType));
          if (Date.now() - lastAuthModalAt > 2000) {
            lastAuthModalAt = Date.now();
            setTimeout(function () {
              showSafetyModal({
                type: 'danger',
                title: 'انتهت جلسة الدخول',
                message: 'رفض الخادم عملية الرفع لأن جلسة الدخول غير صالحة. لم يتم رفع المستخلص ولم يتم قفل الشهر. سجل الدخول ثم أعد المحاولة.',
                buttonText: 'تسجيل الدخول'
              });
              var modal = document.getElementById('najran-phase1-submit-safety-modal');
              var button = modal && modal.querySelector('button[data-action="close"]');
              if (button) button.onclick = function () { window.location.href = '/sign-in'; };
            }, 0);
          }
        }
        return response;
      } catch (error) {
        clearMatchingActiveLocks(body, clean(body && body.extractType));
        throw error;
      }
    };
  }

  window.NajranPhase1SubmitSafety = {
    version: 'v1',
    currentContract: currentContract,
    activeLockFor: activeLockFor,
    doneLockFor: doneLockFor,
    revisionMismatch: revisionMismatch,
    promoteSubmitExtraData: promoteSubmitExtraData,
    clearMatchingActiveLocks: clearMatchingActiveLocks
  };

  console.info('[NajranPhase1SubmitSafety] installed v1 — lock cleanup + null-success guards + extraData promotion');
})();