/**
 * signature-block.js — نظام التواقيع الموحد V3
 * يحافظ على مفاتيح التواقيع القديمة، ويضيف تنسيقًا تفصيليًا مستقلًا لتواقيع جداول المستهلكات داخل وضع الطباعة فقط.
 */
(function (global) {
  'use strict';

  const PREFIX = 'sb_sigs_';
  const PREFS_PFX = 'sb_prefs_';
  const SESSION_KEY = 'najran_session';
  const CONSUMABLES_LEGACY_SIGNATURES_KEY = 'signatures_data_consumables_v27';
  const CONSUMABLES_STYLE_KEY = 'sb_style_prefs_consumables_v1';
  const nativePrint = window.print.bind(window);

  const instances = {};
  let activeKey = null;
  let printHooksInstalled = false;
  let storageHookInstalled = false;
  let consumablesLegacyOverride = null;
  let enhanceScheduled = false;
  let consumablesPrintInterceptorInstalled = false;
  let consumablesStyleDraft = null;

  const STAMP_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/><circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-size="17" fill="currentColor" font-weight="bold">ختم</text></svg>';

  const CONSUMABLES_LABELS = {
    subcontractors: 'شهادة عقود الباطن',
    performance: 'جدول أداء المستهلكات',
    water: 'شهادة توريد المياه',
    sewage: 'شهادة التخلص من الصرف الصحي',
    summary: 'شهادة الاستحقاق الشهري (الملخص)'
  };

  const CONSUMABLES_SECTION_IDS = {
    subcontractors: 'subcontractors-section',
    performance: 'performance-section',
    water: 'water-supply-section',
    sewage: 'sewage-disposal-section',
    summary: 'summary-section'
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

  const CSS = [
    '.sb-wrap{margin:20px 0 0}',
    '.sb-grid{display:flex;flex-wrap:wrap;gap:var(--sb-gap,14px);direction:ltr;width:100%;justify-content:center;align-items:flex-start}',
    '.sb-grid.sb-align-right{justify-content:flex-end}.sb-grid.sb-align-center{justify-content:center}.sb-grid.sb-align-left{justify-content:flex-start}',
    '.sb-item{direction:rtl;text-align:center;box-sizing:border-box;width:var(--sb-item-width,180px);min-width:min(100%,var(--sb-item-width,180px));padding:var(--sb-pad,12px 10px);background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;break-inside:avoid}',
    '.sb-item-title{font-weight:900;font-size:var(--sb-title-size,15px);color:#111827;margin:0 0 5px;line-height:1.45}',
    '.sb-item-name{font-weight:800;font-size:var(--sb-name-size,13px);color:#334155;min-height:16px;line-height:1.45;margin:0}',
    '.sb-item-line{display:none!important}',
    '.sb-size-small{--sb-title-size:13px;--sb-name-size:11.5px;--sb-item-width:150px;--sb-pad:8px 6px;--sb-gap:8px}',
    '.sb-size-normal{--sb-title-size:15px;--sb-name-size:13px;--sb-item-width:180px;--sb-pad:12px 10px;--sb-gap:14px}',
    '.sb-size-large{--sb-title-size:18px;--sb-name-size:15px;--sb-item-width:220px;--sb-pad:16px 12px;--sb-gap:18px}',
    '.sb-stamp{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1e3c72}.sb-stamp svg{width:80px;height:80px}.sb-size-small .sb-stamp svg{width:58px;height:58px}.sb-size-large .sb-stamp svg{width:96px;height:96px}',
    '.sb-empty{text-align:center;color:#94a3b8;font-size:13px;padding:16px}',
    '.sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:99990;align-items:center;justify-content:center}.sb-overlay.open{display:flex}',
    '.sb-dialog{background:#fff;border-radius:18px;padding:24px;width:760px;max-width:95vw;max-height:90vh;overflow-y:auto;direction:rtl;font-family:Tajawal,Arial,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.28)}',
    '.sb-dialog h3{font-size:18px;font-weight:900;color:#1e3c72;margin:0 0 6px;text-align:center}.sb-dialog-sub{font-size:12px;color:#64748b;text-align:center;margin:0 0 16px}',
    '.sb-settings{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:0 0 14px}',
    '.sb-settings label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:900;color:#334155}.sb-settings select,.sb-settings input[type=number]{padding:8px 10px;border:1.5px solid #dbe4ef;border-radius:10px;font-family:inherit;font-weight:800;background:#fff}.sb-check-row{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;margin-top:20px}.sb-check-row input{width:18px;height:18px}',
    '.sb-field-row{display:flex;gap:8px;align-items:center;margin-bottom:10px}.sb-field-row input[type=text],.sb-cert-select{flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-size:13px;direction:rtl}',
    '.sb-del-btn{width:34px;height:34px;border:none;border-radius:8px;background:#fef2f2;color:#dc2626;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.sb-add-btn{width:100%;padding:10px;border:2px dashed #c7d2fe;border-radius:10px;background:#eef2ff;color:#4f46e5;cursor:pointer;font-family:Tajawal,Arial,sans-serif;font-size:13px;font-weight:800;margin:4px 0 16px}',
    '.sb-dialog-footer{display:flex;gap:10px;justify-content:center}.sb-save-btn{padding:10px 30px;border:none;border-radius:12px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer}.sb-cancel-btn{padding:10px 30px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}',
    '.print-signatures.sb-attendance-table-signatures{display:none!important;visibility:hidden;opacity:0;margin:16px 0 0;padding-top:10px;page-break-inside:avoid;break-inside:avoid}.print-signatures.sb-attendance-table-signatures h4{text-align:center;margin:0 0 10px;font-size:13px;font-weight:900;color:#000}',
'.sb-consumables-signature-wrap{margin:min(var(--sb-block-top,18px),8px) 0 0!important;transform:translateY(var(--sb-block-y,0px));break-before:avoid!important;page-break-before:avoid!important;break-inside:avoid!important;page-break-inside:avoid!important;display:block!important;clear:both!important}',    '.sb-consumables-grid{direction:rtl!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--sb-card-width,180px)),var(--sb-card-width,180px)))!important;justify-content:center!important;align-items:stretch!important;gap:var(--sb-gap,14px)!important;width:100%!important;break-inside:avoid!important;page-break-inside:avoid!important}',
    '.sb-consumables-grid.sb-cols-2{grid-template-columns:repeat(2,minmax(0,var(--sb-card-width,180px)))!important}.sb-consumables-grid.sb-cols-3{grid-template-columns:repeat(3,minmax(0,var(--sb-card-width,180px)))!important}.sb-consumables-grid.sb-cols-4{grid-template-columns:repeat(4,minmax(0,var(--sb-card-width,180px)))!important}',
    '.sb-consumables-grid.sb-align-right{justify-content:flex-start!important}.sb-consumables-grid.sb-align-center{justify-content:center!important}.sb-consumables-grid.sb-align-left{justify-content:flex-end!important}',
'.sb-consumables-card{min-height:var(--sb-card-height,82px)!important;width:var(--sb-card-width,180px)!important;min-width:0!important;background:var(--sb-card-background,#fff)!important;border:var(--sb-card-border-width,1px) solid var(--sb-card-border-color,#cbd5e1)!important;border-radius:var(--sb-card-border-radius,12px)!important;padding:var(--sb-card-padding,10px)!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;break-before:avoid!important;page-break-before:avoid!important;break-inside:avoid!important;page-break-inside:avoid!important;transform:translate(var(--sb-x,0px),var(--sb-y,0px))!important}',    '.sb-consumables-card .sb-item-title{font-size:var(--sb-title-font,15px)!important;font-weight:var(--sb-title-weight,900)!important;line-height:1.35!important;letter-spacing:var(--sb-letter-spacing,0px)!important;margin:0 0 var(--sb-title-name-gap,6px)!important;color:#111827!important;text-align:var(--sb-text-align,center)!important}',
    '.sb-consumables-card .sb-item-name{font-size:var(--sb-name-font,13px)!important;font-weight:var(--sb-name-weight,800)!important;line-height:var(--sb-name-line-height,1.45)!important;letter-spacing:var(--sb-letter-spacing,0px)!important;margin:0!important;color:#111827!important;text-align:var(--sb-text-align,center)!important;min-height:0!important}',
    '.sb-consumables-card .sb-item-line{display:var(--sb-line-display,none)!important;width:var(--sb-line-length,120px)!important;max-width:100%!important;height:0!important;border-top:1.4px solid #111827!important;margin:0 auto var(--sb-line-name-gap,4px)!important}',
    '.sb-consumables-stamp{color:#1e3c72!important;min-height:calc(var(--sb-stamp-size,70px) + 18px)!important;margin-inline:var(--sb-stamp-gap,8px)!important}.sb-consumables-stamp svg{width:var(--sb-stamp-size,70px)!important;height:var(--sb-stamp-size,70px)!important;max-width:100%!important;max-height:90px!important}.sb-stamp-pos-right{order:-10!important}.sb-stamp-pos-center{order:50!important}.sb-stamp-pos-left{order:999!important}',
    '#sb-consumables-print-style-toggle{display:none;position:fixed;left:18px;top:18px;z-index:999991;border:none;border-radius:999px;background:#0f766e;color:#fff;padding:10px 16px;font-family:Tajawal,Arial,sans-serif;font-weight:900;font-size:13px;box-shadow:0 8px 22px rgba(15,118,110,.32);cursor:pointer}',
    '#sb-consumables-print-style-panel{display:none;position:fixed;left:18px;top:66px;z-index:999992;width:470px;max-width:calc(100vw - 22px);max-height:82vh;background:#fff;border:2px solid #0f766e;border-radius:14px;box-shadow:0 14px 38px rgba(15,23,42,.32);direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#0f172a;overflow:auto}',
    'body.sb-consumables-print-preview #sb-consumables-print-style-toggle{display:block}',
    'body.sb-consumables-print-preview #sb-consumables-print-style-panel.open{display:block}',
    '#sb-consumables-print-style-panel.collapsed .sbcp-body{display:none}#sb-consumables-print-style-panel .sbcp-head{display:flex;align-items:center;gap:6px;padding:9px 10px;background:#ecfdf5;border-bottom:1px solid #99f6e4;cursor:move;user-select:none}#sb-consumables-print-style-panel .sbcp-head b{flex:1;font-size:13px;color:#0f766e}',
    '#sb-consumables-print-style-panel button{font-family:inherit;font-weight:900;cursor:pointer;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;padding:6px 8px;font-size:11px}#sb-consumables-print-style-panel button.active{background:#0f766e;color:#fff;border-color:#0f766e}',
    '.sbcp-body{padding:10px}.sbcp-tools,.sbcp-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.sbcp-group{border:1px dashed #cbd5e1;border-radius:10px;padding:8px;margin:8px 0;background:#fff}.sbcp-group>strong{display:block;font-size:12px;color:#334155;margin-bottom:6px}.sbcp-row{display:grid;grid-template-columns:138px 1fr 56px;align-items:center;gap:8px;margin:5px 0;font-size:12px;color:#475569}.sbcp-row input[type=range]{width:100%}.sbcp-row span{font-weight:900;color:#0f766e;text-align:left}.sbcp-select{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-weight:800}.sbcp-check{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#475569;margin:6px 0}.sbcp-final{background:#166534!important;color:#fff!important;border-color:#166534!important}.sbcp-save{background:#0f766e!important;color:#fff!important;border-color:#0f766e!important}.sbcp-reset{background:#fef2f2!important;color:#991b1b!important;border-color:#fecaca!important}',
    '.admin-office-table-enhanced .table-responsive-wrapper,.admin-office-table-enhanced .dept-table-scroll{overflow-x:auto!important;width:100%!important}.admin-office-table-enhanced table{min-width:1150px!important}.tab-action-buttons .zoom-reset-btn,.tab-action-buttons .zoom-fullscreen-btn{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:7px 14px!important;border-radius:8px!important;background:#fff!important;color:#475569!important;border:1.5px solid #e2e8f0!important;font-size:12px!important;font-family:Tajawal,Arial,sans-serif!important;cursor:pointer!important;font-weight:700!important}.department-table.dept-fullscreen{position:fixed!important;inset:0!important;z-index:9998!important;background:#f1f5f9!important;overflow:auto!important;border-radius:0!important;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important}.dept-fullscreen-backdrop{position:fixed!important;inset:0!important;z-index:9997!important;background:rgba(15,36,68,.45)!important}',
    '@media(max-width:720px){.sb-settings{grid-template-columns:1fr}.sb-field-row{flex-direction:column;align-items:stretch}.sb-del-btn{width:100%}#sb-consumables-print-style-panel{left:8px!important;top:58px!important;width:calc(100vw - 16px)!important}.sbcp-row{grid-template-columns:122px 1fr 50px}}',
    '@media print{.sb-bar,.sb-btn,.sb-toggle-row,#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel{display:none!important}#sb-container-attendance{display:none!important}.sb-wrap.sb-no-print-sigs,.sb-no-print-sigs-inner,.sb-stamp.sb-no-print-stamp{display:none!important}.print-signatures.sb-attendance-table-signatures{display:block!important;visibility:visible!important;opacity:1!important}.sb-grid{display:flex!important;gap:var(--sb-gap,10px)!important}.sb-item{border:none!important;background:transparent!important;border-radius:0!important;padding:4px!important}.sb-item-title{color:#000!important;margin-bottom:3px!important}.sb-item-name{color:#000!important}.sb-stamp{color:#000!important}.sb-stamp svg{width:60px!important;height:60px!important}.sb-size-small .sb-stamp svg{width:48px!important;height:48px!important}.sb-size-large .sb-stamp svg{width:74px!important}.sb-consumables-signature-wrap{margin-top:min(var(--sb-block-top,12px),8px)!important;break-before:avoid!important;page-break-before:avoid!important;break-inside:avoid!important;page-break-inside:avoid!important}.sb-consumables-grid{display:grid!important;gap:var(--sb-gap,10px)!important;break-inside:avoid!important;page-break-inside:avoid!important}.sb-consumables-card{background:var(--sb-card-background,transparent)!important;border:var(--sb-card-border-width,0px) solid var(--sb-card-border-color,#111827)!important;border-radius:var(--sb-card-border-radius,0px)!important;padding:min(var(--sb-card-padding,6px),5px)!important;min-height:min(var(--sb-card-height,82px),68px)!important;break-before:avoid!important;page-break-before:avoid!important;break-inside:avoid!important;page-break-inside:avoid!important}.sb-consumables-card .sb-item-title,.sb-consumables-card .sb-item-name{color:#000!important}.sb-consumables-stamp{color:#000!important}.sb-consumables-stamp svg{max-width:58px!important;max-height:58px!important}}'
  ].join('\n');

  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function clamp(n,min,max,fallback){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function getToken(){
  try{
    const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'{}');
    if(!s||!s.clerkToken)return null;
    if(s.timestamp&&Date.now()-Number(s.timestamp)>7.5*60*60*1000)return null;
    return s.clerkToken;
  }catch{
    return null;
  }
}

async function apiFetch(path,opts={}){
  const token=getToken();
  const headers={'Content-Type':'application/json',...(opts.headers||{})};
  if(token)headers.Authorization='Bearer '+token;
  try{
    const r=await fetch('/api'+path,{...opts,headers,credentials:'include'});
    if(r.status===401){
      console.warn('[SignatureBlock] API 401 unauthorized:',path);
      return null;
    }
    return r.ok?r.json():null;
  }catch{
    return null;
  }
}

async function apiFetchStatus(path,opts={}){
  const token=getToken();
  if(!token)return{ok:false,status:0,reason:'NO_VALID_TOKEN'};
  const headers={'Content-Type':'application/json',...(opts.headers||{}),Authorization:'Bearer '+token};
  try{
    const r=await fetch('/api'+path,{...opts,headers,credentials:'include'});
    if(r.status===401)return{ok:false,status:401,reason:'UNAUTHORIZED'};
    if(!r.ok)return{ok:false,status:r.status,reason:'HTTP_'+r.status};
    return{ok:true,status:r.status,data:await r.json().catch(()=>null)};
  }catch{
    return{ok:false,status:0,reason:'FETCH_FAILED'};
  }
}
  function normalizePrefs(prefs){prefs=prefs&&typeof prefs==='object'?prefs:{};return{includeSigs:prefs.includeSigs!==false,includeStamp:prefs.includeStamp!==false,align:['right','center','left'].includes(prefs.align)?prefs.align:'center',size:['small','normal','large'].includes(prefs.size)?prefs.size:'normal',width:Math.max(120,Math.min(320,Number(prefs.width)||180))};}
  function loadPrefs(pageKey){return normalizePrefs((()=>{try{return JSON.parse(localStorage.getItem(PREFS_PFX+pageKey)||'{}');}catch{return{};}})());}
  function savePrefs(pageKey,prefs){const p=normalizePrefs(prefs);localStorage.setItem(PREFS_PFX+pageKey,JSON.stringify(p));if(instances[pageKey])instances[pageKey].prefs=p;return p;}
  function injectCSS(){if(document.getElementById('sb-styles'))return;const el=document.createElement('style');el.id='sb-styles';el.textContent=CSS;document.head.appendChild(el);}

  function defaultDetailedStyle(){
    return { version:1,styleApproved:false,savedAt:null,titleFontSize:15,nameFontSize:13,titleWeight:900,nameWeight:800,titleNameGap:6,nameLineHeight:1.45,letterSpacing:0,textAlign:'center',blockY:0,blockTop:18,gap:14,perRow:'auto',cardWidth:180,cardHeight:82,cardBorderVisible:true,cardBorderWidth:1,cardBorderRadius:12,cardBorderColor:'default',cardBackground:'white',cardPadding:10,textOnly:false,showLine:false,lineLength:120,lineNameGap:4,showStamp:true,stampSize:70,stampPosition:'center',stampGap:8,panelLeft:18,panelTop:66,panelCollapsed:false,perSignature:[] };
  }
  function normalizePerSig(x){x=x&&typeof x==='object'?x:{};return{x:clamp(x.x,-180,180,0),y:clamp(x.y,-160,220,0),textAlign:['right','center','left'].includes(x.textAlign)?x.textAlign:null};}
  function normalizeDetailedStyle(s){const d=defaultDetailedStyle();s=s&&typeof s==='object'?s:{};d.styleApproved=s.styleApproved===true;d.savedAt=typeof s.savedAt==='string'?s.savedAt:null;d.titleFontSize=clamp(s.titleFontSize,6,44,d.titleFontSize);d.nameFontSize=clamp(s.nameFontSize,6,44,d.nameFontSize);d.titleWeight=clamp(s.titleWeight,100,900,d.titleWeight);d.nameWeight=clamp(s.nameWeight,100,900,d.nameWeight);d.titleNameGap=clamp(s.titleNameGap,-40,140,d.titleNameGap);d.nameLineHeight=clamp(s.nameLineHeight,.8,3,d.nameLineHeight);d.letterSpacing=clamp(s.letterSpacing,-2,8,d.letterSpacing);d.textAlign=['right','center','left'].includes(s.textAlign)?s.textAlign:d.textAlign;d.blockY=clamp(s.blockY,-180,280,d.blockY);d.blockTop=clamp(s.blockTop,0,100,d.blockTop);d.gap=clamp(s.gap,0,120,d.gap);d.perRow=['auto','2','3','4'].includes(String(s.perRow))?String(s.perRow):d.perRow;d.cardWidth=clamp(s.cardWidth,120,340,d.cardWidth);d.cardHeight=clamp(s.cardHeight,48,180,d.cardHeight);d.cardBorderVisible=s.cardBorderVisible!==false;d.cardBorderWidth=clamp(s.cardBorderWidth,0,3,d.cardBorderWidth);d.cardBorderRadius=clamp(s.cardBorderRadius,0,20,d.cardBorderRadius);d.cardBorderColor=['default','black','gray','navy'].includes(s.cardBorderColor)?s.cardBorderColor:d.cardBorderColor;d.cardBackground=['transparent','white','lightgray'].includes(s.cardBackground)?s.cardBackground:d.cardBackground;d.cardPadding=clamp(s.cardPadding,0,30,d.cardPadding);d.textOnly=s.textOnly===true;d.showLine=s.showLine===true;d.lineLength=clamp(s.lineLength,20,320,d.lineLength);d.lineNameGap=clamp(s.lineNameGap,-30,80,d.lineNameGap);d.showStamp=s.showStamp!==false;d.stampSize=clamp(s.stampSize,32,130,d.stampSize);d.stampPosition=['right','center','left'].includes(s.stampPosition)?s.stampPosition:d.stampPosition;d.stampGap=clamp(s.stampGap,0,80,d.stampGap);d.panelLeft=clamp(s.panelLeft,4,1400,d.panelLeft);d.panelTop=clamp(s.panelTop,4,1000,d.panelTop);d.panelCollapsed=s.panelCollapsed===true;d.perSignature=Array.isArray(s.perSignature)?s.perSignature.map(normalizePerSig):[];return d;}
  function readDetailedStyle(){try{return normalizeDetailedStyle(JSON.parse(localStorage.getItem(CONSUMABLES_STYLE_KEY)||'{}'));}catch{return defaultDetailedStyle();}}
  function writeDetailedStyle(s){localStorage.setItem(CONSUMABLES_STYLE_KEY,JSON.stringify(normalizeDetailedStyle(s)));}
  function detailedStyleStamp(s){const t=s&&typeof s.savedAt==='string'?Date.parse(s.savedAt):NaN;return Number.isFinite(t)?t:0;}
  function syncConsumablesStyleToCloud(){try{const raw=loasync function syncConsumablesStyleToCloud(){
  try{
    const raw=localStorage.getItem(CONSUMABLES_STYLE_KEY);
    if(!raw)return{ok:false,reason:'NO_LOCAL_STYLE'};
    return await apiFetchStatus('/hospital-storage',{
      method:'PUT',
      body:JSON.stringify({data:{[CONSUMABLES_STYLE_KEY]:raw}})
    });
  }catch{
    return{ok:false,reason:'SYNC_EXCEPTION'};
  }
}calStorage.getItem(CONSUMABLES_STYLE_KEY);if(!raw)return;apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[CONSUMABLES_STYLE_KEY]:raw}})});}catch{}}
  function cardBorderColorValue(v){if(v==='black')return'#111827';if(v==='gray')return'#94a3b8';if(v==='navy')return'#1e3c72';return'#cbd5e1';}
  function cardBackgroundValue(v){if(v==='transparent')return'transparent';if(v==='lightgray')return'#f8fafc';return'#fff';}

  function readLegacyConsumables(){try{const v=JSON.parse(localStorage.getItem(CONSUMABLES_LEGACY_SIGNATURES_KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:clone(DEFAULT_CONSUMABLES_SIGS);}catch{return clone(DEFAULT_CONSUMABLES_SIGS);}}
  function writeLegacyConsumables(data){consumablesLegacyOverride=data;localStorage.setItem(CONSUMABLES_LEGACY_SIGNATURES_KEY,JSON.stringify(data));renderAll('consumables');apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[CONSUMABLES_LEGACY_SIGNATURES_KEY]:JSON.stringify(data)}})});}
  function consumablesSectionKeyFromElement(el){const id=el.closest('.table-section')?.id||'';if(id==='subcontractors-section')return'subcontractors';if(id==='performance-section')return'performance';if(id==='water-supply-section')return'water';if(id==='sewage-disposal-section')return'sewage';if(id==='summary-section')return'summary';return'consumables';}
  function getLegacyConsumablesSignatures(sectionKey){const all=readLegacyConsumables();const arr=all&&all[sectionKey];return Array.isArray(arr)?arr.map(s=>({title:s.title||'',name:s.name||''})):[];}

  function buildHTML(sigs,showStamp,prefs){const p=normalizePrefs(prefs);if(!Array.isArray(sigs)||sigs.length===0)return '<div class="sb-empty">لا توجد توقيعات — اضغط تعديل التواقيع للإضافة</div>';const style='--sb-item-width:'+p.width+'px';const items=sigs.map(s=>'<div class="sb-item"><div class="sb-item-title">'+esc(s.title)+'</div><div class="sb-item-name">'+esc(s.name||'')+'</div></div>').join('');const stamp=showStamp!==false?'<div class="sb-item sb-stamp">'+STAMP_SVG+'</div>':'';return '<div class="sb-grid sb-align-'+p.align+' sb-size-'+p.size+'" style="'+style+'">'+items+stamp+'</div>';}
  function buildConsumablesHTML(sigs,showStamp,prefs){const p=normalizePrefs(prefs);const st=consumablesStyleDraft?normalizeDetailedStyle(consumablesStyleDraft):readDetailedStyle();if(p.includeSigs===false)return '';if(!Array.isArray(sigs)||sigs.length===0)return '<div class="sb-empty">لا توجد توقيعات — اضغط تعديل التواقيع للإضافة</div>';const rowCls=st.perRow==='auto'?'sb-cols-auto':'sb-cols-'+st.perRow;const alignCls='sb-align-'+(p.align||'center');const borderWidth=(st.textOnly||!st.cardBorderVisible)?0:st.cardBorderWidth;const borderRadius=st.textOnly?0:st.cardBorderRadius;const cardBg=st.textOnly?'transparent':cardBackgroundValue(st.cardBackground);const cardPadding=st.textOnly?0:st.cardPadding;const wrapStyle=['--sb-block-y:'+st.blockY+'px','--sb-block-top:'+st.blockTop+'px','--sb-gap:'+st.gap+'px','--sb-card-width:'+st.cardWidth+'px','--sb-card-height:'+st.cardHeight+'px','--sb-card-border-width:'+borderWidth+'px','--sb-card-border-color:'+cardBorderColorValue(st.cardBorderColor),'--sb-card-border-radius:'+borderRadius+'px','--sb-card-background:'+cardBg,'--sb-card-padding:'+cardPadding+'px','--sb-title-font:'+st.titleFontSize+'px','--sb-name-font:'+st.nameFontSize+'px','--sb-title-weight:'+st.titleWeight,'--sb-name-weight:'+st.nameWeight,'--sb-title-name-gap:'+st.titleNameGap+'px','--sb-name-line-height:'+st.nameLineHeight,'--sb-letter-spacing:'+st.letterSpacing+'px','--sb-line-display:'+(st.showLine?'block':'none'),'--sb-line-length:'+st.lineLength+'px','--sb-line-name-gap:'+st.lineNameGap+'px','--sb-stamp-size:'+st.stampSize+'px','--sb-stamp-gap:'+st.stampGap+'px'].join(';');const items=sigs.map((s,i)=>{const one=normalizePerSig(st.perSignature[i]);const ta=one.textAlign||st.textAlign||'center';const itemStyle='--sb-x:'+one.x+'px;--sb-y:'+one.y+'px;--sb-text-align:'+ta;return '<div class="sb-item sb-consumables-card" style="'+itemStyle+'"><div class="sb-item-title">'+esc(s.title)+'</div><div class="sb-item-line"></div><div class="sb-item-name">'+esc(s.name||'')+'</div></div>';}).join('');const stampAllowed=showStamp!==false&&p.includeStamp!==false&&st.showStamp!==false;const stamp=stampAllowed?'<div class="sb-item sb-consumables-card sb-stamp sb-consumables-stamp sb-stamp-pos-'+st.stampPosition+'">'+STAMP_SVG+'</div>':'';return '<div class="sb-wrap sb-consumables-signature-wrap" style="'+wrapStyle+'"><div class="sb-grid sb-consumables-grid '+alignCls+' '+rowCls+'">'+items+stamp+'</div></div>';}

  function renderConsumablesSeparated(pageKey){const inst=instances[pageKey];if(!inst)return;const prefs=normalizePrefs(inst.prefs);const includeSigs=prefs.includeSigs!==false;const includeStamp=inst.options.showStamp!==false&&prefs.includeStamp!==false;document.querySelectorAll('[data-sb-page="consumables"]').forEach(el=>{const sectionKey=consumablesSectionKeyFromElement(el);const sigs=getLegacyConsumablesSignatures(sectionKey);el.innerHTML=includeSigs?buildConsumablesHTML(sigs,includeStamp,prefs):'';el.setAttribute('data-sb-consumables-section',sectionKey);el.classList.toggle('sb-no-print-sigs-inner',!includeSigs);if(el.parentElement)el.parentElement.classList.toggle('sb-no-print-sigs-inner',!includeSigs);});}

  function addDialogRow(fields,title,name){const row=document.createElement('div');row.className='sb-field-row';row.innerHTML='<input type="text" class="sb-f-title" placeholder="الصفة / المسمى" value="'+esc(title||'')+'"><input type="text" class="sb-f-name" placeholder="الاسم" value="'+esc(name||'')+'"><button class="sb-del-btn" type="button" title="حذف">×</button>';row.querySelector('.sb-del-btn').onclick=()=>row.remove();fields.appendChild(row);}
  function buildSettingsHTML(prefs,options){const p=normalizePrefs(prefs);const stampVisible=options&&options.showStamp!==false;return '<div class="sb-settings"><label>مكان التواقيع<select id="sb-pref-align"><option value="right" '+(p.align==='right'?'selected':'')+'>يمين</option><option value="center" '+(p.align==='center'?'selected':'')+'>وسط</option><option value="left" '+(p.align==='left'?'selected':'')+'>يسار</option></select></label><label>حجم التوقيع<select id="sb-pref-size"><option value="small" '+(p.size==='small'?'selected':'')+'>صغير</option><option value="normal" '+(p.size==='normal'?'selected':'')+'>عادي</option><option value="large" '+(p.size==='large'?'selected':'')+'>كبير</option></select></label><label>عرض خانة التوقيع<input id="sb-pref-width" type="number" min="120" max="320" step="10" value="'+p.width+'"></label><label class="sb-check-row"><input id="sb-pref-include-sigs" type="checkbox" '+(p.includeSigs!==false?'checked':'')+'> إظهار التواقيع</label>'+(stampVisible?'<label class="sb-check-row"><input id="sb-pref-include-stamp" type="checkbox" '+(p.includeStamp!==false?'checked':'')+'> إظهار الختم</label>':'')+'</div>';}
  function readSettingsFromDialog(oldPrefs,options){return normalizePrefs({includeSigs:document.getElementById('sb-pref-include-sigs')?.checked!==false,includeStamp:options&&options.showStamp===false?false:document.getElementById('sb-pref-include-stamp')?.checked!==false,align:document.getElementById('sb-pref-align')?.value||oldPrefs.align,size:document.getElementById('sb-pref-size')?.value||oldPrefs.size,width:Number(document.getElementById('sb-pref-width')?.value)||oldPrefs.width});}
  function buildDialogDOM(){if(document.getElementById('sb-overlay'))return;const ov=document.createElement('div');ov.id='sb-overlay';ov.className='sb-overlay';ov.innerHTML='<div class="sb-dialog"><h3 id="sb-dialog-title">تعديل التواقيع</h3><p class="sb-dialog-sub" id="sb-dialog-sub">أضف أو عدّل التواقيع وتحكم في مكانها وحجمها</p><div id="sb-extra"></div><div id="sb-fields"></div><button class="sb-add-btn" id="sb-add-btn" type="button">إضافة توقيع جديد</button><div class="sb-dialog-footer"><button class="sb-save-btn" id="sb-save-btn" type="button">حفظ</button><button class="sb-cancel-btn" id="sb-cancel-btn" type="button">إلغاء</button></div></div>';document.body.appendChild(ov);ov.onclick=e=>{if(e.target===ov)closeDialog();};document.getElementById('sb-add-btn').onclick=()=>addDialogRow(document.getElementById('sb-fields'));document.getElementById('sb-cancel-btn').onclick=closeDialog;}
  function closeDialog(){const ov=document.getElementById('sb-overlay');if(ov)ov.classList.remove('open');document.body.style.overflow='';activeKey=null;}
  function openConsumablesDialog(){injectCSS();buildDialogDOM();let selected='subcontractors';let data=readLegacyConsumables();const extra=document.getElementById('sb-extra');const fields=document.getElementById('sb-fields');const prefs=instances.consumables?.prefs||loadPrefs('consumables');document.getElementById('sb-dialog-title').textContent='تعديل تواقيع المستهلكات';document.getElementById('sb-dialog-sub').textContent='كل شهادة مستقلة، والشكل العام يطبق على تواقيع المستهلكات';extra.innerHTML='<select id="sb-consumables-cert" class="sb-cert-select" style="width:100%;margin-bottom:14px">'+Object.entries(CONSUMABLES_LABELS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select>'+buildSettingsHTML(prefs,instances.consumables?.options||{showStamp:true});function renderForm(){fields.innerHTML='';const arr=Array.isArray(data[selected])?data[selected]:[];if(!arr.length)addDialogRow(fields);else arr.forEach(s=>addDialogRow(fields,s.title,s.name));}function collect(){const arr=[];fields.querySelectorAll('.sb-field-row').forEach(row=>{const title=row.querySelector('.sb-f-title')?.value.trim()||'';const name=row.querySelector('.sb-f-name')?.value.trim()||'';if(title)arr.push({title,name});});data[selected]=arr;}document.getElementById('sb-consumables-cert').onchange=e=>{collect();selected=e.target.value;renderForm();};document.getElementById('sb-add-btn').onclick=()=>addDialogRow(fields);document.getElementById('sb-save-btn').onclick=async()=>{collect();const p=savePrefs('consumables',readSettingsFromDialog(prefs,instances.consumables?.options||{showStamp:true}));writeLegacyConsumables(data);closeDialog();await apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[PREFS_PFX+'consumables']:JSON.stringify(p)}})});};renderForm();document.getElementById('sb-overlay').classList.add('open');document.body.style.overflow='hidden';}

  function getAdminOfficeNames(){try{if(typeof global.getCenterNames==='function')return global.getCenterNames();}catch{}try{return JSON.parse(localStorage.getItem('adminOfficeNames_v1')||'{}');}catch{return{};}}
  function detectAdminOfficeCenterKey(){try{if(global.activeCenterKeyForManagement)return global.activeCenterKeyForManagement;}catch{}const visible=Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});if(visible?.id)return visible.id.replace('table-div-','');const selected=document.getElementById('admin-office-load-center')?.value||document.getElementById('center-select-import')?.value;if(selected)return selected;return null;}
  function isAdminOfficesPage(){return /admin_offices_(attendance|consumables)\.html/.test(location.href)||!!document.getElementById('sb-container-admin_offices');}
  function resolveKey(pageKey){if(pageKey!=='admin_offices'||!isAdminOfficesPage())return pageKey;const centerKey=detectAdminOfficeCenterKey();return centerKey?'admin_offices_'+centerKey:pageKey;}
  function labelForKey(pageKey){if(!pageKey||!pageKey.startsWith('admin_offices_'))return'';const centerKey=pageKey.replace('admin_offices_','');return getAdminOfficeNames()[centerKey]||centerKey;}

  function ensureAttendanceSignatureContainers(){const tables=Array.from(document.querySelectorAll('.department-table')).filter(section=>section.querySelector('table[id$="-table"]'));tables.forEach(section=>{section.querySelectorAll('.print-signatures').forEach(el=>el.remove());});tables.forEach(section=>{const table=section.querySelector('table[id$="-table"]');if(!table)return;const block=document.createElement('div');block.className='print-signatures sb-attendance-table-signatures';block.innerHTML='<h4>التواقيع</h4><div class="print-signatures-grid" data-sb-page="attendance" data-sb-table="'+esc(table.id)+'"></div>';section.appendChild(block);});}
  function applyPrintClasses(pageKey){const inst=instances[pageKey];const prefs=normalizePrefs(inst?.prefs||{});const includeSigs=prefs.includeSigs!==false;document.querySelectorAll('[data-sb-page="'+pageKey+'"], #sb-container-'+pageKey).forEach(el=>{if(el){el.classList.toggle('sb-no-print-sigs-inner',!includeSigs);if(el.parentElement)el.parentElement.classList.toggle('sb-no-print-sigs-inner',!includeSigs);}});}
  function renderAll(pageKey){const inst=instances[pageKey];if(!inst)return;if(pageKey==='attendance')ensureAttendanceSignatureContainers();if(pageKey==='consumables'){renderConsumablesSeparated(pageKey);return;}const prefs=normalizePrefs(inst.prefs||{});const html=prefs.includeSigs===false?'':buildHTML(inst.sigs,inst.options.showStamp!==false&&prefs.includeStamp!==false,prefs);const main=document.getElementById('sb-container-'+pageKey)||(pageKey.startsWith('admin_offices_')?document.getElementById('sb-container-admin_offices'):null);if(main)main.innerHTML=html;document.querySelectorAll('[data-sb-page="'+pageKey+'"]').forEach(el=>{el.innerHTML=html;});setTimeout(()=>applyPrintClasses(pageKey),0);}
  function installPrintHooks(){if(printHooksInstalled)return;printHooksInstalled=true;global.addEventListener('beforeprint',()=>Object.keys(instances).forEach(k=>renderAll(k)));}
  function installStorageHook(){if(storageHookInstalled)return;storageHookInstalled=true;const originalSetItem=localStorage.setItem.bind(localStorage);localStorage.setItem=function(key,value){if(key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&consumablesLegacyOverride){value=JSON.stringify(consumablesLegacyOverride);}originalSetItem(key,value);if(key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&instances.consumables){setTimeout(()=>renderAll('consumables'),0);}if(key===CONSUMABLES_STYLE_KEY&&instances.consumables){consumablesStyleDraft=null;setTimeout(()=>renderAll('consumables'),0);}if(key&&String(key).startsWith(PREFIX)&&instances[String(key).replace(PREFIX,'')]){setTimeout(()=>renderAll(String(key).replace(PREFIX,'')),0);}if(key&&String(key).startsWith(PREFS_PFX)&&instances[String(key).replace(PREFS_PFX,'')]){instances[String(key).replace(PREFS_PFX,'')].prefs=loadPrefs(String(key).replace(PREFS_PFX,''));setTimeout(()=>renderAll(String(key).replace(PREFS_PFX,'')),0);}};global.addEventListener('storage',e=>{if(e.key===CONSUMABLES_LEGACY_SIGNATURES_KEY&&instances.consumables)renderAll('consumables');if(e.key===CONSUMABLES_STYLE_KEY&&instances.consumables){consumablesStyleDraft=null;renderAll('consumables');}});}
  async function pullCloud(pageKey){const data=await apiFetch('/hospital-storage');if(!data?.data||!instances[pageKey])return;const raw=data.data[PREFIX+pageKey];if(raw){try{const sigs=JSON.parse(raw);instances[pageKey].sigs=Array.isArray(sigs)?sigs:[];localStorage.setItem(PREFIX+pageKey,JSON.stringify(instances[pageKey].sigs));}catch{}}const rawPrefs=data.data[PREFS_PFX+pageKey];if(rawPrefs){try{const prefs=normalizePrefs(JSON.parse(rawPrefs));instances[pageKey].prefs=prefs;localStorage.setItem(PREFS_PFX+pageKey,JSON.stringify(prefs));}catch{}}if(pageKey==='consumables'){const rawStyle=data.data[CONSUMABLES_STYLE_KEY];if(rawStyle){try{const remoteStyle=normalizeDetailedStyle(JSON.parse(rawStyle));const localStyle=readDetailedStyle();if(detailedStyleStamp(remoteStyle)>detailedStyleStamp(localStyle)){localStorage.setItem(CONSUMABLES_STYLE_KEY,JSON.stringify(remoteStyle));consumablesStyleDraft=null;}}catch{}}}renderAll(pageKey);}

  function activeConsumablesSections(target){if(target&&target!=='all'){const id=CONSUMABLES_SECTION_IDS[target];return id&&document.getElementById(id)?[target]:[];}return Object.keys(CONSUMABLES_SECTION_IDS).filter(k=>document.getElementById(CONSUMABLES_SECTION_IDS[k]));}
  function maxSignaturesForTarget(target){const data=readLegacyConsumables();const keys=activeConsumablesSections(target);return Math.max(1,...keys.map(k=>Array.isArray(data[k])?data[k].length:0));}
  function isNormalConsumablesPage(){let pageFile='';try{const q=new URLSearchParams(location.search||'').get('page')||'';pageFile=q?q.split('/').pop():(location.pathname||'').split('/').pop();}catch{pageFile=(location.pathname||'').split('/').pop();}if(pageFile!=='consumables.html'&&!/\/original\/consumables\.html(?:$|[?#])/.test(location.pathname+location.search))return false;if(/admin_offices_consumables\.html|health_centers_consumables\.html|najran_general_consumables\.html/.test(pageFile))return false;return true;}
  function isConsumablesPrintEligible(){return isNormalConsumablesPage()&&!!document.querySelector('[data-sb-page="consumables"]')&&Object.values(CONSUMABLES_SECTION_IDS).some(id=>!!document.getElementById(id));}
  function sectionFromPrintButton(btn){if(!btn)return null;if(btn.id==='print-all-btn')return'all';const sec=btn.getAttribute('data-section');return sec&&CONSUMABLES_SECTION_IDS[sec]?sec:null;}
  function rangeRow(cls,label,min,max,step,value,suffix){return '<div class="sbcp-row"><label>'+label+'</label><input type="range" class="'+cls+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><span>'+value+(suffix||'')+'</span></div>';}
  function setRangeText(input,value,suffix){const sp=input&&input.closest('.sbcp-row')&&input.closest('.sbcp-row').querySelector('span');if(sp)sp.textContent=String(value)+(suffix||'');}
  function makePanelDraggable(panel,handle,onDone){if(!panel||!handle||handle.__sbDrag)return;handle.__sbDrag=true;handle.addEventListener('pointerdown',ev=>{if(ev.button!=null&&ev.button!==0)return;if(ev.target&&ev.target.closest&&ev.target.closest('button'))return;const sx=ev.clientX,sy=ev.clientY,rect=panel.getBoundingClientRect();let moved=false;function mv(e){const nx=Math.max(4,Math.min(innerWidth-(panel.offsetWidth||470)-4,rect.left+e.clientX-sx));const ny=Math.max(4,Math.min(innerHeight-(panel.offsetHeight||220)-4,rect.top+e.clientY-sy));panel.style.left=Math.round(nx)+'px';panel.style.top=Math.round(ny)+'px';moved=true;e.preventDefault();}function up(){removeEventListener('pointermove',mv,true);removeEventListener('pointerup',up,true);if(moved&&onDone){const r=panel.getBoundingClientRect();onDone(Math.round(r.left),Math.round(r.top));}}addEventListener('pointermove',mv,true);addEventListener('pointerup',up,true);});}
  function buildConsumablesPrintStylePanel(target){injectCSS();let toggle=document.getElementById('sb-consumables-print-style-toggle');if(!toggle){toggle=document.createElement('button');toggle.id='sb-consumables-print-style-toggle';toggle.type='button';toggle.textContent='تنسيق تواقيع جداول المستهلكات';document.body.appendChild(toggle);}let panel=document.getElementById('sb-consumables-print-style-panel');if(!panel){panel=document.createElement('div');panel.id='sb-consumables-print-style-panel';document.body.appendChild(panel);}consumablesStyleDraft=normalizeDetailedStyle(consumablesStyleDraft||readDetailedStyle());panel.style.left=consumablesStyleDraft.panelLeft+'px';panel.style.top=consumablesStyleDraft.panelTop+'px';panel.classList.toggle('collapsed',!!consumablesStyleDraft.panelCollapsed);const st=consumablesStyleDraft;const perCount=maxSignaturesForTarget(target);const rows=[];rows.push('<div class="sbcp-group"><strong>تنسيق عام</strong>');rows.push(rangeRow('sbcp-title-font','حجم خط الصفة',6,44,1,st.titleFontSize,'px'));rows.push(rangeRow('sbcp-name-font','حجم خط الاسم',6,44,1,st.nameFontSize,'px'));rows.push(rangeRow('sbcp-title-weight','سماكة الصفة',100,900,100,st.titleWeight,''));rows.push(rangeRow('sbcp-name-weight','سماكة الاسم',100,900,100,st.nameWeight,''));rows.push(rangeRow('sbcp-title-gap','المسافة بين الصفة والاسم',-40,140,1,st.titleNameGap,'px'));rows.push(rangeRow('sbcp-name-line','تباعد أسطر الاسم',0.8,3,0.1,st.nameLineHeight,''));rows.push(rangeRow('sbcp-letter','تباعد الحروف',-2,8,0.1,st.letterSpacing,'px'));rows.push(rangeRow('sbcp-block-top','المسافة بين آخر جدول والتواقيع',0,100,1,st.blockTop,'px'));rows.push(rangeRow('sbcp-block-y','رفع/تنزيل كتلة التواقيع',-180,280,1,st.blockY,'px'));rows.push(rangeRow('sbcp-card-w','عرض كارت التوقيع',120,340,1,st.cardWidth,'px'));rows.push(rangeRow('sbcp-card-h','ارتفاع كارت التوقيع',48,180,1,st.cardHeight,'px'));rows.push('<label>عدد التواقيع في الصف<select class="sbcp-select sbcp-per-row"><option value="auto" '+(st.perRow==='auto'?'selected':'')+'>تلقائي</option><option value="2" '+(st.perRow==='2'?'selected':'')+'>2</option><option value="3" '+(st.perRow==='3'?'selected':'')+'>3</option><option value="4" '+(st.perRow==='4'?'selected':'')+'>4</option></select></label>');rows.push('<label>محاذاة النص الافتراضية<select class="sbcp-select sbcp-text-align"><option value="right" '+(st.textAlign==='right'?'selected':'')+'>يمين</option><option value="center" '+(st.textAlign==='center'?'selected':'')+'>وسط</option><option value="left" '+(st.textAlign==='left'?'selected':'')+'>يسار</option></select></label>');rows.push('</div>');rows.push('<div class="sbcp-group"><strong>إطار التوقيع</strong>');rows.push('<label class="sbcp-check"><input type="checkbox" class="sbcp-text-only" '+(st.textOnly?'checked':'')+'> بدون كارت — توقيع نص فقط</label>');rows.push('<label class="sbcp-check"><input type="checkbox" class="sbcp-border-visible" '+(st.cardBorderVisible?'checked':'')+'> إظهار إطار التوقيع</label>');rows.push('<label>سماكة الإطار<select class="sbcp-select sbcp-border-width"><option value="0" '+(st.cardBorderWidth===0?'selected':'')+'>0 px</option><option value="1" '+(st.cardBorderWidth===1?'selected':'')+'>1 px</option><option value="2" '+(st.cardBorderWidth===2?'selected':'')+'>2 px</option><option value="3" '+(st.cardBorderWidth===3?'selected':'')+'>3 px</option></select></label>');rows.push(rangeRow('sbcp-border-radius','استدارة زوايا الإطار',0,20,1,st.cardBorderRadius,'px'));rows.push('<label>لون الإطار<select class="sbcp-select sbcp-border-color"><option value="default" '+(st.cardBorderColor==='default'?'selected':'')+'>افتراضي</option><option value="black" '+(st.cardBorderColor==='black'?'selected':'')+'>أسود</option><option value="gray" '+(st.cardBorderColor==='gray'?'selected':'')+'>رمادي</option><option value="navy" '+(st.cardBorderColor==='navy'?'selected':'')+'>كحلي</option></select></label>');rows.push('<label>لون خلفية كارت التوقيع<select class="sbcp-select sbcp-card-bg"><option value="transparent" '+(st.cardBackground==='transparent'?'selected':'')+'>شفاف</option><option value="white" '+(st.cardBackground==='white'?'selected':'')+'>أبيض</option><option value="lightgray" '+(st.cardBackground==='lightgray'?'selected':'')+'>رمادي فاتح</option></select></label>');rows.push(rangeRow('sbcp-card-padding','المسافة الداخلية داخل الكارت',0,30,1,st.cardPadding,'px'));rows.push(rangeRow('sbcp-gap','المسافة بين كروت التوقيع',0,120,1,st.gap,'px'));rows.push('</div>');rows.push('<div class="sbcp-group"><strong>خط التوقيع والختم</strong>');rows.push('<label class="sbcp-check"><input type="checkbox" class="sbcp-show-line" '+(st.showLine?'checked':'')+'> إظهار خط التوقيع</label>');rows.push(rangeRow('sbcp-line-length','طول خط التوقيع',20,320,1,st.lineLength,'px'));rows.push(rangeRow('sbcp-line-gap','المسافة بين الخط والاسم',-30,80,1,st.lineNameGap,'px'));rows.push('<label class="sbcp-check"><input type="checkbox" class="sbcp-show-stamp" '+(st.showStamp?'checked':'')+'> إظهار الختم</label>');rows.push(rangeRow('sbcp-stamp-size','حجم الختم',32,130,1,st.stampSize,'px'));rows.push(rangeRow('sbcp-stamp-gap','المسافة بين الختم والتواقيع',0,80,1,st.stampGap,'px'));rows.push('<label>موضع الختم<select class="sbcp-select sbcp-stamp-pos"><option value="right" '+(st.stampPosition==='right'?'selected':'')+'>يمين</option><option value="center" '+(st.stampPosition==='center'?'selected':'')+'>وسط</option><option value="left" '+(st.stampPosition==='left'?'selected':'')+'>يسار</option></select></label>');rows.push('</div>');rows.push('<div class="sbcp-group"><strong>تحريك كل توقيع منفرد</strong>');for(let i=0;i<perCount;i++){const one=normalizePerSig(st.perSignature[i]);rows.push('<div class="sbcp-group" data-sig-idx="'+i+'"><strong>التوقيع '+(i+1)+'</strong>');rows.push(rangeRow('sbcp-sig-x','يمين/يسار',-180,180,1,one.x,'px'));rows.push(rangeRow('sbcp-sig-y','رفع/تنزيل',-160,220,1,one.y,'px'));rows.push('<label>محاذاة هذا التوقيع<select class="sbcp-select sbcp-sig-align"><option value="" '+(!one.textAlign?'selected':'')+'>حسب الافتراضي</option><option value="right" '+(one.textAlign==='right'?'selected':'')+'>يمين</option><option value="center" '+(one.textAlign==='center'?'selected':'')+'>وسط</option><option value="left" '+(one.textAlign==='left'?'selected':'')+'>يسار</option></select></label>');rows.push('</div>');}rows.push('</div>');panel.innerHTML='<div class="sbcp-head"><b>تنسيق تواقيع جداول المستهلكات</b><button type="button" class="sbcp-collapse">'+(st.panelCollapsed?'فتح':'طي')+'</button></div><div class="sbcp-body"><div class="sbcp-tools"><button type="button" class="sbcp-reset-panel">إعادة مكان اللوحة</button><button type="button" class="sbcp-save">حفظ واعتماد التنسيق</button><button type="button" class="sbcp-reset">استعادة الافتراضي</button><button type="button" class="sbcp-final">طباعة نهائية</button></div>'+rows.join('')+'</div>';panel.classList.add('open');const apply=()=>{consumablesStyleDraft=normalizeDetailedStyle(consumablesStyleDraft);renderAll('consumables');};toggle.onclick=()=>{panel.classList.toggle('open');};makePanelDraggable(panel,panel.querySelector('.sbcp-head'),(left,top)=>{consumablesStyleDraft.panelLeft=left;consumablesStyleDraft.panelTop=top;writeDetailedStyle(consumablesStyleDraft);});panel.querySelector('.sbcp-collapse').onclick=()=>{consumablesStyleDraft.panelCollapsed=!consumablesStyleDraft.panelCollapsed;writeDetailedStyle(consumablesStyleDraft);buildConsumablesPrintStylePanel(target);};panel.querySelector('.sbcp-reset-panel').onclick=()=>{consumablesStyleDraft.panelLeft=18;consumablesStyleDraft.panelTop=66;consumablesStyleDraft.panelCollapsed=false;writeDetailedStyle(consumablesStyleDraft);buildConsumablesPrintStylePanel(target);};panel.querySelector('.sbcp-save').onclick=()=>{consumablesStyleDraft=normalizeDetailedStyle(consumablesStyleDraft);consumablesStyleDraft.styleApproved=true;consumablesStyleDraft.savedAt=new Date().toISOString();writeDetailedStyle(consumablesStyleDraft);syncConsumablesStyleToCloud();renderAll('consumables');document.body.classList.remove('sb-consumables-print-preview');window.__sbConsumablesTablePrintIntent=null;const p=document.getElementById('sb-consumables-print-style-panel');const t=document.getElementById('sb-consumables-print-style-toggle');if(p)p.remove();if(t)t.remove();const msg=document.createElement('div');msg.textContent='تم حفظ واعتماد تنسيق التواقيع بنجاح';msg.setAttribute('style','position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:999999;background:#166534;color:#fff;padding:10px 18ppanel.querySelector('.sbcp-save').onclick=async()=>{
  consumablesStyleDraft=normalizeDetailedStyle(consumablesStyleDraft);
  consumablesStyleDraft.styleApproved=true;
  consumablesStyleDraft.savedAt=new Date().toISOString();

  writeDetailedStyle(consumablesStyleDraft);

  const cloudResult=await syncConsumablesStyleToCloud();

  renderAll('consumables');
  document.body.classList.remove('sb-consumables-print-preview');
  window.__sbConsumablesTablePrintIntent=null;

  const p=document.getElementById('sb-consumables-print-style-panel');
  const t=document.getElementById('sb-consumables-print-style-toggle');
  if(p)p.remove();
  if(t)t.remove();

  const cloudOk=cloudResult&&cloudResult.ok===true;
  const msg=document.createElement('div');
  msg.textContent=cloudOk
    ? 'تم حفظ واعتماد تنسيق التواقيع في النظام بنجاح'
    : 'تم حفظ التنسيق محليًا فقط — تعذر الحفظ في النظام بسبب انتهاء الجلسة أو الصلاحية';

  msg.setAttribute(
    'style',
    'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:999999;background:'+(cloudOk?'#166534':'#b45309')+';color:#fff;padding:10px 18px;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;box-shadow:0 10px 25px rgba(0,0,0,.25)'
  );

  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),2600);

  if(!cloudOk){
    console.warn('[SignatureBlock] consumables style saved locally only:',cloudResult);
  }
};x;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;box-shadow:0 10px 25px rgba(0,0,0,.25)');document.body.appendChild(msg);setTimeout(()=>msg.remove(),2200);};panel.querySelector('.sbcp-reset').onclick=()=>{consumablesStyleDraft=defaultDetailedStyle();consumablesStyleDraft.savedAt=new Date().toISOString();writeDetailedStyle(consumablesStyleDraft);syncConsumablesStyleToCloud();renderAll('consumables');buildConsumablesPrintStylePanel(target);};panel.querySelector('.sbcp-final').onclick=()=>finalConsumablesPrint(target);function bindRange(sel,prop,suffix){const input=panel.querySelector(sel);if(!input)return;input.oninput=()=>{consumablesStyleDraft[prop]=Number(input.value);setRangeText(input,consumablesStyleDraft[prop],suffix);apply();};}bindRange('.sbcp-title-font','titleFontSize','px');bindRange('.sbcp-name-font','nameFontSize','px');bindRange('.sbcp-title-weight','titleWeight','');bindRange('.sbcp-name-weight','nameWeight','');bindRange('.sbcp-title-gap','titleNameGap','px');bindRange('.sbcp-name-line','nameLineHeight','');bindRange('.sbcp-letter','letterSpacing','px');bindRange('.sbcp-block-top','blockTop','px');bindRange('.sbcp-block-y','blockY','px');bindRange('.sbcp-card-w','cardWidth','px');bindRange('.sbcp-card-h','cardHeight','px');bindRange('.sbcp-border-radius','cardBorderRadius','px');bindRange('.sbcp-card-padding','cardPadding','px');bindRange('.sbcp-gap','gap','px');bindRange('.sbcp-line-length','lineLength','px');bindRange('.sbcp-line-gap','lineNameGap','px');bindRange('.sbcp-stamp-size','stampSize','px');bindRange('.sbcp-stamp-gap','stampGap','px');panel.querySelector('.sbcp-text-only').onchange=e=>{consumablesStyleDraft.textOnly=e.target.checked;apply();};panel.querySelector('.sbcp-border-visible').onchange=e=>{consumablesStyleDraft.cardBorderVisible=e.target.checked;apply();};panel.querySelector('.sbcp-border-width').onchange=e=>{consumablesStyleDraft.cardBorderWidth=Number(e.target.value);apply();};panel.querySelector('.sbcp-border-color').onchange=e=>{consumablesStyleDraft.cardBorderColor=e.target.value;apply();};panel.querySelector('.sbcp-card-bg').onchange=e=>{consumablesStyleDraft.cardBackground=e.target.value;apply();};panel.querySelector('.sbcp-show-line').onchange=e=>{consumablesStyleDraft.showLine=e.target.checked;apply();};panel.querySelector('.sbcp-show-stamp').onchange=e=>{consumablesStyleDraft.showStamp=e.target.checked;apply();};panel.querySelector('.sbcp-per-row').onchange=e=>{consumablesStyleDraft.perRow=e.target.value;apply();};panel.querySelector('.sbcp-text-align').onchange=e=>{consumablesStyleDraft.textAlign=e.target.value;apply();};panel.querySelector('.sbcp-stamp-pos').onchange=e=>{consumablesStyleDraft.stampPosition=e.target.value;apply();};panel.querySelectorAll('[data-sig-idx]').forEach(group=>{const idx=Number(group.getAttribute('data-sig-idx'));while(consumablesStyleDraft.perSignature.length<=idx)consumablesStyleDraft.perSignature.push(normalizePerSig({}));const sig=consumablesStyleDraft.perSignature[idx];const x=group.querySelector('.sbcp-sig-x'),y=group.querySelector('.sbcp-sig-y'),a=group.querySelector('.sbcp-sig-align');x.oninput=()=>{sig.x=Number(x.value);setRangeText(x,sig.x,'px');apply();};y.oninput=()=>{sig.y=Number(y.value);setRangeText(y,sig.y,'px');apply();};a.onchange=()=>{sig.textAlign=a.value||null;apply();};});}
  function activateConsumablesPrintPreview(target){ensureInstance('consumables',instances.consumables?.options||{showStamp:true});if(!isConsumablesPrintEligible()){nativePrint();return;}document.body.classList.add('sb-consumables-print-preview');consumablesStyleDraft=readDetailedStyle();renderAll('consumables');buildConsumablesPrintStylePanel(target||'all');}
  function installFinalPrintStyle(target){const old=document.getElementById('sb-consumables-final-print-style');if(old)old.remove();const style=document.createElement('style');style.id='sb-consumables-final-print-style';let css='@media print{#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel{display:none!important}';if(target&&target!=='all'){const sectionId=CONSUMABLES_SECTION_IDS[target];if(sectionId)css+='body > .container > *:not(#tables-area),#tables-area > *:not(#'+sectionId+'){display:none!important}';}else{css+='.table-section{display:block!important;page-break-after:always}.table-section:last-of-type{page-break-after:auto}';}css+='}';style.textContent=css;document.head.appendChild(style);return style;}
  function finalConsumablesPrint(target){renderAll('consumables');const st=installFinalPrintStyle(target||'all');window.__sbConsumablesFinalPrint=true;try{nativePrint();}finally{setTimeout(()=>{window.__sbConsumablesFinalPrint=false;if(st&&st.parentNode)st.parentNode.removeChild(st);},900);}}
  function showApprovedStyleEditButton(target) {
  if (!isConsumablesPrintEligible()) return;

  var style = document.getElementById('sb-consumables-approved-edit-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'sb-consumables-approved-edit-style';
    style.textContent =
      '#sb-consumables-approved-edit-btn{' +
      'position:fixed;left:18px;top:18px;z-index:999990;' +
      'border:none;border-radius:999px;background:#334155;color:#fff;' +
      'padding:8px 12px;font-family:Tajawal,Arial,sans-serif;' +
      'font-weight:900;font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.25);' +
      'cursor:pointer}' +
      '@media print{#sb-consumables-approved-edit-btn{display:none!important}}';

    document.head.appendChild(style);
  }

  var btn = document.getElementById('sb-consumables-approved-edit-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'sb-consumables-approved-edit-btn';
    btn.type = 'button';
    btn.textContent = 'تعديل تنسيق التواقيع';
    document.body.appendChild(btn);
  }

  btn.setAttribute('data-target', target || 'all');
  btn.style.display = 'block';

  if (!btn.__sbApprovedEditBound) {
    btn.__sbApprovedEditBound = true;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      var t = btn.getAttribute('data-target') || 'all';

      try {
        window.__sbConsumablesTablePrintIntent = null;
      } catch (_) {}

      if (window.SignatureBlock && typeof window.SignatureBlock.prepareConsumablesPrint === 'function') {
        window.SignatureBlock.prepareConsumablesPrint(t);
      }
    }, true);
  }
}
  function installConsumablesPrintInterceptor(){
  if(consumablesPrintInterceptorInstalled)return;
  consumablesPrintInterceptorInstalled=true;

  document.addEventListener('click',e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('#print-all-btn,.btn-print[data-section]');
    if(!btn||!isConsumablesPrintEligible())return;

    const target=sectionFromPrintButton(btn);
    if(!target)return;

    window.__sbConsumablesTablePrintIntent={target,ts:Date.now()};
  },true);

  const wrapped=function(){
    const intent=window.__sbConsumablesTablePrintIntent;
    const fresh=intent&&Date.now()-Number(intent.ts||0)<2500;

    if(!window.__sbConsumablesFinalPrint&&fresh&&isConsumablesPrintEligible()){
      const target=intent.target||'all';
      window.__sbConsumablesTablePrintIntent=null;

      if(readDetailedStyle().styleApproved===true){
        showApprovedStyleEditButton(target);
        try{renderAll('consumables');}catch(_){}
        return nativePrint();
      }

      activateConsumablesPrintPreview(target);
      return;
    }

    return nativePrint();
  };

  try{
    Object.defineProperty(wrapped,'name',{value:'sbConsumablesPrintWrapper'});
  }catch{}

  global.print=wrapped;
}

  function enhanceAdminOfficeTables(){if(!/admin_offices_attendance\.html/.test(location.href))return;injectCSS();document.querySelectorAll('[id^="table-div-"]').forEach(section=>{section.classList.add('admin-office-table-enhanced');const table=section.querySelector('table[id^="table-"]');if(!table||!table.id)return;const wrapper=table.closest('.table-responsive-wrapper')||table.parentElement;if(wrapper)wrapper.classList.add('dept-table-scroll');const bar=section.querySelector('.tab-action-buttons');if(!bar)return;if(!bar.querySelector('.zoom-reset-btn')){const btn=document.createElement('button');btn.type='button';btn.className='zoom-reset-btn';btn.innerHTML='<i class="fas fa-compress-arrows-alt"></i> إعادة الحجم';btn.onclick=()=>global.resetAdminOfficeTableZoom(table.id);bar.appendChild(btn);}if(!bar.querySelector('.zoom-fullscreen-btn')){const btn=document.createElement('button');btn.type='button';btn.className='zoom-fullscreen-btn';btn.innerHTML='<i class="fas fa-expand"></i> عرض كامل';btn.onclick=()=>global.toggleAdminOfficeTableFullscreen(table.id,btn);bar.appendChild(btn);}});}
  function scheduleEnhanceAdminOfficeTables(){if(enhanceScheduled)return;enhanceScheduled=true;setTimeout(()=>{enhanceScheduled=false;enhanceAdminOfficeTables();},120);}
  global.resetAdminOfficeTableZoom=function(tableId){const table=document.getElementById(tableId);if(!table)return;table.style.zoom='1';try{localStorage.setItem('tableZoom_'+tableId.replace('table-',''),'1');}catch{}};
  global.toggleAdminOfficeFullscreen=function(tableId,btn){return global.toggleAdminOfficeTableFullscreen(tableId,btn);};
  global.toggleAdminOfficeTableFullscreen=function(tableId,btn){const table=document.getElementById(tableId);const section=table?.closest('.department-table');if(!section)return;let backdrop=document.getElementById('dept-fullscreen-backdrop');const active=section.classList.toggle('dept-fullscreen');if(active){if(!backdrop){backdrop=document.createElement('div');backdrop.id='dept-fullscreen-backdrop';backdrop.className='dept-fullscreen-backdrop';backdrop.onclick=()=>global.toggleAdminOfficeTableFullscreen(tableId,btn);document.body.appendChild(backdrop);}document.body.style.overflow='hidden';if(btn)btn.innerHTML='<i class="fas fa-compress"></i> خروج';}else{if(backdrop)backdrop.remove();document.body.style.overflow='';if(btn)btn.innerHTML='<i class="fas fa-expand"></i> عرض كامل';}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const fs=document.querySelector('.department-table.dept-fullscreen table[id^="table-"]');if(fs)global.toggleAdminOfficeTableFullscreen(fs.id);}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEnhanceAdminOfficeTables);else scheduleEnhanceAdminOfficeTables();
  const mo=new MutationObserver(scheduleEnhanceAdminOfficeTables);if(document.body)mo.observe(document.body,{childList:true,subtree:true});else document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{childList:true,subtree:true}));

  function ensureInstance(pageKey,options={}){const key=resolveKey(pageKey);if(instances[key]){if(key==='consumables')installConsumablesPrintInterceptor();return key;}let sigs=[];try{sigs=JSON.parse(localStorage.getItem(PREFIX+key)||'[]');}catch{}const prefs=loadPrefs(key);instances[key]={sigs:Array.isArray(sigs)?sigs:[],options:options||{},prefs};injectCSS();buildDialogDOM();installPrintHooks();installStorageHook();renderAll(key);pullCloud(key);if(key==='consumables')installConsumablesPrintInterceptor();return key;}
  function openGenericDialog(pageKey){if(!pageKey||!instances[pageKey])return;activeKey=pageKey;const inst=instances[pageKey];const fields=document.getElementById('sb-fields');const extra=document.getElementById('sb-extra');extra.innerHTML=buildSettingsHTML(inst.prefs||{},inst.options||{});fields.innerHTML='';document.getElementById('sb-dialog-title').textContent=labelForKey(pageKey)?'تعديل تواقيع: '+labelForKey(pageKey):'تعديل التواقيع';document.getElementById('sb-dialog-sub').textContent='اضبط مكان وحجم التوقيع ثم أضف الصفة والاسم';const sigs=instances[pageKey].sigs||[];if(!sigs.length)addDialogRow(fields);else sigs.forEach(s=>addDialogRow(fields,s.title,s.name));document.getElementById('sb-add-btn').onclick=()=>addDialogRow(fields);document.getElementById('sb-save-btn').onclick=async()=>{const arr=[];fields.querySelectorAll('.sb-field-row').forEach(row=>{const title=row.querySelector('.sb-f-title')?.value.trim()||'';const name=row.querySelector('.sb-f-name')?.value.trim()||'';if(title)arr.push({title,name});});const prefs=savePrefs(pageKey,readSettingsFromDialog(inst.prefs||{},inst.options||{}));instances[pageKey].sigs=arr;localStorage.setItem(PREFIX+pageKey,JSON.stringify(arr));renderAll(pageKey);closeDialog();await apiFetch('/hospital-storage',{method:'PUT',body:JSON.stringify({data:{[PREFIX+pageKey]:JSON.stringify(arr),[PREFS_PFX+pageKey]:JSON.stringify(prefs)}})});};document.getElementById('sb-overlay').classList.add('open');document.body.style.overflow='hidden';}

  const SB={
    init(pageKey,options={}){instances[pageKey]={sigs:[],options,prefs:loadPrefs(pageKey)};try{const sigs=JSON.parse(localStorage.getItem(PREFIX+pageKey)||'[]');instances[pageKey].sigs=Array.isArray(sigs)?sigs:[];}catch{}const setup=()=>{injectCSS();buildDialogDOM();installPrintHooks();installStorageHook();renderAll(pageKey);pullCloud(pageKey);scheduleEnhanceAdminOfficeTables();if(pageKey==='consumables')installConsumablesPrintInterceptor();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();},
    open(pageKey){if(pageKey==='consumables'){ensureInstance('consumables',instances.consumables?.options||{showStamp:true});openConsumablesDialog();return;}const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});openGenericDialog(key);},
    getSigs(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});return (instances[key]?.sigs||[]).slice();},
    getSig(pageKey,index){const sigs=this.getSigs(pageKey);return index<0||index>=sigs.length?null:sigs[index];},
    getPrefs(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});return normalizePrefs(instances[key]?.prefs||{});},
    buildPrintHTML(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});const inst=instances[key];const prefs=normalizePrefs(inst?.prefs||{});if(prefs.includeSigs===false)return'';if(key==='consumables')return buildConsumablesHTML(getLegacyConsumablesSignatures('summary'),inst.options.showStamp!==false&&prefs.includeStamp!==false,prefs);return buildHTML(inst.sigs,inst.options.showStamp!==false&&prefs.includeStamp!==false,prefs);},
    rerender(pageKey){const key=ensureInstance(pageKey,instances[pageKey]?.options||{showStamp:true});renderAll(key);scheduleEnhanceAdminOfficeTables();},
    prepareConsumablesPrint(target){activateConsumablesPrintPreview(target||'all');}
  };

  function bootConsumablesPrintSupport(){if(!isNormalConsumablesPage())return;injectCSS();installConsumablesPrintInterceptor();if(document.querySelector('[data-sb-page="consumables"]'))ensureInstance('consumables',{showStamp:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootConsumablesPrintSupport);else bootConsumablesPrintSupport();
  setTimeout(bootConsumablesPrintSupport,800);
  setTimeout(bootConsumablesPrintSupport,1800);

  global.SignatureBlock=SB;
})(window);
