// Unified professional dialogs for every active Najran screen.
(function (global) {
  'use strict';

  if (global.NajranDialogs && global.NajranDialogs.version) return;

  var VERSION = '20260713_all_native_dialogs_v1';
  var PENDING_ALERT_KEY = 'najran_pending_system_alert_v1';
  var queue = Promise.resolve();

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function merge(base, extra) {
    var out = {};
    var key;
    base = base || {};
    extra = extra || {};
    for (key in base) if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    for (key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) out[key] = extra[key];
    return out;
  }

  function paletteFor(kind) {
    var palettes = {
      info: { accent: '#166534', soft: '#f0fdf4', border: '#bbf7d0', icon: 'i', eyebrow: 'رسالة من النظام' },
      success: { accent: '#15803d', soft: '#f0fdf4', border: '#86efac', icon: '✓', eyebrow: 'تم بنجاح' },
      warning: { accent: '#b45309', soft: '#fffbeb', border: '#fde68a', icon: '!', eyebrow: 'تنبيه من النظام' },
      danger: { accent: '#b91c1c', soft: '#fef2f2', border: '#fecaca', icon: '!', eyebrow: 'تأكيد مطلوب' }
    };
    if (kind === 'error') kind = 'danger';
    return palettes[kind] || palettes.info;
  }

  function inferKind(text, fallback) {
    text = String(text || '');
    if (/تم بنجاح|نجاح|تم الحفظ|تم الرفع|تم التحديث|✓|✅/.test(text)) return 'success';
    if (/فشل|خطأ|تعذر|غير مصرح|مرفوض/.test(text)) return 'danger';
    if (/تحذير|تنبيه|انتبه|سيتم حذف|مسح|لا يمكن التراجع/.test(text)) return 'warning';
    return fallback || 'info';
  }

  function splitAlertMessage(message) {
    var text = String(message == null ? '' : message).trim();
    var lines = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (lines.length > 1 && lines[0].length <= 100) {
      return { title: lines.shift(), message: lines.join('\n') };
    }
    return { title: text.length <= 100 ? text : 'رسالة من النظام', message: text.length <= 100 ? '' : text };
  }

  function normalize(options) {
    options = options || {};
    var mode = options.mode || 'confirm';
    var text = [options.title, options.message, options.note].filter(Boolean).join(' ');
    var kind = options.kind || inferKind(text, mode === 'alert' ? 'info' : 'warning');
    var destructive = /حذف|مسح|رفض|إزالة|لا يمكن التراجع/.test(text);
    if (!options.kind && destructive) kind = 'danger';
    return merge(options, {
      mode: mode,
      kind: kind,
      title: options.title || (mode === 'prompt' ? 'إدخال مطلوب' : mode === 'alert' ? 'رسالة من النظام' : 'تأكيد الإجراء'),
      confirmText: options.confirmText || (mode === 'alert' ? 'حسنًا' : mode === 'prompt' ? 'حفظ ومتابعة' : destructive ? 'نعم، تنفيذ الإجراء' : 'متابعة'),
      cancelText: options.cancelText || 'إلغاء'
    });
  }

  function render(options) {
    options = normalize(options);
    return new Promise(function (resolve) {
      var old = document.getElementById('najran-global-system-dialog');
      if (old && typeof old.__najranFinish === 'function') old.__najranFinish(options.mode === 'prompt' ? null : false);
      else if (old && old.parentNode) old.parentNode.removeChild(old);

      var palette = paletteFor(options.kind);
      var details = Array.isArray(options.details) ? options.details.filter(function (item) {
        return item && item.value != null && String(item.value).trim() !== '';
      }) : [];
      var detailsHtml = details.length ? '<div class="najran-dialog-details">' + details.map(function (item) {
        return '<div class="najran-dialog-detail"><span>' + esc(item.label || '') + '</span><b>' + esc(item.value) + '</b></div>';
      }).join('') + '</div>' : '';
      var inputType = /^(?:text|password|number|email|tel)$/.test(options.inputType || '') ? options.inputType : 'text';
      var inputHtml = options.mode === 'prompt'
        ? '<label class="najran-dialog-input-label" for="najran-global-system-dialog-input">' + esc(options.inputLabel || 'القيمة المطلوبة') + '</label>' +
          '<input id="najran-global-system-dialog-input" class="najran-dialog-input" type="' + inputType + '" value="' + esc(options.defaultValue || '') + '" autocomplete="off">'
        : '';

      var overlay = document.createElement('div');
      overlay.id = 'najran-global-system-dialog';
      overlay.className = 'no-print';
      overlay.setAttribute('dir', 'rtl');
      overlay.innerHTML =
        '<style>' +
          '@keyframes najranDialogFade{from{opacity:0}to{opacity:1}}' +
          '@keyframes najranDialogPop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
          '#najran-global-system-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.68);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Tajawal,Arial,sans-serif;backdrop-filter:blur(5px);animation:najranDialogFade .16s ease-out}' +
          '#najran-global-system-dialog *{box-sizing:border-box}' +
          '#najran-global-system-dialog .najran-dialog-card{width:min(580px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.38);border:1px solid ' + palette.border + ';animation:najranDialogPop .2s ease-out}' +
          '#najran-global-system-dialog .najran-dialog-accent{height:6px;background:' + palette.accent + '}' +
          '#najran-global-system-dialog .najran-dialog-body{padding:24px}' +
          '#najran-global-system-dialog .najran-dialog-head{display:flex;align-items:flex-start;gap:14px}' +
          '#najran-global-system-dialog .najran-dialog-icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px;background:' + palette.soft + ';border:1px solid ' + palette.border + ';color:' + palette.accent + ';display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:1000}' +
          '#najran-global-system-dialog .najran-dialog-eyebrow{display:block;color:' + palette.accent + ';font-size:11px;font-weight:900;margin-bottom:5px}' +
          '#najran-global-system-dialog h2{margin:0;color:#0f172a;font-size:21px;line-height:1.5;font-weight:900}' +
          '#najran-global-system-dialog .najran-dialog-message{white-space:pre-line;color:#475569;font-size:14px;line-height:1.95;margin-top:15px;overflow-wrap:anywhere}' +
          '#najran-global-system-dialog .najran-dialog-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:16px 0}' +
          '#najran-global-system-dialog .najran-dialog-detail{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:11px 13px}' +
          '#najran-global-system-dialog .najran-dialog-detail span{display:block;color:#64748b;font-size:11px;font-weight:800;margin-bottom:4px}' +
          '#najran-global-system-dialog .najran-dialog-detail b{display:block;color:#0f172a;font-size:14px;overflow-wrap:anywhere}' +
          '#najran-global-system-dialog .najran-dialog-note{background:' + palette.soft + ';border:1px solid ' + palette.border + ';border-radius:13px;padding:11px 13px;color:' + palette.accent + ';font-size:12px;font-weight:800;line-height:1.8;margin-top:14px}' +
          '#najran-global-system-dialog .najran-dialog-input-label{display:block;color:#334155;font-size:12px;font-weight:900;margin:17px 0 7px}' +
          '#najran-global-system-dialog .najran-dialog-input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px 13px;font:700 14px Tajawal,Arial,sans-serif;color:#0f172a;outline:none}' +
          '#najran-global-system-dialog .najran-dialog-input:focus{border-color:' + palette.accent + ';box-shadow:0 0 0 3px ' + palette.soft + '}' +
          '#najran-global-system-dialog .najran-dialog-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}' +
          '#najran-global-system-dialog button{border-radius:12px;padding:11px 18px;font:900 13px Tajawal,Arial,sans-serif;cursor:pointer}' +
          '#najran-global-system-dialog-confirm{background:' + palette.accent + ';color:#fff;border:0;box-shadow:0 7px 18px ' + palette.accent + '33}' +
          '#najran-global-system-dialog-cancel{background:#f8fafc;color:#475569;border:1px solid #cbd5e1}' +
          '@media(max-width:480px){#najran-global-system-dialog{padding:10px;align-items:flex-end}#najran-global-system-dialog .najran-dialog-card{border-radius:20px 20px 14px 14px}#najran-global-system-dialog .najran-dialog-body{padding:20px}#najran-global-system-dialog .najran-dialog-actions button{width:100%}}' +
          '@media print{#najran-global-system-dialog{display:none!important}}' +
        '</style>' +
        '<div class="najran-dialog-card" role="dialog" aria-modal="true" aria-labelledby="najran-global-system-dialog-title"' + (options.message ? ' aria-describedby="najran-global-system-dialog-message"' : '') + '>' +
          '<div class="najran-dialog-accent"></div>' +
          '<div class="najran-dialog-body">' +
            '<div class="najran-dialog-head"><div class="najran-dialog-icon" aria-hidden="true">' + esc(palette.icon) + '</div>' +
              '<div><span class="najran-dialog-eyebrow">' + esc(options.eyebrow || palette.eyebrow) + '</span>' +
              '<h2 id="najran-global-system-dialog-title">' + esc(options.title) + '</h2></div></div>' +
            (options.message ? '<div id="najran-global-system-dialog-message" class="najran-dialog-message">' + esc(options.message) + '</div>' : '') +
            detailsHtml + inputHtml +
            (options.note ? '<div class="najran-dialog-note">' + esc(options.note) + '</div>' : '') +
            '<div class="najran-dialog-actions"><button id="najran-global-system-dialog-confirm" type="button">' + esc(options.confirmText) + '</button>' +
              (options.mode === 'alert' || options.hideCancel ? '' : '<button id="najran-global-system-dialog-cancel" type="button">' + esc(options.cancelText) + '</button>') +
            '</div>' +
          '</div>' +
        '</div>';

      var previousFocus = document.activeElement;
      var previousOverflow = document.body ? document.body.style.overflow : '';
      var finished = false;

      function finish(value) {
        if (finished) return;
        finished = true;
        document.removeEventListener('keydown', onKeyDown, true);
        if (document.body) document.body.style.overflow = previousOverflow;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        try { if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); } catch (_) {}
        resolve(value);
      }

      function confirmValue() {
        if (options.mode === 'prompt') {
          var input = document.getElementById('najran-global-system-dialog-input');
          finish(input ? input.value : '');
        } else {
          finish(true);
        }
      }

      function cancelValue() {
        finish(options.mode === 'prompt' ? null : false);
      }

      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (options.mode === 'alert') finish(true); else cancelValue();
          return;
        }
        if (event.key === 'Enter' && options.mode === 'prompt' && event.target && event.target.id === 'najran-global-system-dialog-input') {
          event.preventDefault();
          confirmValue();
          return;
        }
        if (event.key === 'Tab') {
          var focusable = overlay.querySelectorAll('button,input');
          if (!focusable.length) return;
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }

      overlay.__najranFinish = finish;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeyDown, true);
      document.getElementById('najran-global-system-dialog-confirm').onclick = confirmValue;
      var cancel = document.getElementById('najran-global-system-dialog-cancel');
      if (cancel) cancel.onclick = cancelValue;
      overlay.addEventListener('click', function (event) {
        if (event.target !== overlay || options.dismissOnBackdrop === false) return;
        if (options.mode === 'alert') finish(true); else cancelValue();
      });
      var initialFocus = document.getElementById(options.mode === 'prompt' ? 'najran-global-system-dialog-input' : 'najran-global-system-dialog-confirm');
      if (initialFocus) {
        initialFocus.focus();
        if (options.mode === 'prompt' && typeof initialFocus.select === 'function') initialFocus.select();
      }
    });
  }

  function enqueue(options) {
    var task = queue.then(function () {
      if (document.body) return null;
      return new Promise(function (resolve) {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }).then(function () { return render(options); });
    queue = task.catch(function () { return false; });
    return task;
  }

  function rememberAlert(config) {
    var id = Date.now() + '_' + Math.random().toString(36).slice(2);
    config = merge(config, { __pendingAlertId: id, __pendingAlertAt: Date.now() });
    try { sessionStorage.setItem(PENDING_ALERT_KEY, JSON.stringify(config)); } catch (_) {}
    return config;
  }

  function clearRememberedAlert(config) {
    try {
      var current = JSON.parse(sessionStorage.getItem(PENDING_ALERT_KEY) || 'null');
      if (current && current.__pendingAlertId === config.__pendingAlertId) sessionStorage.removeItem(PENDING_ALERT_KEY);
    } catch (_) {}
  }

  function enqueueAlert(config, remember) {
    if (remember !== false) config = rememberAlert(config);
    return enqueue(config).then(function (answer) {
      clearRememberedAlert(config);
      return answer;
    });
  }

  var api = {
    version: VERSION,
    open: function (options) { return enqueue(options || {}); },
    alert: function (message, options) {
      var config;
      if (message && typeof message === 'object') config = merge(message, { mode: 'alert' });
      else {
        var split = splitAlertMessage(message);
        config = merge({ mode: 'alert', title: split.title, message: split.message, kind: inferKind(message, 'info') }, options);
      }
      return enqueueAlert(config, true);
    },
    confirm: function (message, options) {
      return enqueue(merge({ mode: 'confirm', message: String(message == null ? '' : message), dismissOnBackdrop: false }, options));
    },
    prompt: function (message, defaultValue, options) {
      var text = String(message == null ? '' : message);
      return enqueue(merge({
        mode: 'prompt',
        message: text,
        defaultValue: defaultValue == null ? '' : String(defaultValue),
        inputType: /كلمة المرور|الرمز السري|password/i.test(text) ? 'password' : 'text',
        dismissOnBackdrop: false
      }, options));
    }
  };

  global.NajranDialogs = api;
  global.NajranSystemDialog = function (options) { return api.open(options); };

  // Safety net for newly added legacy calls. Current production calls are migrated to
  // NajranDialogs directly; confirm/prompt fail closed if a future call bypasses review.
  global.alert = function (message) { void api.alert(message); };
  global.confirm = function (message) {
    console.error('[NajranDialogs] un-migrated confirm blocked safely:', message);
    void api.alert({ kind: 'warning', title: 'تم إيقاف الإجراء مؤقتًا', message: String(message || ''), note: 'أعد المحاولة بعد تحديث الصفحة.' });
    return false;
  };
  global.prompt = function (message) {
    console.error('[NajranDialogs] un-migrated prompt blocked safely:', message);
    void api.alert({ kind: 'warning', title: 'تم إيقاف الإدخال مؤقتًا', message: String(message || ''), note: 'أعد المحاولة بعد تحديث الصفحة.' });
    return null;
  };

  // Native alert used to block navigation. Migrated alerts are asynchronous, so keep
  // the latest one in sessionStorage and restore it after an immediate reload/redirect.
  setTimeout(function () {
    try {
      var pending = JSON.parse(sessionStorage.getItem(PENDING_ALERT_KEY) || 'null');
      if (!pending) return;
      if (!pending.__pendingAlertAt || Date.now() - Number(pending.__pendingAlertAt) > 10 * 60 * 1000) {
        sessionStorage.removeItem(PENDING_ALERT_KEY);
        return;
      }
      void enqueueAlert(pending, false);
    } catch (_) {}
  }, 0);
})(window);
