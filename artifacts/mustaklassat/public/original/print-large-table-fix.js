// Fix printing when the first large table is pushed to page 2 leaving only the title/header.
(function () {
  'use strict';

  function inject() {
    if (document.getElementById('najran-print-large-table-fix')) return;

    var style = document.createElement('style');
    style.id = 'najran-print-large-table-fix';
    style.textContent = `
      @media print {
        html, body {
          height: auto !important;
          overflow: visible !important;
          background: #fff !important;
        }

        /* لا تجعل الصفحة الأولى عنوان فقط عند كبر جدول النظافة */
        .container,
        .content,
        .main-content,
        .print-section-container,
        .department-table,
        .performance-table-section,
        .table-section,
        .card,
        .table-card,
        .printable-section {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        .department-table:first-of-type,
        .performance-table-section:first-of-type,
        .table-section:first-of-type,
        .print-section-container:first-of-type {
          break-before: auto !important;
          page-break-before: auto !important;
          margin-top: 0 !important;
        }

        /* السماح بتقسيم الجدول الكبير بين الصفحات، مع تكرار رأس الجدول */
        table {
          break-inside: auto !important;
          page-break-inside: auto !important;
          page-break-before: auto !important;
        }

        thead {
          display: table-header-group !important;
        }

        tfoot {
          display: table-footer-group !important;
        }

        tbody {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        td, th {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* لا تفصل العنوان/بيانات المستخلص عن أول جدول بمسافة ضخمة */
        .page-contract-info,
        .page-contract-info-v2,
        .extract-details,
        .extract-details-v2,
        .header-info,
        .page-header,
        .company-header,
        .print-header {
          break-after: avoid !important;
          page-break-after: avoid !important;
          margin-bottom: 6px !important;
        }

        h1, h2, h3, h4 {
          break-after: avoid !important;
          page-break-after: avoid !important;
        }

        /* تقليل المساحات البيضاء في الطباعة فقط */
        .department-table,
        .performance-table-section,
        .table-section {
          margin-top: 6px !important;
          margin-bottom: 10px !important;
          padding-top: 0 !important;
        }

        .total,
        .table-summary,
        .table-summary-v2 {
          break-after: avoid !important;
          page-break-after: avoid !important;
        }
      }
    `;

    document.head.appendChild(style);
    console.warn('[PrintFix] large table print pagination fix active');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
