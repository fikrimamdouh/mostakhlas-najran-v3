(function () {
  'use strict';

  function arrangePermit(documentNode) {
    if (!documentNode) return;
    var downloadQr = documentNode.querySelector('[data-role="permit-download-qr"]');
    var footer = documentNode.querySelector('[data-role="permit-footer-note"]');
    if (!downloadQr || !footer) return;

    var footerCopy = footer.querySelector('[data-role="permit-footer-copy"]');
    if (!footerCopy) {
      footerCopy = document.createElement('div');
      footerCopy.dataset.role = 'permit-footer-copy';
      footerCopy.innerHTML = footer.innerHTML;
    }

    footer.innerHTML = '';
    footer.style.cssText = 'margin-top:10px;border-top:1px solid #cbd5e1;padding-top:8px;display:grid;grid-template-columns:72px minmax(0,1fr);direction:rtl;align-items:center;gap:14px;font-size:10.5px;font-weight:800;color:#334155';

    downloadQr.style.cssText = 'grid-column:1;grid-row:1;text-align:center;padding:3px 0;justify-self:start';
    var image = downloadQr.querySelector('img');
    if (image) image.style.cssText = 'width:64px;height:64px;display:block;margin:auto;image-rendering:pixelated';

    footerCopy.style.cssText = 'grid-column:2;grid-row:1;min-width:0;text-align:right;line-height:1.75';
    footer.appendChild(downloadQr);
    footer.appendChild(footerCopy);
    documentNode.dataset.downloadQrFooterLayout = '1';

    var mainQr = documentNode.querySelector('[data-role="permit-qr"]');
    if (mainQr) {
      mainQr.style.justifyContent = 'center';
      mainQr.style.alignItems = 'center';
      mainQr.style.gap = '0';
    }
  }

  function scan(root) {
    if (root && root.matches && root.matches('.najran-visit-permit-document')) arrangePermit(root);
    if (root && root.querySelectorAll) root.querySelectorAll('.najran-visit-permit-document').forEach(arrangePermit);
  }

  scan(document);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
