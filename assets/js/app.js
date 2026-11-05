/* =========================================================
   시작 — 모든 부품을 연결합니다
   ========================================================= */
window.MK = window.MK || {};

/* 공통 조건 목록 위젯 (challenges.js의 MK.commonNotice) */
MK.widgets = MK.widgets || {};
MK.widgets['common-notice'] = function (el) {
  el.innerHTML = '<ul class="checklist checklist--done">' + MK.commonNotice.map(function (t, i) {
    return '<li><span class="box">' + MK.icon('check') + '</span><span class="bar" data-field="notice:' + i + '">' + MK.esc(t) + '</span></li>';
  }).join('') + '</ul>';
};
MK.widgets['design-freedom'] = function (el) { el.setAttribute('data-field', 'freedom'); el.textContent = MK.designFreedom; };

document.addEventListener('DOMContentLoaded', function () {
  if (MK.editor) MK.editor.snapshot(); // 고치기 전 원본을 먼저 떠 둠 (편집 저장용)
  MK.injectIcons();
  MK.deck.init();
  MK.renderWidgets();

  function sync() {
    document.body.classList.toggle('is-admin', MK.store.isAdmin());
    var flag = document.getElementById('demo-flag'), st = MK.store;
    if (!flag) return;
    if (st.kind !== 'remote') { flag.textContent = '데모 모드 · 이 브라우저에만 저장됩니다'; flag.classList.remove('is-hidden', 'is-off'); return; }
    var off = st.online === false;
    flag.textContent = off ? '서버 연결 끊김 · 다시 연결하는 중' : '서버에 연결하는 중…';
    flag.classList.toggle('is-off', off);
    flag.classList.toggle('is-hidden', !off && st.loaded);
  }
  sync();

  MK.store.subscribe(function () {
    MK.deck.refresh();
    MK.renderWidgets();
    sync();
    if (MK.editor) MK.editor.remark();
    if (MK.admin && document.querySelector('#admin.is-open')) MK.admin.render();
  });

  if (MK.admin) MK.admin.checkHash();
});
