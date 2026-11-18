(function () {
  'use strict';
  var link = document.getElementById('hub-url');
  var button = document.getElementById('copy-url');
  var status = document.getElementById('copy-status');
  var address = link.href;
  try {
    var configured = new URL(window.MK.config.shareUrl);
    if (configured.protocol === 'https:' || configured.protocol === 'http:') {
      address = configured.href;
      link.href = address;
      link.textContent = address.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  } catch (e) {}
  button.addEventListener('click', async function () {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(address);
      } else {
        var field = document.createElement('textarea');
        field.value = address;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw new Error('Copy unavailable');
        } finally { field.remove(); button.focus(); }
      }
      status.textContent = '교안 주소를 복사했습니다.';
    } catch (e) {
      status.textContent = '주소를 선택해 복사해 주세요.';
    }
  });
})();
