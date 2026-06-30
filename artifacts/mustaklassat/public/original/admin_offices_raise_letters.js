(function(){
  'use strict';
  if(!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname+location.search))return;

  var CLEAN_PARAM='raiseLettersClean';
  var target='/original/admin_offices_attendance.html?'+CLEAN_PARAM+'=1#raise-letters-clean';
  var params=new URLSearchParams(location.search||'');
  var isClean=params.get(CLEAN_PARAM)==='1';

  function loadCleanScreen(){
    if(!isClean)return;
    if(document.getElementById('admin-offices-raise-letters-clean-v1'))return;
    var s=document.createElement('script');
    s.id='admin-offices-raise-letters-clean-v1';
    s.src='/original/admin_offices_raise_letters_clean_v1.js?v=20260630_clean_screen_loader_v1';
    s.onload=function(){console.info('[Admin Offices Raise Letters] clean screen loaded');};
    s.onerror=function(){console.error('[Admin Offices Raise Letters] failed to load clean screen');};
    document.head.appendChild(s);
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
  window.AdminOfficesRaiseLetters.tafqeetSAR=function(v){return 'فقط وقدره '+String(v||0)+' ريال سعودي لا غير';};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCloseOnly);else installCloseOnly();
  setTimeout(install,700);setTimeout(install,1800);setTimeout(install,3500);
})();