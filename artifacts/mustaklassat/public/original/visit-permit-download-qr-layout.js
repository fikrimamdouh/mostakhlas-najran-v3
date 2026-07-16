(function () {
  'use strict';

  function arrangePermit(documentNode) {
    if (!documentNode || documentNode.dataset.downloadQrFooterLayout === '1') return;
    var downloadQr = documentNode.querySelector('[data-role="permit-download-qr"]');
    var footer = documentNode.querySelector('[data-role="permit-footer-note"]');
    if (!downloadQr || !footer) return;

    documentNode.dataset.downloadQrFooterLayout = '1';
    var footerCopy = document.createElement('div');
    footerCopy.dataset.role = 'permit-footer-copy';
    footerCopy.innerHTML = footer.innerHTML;
    footerCopy.style.cssText = 'flex:1;min-width:0;text-align:right;line-height:1.75';

    downloadQr.style.cssText = 'flex:0 0 72px;text-align:center;padding:3px 0';
    var image = downloadQr.querySelector('img');
    if (image) image.style.cssText = 'width:64px;height:64px;display:block;margin:auto;image-rendering:pixelated';

    footer.innerHTML = '';
    footer.style.cssText = 'margin-top:10px;border-top:1px solid #cbd5e1;padding-top:8px;display:flex;direction:rtl;flex-direction:row;align-items:center;justify-content:center;gap:14px;font-size:10.5px;font-weight:800;color:#334155';
    footer.appendChild(downloadQr);
    footer.appendChild(footerCopy);

    var mainQr = documentNode.querySelector('[data-role="permit-qr"]');
    if (mainQr) {
      mainQr.style.justifyContent = 'center';
      mainQr.style.alignItems = 'center';
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
