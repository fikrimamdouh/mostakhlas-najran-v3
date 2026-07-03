/**
 * signature-block.js — نظام التواقيع الموحد V2
 * - شاشة واحدة لإضافة/تعديل التواقيع.
 * - إعدادات مكان التوقيع: يمين / وسط / يسار.
 * - إعدادات حجم التوقيع: صغير / عادي / كبير.
 * - إعداد عرض خانة التوقيع.
 * - إزالة مسطرة الخط بين الصفة والاسم.
 */
(function (global) {
  'use strict';

  const PREFIX = 'sb_sigs_';
  const PREFS_PFX = 'sb_prefs_';
  const SESSION_KEY = 'najran_session';
  const CONSUMABLES_LEGACY_SIGNATURES_KEY = 'signatures_data_consumables_v27';
  const instances = {};
  let activeKey = null;
  let printHooksInstalled = false;
  let storageHookInstalled = false;
  let consumablesLegacyOverride = null;
  let enhanceScheduled = false;

  const STAMP_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/><circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-size="17" fill="currentColor" font-weight="bold">ختم</text></svg>`;

  const CONSUMABLES_LABELS = {
    subcontractors: 'شهادة عقود الباطن',
    performance: 'جدول أداء المستهلكات',
    water: 'شهادة توريد المياه',
    sewage: 'شهادة التخلص من الصرف الصحي',
    summary: 'شهادة الاستحقاق الشهري (الملخص)'
  };

  const DEFAULT_CONSUMABLES_SIGS = {
    subcontractors: [
      { title: 'مندوب المقاول', name: 'م/فهد ناجي آل سالم' },
      { title: 'محاسب المستشفى', name: 'أ/ذيب ثوران' },
      { title: 'مساعد مدير المستشفى للشئون الإدارية والتشغيل', name: 'أ/صالح الطويل' },
      { title: 'مدير المستشفى', name: 'أ/إبراهيم حمد آل عامر' }
    ],
    performance: [
      { title: 'مندوب المقاول', name: 'م/فهد ناجي آل سالم' },
      { title: 'مدير المستشفى', name: 'أ/إبراهيم حمد آل عامر' }
    ],
    water: [
      { title: 'مندوب المقاول', name: 'م/فهد ناجي آل سالم' },
      { title: 'مدير المستشفى', name: 'أ/إبراهيم حمد آل عامر' }
    ],
    sewage: [
      { title: 'مندوب المقاول', name: 'م/فهد ناجي آل سالم' },
      { title: 'مدير المستشفى', name: 'أ/إبراهيم حمد آل عامر' }
    ],
    summary: [
      { title: 'مندوب المقاول', name: 'م/فهد ناجي آل سالم' },
      { title: 'محاسب المستشفى', name: 'أ/ذيب ثوران' },
      { title: 'مساعد مدير المستشفى للشئون الإدارية والتشغيل', name: 'أ/صالح الطويل' },
      { title: 'مدير المستشفى', name: 'أ/إبراهيم حمد آل عامر' }
    ]
  };

  const CSS = `
.sb-wrap{margin:20px 0 0}
.sb-grid{display:flex;flex-wrap:wrap;gap:var(--sb-gap,14px);direction:ltr;width:100%;justify-content:center;align-items:flex-start}
.sb-grid.sb-align-right{justify-content:flex-end}.sb-grid.sb-align-center{justify-content:center}.sb-grid.sb-align-left{justify-content:flex-start}
.sb-item{direction:rtl;text-align:center;box-sizing:border-box;width:var(--sb-item-width,180px);min-width:min(100%,var(--sb-item-width,180px));padding:var(--sb-pad,12px 10px);background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;break-inside:avoid}
.sb-item-title{font-weight:900;font-size:var(--sb-title-size,15px);color:#111827;margin:0 0 5px;line-height:1.45}
.sb-item-name{font-weight:800;font-size:var(--sb-name-size,13px);color:#334155;min-height:16px;line-height:1.45;margin:0}
.sb-item-line{display:none!important}
.sb-size-small{--sb-title-size:13px;--sb-name-size:11.5px;--sb-item-width:150px;--sb-pad:8px 6px;--sb-gap:8px}
.sb-size-normal{--sb-title-size:15px;--sb-name-size:13px;--sb-item-width:180px;--sb-pad:12px 10px;--sb-gap:14px}
.sb-size-large{--sb-title-size:18px;--sb-name-size:15px;--sb-item-width:220px;--sb-pad:16px 12px;--sb-gap:18px}
.sb-stamp{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1e3c72}.sb-stamp svg{width:80px;height:80px}.sb-size-small .sb-stamp svg{width:58px;height:58px}.sb-size-large .sb-stamp svg{width:96px;height:96px}
.sb-empty{text-align:center;color:#94a3b8;font-size:13px;padding:16px}
.sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:99990;align-items:center;justify-content:center}.sb-overlay.open{display:flex}
.sb-dialog{background:#fff;border-radius:18px;padding:24px;width:760px;max-width:95vw;max-height:90vh;overflow-y:auto;direction:rtl;font-family:Tajawal,Arial,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.28)}
.sb-dialog h3{font-size:18px;font-weight:900;color:#1e3c72;margin:0 0 6px;text-align:center}.sb-dialog-sub{font-size:12px;color:#64748b;text-align:center;margin:0 0 16px}
.sb-settings{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:0 0 14px}
.sb-settings label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:900;color:#334155}.sb-settings select,.sb-settings input[type=number]{padding:8px 10px;border:1.5px solid #dbe4ef;border-radius:10px;font-family:inherit;font-weight:800;background:#fff}.sb-check-row{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;margin-top:20px}.sb-check-row input{width:18px;height:18px}
.sb-field-row{display:flex;gap:8px;align-items:center;margin-bottom:10px}.sb-field-row input[type=text],.sb-cert-select{flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-size:13px;direction:rtl}
.sb-del-btn{width:34px;height:34px;border:none;border-radius:8px;background:#fef2f2;color:#dc2626;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-add-btn{width:100%;padding:10px;border:2px dashed #c7d2fe;border-radius:10px;background:#eef2ff;color:#4f46e5;cursor:pointer;font-family:Tajawal,Arial,sans-serif;font-size:13px;font-weight:800;margin:4px 0 16px}
.sb-dialog-footer{display:flex;gap:10px;justify-content:center}.sb-save-btn{padding:10px 30px;border:none;border-radius:12px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer}.sb-cancel-btn{padding:10px 30px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}
.print-signatures.sb-attendance-table-signatures{display:none!important;visibility:hidden;opacity:0;margin:16px 0 0;padding-top:10px;page-break-inside:avoid;break-inside:avoid}.print-signatures.sb-attendance-table-signatures h4{text-align:center;margin:0 0 10px;font-size:13px;font-weight:900;color:#000}
@media print{.sb-bar,.sb-btn,.sb-toggle-row{display:none!important}#sb-container-attendance{display:none!important}.sb-wrap.sb-no-print-sigs,.sb-no-print-sigs-inner,.sb-stamp.sb-no-print-stamp{display:none!important}.print-signatures.sb-attendance-table-signatures{display:block!important;visibility:visible!important;opacity:1!important}.sb-grid{display:flex!important;gap:var(--sb-gap,10px)!important}.sb-item{border:none!important;background:transparent!important;border-radius:0!important;padding:4px!important}.sb-item-title{color:#000!important;margin-bottom:3px!important}.sb-item-name{color:#000!important}.sb-stamp{color:#000!important}.sb-stamp svg{width:60px!important;height:60px!important}.sb-size-small .sb-stamp svg{width:48px!important;height:48px!important}.sb-size-large .sb-stamp svg{width:74px!important;height:74px!important}}
.admin-office-table-enhanced .table-responsive-wrapper,.admin-office-table-enhanced .dept-table-scroll{overflow-x:auto!important;width:100%!important}.admin-office-table-enhanced table{min-width:1150px!important}.tab-action-buttons .zoom-reset-btn,.tab-action-buttons .zoom-fullscreen-btn{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:7px 14px!important;border-radius:8px!important;background:#fff!important;color:#475569!important;border:1.5px solid #e2e8f0!important;font-size:12px!important;font-family:Tajawal,Arial,sans-serif!important;cursor:pointer!important;font-weight:700!important}.department-table.dept-fullscreen{position:fixed!important;inset:0!important;z-index:9998!important;background:#f1f5f9!important;overflow:auto!important;border-radius:0!important;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important}.dept-fullscreen-backdrop{position:fixed!important;inset:0!important;z-index:9997!important;background:rgba(15,36,68,.45)!important}
@media(max-width:720px){.sb-settings{grid-template-columns:1fr}.sb-field-row{flex-direction:column;align-items:stretch}.sb-del-btn{width:100%}}
`;

  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function getToken(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'{}');return s&&s.clerkToken?s.clerkToken:null;}catch{return null;}}
  async function apiFetch(path,opts={}){const token=getToken();const headers={'Content-Type':'application/json',...(opts.headers||{})};if(token)headers.Authorization='Bearer '+token;try{const r=await fetch('/api'+path,{...opts,headers,credentials:'include'});return r.ok?r.json():null;}catch{return null;}}
  function normalizePrefs(prefs){prefs=prefs&&typeof prefs==='object'?prefs:{};return{includeSigs:prefs.includeSigs!==false,includeStamp:prefs.includeStamp!==false,align:['right','center','left'].includes(prefs.align)?prefs.align:'center',size:['small','normal','large'].includes(prefs.size)?prefs.size:'normal',width:Math.max(120,Math.min(320,Number(prefs.width)||180))};}
  function loadPrefs(pageKey){return normalizePrefs((()=>{try{return JSON.parse(localStorage.getItem(PREFS_PFX+pageKey)||'{}');}catch{return{};}})());}
  function savePrefs(pageKey,prefs){const p=normalizePrefs(prefs);localStorage.setItem(PREFS_PFX+pageKey,JSON.stringify(p));if(instances[pageKey])instances[pageKey].prefs=p;return p;}
  function injectCSS(){if(document.getElementById('sb-styles'))return;const el=document.createElement('style');el.id='sb-styles';el.textContent=CSS;document.head.appendChild(el);}

  function readLegacyConsumables(){try{const v=JSON.parse(localStorage.getItem(CONSUMABLES_LEGACY_SIGNATURES_KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:clone(DEFAULT_CONSUMABLES_SIGS);}catch{return clone(DEFAULT_CONSUMABLES_SIGS);}}
  function writeLegacyConsumables(data){consumablesLegacyOverride=data;localStorage.setItem(CONSUMABLES_LEGACY_SIGNATURES_KEY,JSON.stringify(data));renderAll('consumables');apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[CONSUMABLES_LEGACY_SIGNATURES_KEY]:JSON.stringify(data)}})});}
  function consumablesSectionKeyFromElement(el){const id=el.closest('.table-section')?.id||'';if(id==='subcontractors-section')return'subcontractors';if(id==='performance-section')return'performance';if(id==='water-supply-section')return'water';if(id==='sewage-disposal-section')return'sewage';if(id==='summary-section')return'summary';return'consumables';}
  function getLegacyConsumablesSignatures(sectionKey){const all=readLegacyConsumables();const arr=all&&all[sectionKey];return Array.isArray(arr)?arr.map(s=>({title:s.title||'',name:s.name||''})):[];}

  function buildHTML(sigs,showStamp,prefs){const p=normalizePrefs(prefs);if(!Array.isArray(sigs)||sigs.length===0)return`<div class="sb-empty">لا توجد توقيعات — اضغط تعديل التواقيع للإضافة</div>`;const style=`--sb-item-width:${p.width}px`;const items=sigs.map(s=>`<div class="sb-item"><div class="sb-item-title">${esc(s.title)}</div><div class="sb-item-name">${esc(s.name||'')}</div></div>`).join('');const stamp=showStamp!==false?`<div class="sb-item sb-stamp">${STAMP_SVG}</div>`:'';return`<div class="sb-grid sb-align-${p.align} sb-size-${p.size}" style="${style}">${items}${stamp}</div>`;}

  function renderConsumablesSeparated(pageKey){const inst=instances[pageKey];if(!inst)return;const prefs=normalizePrefs(inst.prefs);const includeSigs=prefs.includeSigs!==false;const includeStamp=inst.options.showStamp!==false&&prefs.includeStamp!==false;document.querySelectorAll('[data-sb-page="consumables"]').forEach(el=>{const sectionKey=consumablesSectionKeyFromElement(el);const sigs=getLegacyConsumablesSignatures(sectionKey);el.innerHTML=includeSigs?buildHTML(sigs,includeStamp,prefs):'';el.setAttribute('data-sb-consumables-section',sectionKey);el.classList.toggle('sb-no-print-sigs-inner',!includeSigs);if(el.parentElement)el.parentElement.classList.toggle('sb-no-print-sigs-inner',!includeSigs);});}

  function addDialogRow(fields,title,name){const row=document.createElement('div');row.className='sb-field-row';row.innerHTML=`<input type="text" class="sb-f-title" placeholder="الصفة / المسمى" value="${esc(title||'')}"><input type="text" class="sb-f-name" placeholder="الاسم" value="${esc(name||'')}"><button class="sb-del-btn" type="button" title="حذف">×</button>`;row.querySelector('.sb-del-btn').onclick=()=>row.remove();fields.appendChild(row);}
  function buildSettingsHTML(prefs,options){const p=normalizePrefs(prefs);const stampVisible=options&&options.showStamp!==false;return`<div class="sb-settings"><label>مكان التواقيع<select id="sb-pref-align"><option value="right" ${p.align==='right'?'selected':''}>يمين</option><option value="center" ${p.align==='center'?'selected':''}>وسط</option><option value="left" ${p.align==='left'?'selected':''}>يسار</option></select></label><label>حجم التوقيع<select id="sb-pref-size"><option value="small" ${p.size==='small'?'selected':''}>صغير</option><option value="normal" ${p.size==='normal'?'selected':''}>عادي</option><option value="large" ${p.size==='large'?'selected':''}>كبير</option></select></label><label>عرض خانة التوقيع<input id="sb-pref-width" type="number" min="120" max="320" step="10" value="${p.width}"></label><label class="sb-check-row"><input id="sb-pref-include-sigs" type="checkbox" ${p.includeSigs!==false?'checked':''}> إظهار التواقيع</label>${stampVisible?`<label class="sb-check-row"><input id="sb-pref-include-stamp" type="checkbox" ${p.includeStamp!==false?'checked':''}> إظهار الختم</label>`:''}</div>`;}
  function readSettingsFromDialog(oldPrefs,options){return normalizePrefs({includeSigs:document.getElementById('sb-pref-include-sigs')?.checked!==false,includeStamp:options&&options.showStamp===false?false:document.getElementById('sb-pref-include-stamp')?.checked!==false,align:document.getElementById('sb-pref-align')?.value||oldPrefs.align,size:document.getElementById('sb-pref-size')?.value||oldPrefs.size,width:Number(document.getElementById('sb-pref-width')?.value)||oldPrefs.width});}
  function buildDialogDOM(){if(document.getElementById('sb-overlay'))return;const ov=document.createElement('div');ov.id='sb-overlay';ov.className='sb-overlay';ov.innerHTML=`<div class="sb-dialog"><h3 id="sb-dialog-title">تعديل التواقيع</h3><p class="sb-dialog-sub" id="sb-dialog-sub">أضف أو عدّل التواقيع وتحكم في مكانها وحجمها</p><div id="sb-extra"></div><div id="sb-fields"></div><button class="sb-add-btn" id="sb-add-btn" type="button">إضافة توقيع جديد</button><div class="sb-dialog-footer"><button class="sb-save-btn" id="sb-save-btn" type="button">حفظ</button><button class="sb-cancel-btn" id="sb-cancel-btn" type="button">إلغاء</button></div></div>`;document.body.appendChild(ov);ov.onclick=e=>{if(e.target===ov)closeDialog();};document.getElementById('sb-add-btn').onclick=()=>addDialogRow(document.getElementById('sb-fields'));document.getElementById('sb-cancel-btn').onclick=closeDialog;}
  function closeDialog(){const ov=document.getElementById('sb-overlay');if(ov)ov.classList.remove('open');document.body.style.overflow='';activeKey=null;}

  function openConsumablesDialog(){injectCSS();buildDialogDOM();let selected='subcontractors';let data=readLegacyConsumables();const extra=document.getElementById('sb-extra');const fields=document.getElementById('sb-fields');const prefs=instances.consumables?.prefs||loadPrefs('consumables');document.getElementById('sb-dialog-title').textContent='تعديل تواقيع المستهلكات';document.getElementById('sb-dialog-sub').textContent='كل شهادة مستقلة، والشكل العام يطبق على تواقيع المستهلكات';extra.innerHTML=`<select id="sb-consumables-cert" class="sb-cert-select" style="width:100%;margin-bottom:14px">${Object.entries(CONSUMABLES_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>${buildSettingsHTML(prefs,instances.consumables?.options||{showStamp:true})}`;function renderForm(){fields.innerHTML='';const arr=Array.isArray(data[selected])?data[selected]:[];if(!arr.length)addDialogRow(fields);else arr.forEach(s=>addDialogRow(fields,s.title,s.name));}function collect(){const arr=[];fields.querySelectorAll('.sb-field-row').forEach(row=>{const title=row.querySelector('.sb-f-title')?.value.trim()||'';const name=row.querySelector('.sb-f-name')?.value.trim()||'';if(title)arr.push({title,name});});data[selected]=arr;}document.getElementById('sb-consumables-cert').onchange=e=>{collect();selected=e.target.value;renderForm();};document.getElementById('sb-add-btn').onclick=()=>addDialogRow(fields);document.getElementById('sb-save-btn').onclick=async()=>{collect();const p=savePrefs('consumables',readSettingsFromDialog(prefs,instances.consumables?.options||{showStamp:true}));writeLegacyConsumables(data);closeDialog();await apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[PREFS_PFX+'consumables']:JSON.stringify(p)}})});};renderForm();document.getElementById('sb-overlay').classList.add('open');document.body.style.overflow='hidden';}

  function getAdminOfficeNames(){try{if(typeof global.getCenterNames==='function')return global.getCenterNames();}catch{}try{return JSON.parse(localStorage.getItem('adminOfficeNames_v1')||'{}');}catch{return{};}}
  function detectAdminOfficeCenterKey(){try{if(global.activeCenterKeyForManagement)return global.activeCenterKeyForManagement;}catch{}const visible=Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});if(visible?.id)return visible.id.replace('table-div-','');const selected=document.getElementById('admin-office-load-center')?.value||document.getElementById('center-select-import')?.value;if(selected)return selected;return null;}
  function isAdminOfficesPage(){return /admin_offices_(attendance|consumables)\.html/.test(location.href)||!!document.getElementById('sb-container-admin_offices');}
  function resolveKey(pageKey){if(pageKey!=='admin_offices'||!isAdminOfficesPage())return pageKey;const centerKey=detectAdminOfficeCenterKey();return centerKey?'admin_offices_'+centerKey:pageKey;}
  function labelForKey(pageKey){if(!pageKey||!pageKey.startsWith('admin_offices_'))return'';const centerKey=pageKey.replace('admin_offices_','');return getAdminOfficeNames()[centerKey]||centerKey;}

  function ensureAttendanceSignatureContainers(){const tables=Array.from(document.querySelectorAll('.department-table')).filter(section=>section.querySelector('table[id$="-table"]'));tables.forEach(section=>{section.querySelectorAll('.print-signatures').forEach(el=>el.remove());});tables.forEach(section=>{const table=section.querySelector('table[id$="-table"]');if(!table)return;const block=document.createElement('div');block.className='print-signatures sb-attendance-table-signatures';block.innerHTML=`<h4>التواقيع</h4><div class="print-signatures-grid" data-sb-page="attendance" data-sb-table="${esc(table.id)}"></div>`;section.appendChild(block);});}
  function applyPrintClasses(pageKey){const inst=instances[pageKey];const prefs=normalizePrefs(inst?.prefs||{});const includeSigs=prefs.includeSigs!==false;document.querySelectorAll('[data-sb-page="'+pageKey+'"], #sb-container-'+pageKey).forEach(el=>{if(el){el.classList.toggle('sb-no-print-sigs-inner',!includeSigs);if(el.parentElement)el.parentElement.classList.toggle('sb-no-print-sigs-inner',!includeSigs);}});}
  function renderAll(pageKey){const inst=instances[pageKey];if(!inst)return;if(pageKey==='attendance')ensureAttendanceSignatureContainers();if(pageKey==='consumables'){renderConsumablesSeparated(pageKey);return;}const prefs=normalizePrefs(inst.prefs||{});const html=prefs.includeSigs===false?'':buildHTML(inst.sigs,inst.options.showStamp!==false&&prefs.includeStamp!==false,prefs);const main=document.getElementById('sb-container-'+pageKey)||(pageKey.startsWith('admin_offices_')?document.getElementById('sb-container-admin_offices'):null);if(main)main.innerHTML=html;document.querySelectorAll('[data-sb-page="'+pageKey+'"]').forEach(el=>{el.innerHTML=html;});setTimeout(()=>applyPrintClasses(pageKey),0);}

  function installPrintHooks(){if(printHooksInstalled)return;printHooksInstalled=true;global.addEventListener('beforeprint',()=>Object.keys(instances).forEach(k=>renderAll(k)));}
  function installStorageHook(){if(storageHookInstalled)return;storageHookInstalled=true;const originalSetItem=localStorage.setItem.bind(localStorage);localStorage.setItem=function(key,value){if(key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&consumablesLegacyOverride){value=JSON.stringify(consumablesLegacyOverride);}originalSetItem(key,value);if(key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&instances.consumables){setTimeout(()=>renderAll('consumables'),0);}if(key&&String(key).startsWith(PREFIX)&&instances[String(key).replace(PREFIX,'')]){setTimeout(()=>renderAll(String(key).replace(PREFIX,'')),0);}if(key&&String(key).startsWith(PREFS_PFX)&&instances[String(key).replace(PREFS_PFX,'')]){instances[String(key).replace(PREFS_PFX,'')].prefs=loadPrefs(String(key).replace(PREFS_PFX,''));setTimeout(()=>renderAll(String(key).replace(PREFS_PFX,'')),0);}};global.addEventListener('storage',e=>{if(e.key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&instances.consumables)renderAll('consumables');});}
  async function pullCloud(pageKey){const data=await apiFetch('/hospital-storage');if(!data?.data||!instances[pageKey])return;const raw=data.data[PREFIX+pageKey];if(raw){try{const sigs=JSON.parse(raw);instances[pageKey].sigs=Array.isArray(sigs)?sigs:[];localStorage.setItem(PREFIX+pageKey,JSON.stringify(instances[pageKey].sigs));}catch{}}const rawPrefs=data.data[PREFS_PFX+pageKey];if(rawPrefs){try{const prefs=normalizePrefs(JSON.parse(rawPrefs));instances[pageKey].prefs=prefs;localStorage.setItem(PREFS_PFX+pageKey,JSON.stringify(prefs));}catch{}}renderAll(pageKey);}

  function enhanceAdminOfficeTables(){if(!/admin_offices_attendance\.html/.test(location.href))return;injectCSS();document.querySelectorAll('[id^="table-div-"]').forEach(section=>{section.classList.add('admin-office-table-enhanced');const table=section.querySelector('table[id^="table-"]');if(!table||!table.id)return;const wrapper=table.closest('.table-responsive-wrapper')||table.parentElement;if(wrapper)wrapper.classList.add('dept-table-scroll');const bar=section.querySelector('.tab-action-buttons');if(!bar)return;if(!bar.querySelector('.zoom-reset-btn')){const btn=document.createElement('button');btn.type='button';btn.className='zoom-reset-btn';btn.innerHTML='<i class="fas fa-compress-arrows-alt"></i> إعادة الحجم';btn.onclick=()=>global.resetAdminOfficeTableZoom(table.id);bar.appendChild(btn);}if(!bar.querySelector('.zoom-fullscreen-btn')){const btn=document.createElement('button');btn.type='button';btn.className='zoom-fullscreen-btn';btn.innerHTML='<i class="fas fa-expand"></i> عرض كامل';btn.onclick=()=>global.toggleAdminOfficeTableFullscreen(table.id,btn);bar.appendChild(btn);}});}
  function scheduleEnhanceAdminOfficeTables(){if(enhanceScheduled)return;enhanceScheduled=true;setTimeout(()=>{enhanceScheduled=false;enhanceAdminOfficeTables();},120);}
  global.resetAdminOfficeTableZoom=function(tableId){const table=document.getElementById(tableId);if(!table)return;table.style.zoom='1';try{localStorage.setItem('tableZoom_'+tableId.replace('table-',''),'1');}catch{}};
  global.toggleAdminOfficeTableFullscreen=function(tableId,btn){const table=document.getElementById(tableId);const section=table?.closest('.department-table');if(!section)return;let backdrop=document.getElementById('dept-fullscreen-backdrop');const active=section.classList.toggle('dept-fullscreen');if(active){if(!backdrop){backdrop=document.createElement('div');backdrop.id='dept-fullscreen-backdrop';backdrop.className='dept-fullscreen-backdrop';backdrop.onclick=()=>global.toggleAdminOfficeTableFullscreen(tableId,btn);document.body.appendChild(backdrop);}document.body.style.overflow='hidden';if(btn)btn.innerHTML='<i class="fas fa-compress"></i> خروج';}else{if(backdrop)backdrop.remove();document.body.style.overflow='';if(btn)btn.innerHTML='<i class="fas fa-expand"></i> عرض كامل';}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const fs=document.querySelector('.department-table.dept-fullscreen table[id^="table-"]');if(fs)global.toggleAdminOfficeTableFullscreen(fs.id);}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEnhanceAdminOfficeTables);else scheduleEnhanceAdminOfficeTables();
  const mo=new MutationObserver(scheduleEnhanceAdminOfficeTables);if(document.body)mo.observe(document.body,{childList:true,subtree:true});else document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{childList:true,subtree:true}));

  function ensureInstance(pageKey,options={}){const key=resolveKey(pageKey);if(instances[key])return key;let sigs=[];try{sigs=JSON.parse(localStorage.getItem(PREFIX+key)||'[]');}catch{}const prefs=loadPrefs(key);instances[key]={sigs:Array.isArray(sigs)?sigs:[],options:options||{},prefs};injectCSS();buildDialogDOM();installPrintHooks();installStorageHook();renderAll(key);pullCloud(key);return key;}
  function openGenericDialog(pageKey){if(!pageKey||!instances[pageKey])return;activeKey=pageKey;const inst=instances[pageKey];const fields=document.getElementById('sb-fields');const extra=document.getElementById('sb-extra');extra.innerHTML=buildSettingsHTML(inst.prefs||{},inst.options||{});fields.innerHTML='';document.getElementById('sb-dialog-title').textContent=labelForKey(pageKey)?'تعديل تواقيع: '+labelForKey(pageKey):'تعديل التواقيع';document.getElementById('sb-dialog-sub').textContent='اضبط مكان وحجم التوقيع ثم أضف الصفة والاسم';const sigs=instances[pageKey].sigs||[];if(!sigs.length)addDialogRow(fields);else sigs.forEach(s=>addDialogRow(fields,s.title,s.name));document.getElementById('sb-add-btn').onclick=()=>addDialogRow(fields);document.getElementById('sb-save-btn').onclick=async()=>{const arr=[];fields.querySelectorAll('.sb-field-row').forEach(row=>{const title=row.querySelector('.sb-f-title')?.value.trim()||'';const name=row.querySelector('.sb-f-name')?.value.trim()||'';if(title)arr.push({title,name});});const prefs=savePrefs(pageKey,readSettingsFromDialog(inst.prefs||{},inst.options||{}));instances[pageKey].sigs=arr;localStorage.setItem(PREFIX+pageKey,JSON.stringify(arr));renderAll(pageKey);closeDialog();await apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[PREFIX+pageKey]:JSON.stringify(arr),[PREFS_PFX+pageKey]:JSON.stringify(prefs)}})});};document.getElementById('sb-overlay').classList.add('open');document.body.style.overflow='hidden';}

  const SB={
    init(pageKey,options={}){instances[pageKey]={sigs:[],options,prefs:loadPrefs(pageKey)};try{const sigs=JSON.parse(localStorage.getItem(PREFIX+pageKey)||'[]');instances[pageKey].sigs=Array.isArray(sigs)?sigs:[];}catch{}const setup=()=>{injectCSS();buildDialogDOM();installPrintHooks();installStorageHook();renderAll(pageKey);pullCloud(pageKey);scheduleEnhanceAdminOfficeTables();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();},
    open(pageKey){if(pageKey==='consumables'){ensureInstance('consumables',instances.consumables?.options||{showStamp:true});openConsumablesDialog();return;}const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});openGenericDialog(key);},
    getSigs(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});return (instances[key]?.sigs||[]).slice();},
    getSig(pageKey,index){const sigs=this.getSigs(pageKey);return index<0||index>=sigs.length?null:sigs[index];},
    getPrefs(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});return normalizePrefs(instances[key]?.prefs||{});},
    buildPrintHTML(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});const inst=instances[key];const prefs=normalizePrefs(inst?.prefs||{});if(prefs.includeSigs===false)return'';return buildHTML(inst.sigs,inst.options.showStamp!==false&&prefs.includeStamp!==false,prefs);},
    rerender(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});renderAll(key);scheduleEnhanceAdminOfficeTables();}
  };

  global.SignatureBlock=SB;
})(window);
