// extract_archive_server_hospital_filter.js
// Adds a hospital/site dropdown filter to the uploaded extracts archive tab.
(function () {
  'use strict';
  if (!/extract-archive\.html|original-viewer\?page=extract-archive\.html/.test(location.pathname + location.search)) return;
  if (window.__NAJRAN_SERVER_ARCHIVE_HOSPITAL_FILTER__) return;
  window.__NAJRAN_SERVER_ARCHIVE_HOSPITAL_FILTER__ = true;

  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function lower(v) { return clean(v).toLowerCase(); }
  function typeLabel(t) {
    var map = window.TYPE_AR || {
      labor: 'مستخلص العمالة',
      consumables: 'المستهلكات',
      spare_parts: 'قطع الغيار',
      health_centers: 'المراكز الصحية',
      admin_offices: 'المكاتب الإدارية'
    };
    return map[t] || t || '—';
  }
  function statusBadge(status) {
    if (typeof window.srvStatusBadge === 'function') return window.srvStatusBadge(status);
    var map = {
      submitted: 'بانتظار المراجعة',
      under_review: 'قيد المراجعة',
      approved: 'معتمد ✓',
      needs_revision: 'يحتاج تعديل',
      rejected: 'مرفوض'
    };
    return '<span style="display:inline-flex;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;background:#f8fafc;color:#334155;border:1px solid #cbd5e1">' + esc(map[status] || status || '—') + '</span>';
  }
  function serverData() {
    try { if (Array.isArray(window.serverExtracts)) return window.serverExtracts; } catch (_) {}
    try { if (Array.isArray(serverExtracts)) return serverExtracts; } catch (_) {}
    return [];
  }
  function setServerData(arr) {
    try { window.serverExtracts = arr; } catch (_) {}
    try { serverExtracts = arr; } catch (_) {}
  }
  function hospitalOf(e) {
    return clean(e && (e.hospitalName || e.hospital || e.siteName || e.locationName));
  }
  function ensureSelect() {
    var toolbar = document.querySelector('#section-server .toolbar');
    if (!toolbar) return null;
    var select = document.getElementById('srv-filter-hospital');
    if (select) return select;

    select = document.createElement('select');
    select.id = 'srv-filter-hospital';
    select.title = 'فلترة المستخلصات المرفوعة حسب المستشفى / الموقع';
    select.innerHTML = '<option value="">كل المستشفيات / المواقع</option>';
    select.onchange = function () {
      if (typeof window.renderServer === 'function') window.renderServer();
    };

    var status = document.getElementById('srv-filter-status');
    if (status && status.parentNode === toolbar) toolbar.insertBefore(select, status.nextSibling);
    else toolbar.insertBefore(select, toolbar.querySelector('.spacer') || null);
    return select;
  }
  function populateHospitals() {
    var select = ensureSelect();
    if (!select) return;
    var current = select.value || '';
    var names = [];
    var seen = Object.create(null);
    serverData().forEach(function (e) {
      var h = hospitalOf(e);
      if (!h || seen[h]) return;
      seen[h] = true;
      names.push(h);
    });
    names.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
    select.innerHTML = '<option value="">كل المستشفيات / المواقع' + (names.length ? ' (' + names.length + ')' : '') + '</option>' +
      names.map(function (h) { return '<option value="' + esc(h) + '">' + esc(h) + '</option>'; }).join('');
    if (current && names.indexOf(current) > -1) select.value = current;
  }
  function getInputValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }
  function amountText(v) {
    var n = Number(v || 0);
    return n ? n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س' : '—';
  }
  function dateText(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { return String(v); }
  }
  function renderServerFiltered() {
    populateHospitals();
    var data = serverData().slice();
    var q = lower(getInputValue('srv-search'));
    var typeQ = getInputValue('srv-filter-type');
    var statQ = getInputValue('srv-filter-status');
    var hospQ = getInputValue('srv-filter-hospital');

    if (q) data = data.filter(function (e) {
      return lower(hospitalOf(e)).indexOf(q) > -1 || lower(typeLabel(e.extractType)).indexOf(q) > -1 || lower(e.periodMonth || '').indexOf(q) > -1;
    });
    if (typeQ) data = data.filter(function (e) { return e.extractType === typeQ; });
    if (statQ) data = data.filter(function (e) { return e.status === statQ; });
    if (hospQ) data = data.filter(function (e) { return hospitalOf(e) === hospQ; });

    var container = document.getElementById('server-container');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-cloud"></i><h3>لا توجد مستخلصات مرفوعة</h3><p>' +
        (hospQ ? 'لا توجد مستخلصات لهذا الموقع حسب الفلاتر الحالية: ' + esc(hospQ) : 'ارفع مستخلصاتك من صفحات الحضور أو المستهلكات') +
        '</p></div>';
      return;
    }

    data.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

    var html = data.map(function (e) {
      var dt = dateText(e.createdAt);
      var dtU = dateText(e.updatedAt);
      var border = e.status === 'approved' ? 'border-color:#bbf7d0' : e.status === 'needs_revision' ? 'border-color:#fed7aa' : '';
      var head = e.status === 'approved' ? 'background:linear-gradient(135deg,#15803d,#16a34a)' : '';
      return '<div class="arc-card" style="' + border + '">' +
        '<div class="arc-card-header" style="' + head + '">' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">' +
              '<span class="arc-badge">' + esc(typeLabel(e.extractType)) + '</span>' + statusBadge(e.status) +
            '</div>' +
            '<div class="arc-payment" style="font-size:16px">' + esc(hospitalOf(e) || '—') + '</div>' +
            '<div class="arc-period">' + esc(e.periodMonth || '—') + '</div>' +
          '</div>' +
          '<div style="text-align:left;">' +
            '<div style="color:rgba(255,255,255,.7);font-size:11px">' + esc(e.companyName || '') + '</div>' +
            '<div style="color:rgba(255,255,255,.6);font-size:11px;margin-top:2px">' + esc(e.contractNumber || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="arc-card-body">' +
          '<div class="arc-totals"><div><div class="t-lbl">المبلغ الإجمالي</div><div class="t-val">' + amountText(e.totalAmount) + '</div></div><i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#7dd3fc;opacity:.6"></i></div>' +
          (e.adminNotes ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 12px;font-size:12px;color:#c2410c;margin-bottom:10px"><b>ملاحظة الإدارة:</b> ' + esc(e.adminNotes) + '</div>' : '') +
          '<div class="arc-actions"><a href="/original/approval.html" class="arc-btn arc-btn-print" style="text-decoration:none"><i class="fas fa-eye"></i> عرض التفاصيل</a></div>' +
          '<div class="arc-date"><i class="fas fa-upload"></i> تاريخ الرفع: ' + esc(dt) + (dtU && dtU !== dt ? ' — آخر تحديث: ' + esc(dtU) : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    container.innerHTML = '<div style="margin:0 0 12px;color:#475569;font-size:12px;font-weight:700;">المعروض: ' + data.length + ' من ' + serverData().length + (hospQ ? ' — ' + esc(hospQ) : '') + '</div><div class="archive-grid">' + html + '</div>';
  }
  function install() {
    ensureSelect();
    populateHospitals();

    if (typeof window.renderServer === 'function' && !window.renderServer.__najranHospitalFilterWrapped) {
      window.renderServer = renderServerFiltered;
      window.renderServer.__najranHospitalFilterWrapped = true;
    }

    if (typeof window.loadServerData === 'function' && !window.loadServerData.__najranHospitalFilterWrapped) {
      var originalLoad = window.loadServerData;
      window.loadServerData = async function () {
        var result = await originalLoad.apply(this, arguments);
        populateHospitals();
        renderServerFiltered();
        return result;
      };
      window.loadServerData.__najranHospitalFilterWrapped = true;
    }

    var list = serverData();
    if (list.length) renderServerFiltered();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  setTimeout(install, 300);
  setTimeout(install, 1000);
  setTimeout(install, 2500);

  window.NajranServerArchiveHospitalFilter = {
    install: install,
    render: renderServerFiltered,
    populate: populateHospitals,
    getData: serverData,
    setData: setServerData
  };

  console.info('[ServerArchiveHospitalFilter] installed v1');
})();
