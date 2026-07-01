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
var cleanLoadStarted=false;
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
function loadCleanSignatures(){
  loadScript('admin-offices-raise-letters-clean-signatures-v4','/original/admin_offices_raise_letters_clean_signatures_v1.js?v=20260630_clean_signatures_v4_rebuilt_after_screen');
}
function loadCleanScreen(){
  if(!isClean||cleanLoadStarted)return;
  cleanLoadStarted=true;
  document.documentElement.classList.remove('admin-raise-clean-booting');
  var boot=document.getElementById('admin-raise-clean-boot-shell');
  if(boot)boot.remove();
loadScript('admin-offices-raise-letters-print-fallbacks-v1','/original/admin_offices_raise_letters_print_fallbacks_v1.js?v=20260701_admin_raise_fallback_v4');
  loadScript('admin-offices-raise-letters-clean-v1','/original/admin_offices_raise_letters_clean_v1.js?v=20260630_clean_screen_loader_v2',function(){
    console.info('[Admin Offices Raise Letters] clean screen loaded');
    loadCleanSignatures();
    setTimeout(loadCleanSignatures,300);
    setTimeout(loadCleanSignatures,900);
  });
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCloseOnly);else installCloseOnly();
if(!isClean){setTimeout(install,700);setTimeout(install,1800);setTimeout(install,3500);}
})();
