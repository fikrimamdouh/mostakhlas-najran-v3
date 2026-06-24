(function(){
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function hg1Css(){return '<style id="admin-hg1-exact-print-css">.exact-hg1-print{direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;padding:6mm 8mm;box-sizing:border-box}.exact-hg1-print .hg1-top-lines{text-align:right;font-size:12px;line-height:1.4;margin-bottom:8px}.exact-hg1-print .hg1-contract-box{background:#f8fafc;border:1px solid #d7dce2;padding:8px 10px;margin-bottom:10px;font-size:13px;line-height:1.8;text-align:right}.exact-hg1-print .hg1-title{background:#0b84f3!important;color:#fff!important;text-align:center;font-weight:900;font-size:16px;padding:8px;margin:8px 0;border-radius:7px}.exact-hg1-print .hg1-section-amount{text-align:right;font-size:13px;font-weight:700;margin:8px 0}.exact-hg1-print .hg1-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12.5px}.exact-hg1-print .hg1-table th{background:#0b84f3!important;color:#fff!important;border:1px solid #cfd6df;padding:6px 4px;text-align:center;font-weight:900}.exact-hg1-print .hg1-table td{border:1px solid #cfd6df;padding:5px 4px;text-align:center;vertical-align:middle;line-height:1.45;white-space:normal;word-break:normal;overflow-wrap:anywhere}.exact-hg1-print .hg1-table th:first-child,.exact-hg1-print .hg1-table td:first-child{width:74%}.exact-hg1-print .hg1-table th:nth-child(2),.exact-hg1-print .hg1-table td:nth-child(2),.exact-hg1-print .hg1-table th:nth-child(3),.exact-hg1-print .hg1-table td:nth-child(3){width:13%}.exact-hg1-print .hg1-total-row td{background:#ffe08a!important;font-weight:900}.exact-hg1-print .hg1-summary{margin-top:10px;font-size:13px;line-height:1.65;text-align:right;font-weight:700}.exact-hg1-print .hg1-summary p{margin:3px 0}</style>';}

  function install(){
    if(typeof window.printSelected !== 'function' || window.printSelected.__hg1CssOnlyPatch) return false;
    const old = window.printSelected;
    window.printSelected = function(){
      let printWin = null;
      const realOpen = window.open;
      window.open = function(){ printWin = realOpen.apply(window, arguments); return printWin; };
      const result = old.apply(this, arguments);
      window.open = realOpen;
      if(printWin && printWin.document){
        const previous = printWin.onload;
        printWin.onload = function(){
          try{ if(!printWin.document.getElementById('admin-hg1-exact-print-css')) printWin.document.head.insertAdjacentHTML('beforeend', hg1Css()); }catch(e){ console.error('[Admin Offices HG1 CSS] failed', e); }
          if(typeof previous === 'function') return previous.call(printWin);
          printWin.focus(); printWin.print(); printWin.close();
        };
      }
      return result;
    };
    window.printSelected.__hg1CssOnlyPatch = true;
    return true;
  }

  function boot(n){ install(); if(n < 40 && !window.printSelected?.__hg1CssOnlyPatch) setTimeout(function(){boot(n+1);},250); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){boot(0);}); else boot(0);
  console.info('[Admin Offices Print All] respects choices + HG1 CSS only');
})();
