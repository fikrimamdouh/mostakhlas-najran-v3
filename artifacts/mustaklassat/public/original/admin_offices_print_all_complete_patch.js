(function(){
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function sharedCss(){return '<style id="admin-print-stability-css">.print-page{page-break-inside:auto!important;break-inside:auto!important;overflow:visible!important}.landscape-page{page-break-inside:auto!important;break-inside:auto!important}.table-responsive-wrapper{overflow:visible!important;width:100%!important;max-width:100%!important}table{page-break-inside:auto!important;break-inside:auto!important;margin-top:0!important}thead{display:table-header-group!important}tfoot{display:table-footer-group!important}tr{page-break-inside:avoid!important;break-inside:avoid!important}.printable-header{margin-bottom:2px!important;padding-bottom:2px!important}.page-contract-info-v2{margin:1px 0 2px!important;padding:2px 4px!important}.extract-details-v2{margin:0!important}.table-summary-v2{margin:0!important}</style>';}
  function hg1Css(){return '<style id="admin-hg1-exact-print-css">@page hg1{size:A4 portrait;margin:8mm}.portrait-page-perf,.exact-hg1-print{page:hg1}.exact-hg1-print{direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;padding:6mm 8mm;box-sizing:border-box;page-break-after:always}.exact-hg1-print .hg1-top-lines{text-align:right;font-size:12px;line-height:1.4;margin-bottom:8px}.exact-hg1-print .hg1-contract-box{background:#f8fafc;border:1px solid #d7dce2;padding:8px 10px;margin-bottom:10px;font-size:13px;line-height:1.8;text-align:right}.exact-hg1-print .hg1-title{background:#0b84f3!important;color:#fff!important;text-align:center;font-weight:900;font-size:16px;padding:8px;margin:8px 0;border-radius:7px}.exact-hg1-print .hg1-section-amount{text-align:right;font-size:13px;font-weight:700;margin:8px 0}.exact-hg1-print .hg1-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12.5px}.exact-hg1-print .hg1-table th{background:#0b84f3!important;color:#fff!important;border:1px solid #cfd6df;padding:6px 4px;text-align:center;font-weight:900}.exact-hg1-print .hg1-table td{border:1px solid #cfd6df;padding:5px 4px;text-align:center;vertical-align:middle;line-height:1.45;white-space:normal;word-break:normal;overflow-wrap:anywhere}.exact-hg1-print .hg1-table th:first-child,.exact-hg1-print .hg1-table td:first-child{width:74%}.exact-hg1-print .hg1-table th:nth-child(2),.exact-hg1-print .hg1-table td:nth-child(2),.exact-hg1-print .hg1-table th:nth-child(3),.exact-hg1-print .hg1-table td:nth-child(3){width:13%}.exact-hg1-print .hg1-total-row td{background:#ffe08a!important;font-weight:900}.exact-hg1-print .hg1-summary{margin-top:10px;font-size:13px;line-height:1.65;text-align:right;font-weight:700}.exact-hg1-print .hg1-summary p{margin:3px 0}</style>';}
  function injectCss(w){try{if(!w||!w.document||!w.document.head)return;if(!w.document.getElementById('admin-print-stability-css'))w.document.head.insertAdjacentHTML('beforeend',sharedCss());if(!w.document.getElementById('admin-hg1-exact-print-css'))w.document.head.insertAdjacentHTML('beforeend',hg1Css());}catch(e){console.error('[Admin Offices Print CSS] failed',e);}}

  function selectedKeys(){return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function(cb){return cb.value;}).filter(Boolean);}
  function isChecked(id){return !!document.getElementById(id)?.checked;}
  function setChecked(id,val){const el=document.getElementById(id);if(el)el.checked=val;}
  function performancePages(keys){if(typeof window.buildAdminOfficePerformancePrintHtml!=='function')return '';return keys.map(function(k){return window.buildAdminOfficePerformancePrintHtml(k);}).join('');}
  function detectCenterKey(){
    const visible=Array.from(document.querySelectorAll('[id^="table-div-"]')).find(function(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});
    if(visible&&visible.id)return visible.id.replace('table-div-','');
    const title=(document.getElementById('center-main-title')?.textContent||'').trim();
    try{const names=typeof getCenterNames==='function'?getCenterNames():JSON.parse(localStorage.getItem('adminOfficeNames_v1')||'{}');const hit=Object.entries(names).find(function(x){return title.includes(x[1]);});if(hit)return hit[0];}catch(_){ }
    return null;
  }
  function openPerformanceOnly(keys){
    if(typeof closeDialog==='function') closeDialog('management-dialog');
    const w=window.open('','_blank','width=1200,height=900');
    if(!w)return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open();
    w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة تقييم الأداء</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+sharedCss()+hg1Css()+'</head><body>'+performancePages(keys)+'</body></html>');
    w.document.close();
    w.onload=function(){w.focus();w.print();w.close();};
  }
  function callOldWithWindowCapture(old,args,after){
    let printWin=null;
    const realOpen=window.open;
    window.open=function(){printWin=realOpen.apply(window,arguments);return printWin;};
    const result=old.apply(this,args);
    window.open=realOpen;
    if(printWin){setTimeout(function(){injectCss(printWin);if(typeof after==='function')after(printWin);},80);}
    return result;
  }
  function routeAttendanceOnly(centerKey){
    if(typeof window.openPrintDialog!=='function'||typeof window.printSelected!=='function')return false;
    window.openPrintDialog();
    setTimeout(function(){
      document.querySelectorAll('#print-centers-checkboxes input').forEach(function(cb){cb.checked=(cb.value===centerKey);});
      setChecked('print-opt-attendance',true);
      setChecked('print-opt-performance',false);
      setChecked('print-opt-achievement',false);
      window.printSelected();
    },160);
    return true;
  }

  function installPrintSelected(){
    if(typeof window.printSelected !== 'function' || window.printSelected.__exactHg1PerformancePatch) return false;
    const old = window.printSelected;
    window.printSelected = function(){
      const keys=selectedKeys();
      const wantAttendance=isChecked('print-opt-attendance');
      const wantPerformance=isChecked('print-opt-performance');
      const wantAchievement=isChecked('print-opt-achievement');
      if(!wantPerformance) return callOldWithWindowCapture.call(this,old,arguments,null);
      if(!keys.length)return alert('الرجاء اختيار مكتب/مرفق واحد على الأقل للطباعة.');
      if(!wantAttendance && !wantAchievement){openPerformanceOnly(keys);return;}
      setChecked('print-opt-performance', false);
      const result=callOldWithWindowCapture.call(this,old,arguments,function(w){try{w.document.body.insertAdjacentHTML('beforeend',performancePages(keys));}catch(e){console.error('[Admin Offices HG1 Performance] append failed',e);}});
      setChecked('print-opt-performance', true);
      return result;
    };
    window.printSelected.__exactHg1PerformancePatch=true;
    return true;
  }
  function installPreparePrint(){
    if(typeof window.preparePrint!=='function'||window.preparePrint.__routesToGroupedAttendance)return false;
    const fallback=window.preparePrint;
    window.preparePrint=function(){
      const key=detectCenterKey();
      if(key&&routeAttendanceOnly(key))return;
      return fallback.apply(this,arguments);
    };
    window.preparePrint.__routesToGroupedAttendance=true;
    return true;
  }
  function boot(n){installPrintSelected();installPreparePrint();if(n<40&&(!window.printSelected?.__exactHg1PerformancePatch||!window.preparePrint?.__routesToGroupedAttendance))setTimeout(function(){boot(n+1);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){boot(0);});else boot(0);
  console.info('[Admin Offices Print All] choices respected + exact HG1 + attendance routed');
})();
