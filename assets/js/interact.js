/* =========================================================
   조작하는 슬라이드 — HTML 교안이라서 할 수 있는 것들
   - 도전과제 필터 (한눈에 보기: 모델별 · 빈자리만)
   - 내 과제 맞춤 (모델별 코드 · 안 될 때 확인: 내 모델을 강조)
   - 도움 요청 (안 될 때 다섯 가지 확인) + 관리자 알림
   - 같은 타이머 표시 (모든 쪽 위 가운데)
   - 지금 여기 (오늘의 흐름)
   - 서보 각도 실험 (만들기)
   - 작품 하트 · 발표 순서 뽑기 (작품 발표회)
   - 수업 아이디어 모으기 (수업으로)
   도움 요청·같은 타이머·하트·아이디어는 서버(Code.gs)가 새 버전일 때만 켜집니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n, c) { return MK.icon(n, c); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function st() { return MK.store.getStateSync(); }
  function me() { return MK.store.getMe(); }
  function has(f) { return MK.store.supports && MK.store.supports(f); }
  function editing() { return MK.editor && MK.editor.isOn && MK.editor.isOn(); }
  function bad(err) { MK.ui.toast(err.message, true); }

  /* 이름이 필요할 때: 등록돼 있으면 바로, 아니면 이름 등록 창을 먼저 */
  function withMe(then, why) {
    var m = me();
    if (m) return then(m);
    MK.ui.form({ kicker: '이름 등록', title: '먼저 이름을 등록해 주세요', desc: why || '신청과 제출에 쓰는 이름과 같은 이름을 적어 주세요.',
      fields: MK.ui.personFields(null), note: MK.ui.PIN_NOTE, submitText: '등록',
      onSubmit: function (v) {
        return MK.store.identify(v).then(function () { setTimeout(function () { var n = me(); if (n) then(n); }, 80); });
      } });
  }

  /* =========================================================
     1. 도전과제 필터 — 고른 모델만 진하게, 나머지는 흐리게
     ========================================================= */
  var filt = { cat: null, open: false };

  MK.widgets['ch-filter'] = function (el) {
    var h = MK.categoryOrder.map(function (k) {
      var cat = MK.categories[k], on = filt.cat === k;
      return '<button type="button" class="tag ch-filter__btn c-' + cat.color + (on ? ' tag--solid is-on' : '') + '" data-filter-cat="' + esc(k) + '" aria-pressed="' + on + '"><span class="dot"></span>' + esc(k) + '</button>';
    }).join('');
    h += '<button type="button" class="tag ch-filter__btn ch-filter__open' + (filt.open ? ' is-on' : '') + '" data-filter-open aria-pressed="' + filt.open + '">' + ic('check') + ' 빈자리만</button>';
    el.innerHTML = h;
  };

  var baseOverview = MK.widgets['challenge-overview'];
  MK.widgets['challenge-overview'] = function (el, s) { baseOverview(el, s); paintFilter(el, s); };
  function paintFilter(el, s) {
    var any = !!(filt.cat || filt.open), shown = 0;
    $$('.ch-card', el).forEach(function (card) {
      var c = MK.challengeById((card.getAttribute('data-goto') || '').replace(/^ch-/, '')); if (!c) return;
      var full = MK.state.isClosed(s, c.id) || MK.state.enrolledIn(s, c.id).length >= MK.state.capOf(s, c.id);
      var hit = (!filt.cat || c.category === filt.cat) && (!filt.open || !full);
      card.classList.toggle('is-dim', any && !hit);
      if (hit) shown++;
    });
    var info = $('.ch-overview > .dashed', el);
    if (info && any) {
      var what = (filt.open ? '빈자리 있는 ' : '') + (filt.cat ? filt.cat + ' ' : '') + '과제';
      info.innerHTML = '<div class="t-lg" style="font-size:24px">' + (shown ? esc(what) + ' <span class="t-blue">' + shown + '개</span>' : '조건에 맞는 과제가 없어요') + '</div>' +
        '<div class="t-sm t-muted" style="font-size:20px;line-height:1.45">흐린 카드도 누르면 볼 수 있어요.<br>위의 태그를 한 번 더 누르면<br>전체를 봅니다.</div>';
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter-cat], [data-filter-open]'); if (!b) return;
    if (b.hasAttribute('data-filter-open')) filt.open = !filt.open;
    else { var k = b.getAttribute('data-filter-cat'); filt.cat = filt.cat === k ? null : k; }
    MK.renderWidgets(b.closest('.slide'));
  });

  /* =========================================================
     2. 내 과제 맞춤 — data-model="핸드포즈 이미지분류" 처럼 표시한 곳을
        내 모델이면 강조(is-mine), 아니면 흐리게(is-other)
     ========================================================= */
  // 내 도전과제: 아이디어 카드가 있으면 카드의 모델, 없으면 예전 신청의 도전과제
  function myChallenge(s) {
    var card = MK.state.myCard ? MK.state.myCard(s) : null;
    if (card) return { title: card.title, category: card.model, card: true };
    var e = MK.state.myEnrollment(s); return e ? MK.challengeById(e.challengeId) : null;
  }
  function applyPersonal(s) {
    var c = myChallenge(s), cat = c && c.category !== '자유발명' ? c.category : null;
    $$('[data-model]').forEach(function (el) {
      var mine = !!cat && el.getAttribute('data-model').split(/\s+/).indexOf(cat) >= 0;
      el.classList.toggle('is-mine', mine);
      el.classList.toggle('is-other', !!cat && !mine);
    });
  }
  MK.widgets['my-model'] = function (el, s) {
    var m = me(), c = myChallenge(s);
    if (!m) { el.innerHTML = '<button type="button" class="my-model my-model--empty" data-act="identify">' + ic('user') + ' 이름을 등록하면 내 모델이 강조돼요</button>'; return; }
    if (!c) { el.innerHTML = '<button type="button" class="my-model my-model--empty" data-goto="s-mycard">' + ic('hand') + ' 내 도전과제를 등록하면 내 모델이 강조돼요</button>'; return; }
    var cat = MK.categories[c.category] || MK.catOf(c);
    el.innerHTML = '<div class="my-model c-' + cat.color + '"><span class="my-model__k">내 도전과제</span><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.category) + '</span>' +
      '<span class="my-model__t">' + esc(c.title) + '</span></div>' +
      (c.category === '자유발명' ? '<div class="my-model__hint">자유발명은 고른 모델의 코드를 여세요</div>' : '');
  };

  /* =========================================================
     3. 도움 요청 — 확인 목록을 눌러 체크하고, 그래도 안 되면 요청
     ========================================================= */
  var CHECK_KEY = MK.config.storageKey + '-check5';
  var STEPS = [
    { v: '1', t: '1 · AI 연결용 코드' }, { v: '2', t: '2 · 내 장치 이름 연결' }, { v: '3', t: '3 · ID 글자 (모션인식은 핀 확인)' },
    { v: '4', t: '4 · 웹앱에서 ‘시작’' }, { v: '5', t: '5 · 링비트 전원' }, { v: '9', t: '재료·조립 등 다른 것' }, { v: '0', t: '잘 모르겠어요' }
  ];
  function stepText(v) { var x = STEPS.filter(function (s) { return s.v === String(v); })[0]; return x ? x.t.replace(/ \(.*\)$/, '') : '잘 모르겠어요'; }
  function stepShort(v) { v = String(v || '0'); return v === '0' ? '' : v === '9' ? '기타' : v + '번'; }

  function checkedList() {
    var out = [];
    $$('.checklist--tap').forEach(function (ul) { $$('li', ul).forEach(function (li, i) { if (li.classList.contains('is-done')) out.push(i + 1); }); });
    return out;
  }
  function saveChecks() { try { sessionStorage.setItem(CHECK_KEY, JSON.stringify(checkedList())); } catch (e) {} }
  function loadChecks() {
    var saved = []; try { saved = JSON.parse(sessionStorage.getItem(CHECK_KEY)) || []; } catch (e) {}
    $$('.checklist--tap').forEach(function (ul) { $$('li', ul).forEach(function (li, i) { li.classList.toggle('is-done', saved.indexOf(i + 1) >= 0); }); });
  }
  document.addEventListener('click', function (e) {
    var li = e.target.closest('.checklist--tap li'); if (!li || editing()) return;
    li.classList.toggle('is-done'); saveChecks();
  });

  MK.widgets['help-request'] = function (el, s) {
    if (!has('help')) { // 예전 서버: 원래 안내 그대로
      el.innerHTML = '<div class="callout help help--plain"><span class="circle c-blue">' + ic('hand') + '</span><span>그래도 안 되면<br>손을 들어 주세요.<br><span class="t-blue">분임강사가 갑니다.</span></span></div>';
      return;
    }
    var m = me(), admin = MK.store.isAdmin();
    var q = (s.help || []).slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var mi = -1; if (m) q.forEach(function (x, i) { if (x.name === m.name) mi = i; });
    var h = '<div class="callout help' + (mi >= 0 ? ' is-waiting' : '') + '">';
    if (mi >= 0) {
      var x = q[mi];
      h += '<div class="help__head"><span class="circle c-yellow">' + ic('hand') + '</span><div><div class="help__big">도움 요청 보냄 · <b>' + (mi + 1) + '번째</b></div>' +
        '<div class="help__sub">막힌 곳: ' + esc(stepText(x.step)) + (x.note ? '<br>“' + esc(x.note) + '”' : '') + '</div></div></div>' +
        '<div class="help__btns"><button type="button" class="btn btn--green btn--sm" data-help="cancel">' + ic('check') + ' 해결됐어요</button><button type="button" class="btn btn--ghost btn--sm" data-help="ask">' + ic('edit') + ' 고치기</button></div>';
    } else {
      h += '<div class="help__head"><span class="circle c-blue">' + ic('hand') + '</span><div class="help__big">그래도 안 되면<br><span class="t-blue">도움을 요청하세요.</span></div></div>' +
        '<div class="help__sub">분임강사가 요청한 순서대로 갑니다.</div>' +
        '<div class="help__btns"><button type="button" class="btn" data-help="ask">' + ic('hand') + ' 도움 요청하기</button></div>';
    }
    h += '<div class="help__queue"><span class="help__qk">대기 ' + q.length + '명</span>' + q.slice(0, 8).map(function (x, i) {
      var sh = stepShort(x.step);
      return '<span class="help__chip' + (m && x.name === m.name ? ' is-me' : '') + '">' + (i + 1) + '. ' + esc(x.name) + (sh ? ' <small>' + sh + '</small>' : '') +
        (admin ? '<button type="button" class="help__done" data-help-done="' + esc(x.id) + '" title="처리 완료">' + ic('check') + '</button>' : '') + '</span>';
    }).join('') + (q.length > 8 ? '<span class="help__more">외 ' + (q.length - 8) + '명</span>' : '') + '</div>';
    el.innerHTML = h + '</div>';
  };

  function askHelp() {
    withMe(function (m) {
      var mine = (st().help || []).filter(function (h) { return h.name === m.name; })[0];
      var done = checkedList(), first = [1, 2, 3, 4, 5].filter(function (n) { return done.indexOf(n) < 0; })[0];
      MK.ui.form({ kicker: '도움 요청', title: mine ? '도움 요청 고치기' : '분임강사에게 도움 요청',
        desc: '어디서 막혔는지 알려 주면 더 빨리 도울 수 있어요.' + (done.length ? '<br>확인한 것: <b>' + done.join('·') + '번</b>' : ''),
        fields: [
          { name: 'step', label: '어디서 막혔나요?', type: 'select', value: mine ? String(mine.step) : String(first || 0), options: STEPS.map(function (x) { return { value: x.v, label: x.t }; }) },
          { name: 'note', label: '한 줄 메모', small: '없어도 됩니다', value: mine ? mine.note : '', maxlength: 60, placeholder: '예: 서보가 한쪽으로만 돌아요' }
        ],
        submitText: mine ? '고치기' : '도움 요청 보내기',
        onSubmit: function (v) {
          return MK.store.requestHelp({ name: m.name, pin: m.pin, step: v.step, note: v.note, checked: done.join(',') })
            .then(function (r) { MK.ui.toast(r.updated ? '도움 요청을 고쳤어요.' : '도움 요청을 보냈어요. 분임강사가 갑니다.'); });
        } });
    }, '도움 요청에 이름이 필요해요. 신청할 때 쓴 이름과 같은 이름을 적어 주세요.');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-help]');
    if (b) {
      if (b.getAttribute('data-help') === 'ask') askHelp();
      else {
        var m = me(); if (!m) return;
        b.disabled = true;
        MK.store.cancelHelp(m).then(function () { MK.ui.toast('해결돼서 다행이에요!'); }, function (err) { b.disabled = false; bad(err); });
      }
      return;
    }
    var d = e.target.closest('[data-help-done]');
    if (d && MK.store.isAdmin()) { d.disabled = true; MK.store.resolveHelp(d.getAttribute('data-help-done')).then(function () { MK.ui.toast('처리했어요.'); }, bad); }
  });

  // 관리자: 새 도움 요청이 오면 알림
  var seenHelp = null;
  MK.store.subscribe(function () {
    if (!MK.store.isAdmin() || !has('help')) { seenHelp = null; return; }
    var list = st().help || [];
    if (seenHelp) {
      var fresh = list.filter(function (h) { return seenHelp.indexOf(h.id) < 0; });
      if (fresh.length) MK.ui.toast('도움 요청 · ' + fresh.map(function (h) { var sh = stepShort(h.step); return h.name + (sh ? '(' + sh + ')' : ''); }).join(', '));
    }
    seenHelp = list.map(function (h) { return h.id; });
  });

  /* =========================================================
     4. 같은 타이머 — 타이머가 돌고 있으면 모든 쪽 위 가운데에 남은 시간
     ========================================================= */
  var chip = null, lastLeft = null;
  function timerSlide() { var w = $('#stage [data-widget="timer"]'); return w ? w.closest('.slide') : null; }
  function paintChip() {
    if (!MK.deck || !MK.deck.current) return;
    if (!chip) {
      chip = document.createElement('button'); chip.type = 'button'; chip.id = 'timer-chip'; chip.className = 'timer-chip ui';
      chip.title = '타이머 쪽으로 가기';
      chip.addEventListener('click', function () { var sl = timerSlide(); if (sl) MK.deck.goto(sl.id); });
      document.body.appendChild(chip);
    }
    var on = false;
    if (MK.timerMode() === 'shared') {
      var t = st().settings.timer || {}, l = MK.timerLeft(t);
      var active = t.total > 0 && (t.running || l < t.total);
      if (t.running && lastLeft != null && lastLeft > 0 && l <= 0) MK.ui.toast((t.label || '타이머') + ' 시간이 끝났어요!');
      lastLeft = t.running ? l : null;
      var cur = MK.deck.current();
      if (active && !(cur && cur === timerSlide())) {
        on = true;
        chip.innerHTML = ic('clock') + '<span>' + esc(t.label || '타이머') + '</span><b>' + (l <= 0 ? '시간 끝' : MK.fmtClock(l)) + '</b>' + (!t.running && l > 0 ? '<small>멈춤</small>' : '');
        chip.classList.toggle('is-done', l <= 0);
        chip.classList.toggle('is-warn', l > 0 && l <= 5 * 60000);
      }
    }
    chip.classList.toggle('is-on', on);
  }
  setInterval(paintChip, 500);
  document.addEventListener('deck:enter', function () { setTimeout(paintChip, 0); });

  /* =========================================================
     5. 지금 여기 — 연수 날 실제 시각에 맞춰 흐름 막대에 표시
        미리 보기: 주소 끝에 ?now=16:35 (날짜는 무시)
     ========================================================= */
  function courseTime() {
    var m = String(MK.config.date || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})[\s\S]*?(\d{1,2}):(\d{2})\s*[~\-–]\s*(\d{1,2}):(\d{2})/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3], start: +m[4] * 60 + +m[5], end: +m[6] * 60 + +m[7] } : null;
  }
  function nowMinutes(c) {
    var q = location.search.match(/[?&]now=(\d{1,2}):?(\d{2})/);
    if (q) return +q[1] * 60 + +q[2];
    var d = new Date(MK.store.now ? MK.store.now() : Date.now());
    if (d.getFullYear() !== c.y || d.getMonth() + 1 !== c.mo || d.getDate() !== c.d) return null;
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
  function hhmm(min) { var h = Math.floor(min / 60), m = Math.floor(min % 60); return h + ':' + (m < 10 ? '0' : '') + m; }
  function paintNow(el) {
    var wrap = el.closest('.tl-wrap'), tl = wrap && $('.timeline', wrap), slide = el.closest('.slide');
    if (!tl) return;
    var segs = $$(':scope > div', tl), steps = slide ? $$('.steps .step', slide) : [];
    segs.forEach(function (s) { s.classList.remove('is-now', 'is-past'); });
    steps.forEach(function (s) { s.classList.remove('is-now'); });
    el.innerHTML = '';
    var c = courseTime(); if (!c) return;
    var n = nowMinutes(c); if (n == null || n < c.start - 60 || n >= c.end) return;
    var span = c.end - c.start, t = n - c.start;
    if (t < 0) { el.innerHTML = '<div class="now-pin is-before" style="left:0%"><span class="now-pin__label">' + Math.ceil(-t) + '분 뒤 시작</span></div>'; return; }
    var w = segs.map(function (s) { return parseFloat(s.style.flex) || 1; }), sum = w.reduce(function (a, b) { return a + b; }, 0);
    var acc = 0, idx = segs.length - 1, segEnd = span;
    for (var i = 0; i < segs.length; i++) { var len = w[i] / sum * span; if (t < acc + len) { idx = i; segEnd = acc + len; break; } acc += len; }
    segs.forEach(function (s, i) { s.classList.toggle('is-past', i < idx); s.classList.toggle('is-now', i === idx); });
    var stepNo = parseInt(segs[idx].getAttribute('data-step'), 10);
    if (stepNo && steps[stepNo - 1]) steps[stepNo - 1].classList.add('is-now');
    var pct = t / span * 100, side = pct < 14 ? ' is-left' : pct > 86 ? ' is-right' : '';
    el.innerHTML = '<div class="now-pin' + side + '" style="left:' + pct.toFixed(2) + '%"><span class="now-pin__label">지금 ' + hhmm(n) + ' · ' + esc(segs[idx].textContent.trim()) +
      ' <b>' + Math.max(1, Math.ceil(segEnd - t)) + '분 남음</b></span></div>';
  }
  MK.widgets['now-marker'] = function (el) { paintNow(el); };
  setInterval(function () { $$('[data-widget="now-marker"]').forEach(paintNow); }, 20000);

  /* =========================================================
     6. 서보 각도 실험 — 슬라이더로 각도를 바꾸면 서보 팔이 실제 속도로 돌아감
        (SG90 기준 약 0.1초에 60° = 600°/초)
     ========================================================= */
  var SPEED = 600; // 도/초
  var CX = 320, CY = 330;
  function hornPath() {
    return 'M' + CX + ' ' + (CY - 24) + ' L' + (CX + 168) + ' ' + (CY - 12) + ' A12 12 0 0 1 ' + (CX + 168) + ' ' + (CY + 12) + ' L' + CX + ' ' + (CY + 24) + ' A24 24 0 0 1 ' + CX + ' ' + (CY - 24) + ' Z';
  }
  function servoSvg() {
    var ticks = '', labels = '';
    for (var a = 0; a <= 180; a += 15) {
      var r1 = 250, r2 = a % 45 === 0 ? 222 : 236, rad = a * Math.PI / 180;
      ticks += '<line x1="' + (CX + r1 * Math.cos(rad)).toFixed(1) + '" y1="' + (CY - r1 * Math.sin(rad)).toFixed(1) + '" x2="' + (CX + r2 * Math.cos(rad)).toFixed(1) + '" y2="' + (CY - r2 * Math.sin(rad)).toFixed(1) + '"/>';
      if (a % 45 === 0) labels += '<text x="' + (CX + 282 * Math.cos(rad)).toFixed(1) + '" y="' + (CY - 282 * Math.sin(rad) + 9).toFixed(1) + '">' + a + '°</text>';
    }
    var holes = [62, 96, 130, 160].map(function (x) { return '<circle cx="' + (CX + x) + '" cy="' + CY + '" r="4.5"/>'; }).join('');
    return '<svg class="servo__svg" viewBox="0 0 640 480" role="img" aria-label="서보모터와 각도">' +
      '<path class="servo__dial" d="M' + (CX - 250) + ' ' + CY + ' A250 250 0 0 1 ' + (CX + 250) + ' ' + CY + ' Z"/>' +
      '<g class="servo__ticks">' + ticks + '</g><g class="servo__labels">' + labels + '</g>' +
      '<g class="servo__body"><rect x="' + (CX - 138) + '" y="' + (CY + 6) + '" width="276" height="44" rx="8"/><circle class="hole" cx="' + (CX - 120) + '" cy="' + (CY + 28) + '" r="7"/><circle class="hole" cx="' + (CX + 120) + '" cy="' + (CY + 28) + '" r="7"/>' +
        '<rect x="' + (CX - 96) + '" y="' + (CY - 50) + '" width="192" height="150" rx="14"/><text x="' + CX + '" y="' + (CY + 86) + '">서보모터</text></g>' +
      '<path class="servo__ghost" d="' + hornPath() + '"/>' +
      '<g class="servo__horn"><path d="' + hornPath() + '"/><g class="holes">' + holes + '</g></g>' +
      '<circle class="servo__boss" cx="' + CX + '" cy="' + CY + '" r="26"/><circle class="servo__shaft" cx="' + CX + '" cy="' + CY + '" r="10"/>' +
      '</svg>';
  }
  function stmt(pin, v) { return '<div class="mcb-stmt"><span class="mcb-dd">' + pin + ' <i class="mcb-caret"></i></span>에 서보 값<span class="mcb-num" data-v>' + v + '</span>출력</div>'; }
  function pauseStmt(v) { return '<div class="mcb-stmt mcb-stmt--basic">일시중지 (ms)<span class="mcb-num" data-p>' + v + '</span></div>'; }

  MK.widgets['servo-lab'] = function (el) {
    var A0 = 0, B0 = 180, P0 = 500;
    el.innerHTML = '<div class="servo">' +
      '<div class="servo__stage card">' + servoSvg() + '<div class="servo__tip" data-tip>0°에서 혼(날개)을 끼우면 0~180°를 모두 쓸 수 있어요</div></div>' +
      '<div class="servo__side">' +
        '<div class="servo__one card"><div class="servo__h">각도 하나 보내기</div>' +
          '<div class="servo__row"><div class="servo__deg"><b data-deg>90</b>°</div><input class="servo__range" type="range" min="0" max="180" step="1" value="90" data-one aria-label="서보 각도"></div>' +
          '<div class="servo__presets">' + [0, 45, 90, 135, 180].map(function (a) { return '<button type="button" class="btn btn--ghost btn--sm" data-preset="' + a + '">' + a + '°</button>'; }).join('') + '</div>' +
          '<div class="mcb servo__code" data-code-one>' + stmt('P0', 90) + '</div></div>' +
        '<div class="servo__swing card"><div class="servo__h">두 각도 번갈아 <small>무한반복 안에서</small></div>' +
          '<div class="servo__swing-grid"><div class="servo__sliders">' +
            '<label>각도 A <b data-show="a">' + A0 + '°</b><input type="range" min="0" max="180" step="5" value="' + A0 + '" data-a></label>' +
            '<label>각도 B <b data-show="b">' + B0 + '°</b><input type="range" min="0" max="180" step="5" value="' + B0 + '" data-b></label>' +
            '<label>pause <b data-show="p">' + P0 + 'ms</b><input type="range" min="100" max="1000" step="50" value="' + P0 + '" data-p></label></div>' +
            '<div class="mcb servo__code"><div class="mcb-c mcb--loop"><div class="mcb-head"><svg class="i"><use href="#i-list"></use></svg>무한반복</div><div class="mcb-arm"></div>' +
              '<div class="mcb-in" data-code-swing>' + stmt('P0', A0) + pauseStmt(P0) + stmt('P0', B0) + pauseStmt(P0) + '</div><div class="mcb-foot"></div></div></div></div>' +
          '<div class="servo__go"><button type="button" class="btn" data-swing>' + ic('play') + ' 돌려 보기</button><div class="servo__verdict" data-verdict></div></div>' +
        '</div>' +
      '</div></div>';

    var horn = $('.servo__horn', el), ghost = $('.servo__ghost', el), tip = $('[data-tip]', el);
    var one = $('[data-one]', el), deg = $('[data-deg]', el), codeOne = $('[data-code-one] [data-v]', el);
    var inA = $('[data-a]', el), inB = $('[data-b]', el), inP = $('[data-p]', el), swingBtn = $('[data-swing]', el), verdict = $('[data-verdict]', el);
    var actual = 90, target = 90, swinging = false, swingT = 0, swingSide = 0, raf = 0, last = 0;

    function draw() {
      horn.setAttribute('transform', 'rotate(' + (-actual).toFixed(2) + ' ' + CX + ' ' + CY + ')');
      ghost.setAttribute('transform', 'rotate(' + (-target) + ' ' + CX + ' ' + CY + ')');
      ghost.style.opacity = Math.abs(target - actual) > 1 ? '1' : '0';
      deg.textContent = Math.round(actual);
      tip.classList.toggle('is-on', Math.round(actual) === 0 && !swinging);
    }
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (swinging) {
        swingT += dt * 1000;
        var p = +inP.value;
        if (swingT >= p) { swingT -= p; swingSide = 1 - swingSide; target = swingSide ? +inB.value : +inA.value; markCode(); }
      }
      var diff = target - actual, step = SPEED * dt;
      actual = Math.abs(diff) <= step ? target : actual + Math.sign(diff) * step;
      draw();
      if (swinging || actual !== target) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function markCode() {
      var rows = $$('[data-code-swing] > .mcb-stmt', el);
      rows.forEach(function (r, i) { r.classList.toggle('is-run', swinging && i === swingSide * 2); });
    }
    function judge() {
      var need = Math.abs(+inA.value - +inB.value) / SPEED * 1000, p = +inP.value;
      verdict.className = 'servo__verdict ' + (p >= need ? 'is-ok' : 'is-bad');
      verdict.innerHTML = need < 1 ? '두 각도가 같아서 움직이지 않아요.' :
        p >= need ? ic('check') + ' 끝까지 가요. 한 번 움직이는 데 약 ' + (need / 1000).toFixed(2) + '초' :
        'pause가 짧아 끝까지 못 가고 되돌아와요. <b>' + Math.ceil(need / 50) * 50 + 'ms</b> 이상으로 늘려 보세요';
    }
    function syncSwing() {
      $('[data-show="a"]', el).textContent = inA.value + '°'; $('[data-show="b"]', el).textContent = inB.value + '°'; $('[data-show="p"]', el).textContent = inP.value + 'ms';
      var v = $$('[data-code-swing] [data-v]', el), p = $$('[data-code-swing] [data-p]', el);
      v[0].textContent = inA.value; v[1].textContent = inB.value; p[0].textContent = inP.value; p[1].textContent = inP.value;
      judge();
    }
    function stopSwing() { swinging = false; swingBtn.innerHTML = ic('play') + ' 돌려 보기'; markCode(); }
    function setOne(a) { stopSwing(); target = a; one.value = a; codeOne.textContent = a; kick(); }

    one.addEventListener('input', function () { setOne(+one.value); });
    $$('[data-preset]', el).forEach(function (b) { b.addEventListener('click', function () { setOne(+b.getAttribute('data-preset')); }); });
    [inA, inB, inP].forEach(function (i) { i.addEventListener('input', syncSwing); });
    swingBtn.addEventListener('click', function () {
      if (swinging) return stopSwing();
      swinging = true; swingT = 0; swingSide = 0; target = +inA.value; swingBtn.innerHTML = '멈춤'; markCode(); kick();
    });
    document.addEventListener('deck:leave', function (e) { if (e.detail.slide.contains(el)) stopSwing(); });
    syncSwing(); draw();
  };
  MK.widgets['servo-lab'].once = true;

  /* =========================================================
     7. 작품 하트 · 발표 순서 뽑기
     ========================================================= */
  function heartBtn(id, s) {
    var names = (s.hearts || {})[id] || [], m = me();
    var sub = s.submissions.filter(function (x) { return x.id === id; })[0];
    if (!sub) return '';
    var own = !!m && sub.name === m.name, on = !!m && names.indexOf(m.name) >= 0;
    var who = names.length ? names.slice(0, 12).join(', ') + (names.length > 12 ? ' 외 ' + (names.length - 12) + '명' : '') : '';
    return '<button type="button" class="heart' + (on ? ' is-on' : '') + (own ? ' is-own' : '') + '" data-heart="' + esc(id) + '"' + (own ? ' disabled' : '') +
      ' title="' + esc(own ? '내 작품' + (who ? ' · ' + who : '') : on ? '하트 취소' : '이 작품에 하트' + (who ? ' · ' + who : '')) + '">' + ic('heart') + '<span>' + names.length + '</span></button>';
  }
  MK.widgets.hearts = function (el, s) { el.innerHTML = has('hearts') ? heartBtn(el.getAttribute('data-sub'), s) : ''; };
  MK.widgets['heart-count'] = function (el, s) {
    var n = has('hearts') ? ((s.hearts || {})[el.getAttribute('data-sub')] || []).length : 0;
    el.innerHTML = n ? ic('heart') + n : '';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-heart]'); if (!b || b.disabled) return;
    e.stopPropagation();
    var id = b.getAttribute('data-heart');
    withMe(function (m) {
      var names = (st().hearts || {})[id] || [], on = names.indexOf(m.name) < 0;
      // 먼저 화면에 바로 보여 주고, 서버 답을 받으면 맞춤
      $$('[data-heart="' + id + '"]').forEach(function (x) {
        x.classList.toggle('is-on', on); var n = x.querySelector('span'); if (n) n.textContent = Math.max(0, names.length + (on ? 1 : -1));
        if (on) { x.classList.remove('is-pop'); void x.offsetWidth; x.classList.add('is-pop'); }
      });
      MK.store.setHeart({ name: m.name, pin: m.pin, submissionId: id, on: on }).catch(function (err) { bad(err); MK.renderWidgets(); });
    }, '하트를 누르려면 이름이 필요해요.');
  });

  var dealtAt = 0;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shuffle]'); if (!b || !MK.store.isAdmin()) return;
    MK.ui.confirm({ kicker: '작품 발표회', title: '발표 순서를 뽑을까요?', desc: '모든 작품의 발표 순서를 무작위로 섞습니다. 관리자 › 제출물에서 다시 바꿀 수 있어요.', okText: '순서 뽑기' }).then(function (ok) {
      if (!ok) return;
      var grid = $('.show-grid'); if (grid) grid.classList.add('is-shuffling');
      MK.store.shuffleOrder().then(function () { dealtAt = Date.now(); MK.ui.toast('발표 순서를 뽑았어요.'); }, bad)
        .then(function () { setTimeout(function () { var g = $('.show-grid'); if (g) g.classList.remove('is-shuffling'); deal(); }, 50); });
    });
  });
  function deal() { // 새 순서의 카드를 한 장씩 나눠 주듯 보여 줌
    if (Date.now() - dealtAt > 4000) return;
    $$('.show-grid .show-tile').forEach(function (t, i) { t.style.animationDelay = (i * 70) + 'ms'; t.classList.remove('is-dealt'); void t.offsetWidth; t.classList.add('is-dealt'); });
  }

  /* =========================================================
     8. 수업 아이디어 모으기
     ========================================================= */
  MK.widgets['idea-wall'] = function (el, s) {
    if (!has('ideas')) { el.innerHTML = '<div class="dashed idea-empty">아이디어 모으기는 서버를 새 버전으로 바꾸면 열립니다.</div>'; return; }
    var list = (s.ideas || []).slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }), m = me(), admin = MK.store.isAdmin();
    var h = '<div class="idea-bar"><div class="idea-bar__n">' + ic('bulb') + '<span>모인 아이디어 <b>' + list.length + '</b>개</span></div>' +
      '<button type="button" class="btn" data-idea="new">' + ic('edit') + ' 내 아이디어 쓰기</button></div>';
    if (!list.length) h += '<div class="dashed idea-empty">아직 아이디어가 없어요. 첫 번째로 적어 보세요!</div>';
    else h += '<div class="idea-wall">' + list.map(function (x) {
      var c = MK.challengeById(x.challengeId), color = c ? MK.catOf(c).color : 'blue';
      return '<div class="idea c-' + color + '"><p class="idea__text">' + esc(x.text) + '</p><div class="idea__meta">' +
        (x.grade ? '<span class="idea__grade">' + esc(x.grade) + '</span>' : '') + '<span class="idea__who">' + esc(x.name) + '</span>' +
        (admin || (m && m.name === x.name) ? '<button type="button" class="idea__x" data-idea-del="' + esc(x.id) + '" title="지우기">' + ic('x') + '</button>' : '') + '</div></div>';
    }).join('') + '</div>';
    el.innerHTML = h;
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-idea="new"]')) {
      withMe(function (m) {
        MK.ui.form({ kicker: '수업 아이디어', title: '우리 반에서 해 볼 아이디어', desc: '오늘 만든 작품을 우리 반 수업에 어떻게 쓸지 한 줄로 적어 주세요. 모두의 화면에 바로 보입니다.',
          fields: [
            { name: 'grade', label: '학년·교과', small: '없어도 됩니다', placeholder: '예: 4학년 과학', maxlength: 20 },
            { name: 'text', label: '아이디어', type: 'textarea', maxlength: 80, placeholder: '예: 분류 챌린지로 분리배출 도우미를 만들어 환경 단원과 잇기' }
          ],
          submitText: '올리기',
          onSubmit: function (v) {
            return MK.store.postIdea({ name: m.name, pin: m.pin, grade: v.grade, text: v.text })
              .then(function (r) { MK.ui.toast(r.already ? '이미 올린 아이디어예요.' : '아이디어를 올렸어요!'); });
          } });
      }, '아이디어에 이름이 함께 보여요.');
      return;
    }
    var d = e.target.closest('[data-idea-del]');
    if (d) {
      MK.ui.confirm({ title: '이 아이디어를 지울까요?', okText: '지우기', danger: true }).then(function (ok) {
        if (ok) MK.store.deleteIdea(d.getAttribute('data-idea-del'), me()).then(function () { MK.ui.toast('지웠어요.'); }, bad);
      });
    }
  });

  /* =========================================================
     9. 카드 세 장 뽑기 (수업으로 · 학교 프로젝트 제안)
        지능(AI가 알아보는 것) + 기능(서보가 하는 일) + 상황(어디서)
        뽑은 카드는 이 창에만 기억하고, 다음 쪽 '설계 원칙 한 문장'에 채웁니다.
     ========================================================= */
  var DRAW = {
    intel: { name: '지능', sub: 'AI가 무엇을 알아보나', icon: 'binoculars', color: 'blue',
      list: [['손 모양', '핸드포즈'], ['물체 종류', '이미지분류'], ['표정', '얼굴인식'], ['다가오는 사람', '얼굴인식'], ['양손 높이', '모션인식']] },
    func: { name: '기능', sub: '서보가 무엇을 하나', icon: 'move', color: 'green',
      list: [['문 열고 닫기'], ['팔 들어 올리기'], ['깃발 흔들기'], ['길 바꾸기'], ['뚜껑 열기'], ['바늘로 가리키기'], ['두드리기'], ['밀어내기']] },
    place: { name: '상황', sub: '어디서', icon: 'home', color: 'purple',
      list: [['교실'], ['급식실'], ['복도'], ['과학실'], ['도서관'], ['보건실'], ['운동장'], ['신발장 앞']] }
  };
  var DRAW_ORDER = ['intel', 'func', 'place'];
  var DRAW_KEY = MK.config.storageKey + '-draw';
  var drawn = (function () { try { return JSON.parse(sessionStorage.getItem(DRAW_KEY)) || null; } catch (e) { return null; } })();
  function saveDraw() { try { sessionStorage.setItem(DRAW_KEY, JSON.stringify(drawn)); } catch (e) {} }
  function pickOne(k, avoid) { var n = DRAW[k].list.length, i; do { i = Math.floor(Math.random() * n); } while (n > 1 && i === avoid); return i; }
  function drawnVal(k) { return drawn && drawn[k] != null && DRAW[k].list[drawn[k]] ? DRAW[k].list[drawn[k]] : null; }

  function drawCard(k) {
    var c = DRAW[k], v = drawnVal(k);
    return '<button type="button" class="dcard c-' + c.color + (v ? ' is-open' : '') + '" data-draw="' + k + '" title="이 카드만 다시 뽑기">' +
      '<span class="dcard__kind">' + ic(c.icon) + ' ' + c.name + '</span><span class="dcard__sub">' + c.sub + '</span>' +
      (v ? '<span class="dcard__v">' + esc(v[0]) + '</span>' + (v[1] ? '<span class="dcard__m">' + esc(v[1]) + '</span>' : '') : '<span class="dcard__q">?</span>') + '</button>';
  }
  MK.widgets['card-draw'] = function (el) {
    el.innerHTML = '<div class="draw"><div class="draw__cards">' + DRAW_ORDER.map(drawCard).join('<span class="draw__op">+</span>') + '</div>' +
      '<div class="draw__bar"><button type="button" class="btn" data-draw="all">' + ic('spark') + (drawn ? ' 다시 뽑기' : ' 카드 뽑기') + '</button>' +
      '<span class="draw__hint">마음에 들 때까지 다시 뽑아도 됩니다.<br>카드 한 장만 눌러 바꿀 수도 있어요.</span></div></div>';
  };
  MK.widgets['card-draw'].once = true;

  /* 받침에 따라 을/를 */
  function eulReul(w) { var c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '을' : '를'; }
  var RULE_EX = { intel: '손 모양', func: '뚜껑 열기', place: '급식실', pain: '잔반통 뚜껑을 손으로 열어야 하는' };
  MK.widgets['design-rule'] = function (el) {
    var mine = !!drawnVal('intel'), v = mine ? { intel: drawnVal('intel')[0], func: drawnVal('func')[0], place: drawnVal('place')[0], pain: '' } : RULE_EX;
    var b = function (cls, t, blank) { return '<b class="rule__b c-' + cls + (blank ? ' is-blank' : '') + '">' + esc(t) + '</b>'; };
    el.innerHTML = '<div class="rule"><div class="rule__k">' + (mine ? '앞 쪽에서 뽑은 카드로' : '예시') + '</div>' +
      '<p class="rule__s">우리 팀은 AI가 ' + b('blue', v.intel) + eulReul(v.intel) + ' 알아보면 서보가 ' + b('green', v.func) + eulReul(v.func) + ' 하도록 만들어, ' +
      b('purple', v.place) + '에서 생기는 ' + (v.pain ? b('yellow', v.pain) : b('yellow', '불편 한 문장', true)) + ' 문제를 해결한다.</p></div>';
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-draw]'); if (!t) return;
    var k = t.getAttribute('data-draw'), keys = k === 'all' ? DRAW_ORDER : [k];
    drawn = drawn || {};
    keys.forEach(function (x) { drawn[x] = pickOne(x, drawn[x]); });
    saveDraw();
    $$('[data-widget="card-draw"]').forEach(function (w) {
      MK.widgets['card-draw'](w);
      keys.forEach(function (x, i) { var c = $('.dcard[data-draw="' + x + '"]', w); if (c) { c.style.animationDelay = (i * 120) + 'ms'; c.classList.add('is-flip'); } });
    });
    $$('[data-widget="design-rule"]').forEach(function (w) { MK.widgets['design-rule'](w); });
  });

  /* =========================================================
     10. 참고 영상 — <button data-yt="유튜브 id" data-yt-title="제목"> 을 누르면 큰 창에서 재생
         창을 닫으면 영상도 멈춤 (iframe을 지움)
     ========================================================= */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-yt]'); if (!b || editing()) return;
    var id = String(b.getAttribute('data-yt') || ''); if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return;
    var title = b.getAttribute('data-yt-title') || '참고 영상';
    var d = document.createElement('dialog'); d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box yt-modal"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="modal__kicker">참고 영상</div><h3 class="modal__title">' + esc(title) + '</h3>' +
      '<div class="yt-modal__frame"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1" title="' + esc(title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
      '<a class="link" href="https://www.youtube.com/shorts/' + id + '" target="_blank" rel="noopener">YouTube에서 열기 ↗</a></div>';
    document.body.appendChild(d);
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  });

  /* =========================================================
     위젯을 그릴 때마다: 내 과제 강조 + 타이머 칩
     ========================================================= */
  var baseRender = MK.renderWidgets;
  MK.renderWidgets = function (root) {
    baseRender(root);
    try { applyPersonal(st()); } catch (e) { console.error(e); }
    paintChip();
  };
  document.addEventListener('DOMContentLoaded', function () { loadChecks(); });
  MK.store.subscribe(function () { setTimeout(deal, 30); });
})();
