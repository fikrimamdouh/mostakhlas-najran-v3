// ===================================================================
// Admin Offices Raise Letters Signature Labels — V1
// Scope: admin_offices_attendance.html / raise letters overlay
// يوضح أن تواقيع خطابات الرفع ليست مرتبطة بكل زر منفرد:
// - خطاب العمالة الإجمالي + خطاب الموقع + خطابات المواقع: تستخدم توقيع المدير فقط.
// - إقرار عدم أسبقية الصرف: يستخدم التوقيعين.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_SIGNATURE_LABELS_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_SIGNATURE_LABELS_V1__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function ensureCss() {
    if (document.getElementById('raise-letter-signature-labels-css')) return;
    var st = document.createElement('style');
    st.id = 'raise-letter-signature-labels-css';
    st.textContent = [
      '#raise-letters-overlay .rl-signature-clarity{background:#eef6ff;border:1px solid #bfdbfe;border-right:5px solid #003087;border-radius:12px;padding:12px 14px;margin:0 0 12px;color:#0f2f5f;font-weight:800;line-height:1.8}',
      '#raise-letters-overlay .rl-signature-clarity b{color:#003087}',
      '#raise-letters-overlay .rl-signature-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
      '#raise-letters-overlay .rl-signature-chip{background:#fff;border:1px solid #cbd5e1;border-radius:999px;padding:5px 10px;font-size:12px;color:#334155;font-weight:900}',
      '#raise-letters-overlay .rl-signature-section h3{display:flex;align-items:center;justify-content:center;gap:8px}',
      '#raise-letters-overlay .rl-signature-section h3:before{content:"✍️";font-family:Arial,sans-serif}',
      '#raise-letters-overlay .rl-signature-section label{line-height:1.45!important}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function labelForKey(key) {
    var map = {
      unitManagerTitle: 'توقيع إضافي للإقرار فقط — الصفة',
      unitManagerName: 'توقيع إضافي للإقرار فقط — الاسم',
      managerTitle: 'توقيع خطابات الرفع والإقرار — الصفة',
      managerName: 'توقيع خطابات الرفع والإقرار — الاسم'
    };
    return map[key] || '';
  }

  function patchSignatureSection() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    ensureCss();

    var sections = Array.prototype.slice.call(overlay.querySelectorAll('.section-box'));
    var section = sections.find(function (box) {
      var title = clean(box.querySelector('h3') && box.querySelector('h3').textContent);
      return title.indexOf('التواقيع') > -1;
    });
    if (!section) return;

    section.classList.add('rl-signature-section');
    var h3 = section.querySelector('h3');
    if (h3) h3.textContent = 'تواقيع خطابات الرفع والإقرار';

    if (!section.querySelector('.rl-signature-clarity')) {
      var note = document.createElement('div');
      note.className = 'rl-signature-clarity';
      note.innerHTML = [
        '<b>توضيح الاستخدام:</b>',
        '<div>توقيع خطابات الرفع يظهر في: خطاب العمالة الإجمالي + خطاب الموقع المحدد + خطابات المواقع المختارة.</div>',
        '<div>إقرار عدم أسبقية الصرف يظهر فيه توقيعان: التوقيع الإضافي + توقيع خطابات الرفع.</div>',
        '<div class="rl-signature-chip-row">',
          '<span class="rl-signature-chip">خطاب العمالة الإجمالي: توقيع خطابات الرفع فقط</span>',
          '<span class="rl-signature-chip">خطاب الموقع: توقيع خطابات الرفع فقط</span>',
          '<span class="rl-signature-chip">إقرار عدم أسبقية الصرف: التوقيعان معًا</span>',
        '</div>'
      ].join('');
      var grid = section.querySelector('.settings-grid');
      section.insertBefore(note, grid || section.firstChild);
    }

    Array.prototype.slice.call(section.querySelectorAll('[data-rl-setting]')).forEach(function (input) {
      var key = input.getAttribute('data-rl-setting');
      var label = input.closest('.field') && input.closest('.field').querySelector('label');
      var next = labelForKey(key);
      if (label && next) label.textContent = next;
      if (next) input.setAttribute('title', next);
    });

    Array.prototype.slice.call(section.querySelectorAll('button')).forEach(function (btn) {
      var text = clean(btn.textContent);
      if (text.indexOf('حفظ التواقيع') > -1 || text.indexOf('حفظ إعدادات') > -1) {
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ تواقيع الخطابات والإقرار';
        btn.title = 'يحفظ التوقيع المستخدم في خطابات الرفع والتوقيع الإضافي الخاص بالإقرار';
      }
    });
  }

  function boot() {
    patchSignatureSection();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('click', function () {
    setTimeout(patchSignatureSection, 80);
    setTimeout(patchSignatureSection, 350);
  }, true);
  setInterval(patchSignatureSection, 900);

  console.info('[Admin Offices Raise Letters Signature Labels] installed v1');
})();