/* review-generic-tables.js - turns non-labor review JSON into professional tables only */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function num(v) {
    var n = Number(String(v == null ? 0 : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function money(n) {
    return Number(n || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
  }

  function first(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]];
    }
    var all = Object.keys(obj);
    for (var j = 0; j < all.length; j++) {
      var nk = String(all[j]).toLowerCase().replace(/[\s_\-]/g, '');
      for (var k = 0; k < keys.length; k++) {
        var kk = String(keys[k]).toLowerCase().replace(/[\s_\-]/g, '');
        if (nk === kk && obj[all[j]] != null && obj[all[j]] !== '') return obj[all[j]];
      }
    }
    return '';
  }

  function collectRows(v, out, depth) {
    out = out || [];
    depth = depth || 0;
    if (depth > 5 || v == null) return out;
    if (typeof v === 'string') {
      try { return collectRows(JSON.parse(v), out, depth + 1); } catch (_) { return out; }
    }
    if (Array.isArray(v)) {
      v.forEach(function (x) { collectRows(x, out, depth + 1); });
      return out;
    }
    if (typeof v === 'object') {
      var keys = Object.keys(v);
      var looksRow = keys.some(function (k) {
        return /item|name|description|part|qty|quantity|unit|price|total|amount|الصنف|البيان|الكمية|السعر|الإجمالي|الاجمالي/i.test(k);
      });
      if (looksRow && !keys.some(function (k) { return Array.isArray(v[k]); })) {
        out.push(v);
        return out;
      }
      keys.forEach(function (k) { collectRows(v[k], out, depth + 1); });
    }
    return out;
  }

  function normalizeRow(r) {
    var name = first(r, ['itemName', 'name', 'description', 'itemDescription', 'item', 'materialName', 'partName', 'partNumber', 'الصنف', 'اسم الصنف', 'البيان']);
    var code = first(r, ['code', 'itemCode', 'partNumber', 'partNo', 'sku', 'كود', 'كود الصنف', 'رقم القطعة']);
    var unit = first(r, ['unit', 'uom', 'الوحدة']);
    var qty = num(first(r, ['quantity', 'qty', 'issuedQty', 'amountQty', 'الكمية', 'العدد']));
    var price = num(first(r, ['unitPrice', 'price', 'rate', 'cost', 'السعر', 'سعر الوحدة']));
    var total = num(first(r, ['total', 'totalAmount', 'amount', 'lineTotal', 'الإجمالي', 'الاجمالي', 'القيمة']));
    if (!total && qty && price) total = qty * price;
    var notes = first(r, ['notes', 'note', 'remarks', 'ملاحظات', 'الملاحظات']);
    return { name: name || '—', code: code || '—', unit: unit || '—', qty: qty, price: price, total: total, notes: notes || '—' };
  }

  function titleFor() {
    var h = document.querySelector('#rv-body .rv-doc-head h2');
    var t = h ? h.textContent.trim() : 'تفاصيل المستخلص';
    if (/مستهلكات/.test(t)) return 'تفاصيل مستخلص المستهلكات';
    if (/قطع/.test(t)) return 'تفاصيل مستخلص قطع الغيار';
    return 'تفاصيل المستخلص';
  }

  function enhancePre(pre) {
    if (!pre || pre.dataset.genericEnhanced === '1') return;
    pre.dataset.genericEnhanced = '1';
    var data;
    try { data = JSON.parse(pre.textContent || ''); } catch (_) { return; }
    var rows = collectRows(data).map(normalizeRow).filter(function (r) {
      return r.name !== '—' || r.code !== '—' || r.qty || r.total;
    });
    if (!rows.length) return;
    var totalQty = rows.reduce(function (a, r) { return a + num(r.qty); }, 0);
    var totalVal = rows.reduce(function (a, r) { return a + num(r.total); }, 0);
    var body = rows.map(function (r, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="nm">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.code) + '</td>' +
        '<td>' + esc(r.unit) + '</td>' +
        '<td>' + esc(r.qty || '') + '</td>' +
        '<td>' + (r.price ? esc(money(r.price)) : '—') + '</td>' +
        '<td><b>' + esc(money(r.total)) + '</b></td>' +
        '<td class="it">' + esc(r.notes) + '</td>' +
      '</tr>';
    }).join('');
    var html = '' +
      '<div class="rv-main-stats rv-generic-stats">' +
        '<div class="rv-stat primary"><span>عدد البنود</span><b>' + rows.length + '</b></div>' +
        '<div class="rv-stat primary"><span>إجمالي الكمية</span><b>' + esc(totalQty) + '</b></div>' +
        '<div class="rv-stat ok"><span>إجمالي القيمة</span><b>' + esc(money(totalVal)) + '</b></div>' +
        '<div class="rv-stat"><span>نوع المراجعة</span><b>تفصيلية</b></div>' +
      '</div>' +
      '<div class="rv-block rv-print-block rv-generic-block">' +
        '<div class="rv-block-title"><h4>' + esc(titleFor()) + '</h4><span>' + rows.length + ' بند</span></div>' +
        '<div class="rv-scroll"><table class="rv-table generic"><thead><tr>' +
          '<th>م</th><th>الصنف / البيان</th><th>الكود / رقم القطعة</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>ملاحظات</th>' +
        '</tr></thead><tbody>' + body +
        '<tr class="total"><td colspan="4">الإجمالي</td><td>' + esc(totalQty) + '</td><td>—</td><td>' + esc(money(totalVal)) + '</td><td></td></tr>' +
        '</tbody></table></div>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.className = 'rv-generic-review';
    wrap.innerHTML = html;
    pre.parentNode.replaceChild(wrap, pre);
  }

  function run() {
    document.querySelectorAll('#rv-body pre.rv-pre').forEach(enhancePre);
  }

  document.addEventListener('DOMContentLoaded', run);
  document.addEventListener('click', function () { setTimeout(run, 80); }, true);
  setInterval(run, 700);
})();