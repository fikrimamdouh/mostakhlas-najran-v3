// ===================================================================
// Admin Offices Consumables Raise Letter
// Scope: admin_offices_consumables.html only
// خطاب رفع المستهلكات من صفحة مستخلص المستهلكات نفسها
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_consumables\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SIG_PREFIX = 'sb_sigs_';
  const RAISE_SIG_KEY = 'admin_offices_raise_letters_signatures';
  const VAT_DEFAULT = 15;

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value || {})); }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[()]/g, '')); return isNaN(n) ? 0 : n; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyPlain(v) { const n = num(v); return Number.isInteger(n) ? String(n) : money(n); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function today() { return new Date().toLocaleDateString('en-CA'); }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getActiveExtractMeta() {
    const e = getExtract();
    const paymentNo = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—';
    const start = e.extractStart || localStorage.getItem('extractStart') || '';
    const end = e.extractEnd || localStorage.getItem('extractEnd') || '';
    return {
      paymentNo: String(paymentNo).match(/^\d+$/) ? String(paymentNo).padStart(2, '0') : String(paymentNo),
      start,
      end
    };
  }
  function extractPhrase() {
    const m = getActiveExtractMeta();
    return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`;
  }
  function getSession() { return readJson('najran_session', {}); }
  function getCompanyName() {
    const c = getContract();
    const s = getSession();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.companyName || s.companyName || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }
  function defaultSettings() {
    const e = getExtract();
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      purchasePeriodLabel: '',
      paymentNo: e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '01',
      vatRate: VAT_DEFAULT,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      period1Start: '',
      period1End: '',
      period2Start: e.extractStart || localStorage.getItem('extractStart') || '',
      period2End: e.extractEnd || localStorage.getItem('extractEnd') || '',
      consumablesPeriod1Net: 0,
      consumablesPeriod2Net: 0
    };
  }
  function getSettings() {
    const settings = Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}));
    const meta = getActiveExtractMeta();
    settings.paymentNo = meta.paymentNo;
    if (/شراء\s*مباشر/.test(String(settings.purchasePeriodLabel || ''))) settings.purchasePeriodLabel = '';
    return settings;
  }
  function saveSettingsPatch(patch) { writeJson(SETTINGS_KEY, Object.assign(getSettings(), patch || {})); }
  function syncFromActiveExtract() {
    const meta = getActiveExtractMeta();
    saveSettingsPatch({ paymentNo: meta.paymentNo, period2Start: meta.start, period2End: meta.end, purchasePeriodLabel: '' });
  }

  function getCurrentConsumablesNet() {
    try {
      if (typeof window.captureUIData === 'function') window.captureUIData();
      if (typeof window.renderAllTables === 'function') window.renderAllTables();
    } catch (_) {}
    const footerCell = document.querySelector('#summary-table tfoot tr:first-child td:last-child');
    if (footerCell) return num(footerCell.textContent);

    const db = 'admin_offices_consumables_v1.0';
    const summary = readJson(`summary_data_${db}`, []);
    const performance = readJson(`performance_data_${db}`, []);
    const extract = getExtract();
    const start = new Date(extract.extractStart || new Date());
    const end = new Date(extract.extractEnd || extract.extractStart || new Date());
    const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30);
    const monthDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30;
    let total = 0;
    summary.filter(i => !i.isCustom && !i.isSubTotal).forEach(item => {
      const pf = performance.find(p => p.id === item.id) || { maxScore: 100, score: 100 };
      const monthly = num(item.value);
      const valueForPeriod = monthly / monthDays * days;
      const max = num(pf.maxScore);
      const score = num(pf.score);
      const deficiency = max > 0 ? (max - score) / max : 0;
      const deduction = valueForPeriod * deficiency;
      const penalty = deduction * 0.10;
      total += valueForPeriod - deduction - penalty;
    });
    const housing = summary.find(i => i.id === 'sm_custom_deduction_1');
    total -= num(housing && housing.value);
    return total;
  }

  function tafqeet(amount) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(amount);
    return `فقط ${money(amount)} ريال لا غير`;
  }
  function logoSrc() { return document.querySelector('.logo-right')?.getAttribute('src') || 'najran_health_cluster_logo.png'; }
  function headerHtml(s) { return `<div class="rl-head"><img src="${esc(logoSrc())}"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="${esc(logoSrc())}"></div>`; }
  function footerHtml(s) { return `<div class="rl-footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`; }
  function signaturesHtml() {
    const sigs = readJson(SIG_PREFIX + RAISE_SIG_KEY, [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }]);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    return `<div class="rl-signatures" style="grid-template-columns:repeat(${Math.min(Math.max(rows.length, 1), 3)},1fr)">${rows.map(s => `<div><div class="sig-title">${esc(s.title)}</div><div class="line"></div><div class="sig-name">${esc(s.name || '')}</div></div>`).join('')}</div>`;
  }
  function css() {
    return `<style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{direction:rtl;margin:0;background:#e9eef5;color:#111827;font-family:Tajawal,Arial,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer;background:#d4af37;color:#111}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.rl-head{display:grid;grid-template-columns:80px 1fr 80px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.rl-head img{width:70px}.rl-head div{text-align:center}.rl-head h1{font-size:17px;margin:0 0 3px;color:#003087}.rl-head h2{font-size:15px;margin:0;color:#111827}.rl-to{font-size:15px;font-weight:900;margin:18px 0 10px}.rl-body{font-size:15px;line-height:2.05;text-align:justify}.rl-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}.rl-table td{border:1px solid #333;padding:8px}.rl-table td:first-child{text-align:right;font-weight:700;width:72%}.rl-table td:last-child{text-align:center;font-weight:900;direction:ltr}.rl-table .grand td{background:#fff7d6;font-weight:900}.rl-tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.rl-signatures{display:grid;gap:20px;margin-top:35px;text-align:center}.rl-signatures .sig-title{font-weight:900}.rl-signatures .sig-name{font-weight:800;margin-top:10px}.rl-signatures .line{height:42px;border-bottom:1px solid #111;margin:8px 30px}.rl-footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:calc(297mm - 24mm);padding:0}.rl-footer{bottom:0}}
    </style>`;
  }

  function generateConsumablesRaiseLetter() {
    syncFromActiveExtract();
    const s = getSettings();
    const net = getCurrentConsumablesNet();
    saveSettingsPatch({ consumablesPeriod2Net: net, purchasePeriodLabel: '' });
    const vat = net * num(s.vatRate) / 100;
    const grand = net + vat;
    const company = getCompanyName();
    const body = `<div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div><section class="page">${headerHtml(s)}<div class="rl-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div><div class="rl-body">السلام عليكم ورحمة الله وبركاته، وبعد:<br>نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند (المستهلكات ومقاولي الباطن) لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div><table class="rl-table"><tbody><tr><td>صافي مستحقات المستهلكات ومقاولي الباطن عن فترة المستخلص</td><td>${moneyPlain(net)}</td></tr><tr><td>ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%</td><td>${money(vat)}</td></tr><tr class="grand"><td>الإجمالي</td><td>${money(grand)}</td></tr></tbody></table><div class="rl-tafqeet">${esc(tafqeet(grand))}</div><div class="rl-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}<br>وتقبلوا تحياتنا ،،،</div>${signaturesHtml()}${footerHtml(s)}</section>`;
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطاب رفع المستهلكات</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${css()}</head><body>${body}</body></html>`);
    win.document.close();
  }

  function installButton() {
    const bar = document.querySelector('.main-action-buttons') || document.querySelector('.std-action-bar') || document.getElementById('main-action-buttons');
    if (!bar || document.getElementById('consumables-raise-letter-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'consumables-raise-letter-btn';
    btn.className = 'btn btn-signature no-print';
    btn.innerHTML = '<i class="fas fa-envelope-open-text"></i> خطاب رفع المستهلكات';
    btn.onclick = generateConsumablesRaiseLetter;
    const printAll = document.getElementById('print-all-btn');
    if (printAll && printAll.nextSibling) bar.insertBefore(btn, printAll.nextSibling);
    else bar.appendChild(btn);
  }

  window.AdminOfficesConsumablesRaiseLetter = { generate: generateConsumablesRaiseLetter, getCurrentConsumablesNet };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButton); else installButton();
  setTimeout(installButton, 700);
  setTimeout(installButton, 1800);
  console.info('[Admin Offices Consumables Raise Letter] installed');
})();