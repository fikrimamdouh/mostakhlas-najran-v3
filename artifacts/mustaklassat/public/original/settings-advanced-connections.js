'use strict';
(function(){
  var DAY=24*60*60*1000,WEEK=7*DAY;
  function el(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function when(v){try{return new Date(v).toLocaleString('ar-SA')}catch(_){return String(v||'')}}
  function userId(u){return String(u.id||u.userId||u.email||u.name||'')}
  function eventUserId(e){return String(e.userId||e.userEmail||e.userName||'')}
  function normalizeUsers(body){
    if(Array.isArray(body))return body;
    if(body&&Array.isArray(body.users))return body.users;
    if(body&&body.data&&Array.isArray(body.data.users))return body.data.users;
    return [];
  }
  function normalizeEvents(body){return body&&Array.isArray(body.events)?body.events:[]}
  function latestByUser(events){
    var map={};events.forEach(function(e){var k=eventUserId(e);if(!k)return;var t=new Date(e.createdAt||e.timestamp||0).getTime()||0;if(!map[k]||t>map[k]._time){map[k]=Object.assign({_time:t},e)}});return map;
  }
  function statusFor(last){
    if(!last)return{lamp:'gray',label:'لم يصل رصد خلال 7 أيام'};
    var age=Date.now()-last._time;
    if(age<=DAY)return{lamp:'green',label:'الربط مؤكد خلال 24 ساعة'};
    if(age<=WEEK)return{lamp:'yellow',label:'ظهر خلال آخر 7 أيام'};
    return{lamp:'gray',label:'لم يصل رصد حديث'};
  }
  function render(users,events){
    var box=el('connection-grid'),summary=el('connection-summary'),map=latestByUser(events),green=0,yellow=0,gray=0;
    var cards=users.map(function(u){
      var keys=[String(u.id||''),String(u.userId||''),String(u.email||''),String(u.name||'')].filter(Boolean),last=null;
      for(var i=0;i<keys.length;i++){if(map[keys[i]]){last=map[keys[i]];break}}
      var st=statusFor(last);if(st.lamp==='green')green++;else if(st.lamp==='yellow')yellow++;else gray++;
      var name=u.name||u.fullName||u.userName||u.email||'مستخدم غير مسمى',email=u.email||'',hospital=u.hospital||u.hospitalName||'غير محدد',role=u.role||'user';
      return '<div class="connection-user"><span class="connection-lamp '+st.lamp+'"></span><div><div class="connection-name">'+esc(name)+'</div><div class="connection-email">'+esc(email)+'</div><div class="connection-meta">الموقع: '+esc(hospital)+' · الدور: '+esc(role)+(last?'<br>آخر رصد: '+esc(when(last.createdAt||last.timestamp))+' · الصفحة: '+esc(last.page||'-')+' · الإصدار: '+esc(last.buildVersion||'-'):'<br>لم يصل أي سجل مراقبة حديث لهذا المستخدم')+'</div><span class="connection-status '+st.lamp+'">'+esc(st.label)+'</span></div></div>';
    });
    summary.innerHTML='<div class="connection-stat"><b>إجمالي المستخدمين</b><span>'+users.length+'</span></div><div class="connection-stat"><b>ربط مؤكد 24 ساعة</b><span>'+green+'</span></div><div class="connection-stat"><b>ظهر خلال 7 أيام</b><span>'+yellow+'</span></div><div class="connection-stat"><b>لا يوجد رصد حديث</b><span>'+gray+'</span></div>';
    box.innerHTML=cards.length?cards.join(''):'<div class="empty">لا توجد بيانات مستخدمين.</div>';
  }
  async function checkConnections(){
    var btn=el('btn-connections'),panel=el('connection-panel'),box=el('connection-grid');
    if(!btn||!panel||typeof authHeaders!=='function'||typeof manualFetch!=='function')return;
    panel.classList.add('show');btn.disabled=true;box.innerHTML='<div class="empty">جاري فحص الربط...</div>';
    try{
      var h=await authHeaders();if(!h.Authorization)throw Error('تعذر الحصول على جلسة صالحة');
      var since=encodeURIComponent(new Date(Date.now()-WEEK).toISOString());
      var results=await Promise.all([
        manualFetch('/api/users',{headers:h,credentials:'include'}),
        manualFetch('/api/client-events?limit=200&since='+since,{headers:h,credentials:'include'})
      ]);
      if(!results[0].ok)throw Error('تعذر تحميل المستخدمين: HTTP '+results[0].status);
      if(!results[1].ok)throw Error('تعذر تحميل سجلات المراقبة: HTTP '+results[1].status);
      var users=normalizeUsers(await results[0].json()),events=normalizeEvents(await results[1].json());
      render(users,events);el('connection-last-check').textContent='آخر فحص يدوي: '+when(new Date().toISOString())+' — طلبان فقط';
    }catch(e){box.innerHTML='<div class="empty">فشل فحص الربط: '+esc(e.message||e)+'</div>'}finally{btn.disabled=false}
  }
  document.addEventListener('DOMContentLoaded',function(){var b=el('btn-connections');if(b)b.addEventListener('click',checkConnections)});
})();