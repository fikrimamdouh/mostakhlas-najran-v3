/*
 * review-workflow.js
 * طبقة مراجعة مهنية فوق عارض المستخلص الحالي.
 * لا يغير المعادلات أو الطباعة أو الرفع أو قاعدة البيانات.
 */
(function () {
  'use strict';

  if (!/\/original\/approval\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SECTIONS = [
    ['attendance', 'الحضور والانصراف'],
    ['performance', 'تقييم الأداء'],
    ['achievement', 'شهادة الإنجاز'],
    ['consumables', 'المستهلكات والمواد'],
    ['spare', 'قطع الغيار']
  ];

  let currentReviewId = null;

  function css() {
    if (document.getElementById('review-workflow-style')) return;
    const s = document.createElement('style');
    s.id = 'review-workflow-style';
    s.textContent = `
      .rw-box{background:#fff;border:1px solid #dbe5ef;border-radius:18px;padding:14px;margin-top:16px;box-shadow:0 4px 14px rgba(15,47,85,.04)}
      .rw-title{font-size:13px;font-weight:900;color:#123b6d;margin-bottom:10px}
      .rw-options{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
      .rw-options label{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;color:#334155;cursor:pointer}
      .rw-options input{vertical-align:middle;margin-left:5px}
      .rw-box textarea,.rw-general textarea{width:100%;border:1.5px solid #dbe5ef;border-radius:14px;padding:11px 13px;font-family:inherit;font-size:13px;resize:vertical;min-height:74px;background:#fff}
      .rw-box textarea:focus,.rw-general textarea:focus{outline:none;border-color:#1e5d92;box-shadow:0 0 0 3px rgba(30,93,146,.1)}
      .rw-general{background:#fff;border-top:1px solid #dbe5ef;padding:14px 18px}
      .rw-footer{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start;background:#f8fafc;border-top:1px solid #dbe5ef;padding:14px 18px}
      .rw-action{border:none;border-radius:14px;padding:11px 18px;font-family:inherit;font-weight:900;cursor:pointer}
      .rw-revision{background:#ea580c;color:#fff}.rw-review{background:#123b6d;color:#fff}.rw-approve{background:#15803d;color:#fff}.rw-close{background:#e2e8f0;color:#334155}
    `;
    document.head.appendChild(s);
  }

  function addBoxes() {
    const body = document.getElementById('nr-body');
    const modal = document.querySelector('#najran-review-details-overlay .nr-modal');
    if (!body || !modal || body.dataset.rwDone === '1') return;
    body.dataset.rwDone = '1';

    SECTIONS.forEach(([id, title]) => {
      const sec = document.getElementById('nr-sec-' + id);
      if (!sec || sec.querySelector('.rw-box')) return;
      const box = document.createElement('div');
      box.className = 'rw-box';
      box.innerHTML = `
        <div class="rw-title">قرار المراجع لهذا الجزء</div>
        <div class="rw-options">
          <label><input type="radio" name="rw-${id}" value="سليم"> سليم</label>
          <label><input type="radio" name="rw-${id}" value="يحتاج تعديل"> يحتاج تعديل</label>
          <label><input type="radio" name="rw-${id}" value="غير قابل للمراجعة"> غير قابل للمراجعة</label>
        </div>
        <textarea id="rw-note-${id}" placeholder="ملاحظة ${title} — اكتب سبب طلب التعديل أو ما يجب مراجعته"></textarea>
      `;
      sec.appendChild(box);
    });

    if (!modal.querySelector('.rw-general')) {
      const g = document.createElement('div');
      g.className = 'rw-general';
      g.innerHTML = '<textarea id="rw-general-note" placeholder="ملاحظات عامة على المستخلص بالكامل — اختيارية"></textarea>';
      modal.appendChild(g);
    }

    if (!modal.querySelector('.rw-footer')) {
      const f = document.createElement('div');
      f.className = 'rw-footer';
      f.innerHTML = `
        <button class="rw-action rw-revision" onclick="window.reviewWorkflowSubmit('needs_revision')">إرجاع المستخلص بالملاحظات</button>
        <button class="rw-action rw-review" onclick="window.reviewWorkflowSubmit('under_review')">حفظ كمراجعة جارية</button>
        <button class="rw-action rw-approve" onclick="window.reviewWorkflowSubmit('approved')">اعتماد المستخلص</button>
        <button class="rw-action rw-close" onclick="window.closeNajranReviewDetails && window.closeNajranReviewDetails()">إغلاق</button>
      `;
      modal.appendChild(f);
    }
  }

  function collect(label) {
    const lines = ['ملف مراجعة تفصيلي للمستخلص', 'الإجراء: ' + label, ''];
    let hasIssue = false;
    SECTIONS.forEach(([id, title]) => {
      const checked = document.querySelector('input[name="rw-' + id + '"]:checked');
      const decision = checked ? checked.value : 'لم يتم تحديد قرار';
      const note = (document.getElementById('rw-note-' + id)?.value || '').trim();
      if (decision !== 'سليم' || note) hasIssue = true;
      lines.push('[' + title + ']');
      lines.push('الحالة: ' + decision);
      if (note) lines.push('الملاحظة: ' + note);
      lines.push('');
    });
    const general = (document.getElementById('rw-general-note')?.value || '').trim();
    if (general) {
      hasIssue = true;
      lines.push('[ملاحظات عامة]');
      lines.push(general);
    }
    return { text: lines.join('\n').trim(), hasIssue };
  }

  window.reviewWorkflowSubmit = function (status) {
    const id = currentReviewId;
    if (!id) return alert('تعذر تحديد رقم المستخلص. أغلق النافذة وافتحها مرة أخرى.');

    const label = status === 'approved' ? 'اعتماد المستخلص' : status === 'under_review' ? 'حفظ كمراجعة جارية' : 'إرجاع المستخلص للمستخدم للتعديل';
    const data = collect(label);

    if ((status === 'needs_revision' || status === 'rejected') && !data.hasIssue) {
      alert('حدد الجزء الذي يحتاج تعديلًا أو اكتب ملاحظة قبل إرجاع المستخلص.');
      return;
    }
    if (status === 'approved' && !confirm('تأكيد اعتماد المستخلص بعد مراجعة جميع التبويبات؟')) return;
    if (status === 'needs_revision' && !confirm('سيتم إرجاع المستخلص للمستخدم بهذه الملاحظات. تأكيد؟')) return;

    let ta = document.getElementById('notes-' + id);
    if (!ta) {
      ta = document.createElement('textarea');
      ta.id = 'notes-' + id;
      ta.style.display = 'none';
      document.body.appendChild(ta);
    }
    ta.value = data.text;

    if (typeof updateStatus === 'function') updateStatus(id, status);
    else alert('تعذر العثور على دالة تحديث الحالة داخل صفحة الاعتماد.');

    if (window.closeNajranReviewDetails) window.closeNajranReviewDetails();
  };

  function wrapOpen() {
    if (typeof window.openNajranReviewDetails !== 'function' || window.openNajranReviewDetails.__rwWrapped) return false;
    const old = window.openNajranReviewDetails;
    window.openNajranReviewDetails = function (id) {
      currentReviewId = id;
      const r = old.apply(this, arguments);
      setTimeout(addBoxes, 80);
      setTimeout(addBoxes, 350);
      return r;
    };
    window.openNajranReviewDetails.__rwWrapped = true;
    return true;
  }

  function init() {
    css();
    const t = setInterval(() => {
      if (wrapOpen()) clearInterval(t);
    }, 300);
    setTimeout(() => clearInterval(t), 12000);

    const obs = new MutationObserver(() => addBoxes());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
