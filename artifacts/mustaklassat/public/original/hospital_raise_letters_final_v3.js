// Hospital Raise Letters bootstrap
(function(){
'use strict';
var ok=/hospital_raise_letters\.html/.test(location.pathname)||window.__HOSPITAL_LETTERS_STANDALONE_PAGE__||/hospitalLettersClean=1/.test(location.href);
if(!ok||window.__HOSPITAL_RAISE_LETTERS_BOOT__)return;
window.__HOSPITAL_RAISE_LETTERS_BOOT__=true;
window.__HOSPITAL_RAISE_LETTERS_ADMIN_MODEL_ACTIVE__=true;
try{
  if(/hospital_raise_letters\.html/.test(location.pathname)&&(location.search||location.hash)){
    history.replaceState(null,'','/original/hospital_raise_letters.html');
  }
}catch(e){}
function showFail(){
  var l=document.querySelector('.loading');
  if(l)l.textContent='تعذر تحميل محرك خطابات المستشفى. اعمل تحديث قوي للصفحة.';
}
function sanitizeSettings(){
  try{
    var key='hospitalRaiseLettersSettings_v8';
    var raw=localStorage.getItem(key);
    if(!raw)return;
    var s=JSON.parse(raw);
    var allowed={index:1,final:1,labor:1,noPrev:1,salary:1,vacancies:1,vacations:1,saudi:1,custom:1};
    if(!allowed[s.selectedDocKey])s.selectedDocKey='final';
    s.letters=s.letters&&typeof s.letters==='object'?s.letters:{};
    s.layout=s.layout&&typeof s.layout==='object'?s.layout:{};
    localStorage.setItem(key,JSON.stringify(s));
  }catch(e){
    try{localStorage.removeItem('hospitalRaiseLettersSettings_v8')}catch(_){}
  }
}
function loadEngine(){
  if(window.__HL_ENGINE_V8__)return;
  sanitizeSettings();
  var s=document.createElement('script');
  s.src='/original/hospital_raise_letters_engine_v8.js?v=20260630_hospital_admin_model_loader_v2';
  s.async=false;
  s.onload=function(){console.info('[HospitalLetters] engine loaded v8 hospital admin model loader v2');};
  s.onerror=showFail;
  (document.head||document.documentElement).appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadEngine);else loadEngine();
})();