(function(){
  'use strict';
  var backup=null,hospital='';

  function isPage(){return /\/admin\/backup(?:$|[?#])/.test(location.pathname+location.search);}
  function token(){try{return(JSON.parse(localStorage.getItem('najran_session')||'{}')||{}).clerkToken||'';}catch(_){return'';}}
  function el(tag,txt){var x=document.createElement(tag); if(txt!=null)x.textContent=txt; return x;}
  function esc(x){return String(x||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function hospitals(b){var s=new Set(),t=(b&&b.tables)||{}; (t.hospitalStorage||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); (t.extracts||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); (t.visitRequests||[]).forEach(function(r){if(r.submittedByHospital)s.add(String(r.submittedByHospital).trim());}); return Array.from(s).filter(Boolean).sort();}
  function counts(b,h){var t=(b&&b.tables)||{}; return {hospitalStorage:(t.hospitalStorage||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length, extracts:(t.extracts||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length, visits:(t.visitRequests||[]).filter(function(r){return String(r.submittedByHospital||'').trim()===h||String(r.siteLocation||'').trim()===h;}).length};}
  function isOldNestedKey(k){return /^_u\d+__u\d+/.test(String(k||''));}
  function cleanBackupFile(b){
    var t=(b&&b.tables)||{};
    var inactive=(t.users||[]).filter(function(u){return String(u.status||'').toLowerCase()==='deleted';});
    var activeUsers=(t.users||[]).filter(function(u){return String(u.status||'').toLowerCase()!=='deleted';});
    var activeIds=new Set(activeUsers.map(function(u){return u.id;}));
    var removedUserStorage=0, removedOldKeys=0;
    var storage=(t.storage||[]).filter(function(r){
      if(!activeIds.has(r.userId)){removedUserStorage++;return false;}
      if(isOldNestedKey(r.storageKey)){removedOldKeys++;return false;}
      return true;
    });
    var out=JSON.parse(JSON.stringify(b));
    out.meta=out.meta||{}; out.tables=out.tables||{};
    out.meta.version=String(out.meta.version||'3.0')+'-client-clean';
    out.meta.cleanedAt=new Date().toISOString();
    out.meta.cleanup={inactiveUsers:inactive.length, removedUserStorage:removedUserStorage, removedOldNestedKeys:removedOldKeys, rawStorageKeys:(t.storage||[]).length, cleanStorageKeys:storage.length};
    out.tables.users=activeUsers;
    out.tables.storage=storage;
    out.meta.counts=out.meta.counts||{};
    out.meta.counts.users=activeUsers.length;
    out.meta.counts.storageKeys=storage.length;
    return out;
  }
  function downloadJson(obj,name){var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
  function injectStyle(){
    if(document.getElementById('naj-backup-helper-style'))return;
    var st=el('style'); st.id='naj-backup-helper-style';
    st.textContent='\
.naj-backup-helper-card{background:#fff;border-radius:16px;box-shadow:0 2px 16px rgba(30,60,114,.08);border:1px solid #e8edf7;padding:24px;margin-bottom:24px;font-family:Tajawal,Arial,sans-serif;direction:rtl}\
.naj-bh-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px}.naj-bh-icon{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#1e3c72,#2a5298);display:flex;align-items:center;justify-content:center;color:#fff;font-size:21px;flex:0 0 auto}.naj-bh-title{margin:0;color:#1e3c72;font-size:20px;font-weight:800;line-height:1.4}.naj-bh-sub{margin:4px 0 0;color:#64748b;font-size:13px;line-height:1.7}\
.naj-bh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.naj-bh-field{display:flex;flex-direction:column;gap:7px}.naj-bh-field label{font-size:12px;color:#334155;font-weight:800}.naj-bh-field input,.naj-bh-field select{border:1px solid #d7deea;background:#f8fafc;border-radius:12px;padding:11px 12px;font-size:13px;color:#0f172a;outline:none;font-family:Tajawal,Arial,sans-serif;width:100%}.naj-bh-field input:focus,.naj-bh-field select:focus{border-color:#2a5298;background:#fff;box-shadow:0 0 0 3px rgba(42,82,152,.10)}\
.naj-bh-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.8;margin-top:14px}.naj-bh-info{display:none;margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;color:#334155;font-size:12px}.naj-bh-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}.naj-bh-stat{background:#fff;border:1px solid #e8edf7;border-radius:12px;padding:10px;text-align:center}.naj-bh-stat b{display:block;color:#1e3c72;font-size:18px;margin-bottom:2px}\
.naj-bh-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}.naj-bh-btn{border:0;border-radius:12px;padding:11px 18px;font-weight:800;font-size:13px;font-family:Tajawal,Arial,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,#1e3c72,#2a5298);min-width:190px}.naj-bh-btn:disabled{background:#9ca3af;cursor:not-allowed;opacity:.85}.naj-bh-msg{font-size:12px;color:#64748b;line-height:1.7}\
@media(max-width:760px){.naj-bh-grid{grid-template-columns:1fr}.naj-bh-stats{grid-template-columns:1fr}.naj-bh-head{flex-direction:column}}';
    document.head.appendChild(st);
  }
  function removeIfNotPage(){if(isPage())return false;document.getElementById('naj-hospital-restore-box')?.remove();document.getElementById('naj-clean-backup-box')?.remove();document.getElementById('naj-backup-helper-style')?.remove();return true;}
  function mountRestore(parent, afterNode){
    if(document.getElementById('naj-hospital-restore-box'))return;
    var box=el('div');box.id='naj-hospital-restore-box';box.className='naj-backup-helper-card';
    box.innerHTML='<div class="naj-bh-head"><div class="naj-bh-icon">🏥</div><div><h2 class="naj-bh-title">استرجاع بيانات مستشفى محدد من نسخة</h2><p class="naj-bh-sub">استخدمه عند وجود مشكلة في مستشفى واحد فقط. لا يغير المستخدمين أو الصلاحيات أو ربط المستشفيات.</p></div></div><div class="naj-bh-grid"><div class="naj-bh-field"><label>ملف النسخة الاحتياطية</label><input id="naj-hr-file" type="file" accept=".json,application/json"></div><div class="naj-bh-field"><label>المستشفى المطلوب استرجاعه</label><select id="naj-hr-select" disabled><option>اختر ملف النسخة أولاً</option></select></div></div><div id="naj-hr-info" class="naj-bh-info"></div><div class="naj-bh-note"><b>حدود الاسترجاع:</b> يتم استرجاع بيانات المستشفى المشتركة والمستخلصات وطلبات الزيارة فقط. لا يتم تعديل المستخدمين أو الصلاحيات أو الوحدات.</div><div class="naj-bh-grid"><div class="naj-bh-field"><label>عبارة التأكيد</label><input id="naj-hr-confirm" type="text" placeholder="اكتب: تأكيد استعادة مستشفى"></div><div class="naj-bh-field"><label>الحالة</label><div id="naj-hr-msg" class="naj-bh-msg" style="padding:11px 0">لم يتم اختيار ملف بعد.</div></div></div><div class="naj-bh-actions"><button id="naj-hr-run" class="naj-bh-btn" disabled>تنفيذ استرجاع المستشفى</button></div>';
    parent.insertBefore(box, afterNode ? afterNode.nextSibling : parent.firstChild);
    var file=box.querySelector('#naj-hr-file'), sel=box.querySelector('#naj-hr-select'), conf=box.querySelector('#naj-hr-confirm'), btn=box.querySelector('#naj-hr-run'), msg=box.querySelector('#naj-hr-msg'), info=box.querySelector('#naj-hr-info');
    function valid(){btn.disabled=!(backup&&hospital&&conf.value.trim()==='تأكيد استعادة مستشفى');}
    function setMsg(t,c){msg.textContent=t;msg.style.color=c||'#64748b';}
    file.onchange=function(){backup=null;hospital='';info.style.display='none';sel.disabled=true;sel.innerHTML='<option>جاري قراءة الملف...</option>';setMsg('جاري قراءة ملف النسخة...');valid();var f=file.files&&file.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{backup=JSON.parse(String(r.result||'{}'));var arr=hospitals(backup);sel.innerHTML='<option value="">— اختر المستشفى —</option>'+arr.map(function(x){return'<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');sel.disabled=!arr.length;setMsg(arr.length?'تم قراءة الملف — اختر المستشفى المطلوب.':'الملف لا يحتوي على مستشفيات.');}catch(e){backup=null;sel.innerHTML='<option>ملف غير صالح</option>';setMsg('فشل قراءة الملف.','#dc2626');}valid();};r.readAsText(f);};
    sel.onchange=function(){hospital=sel.value||'';if(backup&&hospital){var c=counts(backup,hospital);info.style.display='block';info.innerHTML='<div style="font-weight:800;color:#1e3c72;margin-bottom:8px">محتوى النسخة للمستشفى المحدد</div><div class="naj-bh-stats"><div class="naj-bh-stat"><b>'+c.hospitalStorage+'</b><span>مفتاح مستشفى</span></div><div class="naj-bh-stat"><b>'+c.extracts+'</b><span>مستخلص</span></div><div class="naj-bh-stat"><b>'+c.visits+'</b><span>طلب زيارة</span></div></div>';setMsg('اكتب عبارة التأكيد لتفعيل الزر.');}else{info.style.display='none';setMsg('اختر المستشفى المطلوب.');}valid();};
    conf.oninput=valid;
    btn.onclick=async function(){btn.disabled=true;btn.textContent='جاري التنفيذ...';setMsg('جاري تنفيذ الاسترجاع...');try{var t=token();var res=await fetch('/api/admin/backup/restore/hospital',{method:'POST',credentials:'include',headers:Object.assign({'Content-Type':'application/json'},t?{Authorization:'Bearer '+t}:{}),body:JSON.stringify({confirmation:'تأكيد استعادة مستشفى',backup:backup,hospitalName:hospital})});var data=await res.json().catch(function(){return{};});if(!res.ok)throw new Error(data.error||'فشل التنفيذ');setMsg('تم الاسترجاع بنجاح.','#15803d');}catch(e){setMsg(e.message||'فشل التنفيذ','#dc2626');}btn.textContent='تنفيذ استرجاع المستشفى';valid();};
  }
  function mountCleaner(parent, afterNode){
    if(document.getElementById('naj-clean-backup-box'))return;
    var box=el('div');box.id='naj-clean-backup-box';box.className='naj-backup-helper-card';
    box.innerHTML='<div class="naj-bh-head"><div class="naj-bh-icon">🧹</div><div><h2 class="naj-bh-title">تنظيف ملف نسخة احتياطية</h2><p class="naj-bh-sub">يرفع ملف النسخة عندك فقط، ويحذف منه المستخدمين المحذوفين ومفاتيح التخزين القديمة المتكررة، ثم ينزل ملفًا أخف.</p></div></div><div class="naj-bh-grid"><div class="naj-bh-field"><label>ملف النسخة الثقيلة</label><input id="naj-clean-file" type="file" accept=".json,application/json"></div><div class="naj-bh-field"><label>الحالة</label><div id="naj-clean-msg" class="naj-bh-msg" style="padding:11px 0">اختر ملف النسخة الثقيلة.</div></div></div><div id="naj-clean-info" class="naj-bh-info"></div><div class="naj-bh-actions"><button id="naj-clean-run" class="naj-bh-btn" disabled>تحميل نسخة منظفة</button></div>';
    parent.insertBefore(box, afterNode ? afterNode.nextSibling : parent.firstChild);
    var file=box.querySelector('#naj-clean-file'), btn=box.querySelector('#naj-clean-run'), msg=box.querySelector('#naj-clean-msg'), info=box.querySelector('#naj-clean-info');var cleaned=null;
    file.onchange=function(){cleaned=null;btn.disabled=true;info.style.display='none';msg.textContent='جاري قراءة الملف...';var f=file.files&&file.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var original=JSON.parse(String(r.result||'{}'));cleaned=cleanBackupFile(original);var c=cleaned.meta.cleanup;info.style.display='block';info.innerHTML='<div class="naj-bh-stats"><div class="naj-bh-stat"><b>'+c.inactiveUsers+'</b><span>مستخدم محذوف</span></div><div class="naj-bh-stat"><b>'+c.removedUserStorage+'</b><span>مفتاح تابع لهم</span></div><div class="naj-bh-stat"><b>'+c.removedOldNestedKeys+'</b><span>مفتاح قديم مكرر</span></div></div>';msg.textContent='تم التجهيز. اضغط تحميل نسخة منظفة.';btn.disabled=false;}catch(e){msg.style.color='#dc2626';msg.textContent='فشل قراءة الملف.';}};r.readAsText(f);};
    btn.onclick=function(){if(!cleaned)return;var d=new Date().toISOString().slice(0,10);downloadJson(cleaned,'نسخة_احتياطية_شاملة_نجران_منظفة_'+d+'.json');};
  }
  function mount(){
    if(removeIfNotPage())return;
    var headings=Array.from(document.querySelectorAll('h2'));
    var pageReady=headings.some(function(x){return (x.textContent||'').indexOf('النسخ الاحتياطي الشامل')>-1;});
    var restoreHeading=headings.find(function(x){return (x.textContent||'').indexOf('استعادة من نسخة')>-1;});
    var restoreCard=restoreHeading&&restoreHeading.closest('div[style]');
    if(!pageReady || !restoreCard || !restoreCard.parentElement) return;
    var wrong=document.getElementById('naj-hospital-restore-box');
    if(wrong && !restoreCard.parentElement.contains(wrong)){wrong.remove();document.getElementById('naj-clean-backup-box')?.remove();}
    injectStyle();
    mountRestore(restoreCard.parentElement, restoreCard);
    mountCleaner(restoreCard.parentElement, document.getElementById('naj-hospital-restore-box')||restoreCard);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  setInterval(mount,800);
})();
