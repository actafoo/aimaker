/* 제작 자료: 뒤쪽 슬라이드는 유지하고, 카드 위에서 자료만 열어 봅니다. */
(function () {
  'use strict';
  var dialog, view, canvas, opener, current, testContext = false, cache = {};
  var items = [
    ['s-code', '예제 코드 찾기'], ['s-wire', '선 연결·조립하기'], ['s-servo', '움직임 미리 보기'],
    ['s-servo-basic', '180°·360° 구분'], ['s-check5', '연결이 안 될 때'], ['s-fix', '인식·움직임 이상']
  ];
  var testItems = [['fix-ai', '다르게 인식해요'], ['s-check5', '인식은 맞는데 안 움직여요'], ['fix-structure', '움직이다 걸려요']];
  function lifecycle(name) {
    if (canvas) canvas.node.querySelectorAll('[data-widget]').forEach(function (el) { el.dispatchEvent(new Event('resource:' + name)); });
  }
  function makeDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'mw-dialog ui';
    dialog.setAttribute('aria-labelledby', 'mw-dialog-title');
    dialog.innerHTML = '<header class="mw-dialog-head"><div><span>만들기 자료</span><h2 id="mw-dialog-title"></h2></div><button type="button" class="mw-dialog-close" aria-label="자료 닫기">닫기 ' + MK.icon('x') + '</button></header>' +
      '<nav class="mw-dialog-nav" aria-label="다른 제작 자료">' + items.map(function (item) { return '<button type="button" data-resource-open="' + item[0] + '">' + item[1] + '</button>'; }).join('') + '</nav>' +
      '<div class="mw-dialog-subnav"></div><div class="mw-dialog-scroll"><div class="mw-dialog-view"></div></div>';
    document.body.appendChild(dialog);
    view = dialog.querySelector('.mw-dialog-view');
    dialog.querySelector('.mw-dialog-close').onclick = function () { dialog.close(); };
    dialog.addEventListener('click', function (e) { if (e.target === dialog) { var r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', function () { lifecycle('leave'); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); });
    // 자료 안의 다른 실험도 같은 창에서 엽니다. 슬라이드 이동 기록에는 남기지 않습니다.
    dialog.addEventListener('click', function (e) {
      var go = e.target.closest('[data-goto]');
      if (go) { e.preventDefault(); e.stopPropagation(); open(go.dataset.goto); return; }
      var li = e.target.closest('.checklist--tap li');
      if (li && current === 's-check5') {
        e.stopPropagation();
        var index = Array.prototype.indexOf.call(li.parentNode.children, li);
        var original = document.querySelectorAll('#s-check5 .checklist--tap li')[index];
        li.classList.toggle('is-done', !original.classList.contains('is-done'));
        original.click();
      }
    }, true);
    new ResizeObserver(fit).observe(dialog.querySelector('.mw-dialog-scroll'));
  }
  function material(id) {
    if (cache[id]) return cache[id];
    var source = document.getElementById(id), template = document.getElementById('mw-template-' + id);
    if (!source && !template) return null;
    var original = source ? source.querySelector('.slide__body') : template.content.querySelector('.slide__body');
    if (!original) return null;
    var node = document.createElement('div'); node.className = 'mw-resource'; node.dataset.resource = id;
    node.appendChild(original.cloneNode(true));
    // SVG 등 내부 id는 원본과 구분합니다. 공용 아이콘 참조는 그대로 둡니다.
    var ids = {};
    node.querySelectorAll('[id]').forEach(function (el) { ids[el.id] = 'mw-copy-' + el.id; el.id = ids[el.id]; });
    node.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (a) {
        var value = a.value;
        Object.keys(ids).forEach(function (old) { value = value.replace('url(#' + old + ')', 'url(#' + ids[old] + ')'); if (value === '#' + old) value = '#' + ids[old]; });
        if (value !== a.value) el.setAttribute(a.name, value);
      });
    });
    // 복사된 위젯에는 이벤트가 없으므로 원래 초기화 함수로 다시 연결합니다.
    node.querySelectorAll('[data-widget]').forEach(function (el) { el.innerHTML = ''; });
    var title = source ? source.querySelector('.slide__title').textContent : template.dataset.title;
    var style = source ? getComputedStyle(original) : null;
    var height = style ? 1080 - parseFloat(style.top) - parseFloat(style.bottom) : 628;
    return cache[id] = { node: node, title: title, height: Math.max(600, height || 700), initialized: false };
  }
  function fit() {
    if (!dialog || !dialog.open || !canvas) return;
    var scale = Math.min(1, view.clientWidth / 1470);
    var body = canvas.node.firstElementChild;
    var height = Math.max(canvas.height, body.scrollHeight);
    canvas.node.style.height = height + 'px';
    canvas.node.style.transform = 'scale(' + scale + ')';
    view.style.height = height * scale + 'px';
  }
  function open(id, trigger) {
    var next = material(id); if (!next) return;
    if (!dialog) makeDialog();
    if (!dialog.open) { opener = trigger || document.activeElement; testContext = !!opener.closest('#s-test'); dialog.showModal(); }
    lifecycle('leave');
    current = id; canvas = next;
    view.replaceChildren(canvas.node);
    dialog.querySelector('#mw-dialog-title').textContent = canvas.title;
    dialog.querySelector('.mw-dialog-head span').textContent = testContext ? '시험하고 고치기' : '만들기 자료';
    dialog.querySelector('.mw-dialog-nav').innerHTML = (testContext ? testItems : items).map(function (item) {
      var selected = item[0] === id || (id === 's-horn' && item[0] === 's-wire') || (id === 's-servo360' && item[0] === 's-servo-basic') || (id.indexOf('fix-') === 0 && item[0] === 's-fix');
      return '<button type="button" data-resource-open="' + item[0] + '" aria-pressed="' + selected + '">' + item[1] + '</button>';
    }).join('');
    var subnav = dialog.querySelector('.mw-dialog-subnav');
    subnav.innerHTML = id === 's-wire' || id === 's-horn' ? '<button type="button" data-resource-open="s-wire" aria-pressed="' + (id === 's-wire') + '">선 연결·전원</button><button type="button" data-resource-open="s-horn" aria-pressed="' + (id === 's-horn') + '">서보혼 끼우기</button>' : '';
    subnav.hidden = !subnav.innerHTML;
    canvas.node.style.height = canvas.height + 'px';
    if (!canvas.initialized) { MK.renderWidgets(canvas.node); canvas.initialized = true; }
    if (id === 's-check5') canvas.node.querySelectorAll('.checklist--tap li').forEach(function (li, index) { li.classList.toggle('is-done', document.querySelectorAll('#s-check5 .checklist--tap li')[index].classList.contains('is-done')); });
    lifecycle('enter');
    fit(); dialog.querySelector('.mw-dialog-scroll').scrollTop = 0;
    if (trigger && !trigger.isConnected) { var selected = dialog.querySelector('[data-resource-open="' + id + '"]'); (selected || dialog.querySelector('.mw-dialog-close')).focus({ preventScroll: true }); }
    requestAnimationFrame(fit);
  }
  document.addEventListener('click', function (e) {
    var button = e.target.closest('[data-resource-open]'); if (!button) return;
    e.preventDefault(); open(button.dataset.resourceOpen, button);
  });
})();
