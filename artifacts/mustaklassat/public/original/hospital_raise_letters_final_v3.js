(function(){
  'use strict';
  if (window.__HOSPITAL_RAISE_LETTERS_BOOTSTRAP__) return;
  window.__HOSPITAL_RAISE_LETTERS_BOOTSTRAP__ = true;

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = false;
    document.head.appendChild(s);
  }

  loadScript('hospital-raise-letters-engine-v8', '/original/hospital_raise_letters_engine_v8.js?v=20260702_final_amount_absences_saudi_names_snapshot_v14_saudi_vacant_name_fix');
  setTimeout(function(){
    loadScript('hospital-raise-letters-index-guard-v1', '/original/hospital_raise_letters_index_guard_v1.js?v=20260702_v1_index_not_empty');
  }, 80);
  setTimeout(function(){
    loadScript('hospital-raise-letters-status-pages-fix-v4', '/original/hospital_raise_letters_status_pages_fix_v1.js?v=20260702_v14_count_all_attendance_duplicate_vacancies');
  }, 120);
  setTimeout(function(){
    loadScript('hospital-raise-letters-print-polish-v3', '/original/hospital_raise_letters_print_polish_v1.js?v=20260702_v3_a4_exit');
  }, 150);
  setTimeout(function(){
    loadScript('hospital-raise-letters-print-compact-v4', '/original/hospital_raise_letters_print_compact_v4.js?v=20260702_v4_compact_a4');
  }, 260);
  setTimeout(function(){
    loadScript('hospital-raise-letters-selected-print-polish-v4', '/original/hospital_raise_letters_selected_print_polish_v1.js?v=20260702_v4_compact_saudi_names');
  }, 330);
  setTimeout(function(){
    loadScript('hospital-raise-letters-saudi-names-last-signature-fix-v2', '/original/hospital_raise_letters_saudi_names_last_signature_fix_v1.js?v=20260702_v2_one_row_signatures');
  }, 365);
  setTimeout(function(){
    loadScript('hospital-raise-letters-custom-exclude-v1', '/original/hospital_raise_letters_custom_exclude_v1.js?v=20260702_v2_safe_index_rows');
  }, 390);
  setTimeout(function(){
    loadScript('hospital-raise-letters-iban-preview-toggle-v1', '/original/hospital_raise_letters_iban_preview_toggle_v1.js?v=20260702_v1_iban_preview_toggle');
  }, 490);
  setTimeout(function(){
    loadScript('hospital-raise-letters-toolbar-clean-css-v1', '/original/hospital_raise_letters_toolbar_clean_css_v1.js?v=20260702_v3_no_index_visual_change');
  }, 650);
  setTimeout(function(){
    loadScript('hospital-raise-letters-paginate-rows-polyfill-v1', '/original/hospital_raise_letters_paginate_rows_polyfill_v1.js?v=20260702_v1_polyfill');
  }, 710);
  // Disabled: older status-pages fix loader. V2 merged Saudi count is loaded earlier at 120ms.
  // Disabled: tax logic is now handled by hospital_raise_letters_engine_v8.js.
  // Keeping this layer enabled causes delayed overwrite of amount table and tafqeet.
  // setTimeout(function(){
  //   loadScript('hospital-raise-letters-vat-logic-v1', '/original/hospital_raise_letters_tax_invoice_logic_v1.js?v=20260702_v1_vat_logic');
  // }, 880);
})();