(function(){
'use strict';
if(window.__NAJRAN_HOME_SIDEBAR_GUARD__)return;
window.__NAJRAN_HOME_SIDEBAR_GUARD__=true;
var TARGET='/original/hospital_raise_letters.html';
function txt(el){return String((el&&(el.innerText||el.textContent))||'').trim()}
function sig(el){if(!el)return'';return [txt(el),el.getAttribute&&el.getAttribute('href'),el.getAttribute&&el.getAttribute('data-href'),el.getAttribute&&el.getAttribute('onclick'),el.id,el.className].join(' ')}
function isLetters(el){var s=sig(el);return s.indexOf('خطابات')>-1||s.indexOf('خطاب الرفع')>-1||s.indexOf('مركز خطابات')>-1||s.indexOf('hospitalLettersClean')>-1||s.indexOf('hospital_raise_letters')>-1||s.indexOf('بعد شهادة الإنجاز')>-1}
function openLetters(e){if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}console.warn('[HospitalLetters] open standalone:',TARGET);location.href=TARGET}
function routeLetters(){try{Array.prototype.slice.call(document.querySelectorAll('a,button,[onclick],[data-href],div,span')).forEach(function(el){if(!isLetters(el))return;el.setAttribute('data-hospital-letters-route','standalone');if(el.tagName==='A')el.setAttribute('href',TARGET);if(el.hasAttribute&&el.hasAttribute('data-href'))el.setAttribute('data-href',TARGET)})}catch(e){}}
function isSidebar(el){if(!el||el.nodeType!==1)return false;var id=String(el.id||'').toLowerCase(),cl=String(el.className||'').toLowerCase(),t=txt(el);return id.indexOf('sidebar')>-1||cl.indexOf('sidebar')>-1||cl.indexOf('drawer')>-1||cl.indexOf('mobile-menu')>-1||(String(el.tagName).toLowerCase()==='nav'&&t.indexOf('الرئيسية')>-1&&t.indexOf('الحضور')>-1)}
function cleanSidebars(){var a=Array.prototype.slice.call(document.querySelectorAll('body *')).filter(isSidebar);if(a.length<=1)return;a.slice(1).forEach(function(el){try{el.remove()}catch(e){}});console.warn('[HomeSidebarGuard] duplicate sidebars cleaned:',a.length-1)}
function run(){cleanSidebars();routeLetters()}
document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('a,button,[onclick],[data-href],div,span'):null;if(!t)return;if((t.closest&&t.closest('[data-hospital-letters-route="standalone"]'))||isLetters(t))return openLetters(e)},true);
if(window.MutationObserver){new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
setTimeout(run,150);setTimeout(run,600);setTimeout(run,1500);setTimeout(run,3000);setTimeout(run,6000);
console.warn('[HomeSidebarGuard] installed compact sidebar cleanup + hospital letters route');
})();