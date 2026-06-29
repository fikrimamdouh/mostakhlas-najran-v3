// Hospital Raise Letters bootstrap
(function(){
'use strict';
var ok=/hospital_raise_letters\.html/.test(location.pathname)||window.__HOSPITAL_LETTERS_STANDALONE_PAGE__||/hospitalLettersClean=1/.test(location.href);
if(!ok||window.__HOSPITAL_RAISE_LETTERS_BOOT__)return;
window.__HOSPITAL_RAISE_LETTERS_BOOT__=true;
try{
  if(/hospital_raise_letters\.html/.test(location.pathname)&&(location.search||location.hash)){
    history.replaceState(null,'','/original/hospital_raise_letters.html');
  }
}catch(e){}
function showFail(){
  var l=document.querySelector('.loading');
  if(l)l.textContent='تعذر تحميل محرك خطابات المستشفى. اعمل تحديث قوي للصفحة.';
}
function loadEngine(){
  if(window.__HL_ENGINE_V8__)return;
  var s=document.createElement('script');
  s.src='/original/hospital_raise_letters_engine_v8.js?v=20260629_official_templates_v12';
  s.async=false;
  s.onload=function(){console.info('[HospitalLetters] engine loaded v8 official templates v12');};
  s.onerror=showFail;
  (document.head||document.documentElement).appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadEngine);else loadEngine();
})();