(function(){
  'use strict';
  if(!/\/admin\/backup(?:$|[?#])/.test(location.pathname+location.search)) return;
  var backup=null,hospital='';
  function tok(){try{return(JSON.parse(localStorage.getItem('najran_session')||'{}')||{}).clerkToken||'';}catch(_){return'';}}
  function el(tag,txt){var x=document.createElement(tag); if(txt!=null)x.textContent=txt; return x;}
  function hs(b){var s=new Set(),t=(b&&b.tables)||{}; (t.hospitalStorage||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); (t.extracts||[]).forEach(function(r){if(r.hospitalName)s.add(String(r.hospitalName).trim());}); return Array.from(s).filter(Boolean).sort();}
  function cnt(b,h){var t=(b&&b.tables)||{}; return {a:(t.hospitalStorage||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length,b:(t.extracts||[]).filter(function(r){return String(r.hospitalName||'').trim()===h;}).length};}
  function mount(){
    if(document.getElementById('naj-hospital-restore-box'))return;
    var root=document.querySelector('main')||document.body;
    var box=el('div'); box.id='naj-hospital-restore-box'; box.dir='rtl'; box.style.cssText='background:#fff;border:1px solid #bfdbfe;border-radius:16px;padding:18px;margin:18px auto;max-width:1100px;font-family:Tajawal,Arial,sans-serif;box-shadow:0 2px 12px rgba(30,60,114,.08)';
    var h=el('h2','استرجاع بيانات مستشفى محدد من نسخة'); h.style.cssText='margin:0 0 6px;color:#1e3c72;font-size:18px;font-weight:800';
    var p=el('p','يعيد بيانات المستشفى المشتركة والمستخلصات فقط، ولا يغير المستخدمين أو الصلاحيات.'); p.style.cssText='margin:0 0 12px;color:#64748b;font-size:12px';
    var file=el('input'); file.type='file'; file.accept='.json,application/json'; file.style.cssText='border:1px solid #cbd5e1;border-radius:10px;padding:8px;margin:4px;width:330px;max-width:100%';
    var sel=el('select'); sel.disabled=true; sel.style.cssText='border:1px solid #cbd5e1;border-radius:10px;padding:9px;margin:4px;min-width:280px'; sel.innerHTML='<option>اختر ملف النسخة أولا</option>';
    var conf=el('input'); conf.placeholder='اكتب: تأكيد استعادة مستشفى'; conf.style.cssText='border:1px solid #fdba74;border-radius:10px;padding:9px;margin:4px;min-width:280px';
    var btn=el('button','تنفيذ استرجاع المستشفى'); btn.disabled=true; btn.style.cssText='background:#9ca3af;color:#fff;border:0;border-radius:10px;padding:10px 16px;margin:4px;font-weight:800';
    var msg=el('div',''); msg.style.cssText='font-size:12px;color:#64748b;margin-top:8px';
    function v(){var ok=backup&&hospital&&conf.value.trim()==='تأكيد استعادة مستشفى'; btn.disabled=!ok; btn.style.background=ok?'linear-gradient(135deg,#1e3c72,#2a5298)':'#9ca3af'; btn.style.cursor=ok?'pointer':'not-allowed';}
    file.onchange=function(){backup=null;hospital='';msg.textContent='';sel.disabled=true;sel.innerHTML='<option>جاري القراءة...</option>';v();var f=file.files&&file.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{backup=JSON.parse(String(r.result||'{}'));var arr=hs(backup);sel.innerHTML='<option value="">اختر المستشفى</option>'+arr.map(function(x){return'<option value="'+x.replace(/"/g,'&quot;')+'">'+x+'</option>';}).join('');sel.disabled=!arr.length;msg.textContent='تمت قراءة الملف: '+arr.length+' مستشفى';}catch(e){sel.innerHTML='<option>ملف غير صالح</option>';msg.textContent='فشل قراءة الملف';}v();};r.readAsText(f);};
    sel.onchange=function(){hospital=sel.value||''; if(backup&&hospital){var c=cnt(backup,hospital);msg.textContent='داخل النسخة: '+c.a+' مفتاح مستشفى، '+c.b+' مستخلص';} v();};
    conf.oninput=v;
    btn.onclick=async function(){btn.disabled=true;btn.textContent='جاري التنفيذ...';try{var t=tok();var res=await fetch('/api/admin/backup/restore/hospital',{method:'POST',credentials:'include',headers:Object.assign({'Content-Type':'application/json'},t?{Authorization:'Bearer '+t}:{}),body:JSON.stringify({confirmation:'تأكيد استعادة مستشفى',backup:backup,hospitalName:hospital})});var data=await res.json().catch(function(){return{};});if(!res.ok)throw new Error(data.error||'فشل التنفيذ');msg.style.color='#15803d';msg.textContent='تم التنفيذ بنجاح';}catch(e){msg.style.color='#dc2626';msg.textContent=e.message||'فشل التنفيذ';}btn.textContent='تنفيذ استرجاع المستشفى';v();};
    box.appendChild(h);box.appendChild(p);box.appendChild(file);box.appendChild(sel);box.appendChild(conf);box.appendChild(btn);box.appendChild(msg);
    var marker=Array.from(document.querySelectorAll('h2')).find(function(x){return(x.textContent||'').indexOf('استعادة من نسخة')>-1;}); var card=marker&&marker.closest('div[style]'); if(card&&card.parentNode)card.parentNode.insertBefore(box,card.nextSibling); else root.appendChild(box);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  setInterval(mount,1500);
})();