// Hospital Consumables Print Polish V11
// Normal consumables only: print polish, signature copy, direct print-all, one-page summary, full-extract signatures.
(function () {
  'use strict';

  var page = '';
  try {
    page = new URLSearchParams(location.search || '').get('page') || '';
    page = page ? page.split('/').pop() : (location.pathname || '').split('/').pop();
  } catch (_) { page = (location.pathname || '').split('/').pop(); }
  if (page !== 'consumables.html' && !/\/original\/consumables\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (/admin_offices_consumables|health_centers_consumables|najran_general_consumables/.test(page)) return;
  if (window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V11__) return;
  window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V11__ = true;

  var LETTER_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var LETTERHEAD_KEY = 'hospitalConsumablesLetterheadDataUrl_v1';
  var SIG_KEY = 'signatures_data_consumables_v27';
  var STYLE_KEY = 'sb_style_prefs_consumables_v1';
  var PREFS_KEY = 'sb_prefs_consumables';
  var LABELS = {
    subcontractors: 'شهادة عقود الباطن',
    performance: 'جدول أداء المستهلكات',
    water: 'شهادة توريد المياه',
    sewage: 'شهادة التخلص من الصرف الصحي',
    summary: 'شهادة الاستحقاق الشهري (الملخص)'
  };
  var STAMP = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/><circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-size="17" fill="currentColor" font-weight="bold">ختم</text></svg>';

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[c]; }); }
  function json(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function clamp(v, min, max, fb) { v = Number(v); return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fb; }
  function yes(v) { return v === true || v === 'yes' || v === 'true' || v === '1'; }

  function hospital() {
    var c = json('persistentContractData', {});
    return clean(c.hospitalName || c.siteName || c.centerName || localStorage.getItem('hospitalName') || document.querySelector('.hospitalName')?.textContent || '');
  }
  function period() {
    var e = json('persistentExtractData', {});
    var a = clean(e.extractStart || e.periodStart || e.startDate || localStorage.getItem('extractStart') || document.getElementById('extract-start-date')?.textContent || '');
    var b = clean(e.extractEnd || e.periodEnd || e.endDate || localStorage.getItem('extractEnd') || document.getElementById('extract-end-date')?.textContent || '');
    return a || b ? 'عن الفترة من ' + (a || 'غير محدد') + ' إلى ' + (b || 'غير محدد') : '';
  }
  function letterSettings() { return json(LETTER_KEY, {}); }
  function letterhead(s) { return clean((s && s.letterheadDataUrl) || localStorage.getItem(LETTERHEAD_KEY) || ''); }

  function sectionKey(title) {
    title = clean(String(title || '').replace(/<[^>]*>/g, ''));
    if (/عقود\s+الباطن|مقاولي\s+الباطن/.test(title)) return 'subcontractors';
    if (/ح\s*م\s*1|أداء\s+المستهلكات|المستهلكات\s+والمواد\s+الهندسية/.test(title)) return 'performance';
    if (/توريد\s+المياه/.test(title)) return 'water';
    if (/الصرف\s+الصحي|التخلص\s+من\s+مياه\s+الصرف/.test(title)) return 'sewage';
    if (/الاستحقاق\s+الشهري|الملخص\s+الشهري|المستهلكات\s*-\s*مقاولي/.test(title)) return 'summary';
    return '';
  }

  function styleData() {
    var s = json(STYLE_KEY, {});
    return {
      title: clamp(s.titleFontSize, 6, 44, 13), name: clamp(s.nameFontSize, 6, 44, 12),
      tw: clamp(s.titleWeight, 100, 900, 900), nw: clamp(s.nameWeight, 100, 900, 800),
      tg: clamp(s.titleNameGap, -40, 140, 6), lh: clamp(s.nameLineHeight, .8, 3, 1.35),
      ls: clamp(s.letterSpacing, -2, 8, 0), align: /^(right|center|left)$/.test(s.textAlign) ? s.textAlign : 'center',
      top: clamp(s.blockTop, 0, 100, 10), gap: clamp(s.gap, 0, 120, 10),
      row: /^(2|3|4)$/.test(String(s.perRow)) ? String(s.perRow) : 'auto',
      w: clamp(s.cardWidth, 120, 340, 170), h: clamp(s.cardHeight, 48, 180, 68),
      bw: s.textOnly || s.cardBorderVisible === false ? 0 : clamp(s.cardBorderWidth, 0, 3, 1),
      br: s.textOnly ? 0 : clamp(s.cardBorderRadius, 0, 20, 10),
      bc: s.cardBorderColor === 'black' ? '#111827' : (s.cardBorderColor === 'gray' ? '#94a3b8' : (s.cardBorderColor === 'navy' ? '#1e3c72' : '#cbd5e1')),
      bg: s.textOnly || s.cardBackground === 'transparent' ? 'transparent' : (s.cardBackground === 'lightgray' ? '#f8fafc' : '#fff'),
      pad: s.textOnly ? 0 : clamp(s.cardPadding, 0, 30, 7),
      line: s.showLine === true, lineW: clamp(s.lineLength, 20, 320, 110), lineGap: clamp(s.lineNameGap, -30, 80, 4),
      stamp: s.showStamp !== false, stampSize: clamp(s.stampSize, 32, 130, 55),
      each: Array.isArray(s.perSignature) ? s.perSignature : []
    };
  }

  function signatureHtml(key) {
    var prefs = json(PREFS_KEY, {});
    if (prefs.includeSigs === false) return '';
    var all = json(SIG_KEY, {});
    var list = Array.isArray(all[key]) ? all[key] : [];
    list = list.map(function (x) { return { title: clean(x && x.title), name: clean(x && x.name) }; }).filter(function (x) { return x.title || x.name; });
    if (!list.length) return '';
    var s = styleData();
    var cols = s.row === 'auto' ? 'repeat(auto-fit,minmax(' + s.w + 'px,' + s.w + 'px))' : 'repeat(' + s.row + ',minmax(0,' + s.w + 'px))';
    var cards = list.map(function (x, i) {
      var p = s.each[i] || {};
      var align = /^(right|center|left)$/.test(p.textAlign) ? p.textAlign : s.align;
      return '<div class="cf-sig-card" style="width:' + s.w + 'px;min-height:' + s.h + 'px;border:' + s.bw + 'px solid ' + s.bc + ';border-radius:' + s.br + 'px;background:' + s.bg + ';padding:' + s.pad + 'px;transform:translate(' + clamp(p.x,-180,180,0) + 'px,' + clamp(p.y,-160,220,0) + 'px);text-align:' + align + '">' +
        '<div class="sig-title" style="font-size:' + s.title + 'px;font-weight:' + s.tw + ';letter-spacing:' + s.ls + 'px;margin-bottom:' + s.tg + 'px">' + esc(x.title) + '</div>' +
        '<div class="sig-line cf-sig-line" style="display:' + (s.line ? 'block' : 'none') + ';width:' + s.lineW + 'px;margin:0 auto ' + s.lineGap + 'px"></div>' +
        '<div class="sig-name" style="font-size:' + s.name + 'px;font-weight:' + s.nw + ';line-height:' + s.lh + ';letter-spacing:' + s.ls + 'px">' + esc(x.name) + '</div></div>';
    }).join('');
    if (prefs.includeStamp !== false && s.stamp) cards += '<div class="cf-sig-card cf-stamp" style="width:' + s.w + 'px;min-height:' + s.h + 'px"><div style="width:' + s.stampSize + 'px;height:' + s.stampSize + 'px">' + STAMP + '</div></div>';
    return '<div class="cf-signatures cf-signatures-' + key + '" style="margin-top:' + s.top + 'px"><div class="cf-signatures-grid" style="grid-template-columns:' + cols + ';gap:' + s.gap + 'px">' + cards + '</div></div>';
  }

  function appendTableSignatures(html) {
    return String(html || '').replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>([\s\S]*?)<\/div><\/section>/g, function (_, title, sub, body) {
      var key = sectionKey(title);
      return '<section class="page"><div class="extract-page"><h1>' + title + '</h1><h2>' + sub + '</h2>' + body + (key ? signatureHtml(key) : '') + '</div></section>';
    });
  }

  function css() {
    return `<style id="consumables-polish-print-css-v11">
@page cp{size:A4 portrait;margin:0}@page cl{size:A4 landscape;margin:0}
.extract-page{position:relative!important;padding:14mm 12mm 18mm!important;font-family:Tajawal,Arial,sans-serif!important}.print-brand{display:grid!important;grid-template-columns:72px 1fr 72px!important;align-items:center!important;border:2px solid #003087!important;border-radius:14px!important;padding:8px 12px!important;margin:0 0 10mm!important;background:#fff!important}.print-brand img{width:64px!important}.print-brand .brand-center{text-align:center!important}.print-brand h1{margin:0!important;color:#003087!important;font-size:17px!important;font-weight:900!important}.print-brand h2{margin:3px 0 0!important;font-size:13px!important}.print-brand h3{margin:2px 0 0!important;color:#475569!important;font-size:12px!important}.extract-page table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important}.extract-page th{background:#003087!important;color:#fff!important;border:1px solid #1e3a8a!important;padding:5px!important;text-align:center!important}.extract-page td{border:1px solid #64748b!important;padding:5px!important;text-align:center!important}.extract-page tbody tr:nth-child(even) td{background:#f8fafc!important}.extract-page tfoot td,.extract-page .grand td{background:#fff7d6!important;font-weight:900!important}.extract-page thead{display:table-header-group!important}.extract-page tfoot{display:table-footer-group!important}.extract-page tr{break-inside:avoid!important;page-break-inside:avoid!important}.page.landscape-page{width:297mm!important;min-height:210mm!important;page:cl!important}.page.landscape-page .extract-page{padding:9mm!important}.page.landscape-page .print-brand{grid-template-columns:54px 1fr 54px!important;margin-bottom:5mm!important;padding:5px 8px!important}.page.landscape-page .print-brand img{width:48px!important}.page.landscape-page table{font-size:9px!important;table-layout:fixed!important;width:100%!important}.page.landscape-page th,.page.landscape-page td{padding:3px!important;line-height:1.2!important;overflow-wrap:anywhere!important;word-break:break-word!important;white-space:normal!important}.page.summary-one-page .extract-page{padding:6mm 8mm!important}.page.summary-one-page .print-brand{margin-bottom:3mm!important;grid-template-columns:44px 1fr 44px!important}.page.summary-one-page .print-brand img{width:38px!important}.page.summary-one-page .print-brand h1{font-size:13px!important}.page.summary-one-page .print-brand h2,.page.summary-one-page .print-brand h3{font-size:9px!important;margin:1px 0!important}.page.summary-one-page table{font-size:8px!important;table-layout:fixed!important;width:100%!important}.page.summary-one-page th,.page.summary-one-page td{padding:2px 3px!important;line-height:1.08!important;overflow-wrap:anywhere!important;word-break:break-word!important;white-space:normal!important}.cf-signatures{break-inside:avoid!important;page-break-inside:avoid!important}.cf-signatures-grid{display:grid!important;direction:rtl!important;justify-content:center!important;align-items:stretch!important}.cf-sig-card{box-sizing:border-box!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;break-inside:avoid!important}.cf-sig-line{height:0!important;border-bottom:1.3px solid #111!important}.cf-stamp svg{width:100%!important;height:100%!important}.page.summary-one-page .cf-signatures{zoom:.8!important;margin-top:2mm!important}.consumables-letterhead-force{position:absolute!important;inset:0!important;width:210mm!important;height:297mm!important;object-fit:cover!important;z-index:0!important;pointer-events:none!important}.page>.letter-content{position:relative!important;z-index:1!important}.head .t h2{display:none!important}body[data-signature-scope="consumables:fullExtract"] #najran-sig-toggle,body[data-signature-scope="consumables:fullExtract"] #najran-sig-panel{display:none!important}@media print{.page{page:cp}.page.landscape-page{page:cl!important}#najran-sig-toggle,#najran-sig-panel,#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel,[id*="toast"],[class*="toast"]{display:none!important}}</style>`;
  }

  function isLetterHtml(html) { return /خطاب\s+رفع\s+المستهلكات|عدم\s+أسبقية\s+صرف|محضر\s+استهلاك|مشهد\s+مستهلكات|مشهد\s+مياه|شهادة/.test(html) && /letter-content|letterhead-bg|hospital-consumables/i.test(html); }
  function forceLetterhead(html) {
    html = String(html || '');
    if (!isLetterHtml(html)) return html;
    var s = letterSettings(), img = letterhead(s), enabled = yes(s.letterheadEnabled) || !!img;
    if (!/consumables-polish-print-css-v11/.test(html)) html = html.replace('</head>', css() + '</head>');
    html = html.replace(/<h2>\s*وحدة\s+الصيانة\s+العامة\s*<\/h2>/g, '').replace(/<h2>\s*وحدة\s+الصيانه\s+العامه\s*<\/h2>/g, '');
    if (enabled && img) {
      var tag = '<img class="letterhead-bg full consumables-letterhead-force" src="' + esc(img) + '">';
      // تُحقن ترويسة A4 على صفحات الخطابات فقط. صفحات الشهادات موسومة بـ
      // cert-page ولها ترويسة داخلية (print-brand)، فتُستثنى هنا.
      html = html.replace(/<section class="page">\s*<img[^>]+(?:letterhead-bg|consumables-letterhead-force)[^>]*>/g, '<section class="page">').replace(/<section class="page">(?!\s*<div class="extract-page")/g, '<section class="page">' + tag).replace(/letter-content\s+no-letterhead/g, 'letter-content');
    }
    return html;
  }

  function transformFull(html) {
    html = appendTableSignatures(html);
    // ترتيب حرج: وسم صفحات الشهادات (print-brand + landscape) يجب أن يسبق
    // حقن ترويسة A4. forceLetterhead تُدخل <img> بين <section class="page">
    // و<div class="extract-page">، وهذا يكسر مطابقة الـregex أدناه فتفقد
    // الشهادات الترويسة الداخلية والاتجاه العرضي والـpadding الصحيح.
    html = html.replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>/g, function (_, title, subtitle) {
      var key = sectionKey(title), cls = key === 'subcontractors' ? 'page landscape-page' : (key === 'summary' ? 'page landscape-page summary-one-page' : 'page');
      // cert-page: علامة تُميّز صفحات الشهادات عن صفحات الخطابات. الشهادات لها
      // ترويسة داخلية (print-brand) فلا تُحقن عليها ترويسة A4 مرة ثانية.
      cls += ' cert-page';
      return '<section class="' + cls + '"><div class="extract-page"><div class="print-brand"><img src="najran_health_cluster_logo.png" alt="شعار"><div class="brand-center"><h1>' + title + '</h1><h2>' + esc(hospital() || clean(subtitle.replace(/<[^>]*>/g,''))) + '</h2><h3>' + esc(period() || clean(subtitle.replace(/<[^>]*>/g,''))) + '</h3></div><img src="najran_health_cluster_logo.png" alt="شعار"></div>';
    });
    html = forceLetterhead(html);
    if (!/consumables-polish-print-css-v11/.test(html)) html = html.replace('</head>', css() + '</head>');
    return html;
  }

  function installOpenPolish() {
    if (window.__HC_OPEN_POLISH_V11__) return;
    window.__HC_OPEN_POLISH_V11__ = true;
    var open = window.open;
    window.open = function () {
      var w = open.apply(window, arguments);
      try {
        if (w && w.document && !w.__hcPolishV11) {
          w.__hcPolishV11 = true;
          var write = w.document.write.bind(w.document);
          w.document.write = function (html) { return write(forceLetterhead(html)); };
        }
      } catch (_) {}
      return w;
    };
  }

  function installFullPrint() {
    var api = window.HospitalConsumablesRaiseLetter;
    if (!api || api.__polishedV11 || typeof api.printFullExtract !== 'function') return false;
    var original = api.printFullExtract;
    api.printFullExtract = function () {
      var open = window.open;
      window.__sbConsumablesFinalPrint = true;
      window.open = function () {
        var w = open.apply(window, arguments);
        if (w && w.document && !w.__hcFullV11) {
          w.__hcFullV11 = true;
          var write = w.document.write.bind(w.document);
          w.document.write = function (html) { return write(transformFull(html)); };
        }
        return w;
      };
      try { original(); }
      finally { setTimeout(function () { window.open = open; window.__sbConsumablesFinalPrint = false; window.__sbConsumablesTablePrintIntent = null; }, 600); }
    };
    api.__polishedV11 = true;
    return true;
  }

  function installCenterFullButton() {
    var btn = document.querySelector('#hospital-consumables-letters-center [data-hc-action="full"]');
    if (!btn || btn.__hcFullV11) return;
    btn.__hcFullV11 = true;
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.HospitalConsumablesRaiseLetter?.printFullExtract?.();
    }, true);
  }

  function installSubLandscape() {
    var btn = document.querySelector('.btn-print[data-section="subcontractors"]');
    if (!btn || btn.__subV11) return;
    btn.__subV11 = true;
    btn.addEventListener('click', function () { document.body.classList.add('print-subcontractors-landscape'); setTimeout(function () { document.body.classList.remove('print-subcontractors-landscape'); }, 1800); }, true);
  }

  function pageCss() {
    if (document.getElementById('hc-consumables-v11-css')) return;
    var s = document.createElement('style');
    s.id = 'hc-consumables-v11-css';
    s.textContent = `
#sb-overlay #sb-save-btn.hc-save{background:#15803d!important;color:#fff!important;border:2px solid #166534!important;box-shadow:0 7px 18px rgba(21,128,61,.32)!important;font-weight:950!important;padding:10px 26px!important;min-width:150px!important}
#hc-copy-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:10px;margin:0 0 12px}#hc-copy-box strong{display:block;color:#166534;margin-bottom:7px}#hc-copy-row{display:grid;grid-template-columns:1fr auto;gap:8px}#hc-copy-target{padding:8px;border:1px solid #86efac;border-radius:8px;font-family:inherit;font-weight:800}#hc-copy-btn{background:#0369a1;color:#fff;border:0;border-radius:8px;padding:9px 13px;font-family:inherit;font-weight:900;cursor:pointer}#hc-copy-note{min-height:18px;color:#166534;font-size:12px;font-weight:800;margin-top:6px}
@page cs{size:A4 landscape;margin:5mm}@page sl{size:A4 landscape;margin:0}@media print{#najran-revision-mode-badge,#najran-sig-toggle,#najran-sig-panel,#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel,[id*="toast"],[class*="toast"]{display:none!important}#summary-section{page:cs!important;width:287mm!important;min-height:190mm!important;box-sizing:border-box!important;margin:0!important;padding:3mm!important;break-inside:avoid!important;page-break-inside:avoid!important}#summary-section .printable-header{margin:0 0 3mm!important;padding:3px 0!important}#summary-section .print-logo{width:42px!important}#summary-section .printable-header h1{font-size:12pt!important;margin:0!important}#summary-section .printable-header h2,#summary-section .printable-header h3{font-size:8.5pt!important;margin:1px 0!important}#summary-section .data-table,#summary-section .data-table th,#summary-section .data-table td{font-size:7.3pt!important;line-height:1.08!important}#summary-section .data-table th,#summary-section .data-table td{padding:2px 3px!important}#summary-section .signatures-display-section{margin:2mm auto 0!important;break-inside:avoid!important}#summary-section [data-sb-page="consumables"] .sb-wrap{margin-top:0!important;transform:scale(.76)!important;transform-origin:top center!important;width:131.5%!important;margin-right:-15.75%!important}body.print-subcontractors-landscape #subcontractors-section{page:sl!important;width:297mm!important;min-height:210mm!important;padding:9mm!important}body.print-subcontractors-landscape #subcontractors-section table{font-size:9px!important}body.print-subcontractors-landscape #subcontractors-section th,body.print-subcontractors-landscape #subcontractors-section td{padding:3px!important;line-height:1.2!important}}
`;
    document.head.appendChild(s);
  }

  function collectRows() {
    var out = [];
    document.querySelectorAll('#sb-fields .sb-field-row').forEach(function (r) {
      var title = clean(r.querySelector('.sb-f-title')?.value), name = clean(r.querySelector('.sb-f-name')?.value);
      if (title || name) out.push({ title:title, name:name });
    });
    return out;
  }
  function fillRows(rows) {
    var box = document.getElementById('sb-fields'), add = document.getElementById('sb-add-btn');
    if (!box || !add) return;
    box.innerHTML = '';
    (rows.length ? rows : [{title:'',name:''}]).forEach(function (x) {
      add.click();
      var r = box.lastElementChild;
      if (r) { r.querySelector('.sb-f-title').value = x.title || ''; r.querySelector('.sb-f-name').value = x.name || ''; }
    });
  }
  function targetOptions(source, select) {
    var old = select.value;
    var html = Object.keys(LABELS).filter(function (k) { return k !== source; }).map(function (k) { return '<option value="' + k + '">' + esc(LABELS[k]) + '</option>'; }).join('');
    if (select.innerHTML !== html) select.innerHTML = html;
    if (old && old !== source && LABELS[old]) select.value = old;
  }
  function enhanceDialog() {
    var cert = document.getElementById('sb-consumables-cert'), save = document.getElementById('sb-save-btn');
    if (!cert || !save) return;
    save.classList.add('hc-save');
    if (save.textContent !== 'حفظ التغييرات') save.textContent = 'حفظ التغييرات';
    var copy = document.getElementById('hc-copy-box');
    if (!copy) {
      copy = document.createElement('div'); copy.id = 'hc-copy-box';
      copy.innerHTML = '<strong>نسخ تواقيع الشهادة الحالية إلى شهادة أخرى</strong><div id="hc-copy-row"><select id="hc-copy-target"></select><button id="hc-copy-btn" type="button">نسخ التواقيع</button></div><div id="hc-copy-note"></div>';
      cert.insertAdjacentElement('afterend', copy);
    }
    var target = document.getElementById('hc-copy-target'); targetOptions(cert.value, target);
    if (!cert.__hcCopyChange) { cert.__hcCopyChange = true; cert.addEventListener('change', function () { setTimeout(function () { targetOptions(cert.value, target); }, 0); }); }
    var btn = document.getElementById('hc-copy-btn');
    if (!btn.__hcCopy) {
      btn.__hcCopy = true;
      btn.addEventListener('click', function () {
        var rows = collectRows(), to = target.value, note = document.getElementById('hc-copy-note');
        if (!rows.length) { note.textContent = 'لا توجد توقيعات مكتوبة في الشهادة الحالية.'; return; }
        if (!to || to === cert.value) { note.textContent = 'اختر شهادة مختلفة للنسخ.'; return; }
        cert.value = to; cert.dispatchEvent(new Event('change', { bubbles:true })); fillRows(rows);
        note.textContent = 'تم النسخ إلى «' + LABELS[to] + '». راجعها ثم اضغط حفظ التغييرات.';
      });
    }
  }

  function installDialogCopy() {
    if (window.__HC_SIGNATURE_COPY_V11__) return;
    window.__HC_SIGNATURE_COPY_V11__ = true;
    document.addEventListener('click', function (e) {
      if (!e.target?.closest?.('#edit-signatures-btn')) return;
      setTimeout(enhanceDialog, 0); setTimeout(enhanceDialog, 100);
    }, true);
  }

  function installPrintAllBypass() {
    if (window.__HC_PRINT_ALL_BYPASS_V11__) return;
    window.__HC_PRINT_ALL_BYPASS_V11__ = true;
    document.addEventListener('click', function (e) {
      if (!e.target?.closest?.('#print-all-btn')) return;
      window.__sbConsumablesFinalPrint = true;
      document.getElementById('sb-consumables-print-style-panel')?.classList.remove('open');
      setTimeout(function () { window.__sbConsumablesFinalPrint = false; window.__sbConsumablesTablePrintIntent = null; }, 2600);
    }, true);
  }

  function boot() {
    pageCss(); installOpenPolish(); installFullPrint(); installCenterFullButton(); installSubLandscape(); installDialogCopy(); installPrintAllBypass();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  [300,800,1600,3000].forEach(function (ms) { setTimeout(boot, ms); });
  console.info('[Hospital Consumables Print Polish] V11 installed');
})();
