(function(){
'use strict';
if(!/admin_offices_consumables\.html(?:$|[?#])/.test(location.pathname+location.search))return;
const DB='admin_offices_consumables_v1.0';
const FLAG='adminOfficesConsumablesTemplatePatch_v1_applied';
const S={
summary:`summary_data_${DB}`,
performance:`performance_data_${DB}`,
subcontractors:`subcontractors_data_${DB}`,
sewage:`sewage_disposal_data_${DB}`,
titles:`print_titles_data_${DB}`
};
function j(k,f){try{const r=localStorage.getItem(k);return r?JSON.parse(r):f}catch(e){return f}}
function w(k,v){localStorage.setItem(k,JSON.stringify(v))}
function apply(){
w(S.summary,[
{id:'pf_1',name:'الوقود والزيوت والمحروقات',value:1240,isEditable:true,isCustom:false},
{id:'pf_2',name:'المستهلكات الكيميائية والفلاتر',value:900,isEditable:true,isCustom:false},
{id:'pf_3',name:'مستهلكات الاعمال المدنية',value:1500,isEditable:true,isCustom:false},
{id:'pf_4',name:'مواد ومطهرات النظافة',value:6200,isEditable:true,isCustom:false},
{id:'pf_5',name:'مستهلكات الزراعة والرى',value:800,isEditable:true,isCustom:false},
{id:'pf_6',name:'مستهلكات اجهزة النسخ والتصوير والطباعة',value:2600,isEditable:true,isCustom:false},
{id:'pf_7',name:'المبيدات الحشرية',value:868,isEditable:true,isCustom:false},
{id:'sm_custom_deduction_1',name:'حسم تكاليف الكهرباء + الماء للسكن ان وجد',value:0,isEditable:true,isCustom:true}
]);
w(S.performance,[
{id:'pf_1',name:'الوقود والزيوت والمحروقات',maxScore:20,score:20},
{id:'pf_2',name:'المستهلكات الكيميائية والفلاتر',maxScore:15,score:15},
{id:'pf_3',name:'مستهلكات الاعمال المدنية',maxScore:20,score:20},
{id:'pf_4',name:'مواد ومطهرات النظافة',maxScore:20,score:20},
{id:'pf_5',name:'مستهلكات الزراعة والرى',maxScore:10,score:10},
{id:'pf_6',name:'مستهلكات اجهزة النسخ والتصوير والطباعة',maxScore:10,score:10},
{id:'pf_7',name:'المبيدات الحشرية',maxScore:15,score:15}
]);
w(S.subcontractors,[
{id:'sc_1',name:'صيانة انظمة التكييف والتبريد وانظمة التهوية وملحقاتها',visitValue:28000,annualVisits:4,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_2',name:'صيانة المصاعد الكهربائية',visitValue:60000,annualVisits:12,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_3',name:'صيانة واصلاح نظام اطفاء الحريق',visitValue:12000,annualVisits:2,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_4',name:'صيانة واصلاح نظام انذار الحريق',visitValue:12000,annualVisits:2,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_5',name:'صيانة واصلاح السنترالات',visitValue:30000,annualVisits:3,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_6',name:'صيانة محطات التوليد الكهربائية (مولدات الطوارى) ولوحات التحكم والتشغيل الخاصة بها و(ATS)',visitValue:24000,annualVisits:3,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0},
{id:'sc_7',name:'مكافحة الحشرات والقوارض والافات البيئية',visitValue:96000,annualVisits:12,visitDate:'خلال هذا الشهر',status:'نعم',delayDays:0,damagePenalty:0}
]);
w(S.sewage,[{id:'sw_1',name:'تكلفة التخلص من مياه الصرف و المياه الزائدة',unitPrice:0,quantity:0}]);
const titles=j(S.titles,{});
Object.assign(titles,{
subcontractors:'<h1>جدول رقم (7)</h1><h2>المبلغ المستحق لمقاولي الباطن للأجهزة غير الطبية لمواقع المكاتب الإدارية و المرافق الصحية</h2><h3>{period}</h3>',
summary:'<h1>شهادة الاستحقاق الشهري لبنود (المستهلكات - مقاولي الباطن - التخلص من مياه الصرف)</h1><h2>لأعمال النظافة والصيانة والتشغيل غير الطبي</h2><h2>لموقع المكاتب الإدارية و المرافق الصحية</h2><h3>{period}</h3>',
sewage:'<h1>شهادة الاستحقاق الشهري لتكاليف التخلص من مياه الصرف والمياه الزائدة</h1><h2>للمكاتب الإدارية والمرافق الصحية</h2><h3>{period}</h3>'
});
w(S.titles,titles);
localStorage.setItem(FLAG,new Date().toISOString());
}
function normalizeSubcontractors(){
const rows=j(S.subcontractors,[]);
if(!Array.isArray(rows)||!rows.length)return false;
const valid=['خلال هذا الشهر','تمت الزيارة من قبل','زيارة قادمة','زيارة مؤجلة'];
const oldFuture=['يناير القادم','فبراير القادم','مارس القادم','أبريل القادم','مايو القادم','يونيو القادم','يوليو القادم','أغسطس القادم','سبتمبر القادم','أكتوبر القادم','نوفمبر القادم','ديسمبر القادم'];
let changed=false;
rows.forEach(r=>{
const v=String(r.visitDate||'').trim();
const status=String(r.status||'').trim();
if(!valid.includes(v)){
if(oldFuture.includes(v)&&status)r.visitDate='زيارة قادمة';
else r.visitDate='خلال هذا الشهر';
changed=true;
}
if(!status){r.status='نعم';changed=true;}
});
if(changed)w(S.subcontractors,rows);
return changed;
}
function addConsumablesButtonStyles(){
if(document.getElementById('admin-office-consumables-button-polish'))return;
const css=`
body .std-action-bar button,
body .main-action-buttons button,
body #tables-area .table-header button,
body #tables-area .back-to-dashboard,
body #unified-modal .modal-buttons button,
body #apply-consumables-office-template-btn{
  color:#fff!important;
  border:0!important;
  border-radius:10px!important;
  font-weight:800!important;
  box-shadow:0 5px 14px rgba(15,23,42,.18)!important;
  text-shadow:none!important;
}
body #tables-area .back-to-dashboard{background:linear-gradient(135deg,#0f766e,#14b8a6)!important;}
body #tables-area .btn-print,body .ab-print{background:linear-gradient(135deg,#334155,#0f172a)!important;}
body #tables-area .btn-manage,body .ab-manage{background:linear-gradient(135deg,#4338ca,#7c3aed)!important;}
body #tables-area .btn-add-item,body .ab-excel{background:linear-gradient(135deg,#15803d,#22c55e)!important;}
body #tables-area .btn-remove-item,body .ab-clear{background:linear-gradient(135deg,#b91c1c,#ef4444)!important;}
body .ab-update{background:linear-gradient(135deg,#0369a1,#0284c7)!important;}
body .ab-backup{background:linear-gradient(135deg,#b45309,#f97316)!important;}
body .ab-sig{background:linear-gradient(135deg,#4f46e5,#8b5cf6)!important;}
body .ab-titles,body #apply-consumables-office-template-btn{background:linear-gradient(135deg,#be185d,#db2777)!important;}
body #tables-area .btn:hover,
body .std-action-bar button:hover,
body .main-action-buttons button:hover{
  filter:brightness(1.05)!important;
  transform:translateY(-2px)!important;
}
body #tables-area .btn-manage.edit-mode{
  background:linear-gradient(135deg,#ca8a04,#f59e0b)!important;
  color:#111827!important;
}
@media print{body .std-action-bar button,body .main-action-buttons button,body #tables-area .table-header button,body #tables-area .back-to-dashboard,body #apply-consumables-office-template-btn{display:none!important;}}
`;
const st=document.createElement('style');
st.id='admin-office-consumables-button-polish';
st.textContent=css;
document.head.appendChild(st);
}
function addButton(){
const bar=document.querySelector('.main-action-buttons,.std-action-bar');
if(!bar||document.getElementById('apply-consumables-office-template-btn'))return;
const b=document.createElement('button');
b.type='button';b.id='apply-consumables-office-template-btn';b.className='btn btn-titles no-print ab ab-titles';
b.innerHTML='<i class="fas fa-file-contract"></i> تطبيق نموذج مستهلكات المكاتب';
b.onclick=function(){if(confirm('سيتم تطبيق نموذج مستهلكات المكاتب مع بقاء المعادلات.')){localStorage.removeItem(FLAG);apply();location.reload()}};
bar.appendChild(b);
}
function boot(){addConsumablesButtonStyles();addButton();if(!localStorage.getItem(FLAG))apply();if(normalizeSubcontractors())setTimeout(function(){location.reload()},50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
setTimeout(function(){addConsumablesButtonStyles();addButton()},1200);
console.info('[Admin Offices Consumables Template Patch] installed normalized subcontractors + button polish');
})();
