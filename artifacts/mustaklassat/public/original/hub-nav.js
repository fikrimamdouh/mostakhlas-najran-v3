(function () {
  var params   = new URLSearchParams(window.location.search);
  var nextPage = params.get('next');
  var hubPage  = params.get('hub');

  if (!hubPage && !nextPage) return;

  function buildBar() {
    var nav = document.createElement('div');
    nav.id = 'hub-nav-bar';
    nav.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'z-index:99999',
      'background:rgba(255,255,255,0.97)',
      'border-radius:40px',
      'padding:10px 20px',
      'box-shadow:0 6px 30px rgba(0,0,0,0.18)',
      'font-family:Tajawal,sans-serif',
      'direction:rtl',
      'border:1px solid #e2e8f0',
    ].join(';');

    if (hubPage) {
      var backBtn = document.createElement('a');
      backBtn.href = hubPage;
      backBtn.innerHTML = '\u2190 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629';
      backBtn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:6px',
        'padding:9px 18px',
        'border-radius:30px',
        'background:#f1f5f9',
        'color:#475569',
        'font-weight:700',
        'font-size:14px',
        'text-decoration:none',
        'border:1.5px solid #e2e8f0',
        'white-space:nowrap',
      ].join(';');
      backBtn.onmouseover = function () { this.style.background = '#e2e8f0'; };
      backBtn.onmouseout  = function () { this.style.background = '#f1f5f9'; };
      nav.appendChild(backBtn);
    }

    if (nextPage) {
      if (hubPage) {
        var sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:24px;background:#e2e8f0;flex-shrink:0;';
        nav.appendChild(sep);
      }

      var nextUrl = nextPage + '?hub=' + encodeURIComponent(hubPage || '');

      var nextBtn = document.createElement('a');
      nextBtn.href = nextUrl;
      nextBtn.innerHTML = '\u0627\u0644\u062a\u0627\u0644\u064a \u2192';
      nextBtn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:6px',
        'padding:9px 22px',
        'border-radius:30px',
        'background:linear-gradient(135deg,#003087,#1565c0)',
        'color:#fff',
        'font-weight:700',
        'font-size:14px',
        'text-decoration:none',
        'box-shadow:0 4px 14px rgba(0,48,135,0.30)',
        'white-space:nowrap',
      ].join(';');
      nextBtn.onmouseover = function () { this.style.opacity = '0.88'; };
      nextBtn.onmouseout  = function () { this.style.opacity = '1'; };
      nav.appendChild(nextBtn);
    }

    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBar);
  } else {
    buildBar();
  }
})();
