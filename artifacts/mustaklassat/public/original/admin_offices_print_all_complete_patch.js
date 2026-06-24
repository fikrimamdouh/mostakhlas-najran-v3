(function(){
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function hg1Css(){return '<style id="admin-hg1-exact-print-css">@page hg1{size:A4 portrait;margin:8mm}.portrait-page-perf,.exact-hg1-print{page:hg1}.exact-hg1-print{direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;padding:6mm 8mm;box-sizing:border-box;page-break-after:always}.exact-hg1-print .hg1-top-lines{text-align:right;font-size:12px;line-height:1.4;margin-bottom:8px}.exact-hg1-print .hg1-contract-box{background:#f8fafc;border:1px solid #d7dce2;padding:8px 10px;margin-bottom:10px;font-size:13px;line-height:1.8;text-align:right}.exact-hg1-print .hg1-title{background:#0b84f3!important;color:#fff!important;text-align:center;font-weight:900;font-size:16px;padding:8px;margin:8px 0;border-radius:7px}.exact-hg1-print .hg1-section-amount{text-align:right;font-size:13px;font-weight:700;margin:8px 0}.exact-hg1-print .hg1-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12.5px}.exact-hg1-print .hg1-table th{background:#0b84f3!important;color:#fff!important;border:1px solid #cfd6df;padding:6px 4px;text-align:center;font-weight:900}.exact-hg1-print .hg1-table td{border:1px solid #cfd6df;padding:5px 4px;text-align:center;vertical-align:middle;line-height:1.45;white-space:normal;word-break:normal;overflow-wrap:anywhere}.exact-hg1-print .hg1-table th:first-child,.exact-hg1-print .hg1-table td:first-child{width:74%}.exact-hg1-print .hg1-table th:nth-child(2),.exact-hg1-print .hg1-table td:nth-child(2),.exact-hg1-print .hg1-table th:nth-child(3),.exact-hg1-print .hg1-table td:nth-child(3){width:13%}.exact-hg1-print .hg1-total-row td{background:#ffe08a!important;font-weight:900}.exact-hg1-print .hg1-summary{margin-top:10px;font-size:13px;line-height:1.65;text-align:right;font-weight:700}.exact-hg1-print .hg1-summary p{margin:3px 0}</style>';}

  function selectedKeys(){return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function(cb){return cb.value;}).filter(Boolean);}
  function isChecked(id){return !!document.getElementById(id)?.checked;}
  function setChecked(id,val){const el=document.getElementById(id);if(el)el.checked=val;}
  function performancePages(keys){if(typeof window.buildAdminOfficePerformancePrintHtml!=='function')return '';return keys.map(function(k){return window.buildAdminOfficePerformancePrintHtml(k);}).join('');}
  function openPerformanceOnly(keys){
    if(typeof closeDialog==='function') closeDialog('management-dialog');
    const w=window.open('','_blank','width=1200,height=900');
    if(!w)return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open();
    w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة تقييم الأداء</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+hg1Css()+'</head><body>'+performancePages(keys)+'</body></html>');
    w.document.close();
    w.onload=function(){w.focus();w.print();w.close();};
  }

  function install(){
    if(typeof window.printSelected !== 'function' || window.printSelected.__exactHg1PerformancePatch) return false;
    const old = window.printSelected;
    window.printSelected = function(){
      const keys=selectedKeys();
      const wantAttendance=isChecked('print-opt-attendance');
      const wantPerformance=isChecked('print-opt-performance');
      const wantAchievement=isChecked('print-opt-achievement');
      if(!wantPerformance) return old.apply(this, arguments);
      if(!keys.length)return alert('الرجاء اختيار مكتب/مرفق واحد على الأقل للطباعة.');
      if(!wantAttendance && !wantAchievement){openPerformanceOnly(keys);return;}

      setChecked('print-opt-performance', false);
      let printWin=null;
      const realOpen=window.open;
      window.open=function(){printWin=realOpen.apply(window, arguments);return printWin;};
      const result=old.apply(this, arguments);
      window.open=realOpen;
      setChecked('print-opt-performance', true);

      if(printWin && printWin.document){
        setTimeout(function(){
          try{
            if(!printWin.document.getElementById('admin-hg1-exact-print-css')) printWin.document.head.insertAdjacentHTML('beforeend', hg1Css());
            printWin.document.body.insertAdjacentHTML('beforeend', performancePages(keys));
          }catch(e){console.error('[Admin Offices HG1 Performance] append failed',e);}
        },80);
      }
      return result;
    };
    window.printSelected.__exactHg1PerformancePatch=true;
    return true;
  }
  function boot(n){install();if(n<40&&!window.printSelected?.__exactHg1PerformancePatch)setTimeout(function(){boot(n+1);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){boot(0);});else boot(0);
  console.info('[Admin Offices Print All] respects choices + exact HG1 performance print');
})();
