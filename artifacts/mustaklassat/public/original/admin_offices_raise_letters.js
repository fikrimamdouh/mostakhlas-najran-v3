(function(){
  'use strict';
  if(!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname+location.search))return;
  var target='/original/admin_offices_attendance.html?raiseLettersClean=1#raise-letters-clean';
  var isClean=new URLSearchParams(location.search||'').get('raiseLettersClean')==='1';
  function openClean(){window.open(target,'_blank','width=1200,height=900');return false;}
  function install(){
    if(isClean)return;
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
  window.AdminOfficesRaiseLetters.closeDialog=function(){try{window.close()}catch(_){}};
  window.AdminOfficesRaiseLetters.saveDialog=function(){};
  window.AdminOfficesRaiseLetters.tafqeetSAR=function(v){return 'فقط وقدره '+String(v||0)+' ريال سعودي لا غير';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setTimeout(install,700);setTimeout(install,1800);setTimeout(install,3500);
})();