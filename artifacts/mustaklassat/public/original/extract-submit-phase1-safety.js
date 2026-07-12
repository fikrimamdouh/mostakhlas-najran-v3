// Phase 1 submit safety guard — v2 (2026-07-12)
// Prevents false-success side effects and normalizes submit payloads without touching calculations.
(function () {
  'use strict';

  if (window.__NAJRAN_PHASE1_SUBMIT_SAFETY_V2__) return;
  window.__NAJRAN_PHASE1_SUBMIT_SAFETY_V2__ = true;

  var LOCK_PREFIX = 'najran_submit_lock_';
  var DONE_PREFIX = 'najran_submit_done_';
  var LOCK_TTL = 120000;
  var authNoticeAt = 0;

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function json(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function modal(options) {
    options = options || {};
    var previous = document.getElementById('najran-phase1-submit-safety-modal');
    if (previous) previous.remove();

    var type = options.type || 'warning';
    var theme = type === 'danger'
      ? { color: '#b91c1c', bg: '#fef2f2', icon: '×' }
      : type === 'info'
        ? { color: '#1d4ed8', bg: '#eff6ff', icon: 'i' }
        : { color: '#b45309', bg: '#fffbeb', icon: '!' };

    var overlay = document.createElement('div');
    overlay.id = 'najran-phase1-submit-safety-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.64);display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif';
    overlay.innerHTML =
      '<div role="dialog" aria-modal="true" style="width:min(560px,94vw);background:#fff;border-radius:20px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.34);border-top:7px solid ' + theme.color + ';text-align:right">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:48px;height:48px;border-radius:15px;background:' + theme.bg + ';color:' + theme.color + ';display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:950">' + theme.icon + '</div>' +
          '<h2 style="margin:0;color:#0f172a;font-size:20px;font-weight:950">' + esc(options.title || 'تعذر تنفيذ الرفع') + '</h2>' +
        '</div>' +
        '<div style="color:#334155;font-size:14px;line-height:1.95;white-space:pre-line;margin:12px 0 18px">' + esc(options.message || '') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button data-action="close" style="background:' + theme.color + ';color:#fff;border:0;border-radius:11px;padding:11px 22px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer">' + esc(options.buttonText || 'حسنًا') + '</button>' +
          (options.showTrack ? '<button data-action="track" style="background:#475569;color:#fff;border:0;border-radius:11px;padding:11px 20px;font-family:inherit;font-size:14px;font-weight:850;cursor:pointer">متابعة المستخلصات</button>' : '') +
        '</div>' +
      '</div>';

    overlay.addEventListener('click', function (event) {
      var button = event.target && event.target.closest && event.target.closest('button[data-action]');
      if (!button) return;
      if (button.getAttribute('data-action') === 'track') {
        location.href = '/extracts/track';
        return;
      }
      overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function contract() {
    var c = json(localStorage.getItem('persistentContractData'), {}) || {};
    var e = json(localStorage.getItem('persistentExtractData'), {}) || {};
    return {
      companyName: clean(localStorage.getItem('companyName') || c.companyName || c.company || ''),
      hospitalName: clean(c.hospitalName || localStorage.getItem('hospitalName') || ''),
      extractMonth: clean(e.extractMonth || localStorage.getItem('extractMonth') || ''),
      extractYear: clean(e.extractYear || localStorage.getItem('extractYear') || ''),
      paymentNumber: clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '')
    };
  }

  function typeFromPage(text) {
    var path = String(location.pathname || '');
    text = clean(text);
    if (path.indexOf('spare_parts') > -1 || /قطع الغيار/.test(text)) return 'spare_parts';
    if (path.indexOf('health_centers') > -1 || /المراكز الصحية/.test(text)) return 'health_centers';
    if (path.indexOf('admin_offices') > -1) return /مستهلكات/.test(text) ? 'consumables' : 'labor';
    if (path.indexOf('consumables') > -1 || /مستهلكات/.test(text)) return 'consumables';
    return 'labor';
  }

  function editing() {
    return !!(
      localStorage.getItem('najran_revision_mode') === 'true' ||
      localStorage.getItem('najran_revision_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_id') ||
      localStorage.getItem('najran_editing_submitted_extract_mode') === 'true'
    );
  }

  function uniqueKey(type, values) {
    values = values || contract();
    return [
      'submitted_extract', type || '', values.companyName || '',
      values.hospitalName || localStorage.getItem('hospitalName') || '',
      values.extractYear || '', values.extractMonth || '', values.paymentNumber || ''
    ].join('__');
  }

  function activeLock(type) {
    var key = LOCK_PREFIX + uniqueKey(type);
    var value = json(sessionStorage.getItem(key), null);
    if (!value || !value.startedAt) return null;
    if (Date.now() - Number(value.startedAt) >= LOCK_TTL) {
      try { sessionStorage.removeItem(key); } catch (_) {}
      return null;
    }
    return { key: key, value: value };
  }

  function doneLock(type) {
    var key = DONE_PREFIX + uniqueKey(type);
    var value = json(localStorage.getItem(key), null);
    if (!value || !value.submittedAt) return null;
    if (Date.now() - Number(value.submittedAt) >= 86400000) return null;
    return { key: key, value: value };
  }

  function bodyIdentity(body) {
    var current = contract();
    var data = body && body.extractData && typeof body.extractData === 'object' ? body.extractData : {};
    var persistent = data.persistentExtractData;
    if (typeof persistent === 'string') persistent = json(persistent, {});
    if (!persistent || typeof persistent !== 'object') persistent = {};
    return {
      companyName: clean((body && body.companyName) || current.companyName),
      hospitalName: clean((body && body.hospitalName) || current.hospitalName),
      extractMonth: clean((body && body.extractMonth) || persistent.extractMonth || data.extractMonth || current.extractMonth),
      extractYear: clean((body && body.extractYear) || persistent.extractYear || data.extractYear || current.extractYear),
      paymentNumber: clean((body && (body.paymentNumber || body.extractNumber)) || persistent.paymentNumber || persistent.extractNumber || data.paymentNumber || data.extractNumber || current.paymentNumber)
    };
  }

  function clearLocks(body, type) {
    var values = bodyIdentity(body || {});
    var resolvedType = clean(type || (body && body.extractType) || '');
    try { sessionStorage.removeItem(LOCK_PREFIX + uniqueKey(resolvedType, values)); } catch (_) {}

    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var key = sessionStorage.key(i);
        if (!key || key.indexOf(LOCK_PREFIX) !== 0) continue;
        var lock = json(sessionStorage.getItem(key), null);
        if (!lock || !lock.startedAt || Date.now() - Number(lock.startedAt) >= LOCK_TTL) {
          sessionStorage.removeItem(key);
          continue;
        }
        if (
          clean(lock.type) === resolvedType &&
          clean(lock.month) === values.extractMonth &&
          clean(lock.year) === values.extractYear &&
          clean(lock.payment) === values.paymentNumber
        ) sessionStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function mismatch() {
    if (!editing()) return null;
    try {
      var snapshot = json(localStorage.getItem('najran_revision_snapshot'), {}) || {};
      var oldData = snapshot.persistentExtractData;
      if (typeof oldData === 'string') oldData = json(oldData, {});
      oldData = oldData && typeof oldData === 'object' ? oldData : {};
      var now = contract();
      var oldMonth = clean(oldData.extractMonth);
      var oldYear = clean(oldData.extractYear);
      var oldPayment = clean(oldData.paymentNumber || oldData.extractNumber);
      if (!(
        (oldMonth && now.extractMonth && oldMonth !== now.extractMonth) ||
        (oldYear && now.extractYear && oldYear !== now.extractYear) ||
        (oldPayment && now.paymentNumber && oldPayment !== now.paymentNumber)
      )) return null;
      return {
        oldText: [oldMonth, oldYear, oldPayment ? 'دفعة ' + oldPayment : ''].filter(Boolean).join(' — '),
        newText: [now.extractMonth, now.extractYear, now.paymentNumber ? 'دفعة ' + now.paymentNumber : ''].filter(Boolean).join(' — ')
      };
    } catch (_) {
      return { invalid: true };
    }
  }

  function submitButton(target) {
    var button = target && target.closest && target.closest('#_najran_approve_btn_inner,button');
    if (!button) return null;
    var text = clean(button.textContent);
    if (!/رفع\s+مستخلص|رفع\s+للاعتماد/.test(text)) return null;
    return { button: button, text: text, type: typeFromPage(text) };
  }

  function stop(event, button) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    try { button.disabled = false; button.style.opacity = '1'; } catch (_) {}
  }

  document.addEventListener('click', function (event) {
    var info = submitButton(event.target);
    if (!info) return;

    var changed = mismatch();
    if (changed) {
      stop(event, info.button);
      modal({
        type: 'danger',
        title: 'تم إيقاف الرفع لحماية المستخلص',
        message: changed.invalid
          ? 'تعذر التحقق من بيانات المستخلص القديم. لم يتم الرفع ولم يتم قفل الشهر.'
          : 'بيانات المستخلص الجاري تعديله لا تطابق الشهر أو السنة أو رقم الدفعة الحالية.\n\nالقديم: ' + changed.oldText + '\nالحالي: ' + changed.newText + '\n\nاخرج من وضع التعديل لإنشاء مستخلص جديد.',
        showTrack: true
      });
      return false;
    }

    if (activeLock(info.type)) {
      stop(event, info.button);
      modal({
        title: 'الرفع ما زال قيد التنفيذ',
        message: 'توجد محاولة رفع لنفس المستخلص بدأت منذ أقل من دقيقتين. لم يتم تنفيذ ضغط جديد ولم يتم قفل الشهر.'
      });
      return false;
    }

    if (!editing()) {
      var completed = doneLock(info.type);
      if (completed) {
        stop(event, info.button);
        if (window.NajranExtractSubmitFlowControl && typeof window.NajranExtractSubmitFlowControl.showDuplicateChoiceModal === 'function') {
          window.NajranExtractSubmitFlowControl.showDuplicateChoiceModal(completed.value.resultId || completed.value.existingId || '', completed.value);
        } else if (typeof window.showDuplicateResubmitModal === 'function') {
          window.showDuplicateResubmitModal(function () {});
        } else {
          modal({
            title: 'هذا المستخلص مرفوع مسبقًا',
            message: 'لم يتم رفع نسخة أخرى. افتح المتابعة لتعديل السجل القائم أو غيّر الشهر أو رقم الدفعة.',
            showTrack: true
          });
        }
        return false;
      }
    }
  }, true);

  function submitRequest(url, method) {
    try {
      var parsed = new URL(String(url || ''), location.origin);
      return parsed.origin === location.origin && /^\/api\/submitted-extracts(?:\/\d+)?$/.test(parsed.pathname) && (method === 'POST' || method === 'PUT');
    } catch (_) { return false; }
  }

  function promote(body) {
    if (!body || typeof body !== 'object') return body;
    var data = body.extractData && typeof body.extractData === 'object' ? body.extractData : {};
    var extra = data.submitExtraData && typeof data.submitExtraData === 'object' ? data.submitExtraData : {};
    [
      'totalAmount', 'notes', 'adminOfficeExtract', 'adminOfficePart',
      'adminOfficeLabor', 'adminOfficeConsumables', 'sourceModule', 'reviewScope'
    ].forEach(function (key) {
      // An explicitly supplied extraData value is authoritative, including numeric zero.
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        body[key] = extra[key];
        data[key] = extra[key];
      }
    });
    body.extractData = data;
    return body;
  }

  if (!window.__NAJRAN_PHASE1_FETCH_SAFETY_PATCHED_V2__) {
    window.__NAJRAN_PHASE1_FETCH_SAFETY_PATCHED_V2__ = true;
    var nativeFetch = window.fetch;
    window.fetch = async function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (!submitRequest(url, method)) return nativeFetch.apply(this, arguments);

      var next = init ? Object.assign({}, init) : {};
      var body = json(next.body, null);
      if (body && typeof body === 'object') {
        body = promote(body);
        next.body = JSON.stringify(body);
      }

      try {
        var response = await nativeFetch.call(this, input, next);
        if (!response.ok) clearLocks(body, clean(body && body.extractType));
        if (response.status === 401 && Date.now() - authNoticeAt > 2000) {
          authNoticeAt = Date.now();
          setTimeout(function () {
            var overlay = modal({
              type: 'danger',
              title: 'انتهت جلسة الدخول',
              message: 'رفض الخادم عملية الرفع لأن جلسة الدخول غير صالحة. لم يتم رفع المستخلص ولم يتم قفل الشهر.',
              buttonText: 'تسجيل الدخول'
            });
            var button = overlay && overlay.querySelector('button[data-action="close"]');
            if (button) button.onclick = function () { location.href = '/sign-in'; };
          }, 0);
        }
        return response;
      } catch (error) {
        clearLocks(body, clean(body && body.extractType));
        throw error;
      }
    };
  }

  window.NajranPhase1SubmitSafety = {
    version: 'v2',
    contract: contract,
    activeLock: activeLock,
    doneLock: doneLock,
    mismatch: mismatch,
    promote: promote,
    clearLocks: clearLocks
  };

  console.info('[NajranPhase1SubmitSafety] installed v2 — fail-closed click guard + lock cleanup + authoritative extraData');
})();