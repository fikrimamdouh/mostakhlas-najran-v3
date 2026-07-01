// ===================================================================
// Admin Offices Grand Certificate Stamp + Signature Print Fix
// Scope: admin_offices_attendance.html only
// يقيد حجم الختم ويزيل تكرار عناصر التوقيع داخل الشهادة الإجمالية فقط.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_GRAND_CERT_STAMP_FIX__) return;
  window.__ADMIN_OFFICES_GRAND_CERT_STAMP_FIX__ = true;

  const GRAND_KEY = 'admin_offices_grand_certificate';
  const STYLE_ID = 'admin-offices-grand-cert-stamp-fix-style';
  const FIX_STYLE = `
    <style id="${STYLE_ID}">
      .cert .sb-grid,
      .admin-grand-cert-print .sb-grid{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important;
        gap:14px!important;
        align-items:end!important;
        margin-top:22px!important;
      }
      .cert .sb-item,
      .admin-grand-cert-print .sb-item{
        text-align:center!important;
        border:0!important;
        background:transparent!important;
        padding:4px 6px!important;
        min-height:70px!important;
      }
      .cert .sb-item-title,
      .admin-grand-cert-print .sb-item-title{
        font-size:12px!important;
        font-weight:900!important;
        color:#111!important;
        margin-bottom:4px!important;
      }
      .cert .sb-item-line,
      .admin-grand-cert-print .sb-item-line{
        height:30px!important;
        border-bottom:1px solid #111!important;
        margin:0 18px 5px!important;
      }
      .cert .sb-item-name,
      .admin-grand-cert-print .sb-item-name{
        font-size:11px!important;
        color:#111!important;
        min-height:12px!important;
      }
      .cert .sb-item-name:empty,
      .admin-grand-cert-print .sb-item-name:empty{
        display:block!important;
        min-height:12px!important;
      }
      .cert .sb-stamp,
      .admin-grand-cert-print .sb-stamp{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        color:#111!important;
        min-height:70px!important;
        max-height:78px!important;
        overflow:hidden!important;
      }
      .cert .sb-stamp svg,
      .admin-grand-cert-print .sb-stamp svg{
        width:58px!important;
        height:58px!important;
        max-width:58px!important;
        max-height:58px!important;
        display:block!important;
        flex:0 0 auto!important;
      }
      @media print{
        .cert .sb-stamp svg,
        .admin-grand-cert-print .sb-stamp svg{
          width:52px!important;
          height:52px!important;
          max-width:52px!important;
          max-height:52px!important;
        }
      }
    </style>
  `;

  function isGrandKey(pageKey) {
    const key = String(pageKey || '');
    return key === GRAND_KEY || key.includes('grand_certificate');
  }

  function cleanText(v) {
    return String(v || '')
      .replace(/[:：]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeGrandSignatureHtml(html) {
    if (!html) return html;

    const holder = document.createElement('div');
    holder.innerHTML = html;

    holder.querySelectorAll('.sb-grid').forEach(grid => {
      const uniqueSignatureItems = [];
      const seenTitles = new Set();
      let stampItem = null;

      Array.from(grid.children).forEach(item => {
        if (!item.classList || !item.classList.contains('sb-item')) return;

        if (item.classList.contains('sb-stamp')) {
          if (!stampItem) stampItem = item.cloneNode(true);
          return;
        }

        const titleEl = item.querySelector('.sb-item-title');
        const nameEl = item.querySelector('.sb-item-name');
        const title = cleanText(titleEl && titleEl.textContent);
        const name = cleanText(nameEl && nameEl.textContent);

        if (!title) return;
        if (seenTitles.has(title)) return;
        seenTitles.add(title);

        const clone = item.cloneNode(true);
        const cloneTitle = clone.querySelector('.sb-item-title');
        const cloneName = clone.querySelector('.sb-item-name');

        if (cloneTitle) cloneTitle.textContent = title;
        if (cloneName && (!name || name === title)) cloneName.textContent = '';

        uniqueSignatureItems.push(clone);
      });

      grid.innerHTML = '';
      uniqueSignatureItems.forEach(item => grid.appendChild(item));
      if (stampItem) grid.appendChild(stampItem);
    });

    return holder.innerHTML;
  }

  function patchSignatureBlock() {
    if (!window.SignatureBlock || typeof window.SignatureBlock.buildPrintHTML !== 'function') return false;
    if (window.SignatureBlock.buildPrintHTML.__ADMIN_OFFICES_STAMP_FIX__) return true;

    const originalBuildPrintHTML = window.SignatureBlock.buildPrintHTML.bind(window.SignatureBlock);
    window.SignatureBlock.buildPrintHTML = function patchedBuildPrintHTML(pageKey) {
      const html = originalBuildPrintHTML(pageKey) || '';
      if (!html || !isGrandKey(pageKey)) return html;
      const normalized = normalizeGrandSignatureHtml(html);
      if (normalized.includes(STYLE_ID)) return normalized;
      return FIX_STYLE + `<div class="admin-grand-cert-print">${normalized}</div>`;
    };
    window.SignatureBlock.buildPrintHTML.__ADMIN_OFFICES_STAMP_FIX__ = true;
    console.info('[Admin Offices Grand Certificate] stamp size + duplicate signature items constrained v3');
    return true;
  }

  function retryPatch(attempt) {
    if (patchSignatureBlock()) return;
    if (attempt >= 60) return;
    setTimeout(function () { retryPatch(attempt + 1); }, 250);
  }

  retryPatch(0);
  document.addEventListener('DOMContentLoaded', function () { retryPatch(0); });
})();