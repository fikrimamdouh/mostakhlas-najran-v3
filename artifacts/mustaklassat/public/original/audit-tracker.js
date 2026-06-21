/**
 * audit-tracker.js
 * مراقبة تشغيلية حقيقية داخل صفحات النظام الأصلي HTML:
 * - دخول الصفحة
 * - الخروج من الصفحة
 * - الضغط على الأزرار والروابط المهمة
 * - تغييرات localStorage المهمة
 * - تغييرات الحقول المباشرة داخل الأداء والمستهلكات
 * - عمليات API المهمة مثل رفع/تعديل/اعتماد المستخلص
 */
(function () {
  'use strict';

  if (!document.querySelector('script[src="/original/audit-diff-enhancer.js"]')) {
    const diffScript = document.createElement('script');
    diffScript.src = '/original/audit-diff-enhancer.js';
    diffScript.defer = true;
    document.head.appendChild(diffScript);
  }

  const SESSION_KEY = 'najran_session';

  function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } }
  function isAdminRole(role) {
    const r = String(role || '').toLowerCase().trim();
    return r === 'admin' || r === 'super_admin' || r === 'administrator';
  }

  async function getFreshTokenForOriginalPages() {
    try { if (typeof window.najranGetFreshToken === 'function') { const t = await window.najranGetFreshToken(); if (t) return t; } } catch (_) {}
    try { if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') { const t = await window.parent.najranGetFreshToken(); if (t) return t; } } catch (_) {}
    try { if (window.top && window.top !== window && typeof window.top.najranGetFreshToken === 'function') { const t = await window.top.najranGetFreshToken(); if (t) return t; } } catch (_) {}
    const session = getSession();
    return session && session.clerkToken ? session.clerkToken : null;
  }

  function getPageName() { try { const url = new URL(window.location.href); return url.searchParams.get('page') || location.pathname; } catch (_) { return location.pathname; } }
  function shortValue(value) { if (value == null) return null; const s = String(value); return s.length > 1500 ? s.slice(0, 1500) + '... [truncated]' : s; }

  function safeDetails(extra) {
    const session = getSession() || {};
    return Object.assign({
      page: getPageName(),
      url: location.pathname + location.search,
      title: document.title || null,
      hospital: session.hospital || localStorage.getItem('hospitalName') || null,
      company: session.companyName || localStorage.getItem('companyName') || null,
      at: new Date().toISOString()
    }, extra || {});
  }

  async function sendAudit(action, details, beforeValue, afterValue, key, options) {
    const session = getSession();
    if (!session || isAdminRole(session.role)) return;

    const token = await getFreshTokenForOriginalPages();
    if (!token) return;
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include',
        keepalive: !!(options && options.keepalive),
        body: JSON.stringify({
          action,
          details: typeof details === 'string' ? details : JSON.stringify(details || null),
          entityType: options && options.entityType || 'page',
          entityId: key || null,
          before: shortValue(beforeValue),
          after: shortValue(afterValue),
          page: getPageName()
        })
      });
    } catch (_) {}
  }

  function log(action, details, options) { sendAudit(action, safeDetails(details), null, null, null, options); }

  function apiActionName(method, url) {
    if (/\/api\/submitted-extracts\/\d+\/status/.test(url)) return 'تحديث حالة مستخلص';
    if (/\/api\/submitted-extracts\/\d+/.test(url) && method === 'PUT') return 'تعديل وإعادة رفع مستخلص';
    if (/\/api\/submitted-extracts/.test(url) && method === 'POST') return 'رفع مستخلص جديد';
    if (/\/api\/submitted-extracts/.test(url) && method === 'GET') return 'استعراض المستخلصات';
    if (/\/api\/users\/me\/activity/.test(url)) return 'تحديث نشاط مستخدم';
    if (/\/api\/audit/.test(url)) return null;
    return null;
  }

  (function patchFetchAuthAndAudit() {
    if (window.__najranOriginalFetchAuthPatched) return;
    window.__najranOriginalFetchAuthPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      init = init || {};
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
      const needsAuth = /\/api\/(submitted-extracts|users\/me|audit)/.test(url);
      if (needsAuth) {
        const token = await getFreshTokenForOriginalPages();
        if (token) {
          const headers = new Headers(init.headers || (input && input.headers) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
          init = Object.assign({}, init, { headers, credentials: init.credentials || 'include' });
        }
      }
      const action = apiActionName(method, url);
      const started = Date.now();
      let res;
      try { res = await nativeFetch(input, init); }
      catch (err) { if (action) log(action + ' — فشل اتصال', { method, url, error: err && err.message, durationMs: Date.now() - started }, { entityType: 'api' }); throw err; }
      if (action && method !== 'GET') log(action + (res.ok ? ' — نجاح' : ' — فشل'), { method, url, status: res.status, durationMs: Date.now() - started }, { entityType: 'api' });
if (
  res.status === 401 &&
  /\/api\/submitted-extracts\/\d+(?:\/status)?(?:$|[?#])/.test(url) &&
  (method === 'PUT' || method === 'PATCH')
) {
  try {
    localStorage.removeItem('najran_revision_extract_id');
  } catch (_) {}

  console.warn('[NajranAuth] فشل تعديل/اعتماد المستخلص بسبب انتهاء التوكن. تم تنظيف مفتاح التعديل القديم.');
}      return res;
    };
  })();

  const AUDIT_KEYS = new Set([
    'attendanceData','ng_attendanceData','nd_attendanceData','adminOfficesAttendanceData_v1','centersAttendanceData_v2','healthCentersAttendanceData',
    'persistentContractData','persistentExtractData',
    'consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','finalConsumablesCost','penaltyValue','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','subcontractors_data_consumables_v27',
    'spare_partsData','sparePartsTotalAmount',
    'performanceData','performanceTotalDeduction','ng_performanceTotalDeduction','nd_performanceTotalDeduction',
    'achievementData','achievementTitles_v1','achievementItemNames','nd_dentalAchievementTotals',
    'dynamicSignatures','contractorSignature'
  ]);
  function isAuditableKey(key) {
    if (AUDIT_KEYS.has(key)) return true;
    if (/^dept_/.test(key)) return true;
    if (/^performance_/.test(key)) return true;
    if (/^consumables_/.test(key)) return true;
    if (/^water_/.test(key)) return true;
    if (/^sewage_/.test(key)) return true;
    if (/^subcontractors_/.test(key)) return true;
    if (/^achievement_/.test(key)) return true;
    if (/^spare_/.test(key)) return true;
    return false;
  }

  function areaForKey(key) {
    if (key.includes('attendance')) return 'الحضور والانصراف';
    if (key.includes('performance') || /^dept_/.test(key)) return 'تقييم الأداء';
    if (key.includes('achievement')) return 'الإنجاز';
    if (key.includes('consumables') || /^water_/.test(key) || /^sewage_/.test(key) || /^subcontractors_/.test(key) || key === 'finalConsumablesCost' || key === 'penaltyValue') return 'المستهلكات';
    if (key.includes('spare')) return 'قطع الغيار';
    if (key.includes('Contract')) return 'بيانات العقد';
    if (key.includes('Extract')) return 'بيانات المستخلص';
    if (key.includes('Signature') || key.includes('Signatures')) return 'التوقيعات';
    return 'بيانات النظام';
  }

  function actionNameForKey(key) {
    if (key.includes('attendance')) return 'تعديل حضور وانصراف';
    if (key.includes('Contract')) return 'تعديل بيانات عقد';
    if (key.includes('Extract')) return 'تعديل بيانات مستخلص';
    if (key.includes('consumables')) return 'تعديل مستهلكات';
    if (key.includes('spare_parts')) return 'تعديل قطع غيار';
    if (key.includes('performance')) return 'تعديل أداء';
    if (key.includes('achievement')) return 'تعديل إنجاز';
    if (key.includes('Signature') || key.includes('Signatures')) return 'تعديل توقيعات';
    return 'تعديل بيانات';
  }

  const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    const beforeValue = this.getItem(key);
    realSetItem.call(this, key, value);
    if (!isAuditableKey(key)) return;
    if (beforeValue === value) return;
    let diff = null;
    try { if (typeof window.najranBuildAuditDiff === 'function') diff = window.najranBuildAuditDiff(key, beforeValue, value); } catch (_) { diff = null; }
    const area = diff && diff.area ? diff.area : areaForKey(key);
    sendAudit(
      diff ? 'تعديل تفصيلي — ' + area : actionNameForKey(key),
      safeDetails({ details: diff ? 'تغيير تفصيلي في ' + area : `تم تعديل ${key}`, storageKey: key, area: area, changedFieldsCount: diff && diff.changedFieldsCount ? diff.changedFieldsCount : null, changes: diff && diff.changes ? diff.changes : null, readableSummary: diff && diff.readableSummary ? diff.readableSummary : null }),
      beforeValue,
      value,
      key,
      { entityType: diff ? 'field-diff' : 'localStorage' }
    );
  };

  window.najranAuditLog = async function (action, details, extra) { extra = extra || {}; await sendAudit(action, safeDetails({ details, extra }), extra.before || null, extra.after || null, extra.entityId || null, { entityType: extra.entityType || 'manual' }); };

  function cleanText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function pageArea() { const p = (location.pathname + ' ' + document.title).toLowerCase(); if (p.includes('performance')) return 'تقييم الأداء'; if (p.includes('consumables')) return 'المستهلكات'; if (p.includes('spare')) return 'قطع الغيار'; if (p.includes('attendance')) return 'الحضور والانصراف'; return null; }

  function tableContext(input) {
    const container = input.closest('.table-container, section, .section, .card, .tab-pane') || document.body;
    const title = cleanText(container.querySelector('.table-title, h1, h2, h3, .section-title, .card-title')?.textContent) || cleanText(container.getAttribute('data-title')) || document.title || 'غير محدد';
    const table = input.closest('table');
    const row = input.closest('tr');
    const cells = row ? Array.from(row.children) : [];
    const cell = input.closest('td,th');
    const colIndex = cell ? cells.indexOf(cell) : -1;
    let field = 'قيمة';
    if (table && colIndex >= 0) { const th = table.querySelector(`thead tr th:nth-child(${colIndex + 1})`); field = cleanText(th?.textContent) || field; }
    const item = row ? cleanText(row.querySelector('td,th')?.textContent) : cleanText(input.getAttribute('name') || input.id || input.placeholder || 'بند غير محدد');
    return { tableTitle: title, tableId: table && table.id || null, itemName: item || 'بند غير محدد', fieldName: field };
  }

  const inputBefore = new WeakMap();
  document.addEventListener('focusin', function (ev) { const el = ev.target; if (!el || !el.matches || !el.matches('input, textarea, select')) return; inputBefore.set(el, el.value); }, true);
  document.addEventListener('change', function (ev) {
    const el = ev.target;
    if (!el || !el.matches || !el.matches('input, textarea, select')) return;
    const area = pageArea();
    if (!area) return;
    const before = inputBefore.has(el) ? inputBefore.get(el) : (el.defaultValue || '');
    const after = el.value;
    if (String(before) === String(after)) return;
    inputBefore.set(el, after);
    const ctx = tableContext(el);
    const summary = `${area} — ${ctx.tableTitle} — ${ctx.itemName} — ${ctx.fieldName}: من "${before || 'فارغ'}" إلى "${after || 'فارغ'}"`;
    sendAudit('تعديل مباشر — ' + area, safeDetails({ details: summary, area: area, tableTitle: ctx.tableTitle, tableId: ctx.tableId, itemName: ctx.itemName, fieldName: ctx.fieldName, beforeValue: before || 'فارغ', afterValue: after || 'فارغ', readableSummary: [summary], changes: [{ field: ctx.fieldName, path: ctx.tableTitle + ' > ' + ctx.itemName, before: before || 'فارغ', after: after || 'فارغ' }] }), before, after, ctx.tableId || area, { entityType: 'direct-field-change' });
  }, true);

  function meaningfulText(el) { if (!el) return ''; const aria = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title')); const txt = (aria || el.innerText || el.textContent || el.value || '').replace(/\s+/g, ' ').trim(); return txt.slice(0, 140); }
  function isImportantClick(el, text) { if (!el) return false; if (el.id === '_najran_approve_btn_inner') return true; if (/اعتماد|رفع|إرجاع|رفض|تعديل|حفظ|طباعة|PDF|تحميل|خروج|دخول|مراجعة|المستخلص|حذف|إرسال/.test(text)) return true; if (el.matches && el.matches('button,a,[role="button"],input[type="button"],input[type="submit"]')) return true; return false; }

  let lastClickSig = '';
  let lastClickAt = 0;
  let signOutLogged = false;
  document.addEventListener('click', function (ev) {
    const target = ev.target && ev.target.closest ? ev.target.closest('button,a,[role="button"],input[type="button"],input[type="submit"]') : null;
    const text = meaningfulText(target);
    if (!isImportantClick(target, text)) return;
    const sig = location.pathname + '|' + text;
    const now = Date.now();
    if (sig === lastClickSig && now - lastClickAt < 1200) return;
    lastClickSig = sig;
    lastClickAt = now;
    if (text && text.includes('خروج')) {
      if (!signOutLogged) {
        signOutLogged = true;
        log('تسجيل خروج فعلي', { details: 'قام المستخدم بتسجيل الخروج من البرنامج', buttonText: text || 'خروج' }, { entityType: 'auth', keepalive: true });
      }
      return;
    }
    log('ضغط زر أو رابط', { buttonText: text || 'زر بدون نص', elementId: target && target.id || null, href: target && target.href || null }, { entityType: 'click' });
  }, true);

  const enteredAt = Date.now();
  function logEnter() { log('دخول صفحة', { referrer: document.referrer || null }, { entityType: 'navigation' }); }
  function logExit() { const seconds = Math.max(1, Math.round((Date.now() - enteredAt) / 1000)); log('خروج صفحة', { durationSeconds: seconds }, { entityType: 'navigation', keepalive: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', logEnter); else setTimeout(logEnter, 0);
  window.addEventListener('pagehide', logExit);
  console.log('[AuditTracker] تم تفعيل مراقبة حقيقية: دخول/خروج/نقرات/تعديلات مباشرة/API');
})();
