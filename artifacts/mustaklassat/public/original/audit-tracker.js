/**
 * audit-tracker.js
 * يسجل تعديلات المستخدم داخل صفحات النظام الأصلي HTML
 * يراقب مفاتيح localStorage المهمة فقط، وليس كل شيء.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'najran_session';

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

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

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

  console.log('[AuditTracker] تم تفعيل مراقبة التعديلات التشغيلية');
})();
