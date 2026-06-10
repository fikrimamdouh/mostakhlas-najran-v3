/* reviewer-hospital-menu-guard.js
 * يضيف مستشفيات المراجعة إلى قائمة اختيار الموقع في السايدبار بوسم "مراجعة فقط".
 * لا يغير hospital الأساسي في قاعدة البيانات.
 */
(function(){
  'use strict';
  if(window.__NAJRAN_REVIEW_HOSPITAL_MENU_GUARD__) return;
  window.__NAJRAN_REVIEW_HOSPITAL_MENU_GUARD__ = true;

  function parseArray(v){
    if(Array.isArray(v)) return v.map(String).map(function(x){return x.trim()}).filter(Boolean);
    if(!v) return [];
    try{ var p = JSON.parse(String(v)); if(Array.isArray(p)) return parseArray(p); }catch(e){}
    return String(v).split(/[،,|\n]/g).map(function(x){return x.trim()}).filter(Boolean);
  }

  function uniq(a){ return Array.from(new Set((a||[]).filter(Boolean))); }

  function getSession(){
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}'); } catch(e){ return {}; }
  }

  function setSession(s){
    try { localStorage.setItem('najran_session', JSON.stringify(s || {})); } catch(e){}
  }

  function getCurrentHospital(){
    var s = getSession();
    return String(s.hospital || localStorage.getItem('hospitalName') || '').trim();
  }

  function getReviewHospitals(){
    var s = getSession();
    return uniq(parseArray(s.reviewHospitals));
  }

  function getEditHospitals(){
    var s = getSession();
    var list = parseArray(s.hospitals);
    if(s.hospital) list.push(String(s.hospital).trim());
    return uniq(list);
  }

  function isReviewHospital(h){
    return getReviewHospitals().indexOf(String(h||'').trim()) > -1;
  }

  function isEditHospital(h){
    return getEditHospitals().indexOf(String(h||'').trim()) > -1;
  }

  function setActiveReviewHospital(h){
    h = String(h || '').trim();
    if(!h) return;
    var s = getSession();
    s.hospital = h;
    s.reviewActiveHospital = h;
    s.canReviewCurrentHospital = isReviewHospital(h);
    s.canEditCurrentHospital = false;
    s.reviewOnly = s.canReviewCurrentHospital && !isEditHospital(h);
    setSession(s);
    try { localStorage.setItem('hospitalName', h); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('najranHospitalChanged', { detail: { hospital: h, reviewOnly: !!s.reviewOnly } })); } catch(e){}
    updateSidebarLabel(h, !!s.reviewOnly);
  }

  function updateSidebarLabel(h, reviewOnly){
    try{
      var current = String(h || getCurrentHospital() || '').trim();
      if(!current) return;
      var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
      var btn = buttons.find(function(b){ return (b.textContent || '').indexOf('🏥') > -1 || (b.textContent || '').indexOf(current) > -1; });
      if(!btn) return;
      var spans = Array.prototype.slice.call(btn.querySelectorAll('span'));
      var textSpan = spans.find(function(sp){ return (sp.textContent || '').trim() && (sp.textContent || '').indexOf('🏥') === -1; });
      if(textSpan) textSpan.textContent = reviewOnly ? (current + ' — مراجعة فقط') : current;
    }catch(e){}
  }

  function findHospitalMenu(){
    var divs = Array.prototype.slice.call(document.querySelectorAll('div'));
    return divs.find(function(d){
      var txt = d.textContent || '';
      return txt.indexOf('اختر الموقع') > -1 && d.querySelectorAll('button').length > 0;
    }) || null;
  }

  function existingMenuHospitals(menu){
    var out = [];
    Array.prototype.slice.call(menu.querySelectorAll('button')).forEach(function(b){
      var t = String(b.textContent || '').replace('✓','').replace('○','').replace('مراجعة فقط','').replace('—','').trim();
      if(t) out.push(t);
    });
    return uniq(out);
  }

  function addReviewHospitalsToMenu(){
    var menu = findHospitalMenu();
    if(!menu) return;
    if(menu.dataset.reviewHospitalsPatched === '1') return;

    var reviews = getReviewHospitals();
    if(!reviews.length) return;

    var existing = existingMenuHospitals(menu);
    var current = getCurrentHospital();
    var toAdd = reviews.filter(function(h){ return existing.indexOf(h) === -1; });
    if(!toAdd.length) return;

    menu.dataset.reviewHospitalsPatched = '1';

    var sep = document.createElement('div');
    sep.textContent = 'مواقع المراجعة فقط';
    sep.style.cssText = 'padding:8px 12px 5px;color:rgba(212,175,55,.85);font-size:10px;font-weight:900;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);';
    menu.appendChild(sep);

    toAdd.forEach(function(h){
      var active = h === current;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'w-full text-right px-3 py-2.5 text-xs transition-all flex items-center gap-2 hover:bg-white/10';
      b.style.cssText = 'color:' + (active ? '#fdba74' : 'rgba(255,255,255,.82)') + ';background:' + (active ? 'rgba(251,146,60,.14)' : 'transparent') + ';font-weight:' + (active ? '800' : '500') + ';border-bottom:1px solid rgba(255,255,255,.05);';
      b.innerHTML = '<span>' + (active ? '✓' : '○') + '</span><span class="flex-1 truncate">' + h + '</span><span style="font-size:9px;font-weight:900;color:#fed7aa;background:rgba(154,52,18,.55);border:1px solid rgba(253,186,116,.45);padding:1px 6px;border-radius:999px;white-space:nowrap">مراجعة فقط</span>';
      b.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        setActiveReviewHospital(h);
        try { menu.style.display = 'none'; } catch(x){}
        setTimeout(function(){ location.reload(); }, 120);
      };
      menu.appendChild(b);
    });
  }

  function tick(){
    addReviewHospitalsToMenu();
    var s = getSession();
    var h = getCurrentHospital();
    if(h && isReviewHospital(h) && !isEditHospital(h)) {
      if(!s.reviewOnly || s.reviewActiveHospital !== h){
        s.reviewOnly = true;
        s.canReviewCurrentHospital = true;
        s.canEditCurrentHospital = false;
        s.reviewActiveHospital = h;
        setSession(s);
      }
      updateSidebarLabel(h, true);
    }
  }

  document.addEventListener('click', function(){ setTimeout(tick, 80); }, true);
  window.addEventListener('najranHospitalChanged', function(){ setTimeout(tick, 80); });
  setInterval(tick, 1200);
  tick();
})();
