// Hospital Letters Route Guard
// Routes any hospital letters button/link to the standalone page from pages that do not load home-sidebar-guard.
(function(){
'use strict';
if(window.__HOSPITAL_LETTERS_ROUTE_GUARD__)return;
window.__HOSPITAL_LETTERS_ROUTE_GUARD__=true;
var TARGET='/original/hospital_raise_letters.html';
function text(el){return String((el&&(el.innerText||el.textContent))||'').trim()}
function blob(el){if(!el)return'';return [text(el),el.getAttribute&&el.getAttribute('href'),el.getAttribute&&el.getAttribute('data-href'),el.getAttribute&&el.getAttribute('onclick'),el.id,el.className].join(' ')}
function isLetters(el){var s=blob(el);return s.indexOf('خطابات')>-1||s.indexOf('خطاب الرفع')>-1||s.indexOf('مركز خطابات')>-1||s.indexOf('hospitalLettersClean')>-1||s.indexOf('hospital_raise_letters')>-1}
function mark(){try{Array.prototype.slice.call(document.querySelectorAll('a,button,[onclick],[data-href],div,span')).forEach(function(el){if(!isLetters(el))return;el.setAttribute('data-hospital-letters-route','standalone');if(el.tagName==='A')el.setAttribute('href',TARGET);if(el.hasAttribute&&el.hasAttribute('data-href'))el.setAttribute('data-href',TARGET);});}catch(e){}}
document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('a,button,[onclick],[data-href],div,span'):null;if(!t)return;var hit=t.closest&&t.closest('[data-hospital-letters-route="standalone"]');if(!hit&&!isLetters(t))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();console.warn('[HospitalLettersRouteGuard] opening standalone letters page');window.location.href=TARGET;},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mark);else mark();
setTimeout(mark,300);setTimeout(mark,1200);setTimeout(mark,3000);
})();
