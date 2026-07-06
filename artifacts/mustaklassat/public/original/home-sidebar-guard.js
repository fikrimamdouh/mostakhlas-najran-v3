(function(){
'use strict';
if(window.__NAJRAN_HOME_SIDEBAR_GUARD__)return;
window.__NAJRAN_HOME_SIDEBAR_GUARD__=true;
var TARGET='/original/hospital_raise_letters.html';
var ON_LETTERS_PAGE=/hospital_raise_letters\.html/.test(location.pathname);
function txt(el){return String((el&&(el.innerText||el.textContent))||'').trim()}
function sig(el){if(!el)return'';return [txt(el),el.getAttribute&&el.getAttribute('href'),el.getAttribute&&el.getAttribute('data-href'),el.getAttribute&&el.getAttribute('onclick'),el.id,el.className].join(' ')}
function isActionable(el){if(!el||el.nodeType!==1)return false;var tag=String(el.tagName||'').toUpperCase();return tag==='A'||tag==='BUTTON'||(el.hasAttribute&&el.hasAttribute('onclick'))||(el.hasAttribute&&el.hasAttribute('data-href'))}
function isLetters(el){if(!isActionable(el))return false;var s=sig(el);return s.indexOf('خطابات')>-1||s.indexOf('خطاب الرفع')>-1||s.indexOf('مركز خطابات')>-1||s.indexOf('hospitalLettersClean')>-1||s.indexOf('hospital_raise_letters')>-1||s.indexOf('بعد شهادة الإنجاز')>-1}
function safeJsonValue(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}}
function captureLettersSnapshot(){
  try{
    var snap={
      createdAt:Date.now(),
      href:location.href,
      hospital:localStorage.getItem('selectedHospital')||localStorage.getItem('hospitalName')||'',
      attendanceData:safeJsonValue('attendanceData'),
      ng_attendanceData:safeJsonValue('ng_attendanceData'),
      nd_attendanceData:safeJsonValue('nd_attendanceData'),
      persistentAttendanceData:safeJsonValue('persistentAttendanceData'),
      persistentExtractData:safeJsonValue('persistentExtractData'),
      najran_revision_snapshot:safeJsonValue('najran_revision_snapshot')
    };
    var rev=snap.najran_revision_snapshot||{};
    var has=!!(snap.attendanceData||snap.ng_attendanceData||snap.nd_attendanceData||snap.persistentAttendanceData||rev.attendanceData||rev.persistentAttendanceData);
    if(has){
      var raw=JSON.stringify(snap);
      localStorage.setItem('hrl_snapshot_v1',raw);
      try{sessionStorage.setItem('hrl_snapshot_v1',raw)}catch(_){}
      console.warn('[HospitalLetters] attendance snapshot captured');
    }else{
      localStorage.removeItem('hrl_snapshot_v1');
      try{sessionStorage.removeItem('hrl_snapshot_v1')}catch(_){}
      console.warn('[HospitalLetters] no attendance snapshot to capture');
    }
  }catch(e){console.warn('[HospitalLetters] snapshot capture failed',e)}
}
function openLetters(e){if(ON_LETTERS_PAGE)return;if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}captureLettersSnapshot();console.warn('[HospitalLetters] open standalone:',TARGET);location.href=TARGET}
function routeLetters(){if(ON_LETTERS_PAGE)return;try{Array.prototype.slice.call(document.querySelectorAll('a,button,[onclick],[data-href]')).forEach(function(el){if(insideReviewPreview(el))return;if(!isLetters(el))return;el.setAttribute('data-hospital-letters-route','standalone');if(el.tagName==='A')el.setAttribute('href',TARGET);if(el.hasAttribute&&el.hasAttribute('data-href'))el.setAttribute('data-href',TARGET)})}catch(e){}}
function isSidebar(el){if(!el||el.nodeType!==1)return false;var id=String(el.id||'').toLowerCase(),cl=String(el.className||'').toLowerCase(),t=txt(el);return id.indexOf('sidebar')>-1||cl.indexOf('sidebar')>-1||cl.indexOf('drawer')>-1||cl.indexOf('mobile-menu')>-1||(String(el.tagName).toLowerCase()==='nav'&&t.indexOf('الرئيسية')>-1&&t.indexOf('الحضور')>-1)}
function cleanSidebars(){var a=Array.prototype.slice.call(document.querySelectorAll('body *')).filter(isSidebar);if(a.length<=1)return;a.slice(1).forEach(function(el){try{el.remove()}catch(e){}});console.warn('[HomeSidebarGuard] duplicate sidebars cleaned:',a.length-1)}
function run(){cleanSidebars();routeLetters()}
function insideReviewPreview(el){try{return !!(el&&el.closest&&el.closest('#rv-body,.rv-doc,[data-admin-offices-review],.rv-modal,#rv-modal,.rv-overlay'))}catch(_){return false}}
document.addEventListener('click',function(e){if(ON_LETTERS_PAGE)return;if(insideReviewPreview(e.target))return;var t=e.target&&e.target.closest?e.target.closest('a,button,[onclick],[data-href]'):null;if(!t)return;if((t.closest&&t.closest('[data-hospital-letters-route="standalone"]'))||isLetters(t))return openLetters(e)},true);
if(window.MutationObserver){new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
setTimeout(run,150);setTimeout(run,600);setTimeout(run,1500);setTimeout(run,3000);setTimeout(run,6000);
console.warn('[HomeSidebarGuard] installed v2 sidebar cleanup + letters route (review preview excluded)');
})();
