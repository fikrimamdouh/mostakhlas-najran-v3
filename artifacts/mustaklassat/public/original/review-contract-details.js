/*
 * review-contract-details.js
 * يضيف بيانات العقد والدفعة لرأس نافذة المراجعة التفصيلية.
 * عرض فقط: لا يغير الرفع، الاعتماد، المعادلات، أو الطباعة.
 */
(function () {
  'use strict';

  if (!/\/original\/approval\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  let currentId = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function parseMaybe(v) {
    if (!v) return v;
    if (typeof v === 'object') return v;
    if (typeof v === 'string') {
      const t = v.trim();
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try { return JSON.parse(t); } catch (_) {}
      }
    }
    return v;
  }

  function getExtract(id) {
    try {
      if (Array.isArray(window.allExtracts)) return window.allExtracts.find(e => String(e.id) === String(id)) || null;
    } catch (_) {}
    return null;
  }

  function flatValues(obj, prefix, out) {
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(k => {
      const v = parseMaybe(obj[k]);
      const key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatValues(v, key, out);
      else out.push({ key, low: key.toLowerCase(), value: v });
    });
    return out;
  }

  function firstValue(list, needles) {
    const n = needles.map(x => String(x).toLowerCase());
    for (const item of list) {
      if (item.value == null || item.value === '') continue;
      if (n.some(x => item.low === x || item.low.endsWith('.' + x))) return item.value;
    }
    for (const item of list) {
      if (item.value == null || item.value === '') continue;
      if (n.some(x => item.low.includes(x))) return item.value;
    }
    return '';
  }

  function money(v) {
    const n = Number(String(v || '').replace(/,/g,''));
    return n ? n.toLocaleString('ar-SA', { minimumFractionDigits:2, maximumFractionDigits:2 }) : (v || '—');
  }

  function makeCard(label, value) {
    return '<div class="rcd-card"><span>' + esc(label) + '</span><b>' + esc(value || '—') + '</b></div>';
  }

  function injectStyles() {
    if (document.getElementById('review-contract-details-style')) return;
    const s = document.createElement('style');
    s.id = 'review-contract-details-style';
    s.textContent = `
      .rcd-wrap{padding:14px 18px;background:#fff;border-bottom:1px solid #dbe5ef}
      .rcd-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
      .rcd-title h4{margin:0;color:#123b6d;font-size:14px;font-weight:900}
      .rcd-title small{color:#64748b;font-weight:800}
      .rcd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
      .rcd-card{background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #e2e8f0;border-radius:14px;padding:11px 12px;border-right:4px solid #123b6d}
      .rcd-card span{display:block;color:#64748b;font-size:11px;font-weight:900;margin-bottom:5px}
      .rcd-card b{display:block;color:#172033;font-size:14px;font-weight:900;word-break:break-word}
    `;
    document.head.appendChild(s);
  }

  function injectDetails() {
    if (!currentId) return;
    const modal = document.querySelector('#najran-review-details-overlay .nr-modal');
    const topLine = document.getElementById('nr-topline');
    if (!modal || !topLine) return;

    const old = document.getElementById('review-contract-details-panel');
    if (old) old.remove();

    const e = getExtract(currentId);
    if (!e) return;

    const snapshot = parseMaybe(e.extractData) || {};
    const contract = parseMaybe(snapshot.persistentContractData) || parseMaybe(snapshot.contractData) || parseMaybe(snapshot.contractDetails) || {};
    const extract = parseMaybe(snapshot.persistentExtractData) || {};
    const rows = flatValues({ extractRecord:e, snapshot, contract, extract }, '', []);

    const hospital = e.hospitalName || e.submittedByHospital || snapshot.hospitalName || firstValue(rows, ['hospitalName','hospital','اسم المستشفى','المستشفى']);
    const company = e.companyName || snapshot.companyName || firstValue(rows, ['companyName','company','اسم الشركة','الشركة']);
    const contractNo = e.contractNumber || snapshot.contractNumber || firstValue(rows, ['contractNumber','contractNo','contract_number','رقم العقد','رقم عقد']);
    const paymentNo = firstValue(rows, ['paymentNumber','paymentNo','extractNumber','extractNo','payment','دفعة','رقم الدفعة','رقم المستخلص','مستخلص']);
    const period = e.periodMonth || firstValue(rows, ['periodMonth','month','extractMonth','الشهر','الفترة']);
    const fromDate = snapshot.extractStart || snapshot.extractFromDate || snapshot.consumablesPeriodFrom || firstValue(rows, ['periodFrom','fromDate','startDate','extractStart','من']);
    const toDate = snapshot.extractEnd || snapshot.extractToDate || snapshot.consumablesPeriodTo || firstValue(rows, ['periodTo','toDate','endDate','extractEnd','إلى']);
    const amount = e.totalAmount || snapshot['grand-net-total'] || snapshot.finalLaborCost || snapshot.finalConsumablesCost || firstValue(rows, ['totalAmount','grandTotal','grand-net-total','الإجمالي','القيمة']);
    const status = e.status || firstValue(rows, ['status','الحالة']);

    const panel = document.createElement('div');
    panel.id = 'review-contract-details-panel';
    panel.className = 'rcd-wrap';
    panel.innerHTML = '<div class="rcd-title"><h4>بيانات العقد والدفعة</h4><small>مأخوذة من نسخة الرفع وبيانات المستخلص</small></div>' +
      '<div class="rcd-grid">' +
        makeCard('المستشفى / الموقع', hospital) +
        makeCard('الشركة', company) +
        makeCard('رقم العقد', contractNo) +
        makeCard('رقم الدفعة / المستخلص', paymentNo || e.id) +
        makeCard('الفترة / الشهر', period) +
        makeCard('من تاريخ', fromDate) +
        makeCard('إلى تاريخ', toDate) +
        makeCard('قيمة المستخلص', money(amount)) +
        makeCard('حالة المستخلص', status) +
      '</div>';

    topLine.insertAdjacentElement('afterend', panel);
  }

  function wrapOpen() {
    if (typeof window.openNajranReviewDetails !== 'function' || window.openNajranReviewDetails.__contractDetailsWrapped) return false;
    const old = window.openNajranReviewDetails;
    window.openNajranReviewDetails = function (id) {
      currentId = id;
      const r = old.apply(this, arguments);
      setTimeout(injectDetails, 120);
      setTimeout(injectDetails, 450);
      return r;
    };
    window.openNajranReviewDetails.__contractDetailsWrapped = true;
    return true;
  }

  function init() {
    injectStyles();
    const t = setInterval(() => { if (wrapOpen()) clearInterval(t); }, 300);
    setTimeout(() => clearInterval(t), 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
