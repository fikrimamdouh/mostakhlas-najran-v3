/*
 * audit-diff-enhancer.js
 * يحلل فروق localStorage المهمة إلى حركة مفهومة: الحقل، قبل، بعد.
 * لا يغير الحفظ أو الحسابات.
 */
(function () {
  'use strict';

  if (window.__najranAuditDiffEnhancerLoaded) return;
  window.__najranAuditDiffEnhancerLoaded = true;

  function parseValue(v) {
    if (v == null || v === '') return null;
    try { return JSON.parse(v); } catch (_) { return v; }
  }

  function same(a, b) {
    if (a == null) a = '';
    if (b == null) b = '';
    if (typeof a === 'object') a = JSON.stringify(a);
    if (typeof b === 'object') b = JSON.stringify(b);
    return String(a) === String(b);
  }

  function label(path) {
    var p = String(path || '').toLowerCase();
    if (p.indexOf('name') !== -1) return 'الاسم';
    if (p.indexOf('jobtitle') !== -1) return 'الوظيفة';
    if (p.indexOf('iqama') !== -1) return 'رقم الإقامة';
    if (p.indexOf('attendance') !== -1) return 'الحضور';
    if (p.indexOf('absence') !== -1) return 'الغياب';
    if (p.indexOf('deduction') !== -1) return 'الحسم';
    if (p.indexOf('fine') !== -1 || p.indexOf('penalty') !== -1) return 'الغرامة';
    if (p.indexOf('salary') !== -1) return 'الراتب / الصافي';
    if (p.indexOf('quantity') !== -1 || p.indexOf('qty') !== -1) return 'الكمية';
    if (p.indexOf('price') !== -1) return 'السعر';
    if (p.indexOf('total') !== -1 || p.indexOf('amount') !== -1 || p.indexOf('cost') !== -1) return 'الإجمالي / المبلغ';
    if (p.indexOf('percent') !== -1) return 'النسبة';
    if (p.indexOf('score') !== -1 || p.indexOf('grade') !== -1) return 'التقييم / الدرجة';
    if (p.indexOf('note') !== -1) return 'ملاحظات';
    if (p.indexOf('days') !== -1) return 'أيام الشهر';
    return path || 'حقل';
  }

  function rowName(o) {
    if (!o || typeof o !== 'object') return '';
    return o.name || o.employeeName || o.itemName || o.item || o.title || o.description || o.jobTitle || '';
  }

  function walk(before, after, path, out, depth) {
    if (out.length >= 30 || depth > 5) return;
    if (same(before, after)) return;

    if (Array.isArray(before) || Array.isArray(after)) {
      var b = Array.isArray(before) ? before : [];
      var a = Array.isArray(after) ? after : [];
      var max = Math.max(b.length, a.length);
      for (var i = 0; i < max && out.length < 30; i++) {
        var name = rowName(a[i]) || rowName(b[i]) || ('صف ' + (i + 1));
        walk(b[i], a[i], path ? path + ' > ' + name : name, out, depth + 1);
      }
      return;
    }

    var bo = before && typeof before === 'object';
    var ao = after && typeof after === 'object';
    if (bo || ao) {
      var keys = {};
      Object.keys(before || {}).forEach(function (k) { keys[k] = true; });
      Object.keys(after || {}).forEach(function (k) { keys[k] = true; });
      Object.keys(keys).forEach(function (k) {
        if (out.length < 30) walk(before ? before[k] : undefined, after ? after[k] : undefined, path ? path + ' > ' + k : k, out, depth + 1);
      });
      return;
    }

    out.push({
      field: label(path),
      path: path,
      before: before == null || before === '' ? 'فارغ' : String(before),
      after: after == null || after === '' ? 'فارغ' : String(after)
    });
  }

  function areaForKey(key) {
    if (key.indexOf('attendance') !== -1) return 'الحضور والانصراف';
    if (key.indexOf('performance') !== -1 || key.indexOf('dept_') === 0) return 'تقييم الأداء';
    if (key.indexOf('achievement') !== -1) return 'الإنجاز';
    if (key.indexOf('consumables') !== -1 || key.indexOf('water_') === 0 || key.indexOf('sewage_') === 0 || key.indexOf('subcontractors_') === 0 || key === 'finalConsumablesCost' || key === 'penaltyValue') return 'المستهلكات';
    if (key.indexOf('spare') !== -1) return 'قطع الغيار';
    return 'بيانات النظام';
  }

  window.najranBuildAuditDiff = function (key, beforeRaw, afterRaw) {
    var before = parseValue(beforeRaw);
    var after = parseValue(afterRaw);
    var changes = [];
    walk(before, after, '', changes, 0);
    return {
      area: areaForKey(key),
      storageKey: key,
      changedFieldsCount: changes.length,
      changes: changes,
      readableSummary: changes.slice(0, 10).map(function (c) {
        return c.field + ': من "' + c.before + '" إلى "' + c.after + '"';
      })
    };
  };
})();
