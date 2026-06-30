(function(){
  'use strict';
  if(!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname+location.search))return;

  var CLEAN_PARAM='raiseLettersClean';
  var LEGACY_PARAM='raiseLettersOnly';
  var target='/original/admin_offices_attendance.html?'+CLEAN_PARAM+'=1#raise-letters-clean';
  var params=new URLSearchParams(location.search||'');

  if(params.get(LEGACY_PARAM)==='1'&&params.get(CLEAN_PARAM)!=='1'){
    var url=new URL(location.href);
    url.searchParams.delete(LEGACY_PARAM);
    url.searchParams.set(CLEAN_PARAM,'1');
    url.hash='raise-letters-clean';
    location.replace(url.toString());
    return;
  }

  var isClean=params.get(CLEAN_PARAM)==='1';

  function ensureCleanBootShell(){
    if(!isClean)return;
    document.documentElement.classList.add('admin-raise-clean-booting');
    if(!document.getElementById('admin-raise-clean-boot-css')){
      var st=document.createElement('style');
      st.id='admin-raise-clean-boot-css';
      st.textContent='html.admin-raise-clean-booting,html.admin-raise-clean-booting body{background:#eef3f9!important;min-height:100vh!important;overflow:hidden!important}html.admin-raise-clean-booting body>.container,html.admin-raise-clean-booting body>footer,html.admin-raise-clean-booting body>#particles-js-bg{visibility:hidden!important}#admin-raise-clean-boot-shell{position:fixed!important;inset:0!important;z-index:2147483600!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#eef3f9!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important}.admin-raise-clean-boot-card{width:min(430px,86vw);background:#fff;border:1px solid #dbe4f0;border-radius:22px;padding:28px 24px;text-align:center;box-shadow:0 18px 45px rgba(15,23,42,.16)}.admin-raise-clean-boot-title{font-size:18px;font-weight:950;color:#003087;margin-bottom:8px}.admin-raise-clean-boot-sub{font-size:13px;font-weight:850;color:#64748b;line-height:1.8}';
      document.head.appendChild(st);
    }
    if(!document.getElementById('admin-raise-clean-boot-shell')){
      var shell=document.createElement('div');
      shell.id='admin-raise-clean-boot-shell';
      shell.innerHTML='<div class="admin-raise-clean-boot-card"><div class="admin-raise-clean-boot-title">جاري تجهيز خطابات الرفع</div><div class="admin-raise-clean-boot-sub">تحميل شاشة الخطابات والبيانات...</div></div>';
      document.body.appendChild(shell);
    }
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(document.getElementById('admin-raise-clean')||tries>80){
        clearInterval(t);
        var x=document.getElementById('admin-raise-clean-boot-shell');
        if(x)x.remove();
        document.documentElement.classList.remove('admin-raise-clean-booting');
      }
    },100);
  }

  function loadScript(id,src,onload){
    var old=document.getElementById(id);
    if(old){if(onload)setTimeout(onload,30);return old;}
    var s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.onload=function(){if(onload)onload();};
    s.onerror=function(){console.error('[Admin Offices Raise Letters] failed:',id);};
    document.head.appendChild(s);
    return s;
  }

  function loadCleanScreen(){
    if(!isClean)return;
    ensureCleanBootShell();
    loadScript('admin-offices-raise-letters-print-fallbacks-v1','/original/admin_offices_raise_letters_print_fallbacks_v1.js?v=20260630_print_fallbacks_v1');
    loadScript('admin-offices-raise-letters-clean-signatures-v1','/original/admin_offices_raise_letters_clean_signatures_v1.js?v=20260630_clean_signatures_v1');
    loadScript('admin-offices-raise-letters-clean-v1','/original/admin_offices_raise_letters_clean_v1.js?v=20260630_clean_screen_loader_v2',function(){console.info('[Admin Offices Raise Letters] clean screen loaded');});
  }

  function closeOnly(){try{window.close()}catch(_){}}

  function installCloseOnly(){
    if(!isClean||window.__ADMIN_RAISE_CLEAN_CLOSE_ONLY__)return;
    window.__ADMIN_RAISE_CLEAN_CLOSE_ONLY__=true;
    loadCleanScreen();
    document.addEventListener('click',function(e){
      var x=e.target&&e.target.closest&&e.target.closest('#admin-raise-clean [data-action="close"]');
      if(!x)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeOnly();
      return false;
    },true);
  }

  function openClean(){
    if(isClean){loadCleanScreen();return false;}
    window.open(target,'_blank','width=1200,height=900');
    return false;
  }

  function install(){
    installCloseOnly();
    if(isClean){loadCleanScreen();return;}
    var bar=document.getElementById('main-action-buttons')||document.querySelector('.std-action-bar');
    if(!bar)return;
    var btn=document.getElementById('raise-letters-btn');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='raise-letters-btn';
      btn.className='ab ab-update no-print';
      btn.innerHTML='<i class="fas fa-envelope-open-text"></i> خطاب الرفع';
      bar.appendChild(btn);
    }
    btn.onclick=function(e){if(e){e.preventDefault();e.stopPropagation();}return openClean();};
  }

  window.AdminOfficesRaiseLetters=window.AdminOfficesRaiseLetters||{};
  window.AdminOfficesRaiseLetters.openDialog=openClean;
  window.AdminOfficesRaiseLetters.closeDialog=closeOnly;
  window.AdminOfficesRaiseLetters.saveDialog=function(){};
  if(typeof window.AdminOfficesRaiseLetters.tafqeetSAR!=='function'){
    window.AdminOfficesRaiseLetters.tafqeetSAR=function(v){return 'فقط وقدره '+String(v||0)+' ريال سعودي لا غير';};
  }

  if(isClean){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureCleanBootShell);else ensureCleanBootShell();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCloseOnly);else installCloseOnly();
  setTimeout(install,700);setTimeout(install,1800);setTimeout(install,3500);
})();