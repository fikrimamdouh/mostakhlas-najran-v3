(function(){
  'use strict';
  if(!/\/original\/settings_main\.html(?:$|[?#])/.test(location.pathname+location.search)) return;

  function isProtectedKey(k){
    return k === 'najran_session' || k === '__clerk_db_jwt' ||
      String(k).indexOf('__clerk') === 0 || String(k).indexOf('clerk_') === 0 ||
      String(k).indexOf('amplitude') === 0 || k === 'loglevel';
  }
  function readVal(k){try{return JSON.parse(localStorage.getItem(k));}catch(_){return localStorage.getItem(k);}}
  function owner(){
    var s={};try{s=JSON.parse(localStorage.getItem('najran_session')||'{}')||{};}catch(_){}
    return {userId:s.userId||null,email:s.email||null,name:s.name||null,hospital:s.hospital||localStorage.getItem('hospitalName')||null,hospitals:s.hospitals||null,company:s.company||s.companyName||localStorage.getItem('companyName')||null,createdAt:new Date().toISOString()};
  }
  function contractHospital(){try{var c=JSON.parse(localStorage.getItem('persistentContractData')||'{}');return c.hospitalName||localStorage.getItem('hospitalName')||owner().hospital||'النظام';}catch(_){return localStorage.getItem('hospitalName')||'النظام';}}
  function allLocalData(){
    var out={};
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(!k||isProtectedKey(k)) continue;
      out[k]=readVal(k);
    }
    return out;
  }
  function manifest(data){
    var keys=Object.keys(data||{});
    function has(re){return keys.some(function(k){return re.test(k);});}
    return {
      totalKeys:keys.length,
      includesLaborAttendance:has(/attendance|Attendance|عمالة|labor|dept|department|admin_staff|centersAttendance/i),
      includesPerformance:has(/performance|Performance|deduction|Deduction|tableData_|deptCalculatedCost_/i),
      includesAchievement:has(/achievement|Achievement|إنجاز|انجاز/i),
      includesConsumables:has(/consumables|Consumables|mainHospitalConsumables|healthCentersConsumables|subcontractors|water_supply|sewage|summary_data|laundry_supply/i),
      includesSpareParts:has(/spare|Spare|parts|Parts|spare_parts|spareParts/i),
      includesSettings:has(/persistentContractData|persistentExtractData|hospitalName|companyName|contract|settings|signature|Signatures/i),
      includesFoundation:has(/contract_foundation|foundation/i),
      includesMonthArchive:has(/monthSnapshot_|monthly|archive/i)
    };
  }
  function normalize(raw){
    if(!raw||typeof raw!=='object') throw new Error('ملف غير صالح');
    if(raw.tables) throw new Error('هذا ملف نسخة مركزية للإدارة. استخدم صفحة /admin/backup وليس إعدادات المستخدم.');
    if(raw.data&&typeof raw.data==='object') return {wrapped:true,type:raw.type||'local',owner:raw.owner||null,manifest:raw.manifest||manifest(raw.data),data:raw.data};
    return {wrapped:false,type:'legacy_flat_local',owner:null,manifest:manifest(raw),data:raw};
  }
  function groupOf(k){
    if(/persistentContractData|persistentExtractData|hospitalName|companyName|contract|settings|signature|Signatures|sb_sigs_/i.test(k)) return 'settings';
    if(/attendance|Attendance|labor|dept|department|admin_staff|centersAttendance/i.test(k)) return 'labor';
    if(/performance|Performance|deduction|Deduction|tableData_|deptCalculatedCost_/i.test(k)) return 'performance';
    if(/achievement|Achievement|إنجاز|انجاز/i.test(k)) return 'achievement';
    if(/consumables|Consumables|mainHospitalConsumables|healthCentersConsumables|subcontractors|water_supply|sewage|summary_data|laundry_supply/i.test(k)) return 'consumables';
    if(/spare|Spare|parts|Parts|spare_parts|spareParts/i.test(k)) return 'spare';
    if(/contract_foundation|foundation/i.test(k)) return 'foundation';
    if(/monthSnapshot_|monthly|archive/i.test(k)) return 'months';
    return 'other';
  }
  var labels={settings:'الإعدادات والتواقيع',labor:'العمالة والحضور',performance:'الأداء والحسميات',achievement:'الإنجاز',consumables:'المستهلكات والمياه والمقاولين',spare:'قطع الغيار',foundation:'التأسيسي',months:'أرشيف الشهور',other:'مفاتيح أخرى'};
  function stats(data){
    var res={};Object.keys(labels).forEach(function(g){res[g]=[];});
    Object.keys(data||{}).forEach(function(k){res[groupOf(k)].push(k);});
    return res;
  }
  function download(obj,name){var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
  function createCompleteBackup(){
    var data=allLocalData();
    var h=contractHospital();
    var ts=new Date().toISOString().slice(0,10);
    var pack={type:'user_hospital_complete',scope:'local-user-browser-complete',owner:owner(),entityName:h,timestamp:new Date().toISOString(),manifest:manifest(data),data:data};
    download(pack,'نسخة_محلية_شاملة_للمستخدم_'+String(h).replace(/\s/g,'_')+'_'+ts+'.json');
    try{if(typeof addLogEntry==='function')addLogEntry('إنشاء نسخة محلية','محلية_شاملة_للمستخدم','نجاح');}catch(_){}
    alert('تم إنشاء نسخة شاملة كاملة.\nعدد المفاتيح: '+pack.manifest.totalKeys+'\nالمستهلكات: '+(pack.manifest.includesConsumables?'نعم':'لا')+'\nقطع الغيار: '+(pack.manifest.includesSpareParts?'نعم':'لا'));
  }
  function installBackupOverride(){
    window.createSpecificBackup=function(type){
      if(type==='full_system'||type==='user_hospital_complete') return createCompleteBackup();
      var data=allLocalData();
      var wanted={};
      var map={settings:['settings'],main_hospital_attendance:['labor','performance','achievement'],main_hospital_consumables:['consumables'],spare_parts:['spare'],health_centers_attendance:['labor','performance'],health_centers_consumables:['consumables'],admin_offices_attendance:['labor','performance'],admin_offices_consumables:['consumables']};
      var groups=map[type]||['settings'];
      Object.keys(data).forEach(function(k){if(groups.indexOf(groupOf(k))>=0||groupOf(k)==='settings')wanted[k]=data[k];});
      var h=contractHospital(),ts=new Date().toISOString().slice(0,10);
      var pack={type:type,scope:'local-user-browser-section',owner:owner(),entityName:h,timestamp:new Date().toISOString(),manifest:manifest(wanted),data:wanted};
      download(pack,'نسخة_محلية_'+(type||'section')+'_'+String(h).replace(/\s/g,'_')+'_'+ts+'.json');
      alert('تم إنشاء النسخة.\nعدد المفاتيح: '+pack.manifest.totalKeys);
    };
  }
  function renderSmart(normalized){
    var body=document.getElementById('smart-modal-body'); if(!body)return;
    var s=stats(normalized.data);
    var html='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.8">'+
      '<b>نوع الملف:</b> '+(normalized.wrapped?'نسخة جديدة':'نسخة قديمة مسطحة')+'<br>'+
      '<b>إجمالي المفاتيح:</b> '+Object.keys(normalized.data).length+'<br>'+
      '<b>طريقة الاستعادة:</b> دمج آمن — لا يحذف بيانات غير موجودة في الملف</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px">';
    Object.keys(labels).forEach(function(g){var arr=s[g]||[];html+='<label style="display:block;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff"><input type="checkbox" class="smart-group" value="'+g+'" '+(arr.length?'checked':'disabled')+'> <b>'+labels[g]+'</b><br><small>'+arr.length+' مفتاح</small></label>';});
    html+='</div><details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700;color:#1e3c72">عرض كل المفاتيح</summary><div style="max-height:180px;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin-top:8px;font-size:11px;direction:ltr;text-align:left">'+Object.keys(normalized.data).map(function(k){return '<div>'+k+'</div>';}).join('')+'</div></details>';
    body.innerHTML=html;
  }
  function restoreSelected(normalized,dry){
    var checked=Array.from(document.querySelectorAll('.smart-group:checked')).map(function(x){return x.value;});
    var keys=Object.keys(normalized.data).filter(function(k){return checked.indexOf(groupOf(k))>=0;});
    if(dry){alert('معاينة فقط\nسيتم استعادة '+keys.length+' مفتاح.');return;}
    if(!keys.length){alert('لم يتم اختيار أي بيانات.');return;}
    if(!confirm('سيتم دمج '+keys.length+' مفتاح مع بيانات المستخدم الحالية. هل تريد المتابعة؟'))return;
    keys.forEach(function(k){if(!isProtectedKey(k)){var v=normalized.data[k];localStorage.setItem(k,typeof v==='object'?JSON.stringify(v):String(v));}});
    alert('تم الاستيراد الذكي بنجاح. سيتم إعادة تحميل الصفحة.');
    setTimeout(function(){location.reload();},700);
  }
  var smartData=null;
  function installSmartImport(){
    var btn=document.getElementById('smart-import-btn'), file=document.getElementById('smart-file');
    if(btn&&file&&!btn.__completeSmart){
      btn.__completeSmart=true;
      btn.addEventListener('click',function(){file.value='';file.click();});
      file.addEventListener('change',function(){
        var f=file.files&&file.files[0]; if(!f)return;
        var r=new FileReader();
        r.onload=function(){try{smartData=normalize(JSON.parse(String(r.result||'{}')));renderSmart(smartData);var modal=document.getElementById('smart-import-modal');if(modal)modal.style.display='block';}catch(e){alert('فشل قراءة الملف: '+e.message);}};
        r.readAsText(f);
      });
    }
    var dry=document.getElementById('smart-dryrun'), restore=document.getElementById('smart-restore');
    if(dry&&!dry.__completeSmart){dry.__completeSmart=true;dry.addEventListener('click',function(){if(smartData)restoreSelected(smartData,true);});}
    if(restore&&!restore.__completeSmart){restore.__completeSmart=true;restore.addEventListener('click',function(){if(smartData)restoreSelected(smartData,false);});}
  }
  function installRestoreOverride(){
    window.confirmRestore=function(){
      var input=document.getElementById('restore-file-input');if(!input||!input.files||!input.files.length){alert('يرجى اختيار ملف نسخة احتياطية أولاً.');return;}
      var f=input.files[0],r=new FileReader();
      r.onload=function(){try{var n=normalize(JSON.parse(String(r.result||'{}')));renderSmart(n);smartData=n;var modal=document.getElementById('smart-import-modal');if(modal)modal.style.display='block';else restoreSelected(n,false);}catch(e){alert('فشل استعادة الملف: '+e.message);}};
      r.readAsText(f);
    };
  }
  function boot(){installBackupOverride();installSmartImport();installRestoreOverride();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setInterval(boot,1000);
})();