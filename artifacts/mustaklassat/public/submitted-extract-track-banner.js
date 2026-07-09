// submitted-extract-track-banner.js
// Shows a clear last submit/update record on /extracts/track.
(function () {
  'use strict';
  if (window.__NAJRAN_SUBMITTED_TRACK_BANNER__) return;
  window.__NAJRAN_SUBMITTED_TRACK_BANNER__ = true;

  var SUMMARY_KEY = 'najran_last_submitted_summary_v1';
  var DISMISS_KEY = 'najran_last_submitted_banner_dismissed_id';

  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function read() { try { return JSON.parse(localStorage.getItem(SUMMARY_KEY) || 'null'); } catch (_) { return null; } }
  function isTrack() { return /^\/extracts\/track\/?$/.test(location.pathname); }
  function actionText(s) { return s && s.action === 'update' ? 'تم تحديث المستخلص' : 'تم رفع المستخلص'; }
  function hintText(s) {
    if (!s) return '';
    if (s.action === 'update') return 'تم تحديث نفس المستخلص، ولم يتم إنشاء مستخلص جديد.';
    if (s.isAdmin) return 'تم رفع مستخلص من حساب الأدمن تحت نطاق المقر الرئيسي. لا يؤثر هذا الرفع على مواقع المستخدمين.';
    return 'لا ترفع نفس المستخلص مرة أخرى بنفس البيانات. غيّر رقم الدفعة أو الشهر قبل إنشاء مستخلص جديد.';
  }
  function createBanner(s) {
    var id = clean(s.id || '');
    if (!id) return null;
    if (localStorage.getItem(DISMISS_KEY) === id) return null;
    var el = document.createElement('div');
    el.id = 'najran-last-submit-track-banner';
    el.dir = 'rtl';
    el.style.cssText = 'margin:14px 0 18px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);border:1px solid #bbf7d0;border-right:6px solid #16a34a;border-radius:16px;padding:14px 16px;box-shadow:0 10px 28px rgba(15,23,42,.08);font-family:Tajawal,Arial,sans-serif;color:#123b6d;';
    el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
      '<div style="min-width:260px;flex:1">' +
        '<div style="font-size:17px;font-weight:950;color:#166534;margin-bottom:6px">' + esc(actionText(s)) + ' رقم ' + esc(id) + ' بنجاح</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px 14px;font-size:13px;line-height:1.7;color:#334155">' +
          '<div><b>الشركة:</b> ' + esc(s.companyName || '—') + '</div>' +
          '<div><b>النطاق:</b> ' + esc(s.hospitalName || '—') + '</div>' +
          '<div><b>الفترة:</b> ' + esc(s.periodMonth || [s.extractMonth, s.extractYear].filter(Boolean).join(' ') || '—') + '</div>' +
          '<div><b>الدفعة:</b> ' + esc(s.paymentNumber || '—') + '</div>' +
          '<div><b>الحالة:</b> ' + esc(s.status || 'submitted') + '</div>' +
        '</div>' +
        '<div style="margin-top:9px;background:#fff;border:1px solid #dbeafe;border-radius:10px;padding:8px 10px;color:#1e40af;font-size:12px;font-weight:800">' + esc(hintText(s)) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<button data-last-submit-refresh style="border:0;background:#1e3c72;color:#fff;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer;font-family:inherit">تحديث القائمة</button>' +
        '<button data-last-submit-dismiss style="border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer;font-family:inherit">إخفاء</button>' +
      '</div>' +
    '</div>';
    el.addEventListener('click', function (e) {
      if (e.target && e.target.closest('[data-last-submit-refresh]')) location.reload();
      if (e.target && e.target.closest('[data-last-submit-dismiss]')) {
        localStorage.setItem(DISMISS_KEY, id);
        el.remove();
      }
    });
    return el;
  }
  function install() {
    if (!isTrack()) return;
    if (document.getElementById('najran-last-submit-track-banner')) return;
    var s = read();
    if (!s || !s.id) return;
    var banner = createBanner(s);
    if (!banner) return;
    var target = document.querySelector('main .space-y-6, main, #root > div, #root') || document.body;
    if (target.firstChild) target.insertBefore(banner, target.firstChild);
    else target.appendChild(banner);
  }
  function boot() {
    install();
    var mo = new MutationObserver(function () { install(); });
    try { mo.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    setTimeout(install, 500);
    setTimeout(install, 1500);
    setTimeout(install, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
