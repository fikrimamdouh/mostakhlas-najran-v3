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

  loadScript('hospital-raise-letters-engine-v8', '/original/hospital_raise_letters_engine_v8.js?v=20260701_restored_admin_clean_pattern');
  setTimeout(function(){
    loadScript('hospital-raise-letters-print-polish-v3', '/original/hospital_raise_letters_print_polish_v1.js?v=20260702_v3_a4_exit');
  }, 150);
  setTimeout(function(){
    loadScript('hospital-raise-letters-print-compact-v4', '/original/hospital_raise_letters_print_compact_v4.js?v=20260702_v4_compact_a4');
  }, 260);
  setTimeout(function(){
    loadScript('hospital-raise-letters-custom-exclude-v1', '/original/hospital_raise_letters_custom_exclude_v1.js?v=20260702_v1_no_custom_packet');
  }, 360);
  setTimeout(function(){
    loadScript('hospital-raise-letters-iban-preview-toggle-v1', '/original/hospital_raise_letters_iban_preview_toggle_v1.js?v=20260702_v1_iban_preview_toggle');
  }, 460);
})();
