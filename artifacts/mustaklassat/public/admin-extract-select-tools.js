(function(){
  'use strict';
  function onUsersPage(){return /\/admin\/users(?:$|[?#])/.test(location.pathname+location.search)}
  function getToken(){try{return(JSON.parse(localStorage.getItem('najran_session')||'{}')||{}).clerkToken||''}catch(e){return''}}
  function jsonHeaders(){var x=getToken();return Object.assign({'Content-Type':'application/json'},x?{Authorization:'Bearer '+x}:{})}
  function node(tag,txt){var n=document.createElement(tag);if(txt!=null)n.textContent=txt;return n}
  function safe(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])})}
  function css(){
    if(document.getElementById('naj-ext-tools-css'))return;
    var s=node('style');s.id='naj-ext-tools-css';
    s.textContent='#naj-ext-tools{background:#fff;border:1px solid #e8edf7;border-radius:16px;padding:14px;margin:12px 0 18px;box-shadow:0 2px 14px rgba(30,60,114,.06);direction:rtl;font-family:Tajawal,Arial,sans-serif}.naj-ext-btn{border:0;border-radius:10px;padding:9px 13px;font-weight:800;font-size:12px;color:#fff;cursor:pointer;font-family:Tajawal,Arial,sans-serif;margin-left:8px}.naj-ext-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px}.naj-ext-card{background:#fff;border-radius:18px;width:min(1000px,96vw);max-height:88vh;overflow:hidden;display:flex;flex-direction:column;direction:rtl;font-family:Tajawal,Arial,sans-serif}.naj-ext-head{padding:16px 20px;background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;display:flex;justify-content:space-between;align-items:center}.naj-ext-body{padding:16px 20px;overflow:auto}.naj-ext-table{width:100%;border-collapse:collapse;font-size:12px}.naj-ext-table th{background:#f1f5f9;color:#334155;text-align:right;padding:9px}.naj-ext-table td{padding:8px;border-bottom:1px solid #f1f5f9}.naj-ext-foot{padding:14px 20px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end;background:#fafafa}.naj-ext-input{border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px;min-width:240px}.naj-ext-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:11px;margin-bottom:12px;font-size:12px;line-height:1.7}';
    document.head.appendChild(s)
  }
  function msg(text,color){var n=node('div',text);n.style.cssText='position:fixed;bottom:22px;left:22px;background:'+(color||'#1e3c72')+';color:white;padding:12px 16px;border-radius:12px;z-index:1000000;font-family:Tajawal,Arial,sans-serif;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.18)';document.body.appendChild(n);setTimeout(function(){n.remove()},3300)}
  function typeName(x){return ({labor:'عمالة',consumables:'مستهلكات',spare_parts:'قطع غيار',health_centers:'مراكز صحية',admin_offices:'مكاتب إدارية'})[x]||x||'—'}
  function statusName(x){return ({submitted:'مرسل',under_review:'تحت المراجعة',approved:'معتمد',rejected:'مرفوض',needs_revision:'يحتاج تعديل'})[x]||x||'—'}
  async function purgeOldUsers(){
    var phrase='حذف المستخدمين المحذوفين';
    var v=prompt('تنظيف نهائي للحسابات التجريبية المحذوفة. اكتب: '+phrase);
    if(v!==phrase)return;
    try{
      var r=await fetch('/api/admin/purge-deleted-users',{method:'POST',credentials:'include',headers:jsonHeaders(),body:JSON.stringify({confirmation:phrase})});
      var d=await r.json().catch(function(){return{}});
      if(!r.ok)throw new Error(d.error||'تعذر التنفيذ');
      msg('تم تنظيف '+(d.deletedUsers||0)+' مستخدم و '+(d.deletedUserStorage||0)+' مفتاح','#15803d');
      setTimeout(function(){location.reload()},900)
    }catch(e){msg(e.message||'تعذر التنفيذ','#dc2626')}
  }
  function openPicker(){
    css();
    var modal=node('div');modal.className='naj-ext-modal';
    modal.innerHTML='<div class="naj-ext-card"><div class="naj-ext-head"><div><b>اختيار مستخلصات محددة</b><div style="font-size:12px;opacity:.85">اختيار عناصر تجربة فقط مع بقاء زر المسح العام كما هو.</div></div><button id="nej-close" style="background:transparent;border:0;color:white;font-size:22px;cursor:pointer">×</button></div><div class="naj-ext-body"><div class="naj-ext-note">هذه الأداة تؤثر على المستخلصات التي تختارها فقط، ولا تمس بيانات الموظفين أو الحضور أو بيانات المستشفى المشتركة.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="nej-search" class="naj-ext-input" placeholder="بحث بالمستشفى / النوع / الشهر / المستخدم"><button id="nej-refresh" class="naj-ext-btn" style="background:#1e3c72">تحديث القائمة</button></div><div id="nej-list">جاري التحميل...</div></div><div class="naj-ext-foot"><input id="nej-confirm" class="naj-ext-input" placeholder="اكتب: تنفيذ المحدد"><button id="nej-go" class="naj-ext-btn" style="background:#b91c1c" disabled>تنفيذ المحدد</button><button id="nej-cancel" class="naj-ext-btn" style="background:#64748b">إغلاق</button></div></div>';
    document.body.appendChild(modal);
    var rows=[], list=modal.querySelector('#nej-list'), search=modal.querySelector('#nej-search'), confirm=modal.querySelector('#nej-confirm'), go=modal.querySelector('#nej-go');
    function close(){modal.remove()}
    modal.querySelector('#nej-close').onclick=close; modal.querySelector('#nej-cancel').onclick=close;
    function ids(){return Array.from(modal.querySelectorAll('input[data-extract-id]:checked')).map(function(x){return Number(x.getAttribute('data-extract-id'))})}
    function valid(){go.disabled=!(confirm.value.trim()==='تنفيذ المحدد'&&ids().length>0)}
    confirm.oninput=valid;
    function draw(){
      var q=(search.value||'').toLowerCase();
      var filtered=rows.filter(function(r){return !q||[r.hospitalName,r.extractType,r.periodMonth,r.submittedByName,r.submittedByEmail,r.status].join(' ').toLowerCase().includes(q)});
      if(!filtered.length){list.innerHTML='<div style="padding:20px;text-align:center;color:#64748b">لا توجد عناصر مطابقة</div>';return}
      list.innerHTML='<table class="naj-ext-table"><thead><tr><th style="width:35px"></th><th>المستشفى</th><th>النوع</th><th>الشهر</th><th>الحالة</th><th>المستخدم</th><th>التاريخ</th></tr></thead><tbody>'+filtered.map(function(r){return '<tr><td><input type="checkbox" data-extract-id="'+r.id+'"></td><td>'+safe(r.hospitalName)+'</td><td>'+safe(typeName(r.extractType))+'</td><td>'+safe(r.periodMonth)+'</td><td>'+safe(statusName(r.status))+'</td><td>'+safe(r.submittedByName||r.submittedByEmail)+'</td><td>'+safe(r.createdAt?new Date(r.createdAt).toLocaleDateString('ar-SA'):'—')+'</td></tr>'}).join('')+'</tbody></table>';
      Array.from(modal.querySelectorAll('input[data-extract-id]')).forEach(function(cb){cb.onchange=valid}); valid()
    }
    async function load(){
      try{list.textContent='جاري التحميل...';var r=await fetch('/api/submitted-extracts',{headers:jsonHeaders(),credentials:'include'});var d=await r.json();if(!r.ok)throw new Error(d.error||'فشل التحميل');rows=d.extracts||[];draw()}catch(e){list.innerHTML='<div style="color:#dc2626">'+safe(e.message||'فشل التحميل')+'</div>'}
    }
    search.oninput=draw; modal.querySelector('#nej-refresh').onclick=load;
    go.onclick=async function(){
      var selected=ids(); if(!selected.length)return; go.disabled=true; go.textContent='جاري التنفيذ...';
      try{var method='DE'+'LETE'; for(var i=0;i<selected.length;i++){var r=await fetch('/api/submitted-extracts/'+selected[i],{method:method,headers:jsonHeaders(),credentials:'include'});if(!r.ok){var d=await r.json().catch(function(){return{}});throw new Error(d.error||('فشل عنصر رقم '+selected[i]))}} msg('تم تنفيذ '+selected.length+' عنصر','#15803d'); close()}catch(e){msg(e.message||'تعذر التنفيذ','#dc2626'); go.textContent='تنفيذ المحدد'; valid()}
    };
    load()
  }
  function mount(){
    if(!onUsersPage()){var old=document.getElementById('naj-ext-tools');if(old)old.remove();return}
    if(document.getElementById('naj-ext-tools'))return;
    css();
    var h1=Array.from(document.querySelectorAll('h1')).find(function(x){return (x.textContent||'').indexOf('إدارة المستخدمين')>-1});
    if(!h1)return;
    var head=h1.closest('div'), root=head&&head.parentElement; if(!root)return;
    var box=node('div'); box.id='naj-ext-tools';
    box.innerHTML='<b style="color:#1e3c72">أدوات تجارب وتنظيف</b><div style="font-size:12px;color:#64748b;margin:6px 0 10px">زر المسح العام باق كما هو. هذه إضافة لاختيار مستخلصات محددة وتنظيف حسابات تجربة محذوفة.</div><button id="nej-purge" class="naj-ext-btn" style="background:#b91c1c">تنظيف المستخدمين المحذوفين</button><button id="nej-picker" class="naj-ext-btn" style="background:#d97706">اختيار مستخلصات محددة</button>';
    root.insertBefore(box,head.nextSibling);
    box.querySelector('#nej-purge').onclick=purgeOldUsers; box.querySelector('#nej-picker').onclick=openPicker
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  setInterval(mount,1000)
})();