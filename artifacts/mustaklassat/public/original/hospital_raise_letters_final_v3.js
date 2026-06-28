// Hospital Raise Letters bootstrap
(function(){
'use strict';
var ok=/hospital_raise_letters\.html/.test(location.pathname)||window.__HOSPITAL_LETTERS_STANDALONE_PAGE__||/hospitalLettersClean=1/.test(location.href);
if(!ok||window.__HOSPITAL_RAISE_LETTERS_BOOT__)return;
window.__HOSPITAL_RAISE_LETTERS_BOOT__=true;
try{if(/hospital_raise_letters\.html/.test(location.pathname)&&(location.search||location.hash))history.replaceState(null,'','/original/hospital_raise_letters.html')}catch(e){}
import('/original/hospital_raise_letters_engine_v8.js?v=20260628_engine_v8_1').catch(function(){
  var l=document.querySelector('.loading');
  if(l)l.textContent='تعذر تحميل محرك خطابات المستشفى. اعمل تحديث قوي للصفحة.';
});
})();
