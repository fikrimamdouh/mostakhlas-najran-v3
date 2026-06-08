(function(){
  'use strict';
  if(!/\/admin\/backup(?:$|[?#])/.test(location.pathname+location.search)) return;

  var backup=null,hospital='';

  function tok(){try{return(JSON.parse(localStorage.getItem('najran_session')||'{}')||{}).clerkToken||'';}catch(_){return'';}}
  function el(tag,txt){var x=document.createElement(tag); if(txt!=null)x.textContent=txt; return x;}
  function esc(x){return String(x||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function hs(b){var s=new Set(),t=(b&&b.tables)||{}; (t.hospitalStorage||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); (t.extracts||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); (t.visitRequests||[]).forEach(function(r){if(r.submittedByHospital)s.add(String(r.submittedByHospital).trim());}); return Array.from(s).filter(Boolean).sort();}
  function cnt(b,h){var t=(b&&b.tables)||{}; return {
    hospitalStorage:(t.hospitalStorage||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length,
    extracts:(t.extracts||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length,
    visits:(t.visitRequests||[]).filter(function(r){return String(r.submittedByHospital||'').trim()===h||String(r.siteLocation||'').trim()===h;}).length
  };}

  function injectStyle(){
    if(document.getElementById('naj-hospital-restore-style'))return;
    var st=el('style'); st.id='naj-hospital-restore-style';
    st.textContent='\
#naj-hospital-restore-box{background:#fff;border-radius:16px;box-shadow:0 2px 16px rgba(30,60,114,.08);border:1px solid #e8edf7;padding:24px;margin-bottom:24px;font-family:Tajawal,Arial,sans-serif;direction:rtl}\
.naj-hr-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px}\
.naj-hr-icon{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#1e3c72,#2a5298);display:flex;align-items:center;justify-content:center;color:#fff;font-size:21px;flex:0 0 auto}\
.naj-hr-title{margin:0;color:#1e3c72;font-size:20px;font-weight:800;line-height:1.4}\
.naj-hr-sub{margin:4px 0 0;color:#64748b;font-size:13px;line-height:1.7}\
.naj-hr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}\
.naj-hr-field{display:flex;flex-direction:column;gap:7px}\
.naj-hr-field label{font-size:12px;color:#334155;font-weight:800}\
.naj-hr-field input,.naj-hr-field select{border:1px solid #d7deea;background:#f8fafc;border-radius:12px;padding:11px 12px;font-size:13px;color:#0f172a;outline:none;font-family:Tajawal,Arial,sans-serif;width:100%}\
.naj-hr-field input:focus,.naj-hr-field select:focus{border-color:#2a5298;background:#fff;box-shadow:0 0 0 3px rgba(42,82,152,.10)}\
.naj-hr-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.8;margin-top:14px}\
.naj-hr-info{display:none;margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;color:#334155;font-size:12px}\
.naj-hr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}\
.naj-hr-stat{background:#fff;border:1px solid #e8edf7;border-radius:12px;padding:10px;text-align:center}\
.naj-hr-stat b{display:block;color:#1e3c72;font-size:18px;margin-bottom:2px}\
.naj-hr-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}\
.naj-hr-btn{border:0;border-radius:12px;padding:11px 18px;font-weight:800;font-size:13px;font-family:Tajawal,Arial,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,#1e3c72,#2a5298);min-width:190px}\
.naj-hr-btn:disabled{background:#9ca3af;cursor:not-allowed;opacity:.85}\
.naj-hr-msg{font-size:12px;color:#64748b;line-height:1.7}\
@media(max-width:760px){.naj-hr-grid{grid-template-columns:1fr}.naj-hr-stats{grid-template-columns:1fr}.naj-hr-head{flex-direction:column}}';
    document.head.appendChild(st);
  }

  function mount(){
    if(document.getElementById('naj-hospital-restore-box'))return;
    injectStyle();
    var root=document.querySelector('main')||document.body;
    var box=el('div'); box.id='naj-hospital-restore-box';
    box.innerHTML='\
      <div class="naj-hr-head">\
        <div class="naj-hr-icon">🏥</div>\
        <div>\
          <h2 class="naj-hr-title">استرجاع بيانات مستشفى محدد من نسخة</h2>\
          <p class="naj-hr-sub">استخدمه عند وجود مشكلة في مستشفى واحد فقط. الاسترجاع هنا لا يغير المستخدمين أو الصلاحيات أو ربط المستشفيات.</p>\
        </div>\
      </div>\
      <div class="naj-hr-grid">\
        <div class="naj-hr-field"><label>ملف النسخة الاحتياطية</label><input id="naj-hr-file" type="file" accept=".json,application/json"></div>\
        <div class="naj-hr-field"><label>المستشفى المطلوب استرجاعه</label><select id="naj-hr-select" disabled><option>اختر ملف النسخة أولاً</option></select></div>\
      </div>\
      <div id="naj-hr-info" class="naj-hr-info"></div>\
      <div class="naj-hr-note"><b>حدود الاسترجاع:</b> يتم استرجاع بيانات المستشفى المشتركة والمستخلصات وطلبات الزيارة فقط. لا يتم تعديل المستخدمين، الصلاحيات، الوحدات، أو بيانات التسجيل.</div>\
      <div class="naj-hr-grid" style="margin-top:14px">\
        <div class="naj-hr-field"><label>عبارة التأكيد</label><input id="naj-hr-confirm" type="text" placeholder="اكتب: تأكيد استعادة مستشفى"></div>\
        <div class="naj-hr-field"><label>الحالة</label><div id="naj-hr-msg" class="naj-hr-msg" style="padding:11px 0">لم يتم اختيار ملف بعد.</div></div>\
      </div>\
      <div class="naj-hr-actions"><button id="naj-hr-run" class="naj-hr-btn" disabled>تنفيذ استرجاع المستشفى</button></div>';

    var marker=Array.from(document.querySelectorAll('h2')).find(function(x){return(x.textContent||'').indexOf('استعادة من نسخة')>-1;});
    var card=marker&&marker.closest('div[style]');
    if(card&&card.parentNode)card.parentNode.insertBefore(box,card.nextSibling); else root.appendChild(box);

    var file=box.querySelector('#naj-hr-file'), sel=box.querySelector('#naj-hr-select'), conf=box.querySelector('#naj-hr-confirm'), btn=box.querySelector('#naj-hr-run'), msg=box.querySelector('#naj-hr-msg'), info=box.querySelector('#naj-hr-info');
    function valid(){var ok=backup&&hospital&&conf.value.trim()==='تأكيد استعادة مستشفى';btn.disabled=!ok;}
    function setMsg(text,color){msg.textContent=text;msg.style.color=color||'#64748b';}
    file.onchange=function(){backup=null;hospital='';info.style.display='none';sel.disabled=true;sel.innerHTML='<option>جاري قراءة الملف...</option>';setMsg('جاري قراءة ملف النسخة...');valid();var f=file.files&&file.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{backup=JSON.parse(String(r.result||'{}'));var arr=hs(backup);sel.innerHTML='<option value="">— اختر المستشفى —</option>'+arr.map(function(x){return'<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');sel.disabled=!arr.length;setMsg(arr.length?'تم قراءة الملف — اختر المستشفى المطلوب.':'الملف لا يحتوي على مستشفيات.');}catch(e){backup=null;sel.innerHTML='<option>ملف غير صالح</option>';setMsg('فشل قراءة الملف. تأكد أنه JSON صحيح.','#dc2626');}valid();};r.readAsText(f);};
    sel.onchange=function(){hospital=sel.value||''; if(backup&&hospital){var c=cnt(backup,hospital);info.style.display='block';info.innerHTML='<div style="font-weight:800;color:#1e3c72;margin-bottom:8px">محتوى النسخة للمستشفى المحدد</div><div class="naj-hr-stats"><div class="naj-hr-stat"><b>'+c.hospitalStorage+'</b><span>مفتاح مستشفى</span></div><div class="naj-hr-stat"><b>'+c.extracts+'</b><span>مستخلص</span></div><div class="naj-hr-stat"><b>'+c.visits+'</b><span>طلب زيارة</span></div></div>';setMsg('اكتب عبارة التأكيد لتفعيل الزر.');}else{info.style.display='none';setMsg('اختر المستشفى المطلوب.');}valid();};
    conf.oninput=valid;
    btn.onclick=async function(){btn.disabled=true;btn.textContent='جاري التنفيذ...';setMsg('جاري تنفيذ الاسترجاع...');try{var t=tok();var res=await fetch('/api/admin/backup/restore/hospital',{method:'POST',credentials:'include',headers:Object.assign({'Content-Type':'application/json'},t?{Authorization:'Bearer '+t}:{}),body:JSON.stringify({confirmation:'تأكيد استعادة مستشفى',backup:backup,hospitalName:hospital})});var data=await res.json().catch(function(){return{};});if(!res.ok)throw new Error(data.error||'فشل التنفيذ');setMsg('تم الاسترجاع بنجاح. راجع بيانات المستشفى قبل أي اعتماد جديد.','#15803d');}catch(e){setMsg(e.message||'فشل التنفيذ','#dc2626');}btn.textContent='تنفيذ استرجاع المستشفى';valid();};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  setInterval(mount,1500);
})();