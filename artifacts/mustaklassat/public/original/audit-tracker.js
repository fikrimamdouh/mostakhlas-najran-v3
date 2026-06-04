/**
 * audit-tracker.js
 * يسجل تعديلات المستخدم داخل صفحات النظام الأصلي HTML
 * يراقب مفاتيح localStorage المهمة فقط، وليس كل شيء.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'najran_session';

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  async function getFreshTokenForOriginalPages() {
    try {
      if (typeof window.najranGetFreshToken === 'function') {
        const t = await window.najranGetFreshToken();
        if (t) return t;
      }
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') {
        const t = await window.parent.najranGetFreshToken();
        if (t) return t;
      }
    } catch (_) {}
    try {
      if (window.top && window.top !== window && typeof window.top.najranGetFreshToken === 'function') {
        const t = await window.top.najranGetFreshToken();
        if (t) return t;
      }
    } catch (_) {}
    const session = getSession();
    return session && session.clerkToken ? session.clerkToken : null;
  }

  (function patchFetchAuth() {
    if (window.__najranOriginalFetchAuthPatched) return;
    window.__najranOriginalFetchAuthPatched = true;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
      init = init || {};
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const needsAuth = /\/api\/(submitted-extracts|users\/me|audit)/.test(url);

      if (needsAuth) {
        const token = await getFreshTokenForOriginalPages();
        if (token) {
          const headers = new Headers(init.headers || (input && input.headers) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
          init = Object.assign({}, init, { headers, credentials: init.credentials || 'include' });
        }
      }

      const res = await nativeFetch(input, init);

      if (res.status === 401 && /\/api\/submitted-extracts/.test(url)) {
        try { localStorage.removeItem('najran_revision_extract_id'); } catch (_) {}
        console.warn('[NajranAuth] فشل اعتماد المستخلص بسبب انتهاء التوكن. تم تنظيف مفتاح التعديل القديم.');
      }

      return res;
    };
  })();

  const AUDIT_KEYS = new Set([
    'attendanceData',
    'ng_attendanceData',
    'nd_attendanceData',
    'adminOfficesAttendanceData_v1',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',

    'persistentContractData',
    'persistentExtractData',

    'consumablesTableData',
    'healthCentersConsumables',
    'mainHospitalConsumables',

    'spare_partsData',
    'performanceData',
    'achievementData',
    'dynamicSignatures',
    'contractorSignature'
  ]);

  function getPageName() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('page') || location.pathname;
    } catch (_) {
      return location.pathname;
    }
  }

  function shortValue(value) {
    if (value == null) return null;
    const s = String(value);
    return s.length > 1500 ? s.slice(0, 1500) + '... [truncated]' : s;
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

  async function sendAudit(action, details, beforeValue, afterValue, key) {
    const session = getSession();
    if (!session || !session.clerkToken) return;

    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.clerkToken
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          details,
          entityType: 'localStorage',
          entityId: key,
          before: shortValue(beforeValue),
          after: shortValue(afterValue),
          page: getPageName()
        })
      });
    } catch (_) {}
  }

  const realSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function (key, value) {
    const beforeValue = this.getItem(key);

    realSetItem.call(this, key, value);

    if (!AUDIT_KEYS.has(key)) return;
    if (beforeValue === value) return;

    const action = actionNameForKey(key);
    const page = getPageName();

    sendAudit(
      action,
      `تم تعديل ${key} في صفحة ${page}`,
      beforeValue,
      value,
      key
    );
  };

  window.najranAuditLog = async function (action, details, extra) {
    const session = getSession();
    if (!session || !session.clerkToken) return;

    extra = extra || {};

    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.clerkToken
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          details,
          entityType: extra.entityType || null,
          entityId: extra.entityId || null,
          before: extra.before || null,
          after: extra.after || null,
          page: getPageName()
        })
      });
    } catch (_) {}
  };

  console.log('[AuditTracker] تم تفعيل مراقبة التعديلات التشغيلية + حماية توكن صفحات النظام الأصلي');
})();
