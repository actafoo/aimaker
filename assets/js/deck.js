/* =========================================================
   슬라이드 엔진
   - 1920×1080 무대를 화면에 맞춰 축소·확대
   - ←/→, Space, PgUp/PgDn(리모컨), Home/End, F(전체화면), M(목차)
   - 주소 뒤 #12 또는 #슬라이드id 로 바로가기
   - data-generate="이름" 영역은 MK.generators[이름](state)가 만든 슬라이드로 채움
   ========================================================= */
window.MK = window.MK || {};
MK.generators = MK.generators || {};

(function () {
  var stage, viewport, slides = [], cur = 0, idleTimer = null;
  var genSig = {};
  var POS_KEY = MK.config.storageKey + '-pos';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  MK.esc = esc;

  /* ---------- 배율 ---------- */
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.min(w / 1920, h / 1080);
    var x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    MK.deck.scale = s;
  }

  /* ---------- 동적 슬라이드 ---------- */
  function runGenerators(state, force) {
    $$('[data-generate]', stage).forEach(function (box) {
      var name = box.getAttribute('data-generate');
      var gen = MK.generators[name];
      if (!gen) return;
      var sig = gen.signature ? gen.signature(state) : 'static';
      if (!force && genSig[name] === sig && box.hasChildNodes()) return;
      genSig[name] = sig;
      box.innerHTML = gen(state);
    });
  }

  function collect() {
    slides = $$('.slide', stage);
    var total = slides.length;
    slides.forEach(function (sl, i) {
      sl.setAttribute('data-n', i + 1);
      if (!sl.id) sl.id = 's' + (i + 1);
      var f = $('.slide__footer', sl);
      if (!f && !sl.hasAttribute('data-no-footer')) {
        f = document.createElement('div'); f.className = 'slide__footer'; sl.appendChild(f);
      }
      if (f) f.innerHTML = esc(MK.config.session + ' · ' + MK.config.title) + '<b>' + (i + 1) + '</b>';
    });
    buildToc();
    buildBar();
    $('#dock-count').textContent = (cur + 1) + ' / ' + total;
  }

  function titleOf(sl) {
    if (sl.dataset.title) return sl.dataset.title;
    var h = $('.slide__title, .ch-head__title, .sv-head__title, .divider__title, .cover__title, .show-cover__title', sl);
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '슬라이드';
  }

  /* ---------- 이동 ---------- */
  function show(i, opts) {
    if (!slides.length) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    var prev = slides[cur];
    if (prev && prev !== slides[i]) {
      prev.classList.remove('is-active');
      document.dispatchEvent(new CustomEvent('deck:leave', { detail: { slide: prev } }));
    }
    cur = i;
    var sl = slides[i];
    sl.classList.add('is-active');
    $('#dock-count').textContent = (i + 1) + ' / ' + slides.length;
    var hash = '#' + (i + 1);
    if (!(opts && opts.noHash) && location.hash !== hash) history.replaceState(null, '', hash);
    try { localStorage.setItem(POS_KEY, String(i + 1)); } catch (e) {}
    $$('.toc__item').forEach(function (b) { b.classList.toggle('is-current', +b.dataset.i === i); });
    updateBar(i);
    document.dispatchEvent(new CustomEvent('deck:enter', { detail: { slide: sl, index: i } }));
  }
  function indexOfId(id) { for (var i = 0; i < slides.length; i++) if (slides[i].id === id) return i; return -1; }
  function goto(target) {
    if (typeof target === 'number') return show(target);
    var i = indexOfId(String(target));
    if (i >= 0) show(i);
  }
  function fromHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!h || h === 'admin') return false;
    if (/^\d+$/.test(h)) { show(parseInt(h, 10) - 1, { noHash: true }); return true; }
    var i = indexOfId(h); if (i >= 0) { show(i); return true; }
    return false;
  }

  /* ---------- 목차 ---------- */
  function buildToc() {
    var list = $('#toc-list'); if (!list) return;
    var html = '', sec = null;
    slides.forEach(function (sl, i) {
      var s = sl.dataset.section || '';
      if (s && s !== sec) { html += '<div class="toc__sec">' + esc(s) + '</div>'; sec = s; }
      html += '<button class="toc__item' + (i === cur ? ' is-current' : '') + '" data-i="' + i + '"><span>' + (i + 1) + '</span><span>' + esc(titleOf(sl)) + '</span></button>';
    });
    list.innerHTML = html;
  }
  /* ---------- 아래 슬라이드 바: 파트별 구간 + 슬라이드마다 한 칸 ---------- */
  var PART_COLOR = { '1': 'c-blue', '2': 'c-green', '3': 'c-purple', '4': 'c-yellow', '5': 'c-sky' };
  function shortSection(s) { return String(s || '').replace(/^(\d+)\.\s*/, '$1 '); }
  function buildBar() {
    var track = $('#sbar-track'); if (!track) return;
    showTip(null);
    var groups = [], last = null;
    slides.forEach(function (sl, i) {
      var name = sl.dataset.section || '';
      if (!last || last.name !== name) { last = { name: name, items: [] }; groups.push(last); }
      last.items.push(i);
    });
    track.innerHTML = groups.map(function (g) {
      var m = g.name.match(/^(\d+)\./), color = m ? (PART_COLOR[m[1]] || 'c-sky') : 'c-gray';
      return '<div class="sbar__sec ' + color + '" style="flex:' + g.items.length + '" data-first="' + g.items[0] + '">' +
        '<button class="sbar__label" data-i="' + g.items[0] + '" title="' + esc(g.name) + ' 처음으로">' + esc(shortSection(g.name) || '슬라이드') + '</button>' +
        '<div class="sbar__ticks">' + g.items.map(function (i) {
          return '<button class="sbar__tick" data-i="' + i + '" aria-label="' + (i + 1) + ' · ' + esc(titleOf(slides[i])) + '"></button>';
        }).join('') + '</div></div>';
    }).join('');
    updateBar(cur);
  }
  function updateBar(i) {
    $$('.sbar__tick').forEach(function (t) {
      var k = +t.dataset.i;
      t.classList.toggle('is-current', k === i);
      t.classList.toggle('is-past', k < i);
    });
    $$('.sbar__sec').forEach(function (sec) {
      sec.classList.toggle('is-current', !!sec.querySelector('.sbar__tick.is-current'));
    });
  }
  function showTip(t) {
    var tip = $('#sbar-tip'); if (!tip) return;
    if (!t) { tip.classList.remove('is-on'); return; }
    var b = t.getBoundingClientRect();
    tip.textContent = t.getAttribute('aria-label') || t.title;
    tip.style.left = Math.round(b.left + b.width / 2) + 'px';
    tip.style.top = Math.round(b.top - 10) + 'px';
    tip.classList.add('is-on');
  }

  function toggleToc(force) {
    var t = $('#toc'); var on = force == null ? !t.classList.contains('is-open') : force;
    t.classList.toggle('is-open', on);
  }

  /* ---------- 키보드 ---------- */
  function typing(e) {
    var t = e.target;
    if (!t || !t.tagName) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }
  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    if (typing(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); show(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); show(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); show(0); }
    else if (k === 'End') { e.preventDefault(); show(slides.length - 1); }
    else if (k === 'f' || k === 'F') { toggleFull(); }
    else if (k === 'm' || k === 'M' || k === 'o' || k === 'O') { toggleToc(); }
    else if (k === 'Escape') { toggleToc(false); }
  }

  function toggleFull() {
    if (!document.fullscreenElement) { (document.documentElement.requestFullscreen || function () {}).call(document.documentElement); }
    else if (document.exitFullscreen) document.exitFullscreen();
  }

  function wake() {
    var d = $('#dock'); if (!d) return;
    d.classList.remove('is-idle');
    clearTimeout(idleTimer);
    if (document.fullscreenElement) idleTimer = setTimeout(function () { d.classList.add('is-idle'); }, 2500);
  }

  /* ---------- 화면 UI 만들기 ---------- */
  function buildChrome() {
    var ic = MK.icon;
    document.body.insertAdjacentHTML('beforeend',
      '<nav class="dock sbar ui" id="dock" aria-label="슬라이드 이동">' +
        '<a id="dock-home" class="dock__link" href="index.html" title="허브로 돌아가기">' + ic('home') + '<span>허브</span></a>' +
        '<button id="dock-toc" title="목차 (M)">' + ic('list') + '<span>목차</span></button>' +
        '<button id="dock-prev" title="이전 (←)" aria-label="이전">' + ic('left') + '</button>' +
        '<div class="sbar__track" id="sbar-track"></div>' +
        '<span class="dock__count" id="dock-count">1 / 1</span>' +
        '<button id="dock-next" class="dock__primary" title="다음 (→)" aria-label="다음">' + ic('right') + '</button>' +
        '<button id="dock-full" title="전체화면 (F)" aria-label="전체화면">' + ic('expand') + '</button>' +
      '</nav>' +
      '<div class="sbar__tip ui" id="sbar-tip" role="tooltip"></div>' +
      '<aside class="toc ui" id="toc" aria-label="목차">' +
        '<div class="toc__head"><b>목차</b><button class="icon-btn" id="toc-close" aria-label="닫기">' + ic('x') + '</button></div>' +
        '<div class="toc__list" id="toc-list"></div>' +
        '<div class="toc__keys"><kbd>←</kbd> <kbd>→</kbd> 넘기기 · <kbd>F</kbd> 전체화면 · <kbd>M</kbd> 목차</div>' +
      '</aside>');
    $('#dock-prev').onclick = function () { show(cur - 1); };
    $('#dock-next').onclick = function () { show(cur + 1); };
    $('#dock-full').onclick = toggleFull;
    $('#dock-toc').onclick = function () { toggleToc(); };
    $('#toc-close').onclick = function () { toggleToc(false); };
    var track = $('#sbar-track');
    track.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return;
      showTip(null); show(+b.dataset.i);
    });
    track.addEventListener('mouseover', function (e) { var t = e.target.closest('.sbar__tick'); showTip(t || null); });
    track.addEventListener('mouseleave', function () { showTip(null); });
    track.addEventListener('focusin', function (e) { var t = e.target.closest('.sbar__tick'); if (t) showTip(t); });
    track.addEventListener('focusout', function () { showTip(null); });
    $('#toc-list').addEventListener('click', function (e) {
      var b = e.target.closest('.toc__item'); if (!b) return;
      show(+b.dataset.i); toggleToc(false);
    });
  }

  /* ---------- 슬라이드 안 링크: data-goto="슬라이드id" ---------- */
  function onClick(e) {
    var g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); goto(g.getAttribute('data-goto')); }
  }

  /* ---------- 공개 함수 ---------- */
  MK.deck = {
    scale: 1,
    init: function () {
      stage = $('#stage'); viewport = $('#viewport');
      buildChrome();
      var state = MK.store.getStateSync();
      runGenerators(state, true);
      collect();
      fit();
      window.addEventListener('resize', fit);
      document.addEventListener('keydown', onKey);
      stage.addEventListener('click', onClick);
      document.addEventListener('mousemove', wake);
      document.addEventListener('fullscreenchange', wake);
      window.addEventListener('hashchange', fromHash);
      if (!fromHash()) {
        var saved = 1; try { saved = parseInt(localStorage.getItem(POS_KEY), 10) || 1; } catch (e) {}
        show(saved - 1);
      }
    },
    /* 데이터가 바뀌면: 동적 슬라이드(서명이 바뀐 것만) 다시 만들고 쪽 번호 갱신 */
    refresh: function (force) {
      var curId = slides[cur] && slides[cur].id;
      var state = MK.store.getStateSync();
      runGenerators(state, force);
      collect();
      var i = indexOfId(curId);
      slides.forEach(function (s) { s.classList.remove('is-active'); });
      show(i >= 0 ? i : Math.min(cur, slides.length - 1), { noHash: false });
    },
    goto: goto,
    next: function () { show(cur + 1); },
    prev: function () { show(cur - 1); },
    current: function () { return slides[cur]; },
    slides: function () { return slides; },
    titleOf: titleOf
  };
})();
