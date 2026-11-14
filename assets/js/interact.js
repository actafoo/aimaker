/* =========================================================
   조작하는 슬라이드 — HTML 교안이라서 할 수 있는 것들
   - 도전과제 필터 (한눈에 보기: 모델별 · 빈자리만)
   - 내 과제 맞춤 (모델별 코드 · 안 될 때 확인: 내 모델을 강조)
   - 도움 요청 (안 될 때 다섯 가지 확인) + 관리자 알림
   - 같은 타이머 표시 (모든 쪽 위 가운데)
   - 지금 여기 (오늘의 흐름)
   - 서보 각도 실험 · 360° 서보 실험 (만들기)
   - 작품 하트 · 발표 순서 뽑기 (작품 발표회)
   - 수업 아이디어 모으기 · 난이도·제약 조건 설계 · 선생님도 바이브코딩 (수업으로)
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
    MK.ui.form({ kicker: '이름 등록', title: '먼저 이름을 등록해 주세요', desc: why || '도전과제 등록과 제출에 쓰는 이름과 같은 이름을 적어 주세요.',
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
    return card ? { title: card.title, category: card.model, card: true } : null; // 예전 신청 기록은 쓰지 않음
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
    { v: '1', t: '1 · AI 연결용 코드' }, { v: '2', t: '2 · 내 장치 이름 연결' }, { v: '3', t: '3 · ID 글자' },
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
    /* 오른쪽 아래 「내 코드대로 돌려 보기」: 블록을 넣고·빼고·순서를 바꾸고·숫자를 고쳐서 돌려 봄.
       처음 값은 7차시 기본 코드의 함수 move 1 (0 → 45 → 90, 사이마다 500ms). 고친 내용은 이 브라우저에 남음 */
    var PKEY = MK.config.storageKey + '-servo-prog', MAXN = 12, YIELD = 20; // 무한반복은 한 바퀴마다 약 20ms 쉼
    var DEF = { mode: 'once', steps: [['s', 0], ['p', 500], ['s', 45], ['p', 500], ['s', 90], ['p', 500]] };
    function fresh() { return JSON.parse(JSON.stringify(DEF)); }
    function readProg() {
      try {
        var v = JSON.parse(localStorage.getItem(PKEY));
        if (v && Array.isArray(v.steps)) { v.mode = v.mode === 'loop' ? 'loop' : 'once'; v.steps = v.steps.filter(function (s) { return s && (s[0] === 's' || s[0] === 'p'); }).slice(0, MAXN); return v; }
      } catch (e) {}
      return fresh();
    }
    var prog = readProg();
    function keepProg() { try { localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {} }
    function ang(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(180, Math.round(v))) : 0; }
    function ms(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(10000, Math.round(v))) : 0; }

    el.innerHTML = '<div class="servo">' +
      '<div class="servo__stage card">' + servoSvg() + '<div class="servo__tip" data-tip>0°에서 혼(날개)을 끼우면 0~180°를 모두 쓸 수 있어요</div></div>' +
      '<div class="servo__side">' +
        '<div class="servo__one card"><div class="servo__h">각도 하나 보내기</div>' +
          '<div class="servo__row"><div class="servo__deg"><b data-deg>90</b>°</div><input class="servo__range" type="range" min="0" max="180" step="1" value="90" data-one aria-label="서보 각도"></div>' +
          '<div class="servo__presets">' + [0, 45, 90, 135, 180].map(function (a) { return '<button type="button" class="btn btn--ghost btn--sm" data-preset="' + a + '">' + a + '°</button>'; }).join('') + '</div></div>' +
        '<div class="servo__prog card"><div class="servo__h">내 코드대로 돌려 보기 <small>블록을 넣고, 빼고, 숫자를 바꿔 보세요</small></div>' +
          '<div class="servo__prog-grid"><div class="mcb servo__code servo__list" data-list></div>' +
            '<div class="servo__ctl">' +
              '<div class="servo__seg" role="group" aria-label="실행 방식"><button type="button" data-mode="once">한 번만</button><button type="button" data-mode="loop">무한반복</button></div>' +
              '<div class="servo__add"><button type="button" class="btn btn--ghost btn--sm" data-add="s">+ 서보 값 출력</button><button type="button" class="btn btn--ghost btn--sm" data-add="p">+ 일시중지</button></div>' +
              '<div class="servo__go"><button type="button" class="btn" data-run>' + ic('play') + ' 돌려 보기</button><button type="button" class="linkish" data-reset>처음 값으로</button></div>' +
              '<div class="servo__verdict" data-verdict></div>' +
            '</div></div>' +
        '</div>' +
      '</div></div>';

    var horn = $('.servo__horn', el), ghost = $('.servo__ghost', el), tip = $('[data-tip]', el);
    var one = $('[data-one]', el), deg = $('[data-deg]', el), list = $('[data-list]', el), runBtn = $('[data-run]', el), verdict = $('[data-verdict]', el);
    var actual = 90, target = 90, running = false, pc = 0, wait = 0, curRow = -1, raf = 0, last = 0;

    function listHtml() {
      var rows = prog.steps.map(function (s, i) {
        var block = s[0] === 's'
          ? '<div class="mcb-stmt"><span class="mcb-dd">P0 <i class="mcb-caret"></i></span>에 서보 값<input class="mcb-num" type="number" min="0" max="180" step="5" value="' + ang(s[1]) + '" data-num="' + i + '" aria-label="' + (i + 1) + '번째 줄 서보 값">출력</div>'
          : '<div class="mcb-stmt mcb-stmt--basic">일시중지 (ms)<input class="mcb-num" type="number" min="0" max="10000" step="50" value="' + ms(s[1]) + '" data-num="' + i + '" aria-label="' + (i + 1) + '번째 줄 일시중지 밀리초"></div>';
        return '<div class="servo__step" data-step="' + i + '">' + block + '<span class="servo__ops">' +
          '<button type="button" data-op="up" data-i="' + i + '" aria-label="위로"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button type="button" data-op="down" data-i="' + i + '" aria-label="아래로"' + (i < prog.steps.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button type="button" data-op="del" data-i="' + i + '" aria-label="이 블록 빼기">×</button></span></div>';
      }).join('');
      var loop = prog.mode === 'loop';
      return '<div class="mcb-c ' + (loop ? 'mcb--loop' : 'mcb--event') + '"><div class="mcb-head"><svg class="i"><use href="#i-' + (loop ? 'list' : 'play') + '"></use></svg>' + (loop ? '무한반복' : '시작하면 실행') + '</div><div class="mcb-arm"></div>' +
        '<div class="mcb-in">' + (rows || '<div class="servo__empty">블록을 넣어 보세요</div>') + '</div><div class="mcb-foot"></div></div>';
    }
    function renderList() {
      list.innerHTML = listHtml();
      $$('[data-mode]', el).forEach(function (b) { var on = b.getAttribute('data-mode') === prog.mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $$('[data-add]', el).forEach(function (b) { b.disabled = prog.steps.length >= MAXN; });
      judge(); mark();
    }
    function mark() { $$('.servo__step', list).forEach(function (r, i) { r.firstChild.classList.toggle('is-run', running && i === curRow); }); }

    /* 지금 코드를 미리 따져 보기: 각도에 닿기 전에 다음 서보 명령이 오는 줄이 있는지 (좋다·나쁘다가 아니라 알려 주기만) */
    function judge() {
      var st = prog.steps, loop = prog.mode === 'loop';
      var firstW = -1; st.forEach(function (s, i) { if (s[0] === 's' && firstW < 0) firstW = i; });
      verdict.className = 'servo__verdict';
      if (!st.length) { verdict.textContent = ''; return; }
      if (firstW < 0) { verdict.textContent = '서보 값 출력 블록이 없어서 움직이지 않아요.'; return; }
      var pos = loop ? ang(st[firstW][1]) : actual, tgt = pos, lastW = -1, since = 0, need = 0, miss = [], cycles = loop ? 3 : 1, total = 0;
      for (var c = 0; c < cycles; c++) {
        for (var i = 0; i < st.length; i++) {
          if (st[i][0] === 's') {
            if (lastW >= 0 && Math.abs(tgt - pos) > 1 && (!loop || c === 2 || (c === 1 && i > lastW))) { if (!loop || c >= 1) miss.push({ row: lastW, a: tgt, need: Math.round(need), given: Math.round(since) }); }
            tgt = ang(st[i][1]); need = Math.abs(tgt - pos) / SPEED * 1000; since = 0; lastW = i;
          } else {
            var p = ms(st[i][1]), mv = SPEED * p / 1000, d = tgt - pos;
            pos = Math.abs(d) <= mv ? tgt : pos + Math.sign(d) * mv; since += p; if (c === 0) total += p;
          }
        }
        if (loop) { var mv2 = SPEED * YIELD / 1000, d2 = tgt - pos; pos = Math.abs(d2) <= mv2 ? tgt : pos + Math.sign(d2) * mv2; since += YIELD; if (c === 0) total += YIELD; }
      }
      var seen = {}; miss = miss.filter(function (m) { if (seen[m.row]) return false; seen[m.row] = 1; return true; });
      if (!miss.length) {
        verdict.className = 'servo__verdict is-ok';
        verdict.innerHTML = ic('check') + ' 모든 각도에 끝까지 가요.' + (loop ? ' 한 바퀴에 약 ' + (total / 1000).toFixed(1) + '초' : '');
      } else {
        var m = miss[0];
        verdict.className = 'servo__verdict is-note';
        verdict.innerHTML = '<b>' + (m.row + 1) + '번째 줄</b> ' + m.a + '°에 닿기 전에 다음 명령이 와요. 가는 데 약 ' + m.need + 'ms, 준 시간 ' + m.given + 'ms.' + (miss.length > 1 ? ' 이런 줄이 ' + miss.length + '곳' : '');
      }
    }

    function draw() {
      horn.setAttribute('transform', 'rotate(' + (-actual).toFixed(2) + ' ' + CX + ' ' + CY + ')');
      ghost.setAttribute('transform', 'rotate(' + (-target) + ' ' + CX + ' ' + CY + ')');
      ghost.style.opacity = Math.abs(target - actual) > 1 ? '1' : '0';
      deg.textContent = Math.round(actual);
      tip.classList.toggle('is-on', Math.round(actual) === 0 && !running);
    }
    function exec(dt) { // 코드를 dt(ms)만큼 진행. 서보 값 출력은 시간이 들지 않고, 일시중지만 시간을 씀
      var guard = 0, before = curRow;
      while (running && guard++ < 400) {
        if (wait > 0) { if (dt <= 0) break; var use = Math.min(wait, dt); wait -= use; dt -= use; if (wait > 0) break; }
        if (pc >= prog.steps.length) {
          if (prog.mode === 'loop' && prog.steps.length) { pc = 0; wait = YIELD; continue; }
          running = false; curRow = -1; runBtn.innerHTML = ic('play') + ' 돌려 보기'; break;
        }
        var s = prog.steps[pc];
        if (s[0] === 's') target = ang(s[1]); else wait = ms(s[1]);
        curRow = pc; pc++;
      }
      if (before !== curRow || !running) mark();
    }
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (running) exec(dt * 1000);
      var diff = target - actual, step = SPEED * dt;
      actual = Math.abs(diff) <= step ? target : actual + Math.sign(diff) * step;
      draw();
      if (running || actual !== target) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function stopRun() { if (!running) return; running = false; curRow = -1; runBtn.innerHTML = ic('play') + ' 돌려 보기'; mark(); }
    function setOne(a) { stopRun(); target = a; one.value = a; kick(); }
    function changed() { stopRun(); keepProg(); }

    one.addEventListener('input', function () { setOne(+one.value); });
    $$('[data-preset]', el).forEach(function (b) { b.addEventListener('click', function () { setOne(+b.getAttribute('data-preset')); }); });
    list.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-num'); if (k == null) return;
      var s = prog.steps[+k]; if (!s) return;
      s[1] = s[0] === 's' ? ang(e.target.value) : ms(e.target.value);
      changed(); judge();
    });
    list.addEventListener('change', function (e) { // 칸을 떠날 때 범위 안의 값으로 정리
      var k = e.target.getAttribute('data-num'); if (k == null || !prog.steps[+k]) return;
      e.target.value = prog.steps[+k][1];
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-op]'))) {
        var i = +b.getAttribute('data-i'), op = b.getAttribute('data-op'), st = prog.steps;
        if (op === 'del') st.splice(i, 1);
        else { var j = op === 'up' ? i - 1 : i + 1; if (j < 0 || j >= st.length) return; var t = st[i]; st[i] = st[j]; st[j] = t; }
        changed(); renderList(); return;
      }
      if ((b = e.target.closest('[data-add]'))) {
        if (prog.steps.length >= MAXN) return;
        prog.steps.push(b.getAttribute('data-add') === 's' ? ['s', 90] : ['p', 500]);
        changed(); renderList(); list.scrollTop = list.scrollHeight; return;
      }
      if ((b = e.target.closest('[data-mode]'))) { prog.mode = b.getAttribute('data-mode'); changed(); renderList(); return; }
      if (e.target.closest('[data-reset]')) { prog = fresh(); changed(); renderList(); return; }
      if (e.target.closest('[data-run]')) {
        if (running) return stopRun();
        if (!prog.steps.length) return;
        running = true; pc = 0; wait = 0; curRow = -1; runBtn.innerHTML = '멈춤'; kick();
      }
    });
    document.addEventListener('deck:leave', function (e) { if (e.detail.slide.contains(el)) stopRun(); });
    renderList(); draw();
  };
  MK.widgets['servo-lab'].once = true;

  /* =========================================================
     6-2. 360° 서보 실험 — 같은 「서보 값 출력」 블록이 각도 대신 방향과 빠르기를 정함
          90 근처 = 멈춤, 90보다 작으면 시계 방향·크면 반시계 방향(흔한 제품 기준), 90에서 멀수록 빠름
          화면 속 최고 속도는 예시(1분에 약 90바퀴). 실제 속도·방향·멈추는 값은 서보마다 조금 다름
     ========================================================= */
  var MAX360 = 540, DEAD360 = 2, W = 320, WY = 228;
  function spin360(v, zero) { // +: 시계 방향, -: 반시계 방향, 크기 0~1
    var d = v - zero, a = Math.abs(d);
    if (a <= DEAD360) return 0;
    var x = Math.min(1, (a - DEAD360) / (90 - DEAD360));
    return (d < 0 ? 1 : -1) * (1 - (1 - x) * (1 - x));
  }
  function speedWord(s) { s = Math.abs(s); return !s ? '멈춤' : s < 0.3 ? '천천히' : s < 0.7 ? '보통' : s < 0.95 ? '빠르게' : '가장 빠르게'; }
  function dirIco(cw) {
    var g = cw ? '' : ' transform="matrix(-1 0 0 1 32 0)"';
    return '<svg class="dir-ico" viewBox="0 0 32 32" aria-hidden="true"><g' + g + '><path d="M16 5.5 A10.5 10.5 0 1 1 5.5 16" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><polygon points="5.5,9.5 0,17.5 11,17.5" fill="currentColor"/></g></svg>';
  }
  function arcArrow(a1, a2, r) { // 시계 방향 화살표 호 (각도는 화면 기준, 0 = 오른쪽)
    var p = function (a, rr) { a = a * Math.PI / 180; return [W + rr * Math.cos(a), WY + rr * Math.sin(a)]; };
    var s = p(a1, r), e = p(a2, r), t = a2 * Math.PI / 180, tx = -Math.sin(t), ty = Math.cos(t), nx = Math.cos(t), ny = Math.sin(t);
    var f = function (x, y) { return x.toFixed(1) + ',' + y.toFixed(1); };
    return '<path d="M' + f(s[0], s[1]) + ' A' + r + ' ' + r + ' 0 0 1 ' + f(e[0], e[1]) + '"/>' +
      '<polygon points="' + f(e[0] + tx * 22, e[1] + ty * 22) + ' ' + f(e[0] + nx * 16 - tx * 2, e[1] + ny * 16 - ty * 2) + ' ' + f(e[0] - nx * 16 - tx * 2, e[1] - ny * 16 - ty * 2) + '"/>';
  }
  function wheelSvg() {
    var spokes = '';
    for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; spokes += '<line x1="' + W + '" y1="' + WY + '" x2="' + (W + 112 * Math.cos(a)).toFixed(1) + '" y2="' + (WY + 112 * Math.sin(a)).toFixed(1) + '"/>'; }
    return '<svg class="s360__svg" viewBox="0 0 640 456" role="img" aria-label="360도 서보에 끼운 바퀴">' +
      '<circle class="s360__dial" cx="' + W + '" cy="' + WY + '" r="214"/>' +
      '<g class="s360__dir">' + arcArrow(-160, -40, 186) + arcArrow(20, 140, 186) + '</g>' +
      '<g class="s360__wheel"><circle class="s360__tire" cx="' + W + '" cy="' + WY + '" r="150"/><circle class="s360__tread" cx="' + W + '" cy="' + WY + '" r="138"/>' +
        '<circle class="s360__rim" cx="' + W + '" cy="' + WY + '" r="122"/><g class="s360__spokes">' + spokes + '</g>' +
        '<circle class="s360__mark" cx="' + W + '" cy="' + (WY - 100) + '" r="13"/></g>' +
      '<circle class="servo__boss" cx="' + W + '" cy="' + WY + '" r="28"/><circle class="servo__shaft" cx="' + W + '" cy="' + WY + '" r="11"/>' +
      '</svg>';
  }

  MK.widgets['servo360-lab'] = function (el) {
    var V0 = 0, T0 = 1000;
    el.innerHTML = '<div class="servo s360">' +
      '<div class="servo__stage card">' + wheelSvg() +
        '<div class="s360__read" data-read></div>' +
        '<div class="s360__zero"><button type="button" class="btn btn--ghost btn--sm" data-zero>멈추는 값이 어긋난 서보로 바꾸기</button>' +
          '<div class="s360__tip" data-tip></div></div></div>' +
      '<div class="servo__side">' +
        '<div class="servo__one card"><div class="servo__h">서보 값 하나 보내기 <small>360° 서보에서는 방향과 빠르기</small></div>' +
          '<div class="servo__row"><div class="servo__deg"><b data-deg>90</b></div><input class="servo__range" type="range" min="0" max="180" step="1" value="90" data-one aria-label="서보 값"></div>' +
          '<div class="servo__presets">' + [0, 45, 80, 90, 100, 135, 180].map(function (a) { return '<button type="button" class="btn btn--ghost btn--sm" data-preset="' + a + '">' + a + '</button>'; }).join('') + '</div>' +
          '<div class="mcb servo__code" data-code-one>' + stmt('P0', 90) + '</div></div>' +
        '<div class="servo__swing card"><div class="servo__h">돌리고 멈추기 <small>각도 대신 시간으로 돌릴 만큼을 정해요</small></div>' +
          '<div class="servo__swing-grid"><div class="servo__sliders">' +
            '<label>서보 값 <b data-show="v">' + V0 + '</b><input type="range" min="0" max="180" step="5" value="' + V0 + '" data-rv></label>' +
            '<label>시간 <b data-show="t">' + T0 + 'ms</b><input type="range" min="100" max="3000" step="100" value="' + T0 + '" data-t></label></div>' +
            '<div class="mcb servo__code"><div class="mcb-c mcb--event"><div class="mcb-head">버튼 A 누르면</div><div class="mcb-arm"></div>' +
              '<div class="mcb-in" data-code-run>' + stmt('P0', V0) + pauseStmt(T0) + stmt('P0', 90) + '</div><div class="mcb-foot"></div></div></div></div>' +
          '<div class="servo__go"><button type="button" class="btn" data-run>' + ic('play') + ' 돌려 보기</button><div class="servo__verdict" data-verdict></div></div>' +
        '</div>' +
      '</div></div>';

    var wheel = $('.s360__wheel', el), dirG = $('.s360__dir', el), read = $('[data-read]', el), tip = $('[data-tip]', el), zeroBtn = $('[data-zero]', el);
    var one = $('[data-one]', el), deg = $('[data-deg]', el), codeOne = $('[data-code-one] [data-v]', el);
    var inV = $('[data-rv]', el), inT = $('[data-t]', el), runBtn = $('[data-run]', el), verdict = $('[data-verdict]', el);
    var rows = $$('[data-code-run] > .mcb-stmt', el), runV = $$('[data-code-run] [data-v]', el), runP = $('[data-code-run] [data-p]', el);
    var zero = 90, stopV = 90, found = false, cmd = 90, ang = 0, raf = 0, last = 0, onSlide = false;
    var run = null; // { t: 지난 시간, turned: 돈 각도 }

    function s() { return spin360(cmd, zero); }
    function paint() {
      var sp = s(), cw = sp > 0, n = Math.round(Math.abs(sp) * 5 + (sp ? 0.49 : 0));
      wheel.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' ' + W + ' ' + WY + ')');
      dirG.setAttribute('class', 's360__dir' + (sp ? (cw ? ' is-cw' : ' is-ccw') : ''));
      dirG.setAttribute('transform', cw || !sp ? '' : 'matrix(-1 0 0 1 ' + (2 * W) + ' 0)');
      var bars = ''; for (var i = 0; i < 5; i++) bars += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      read.className = 's360__read' + (sp ? (cw ? ' is-cw' : ' is-ccw') : ' is-stop');
      read.innerHTML = '<span class="s360__val">서보 값 <b>' + cmd + '</b></span>' + (sp ? dirIco(cw) + '<b>' + (cw ? '시계 방향' : '반시계 방향') + '</b>' : '<i class="s360__sq"></i><b>멈춤</b>') +
        (sp ? '<span class="s360__meter" title="빠르기">' + bars + '</span><span class="s360__word">' + speedWord(sp) + '</span>' : '');
    }
    function paintTip() {
      if (zero === 90) {
        tip.className = 's360__tip';
        tip.innerHTML = '화면 속 바퀴는 흔한 360° 서보 기준이에요. 실제 서보가 반대로 돌면 방향만 바꿔 생각하세요.';
      } else if (found) {
        tip.className = 's360__tip is-ok';
        tip.innerHTML = ic('check') + ' 찾았어요! 이 서보는 <b>' + stopV + '</b>에서 멈춰요. 코드의 90 대신 <b>' + stopV + '</b>을(를) 쓰세요.';
      } else {
        tip.className = 's360__tip is-warn';
        tip.innerHTML = '90을 보내도 바퀴가 천천히 돌아요. 오른쪽 「서보 값 하나 보내기」에서 값을 <b>1씩</b> 바꿔 가며 멈추는 값을 찾아보세요. (슬라이더를 누른 뒤 ← → 키)';
      }
    }
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      var step = s() * MAX360 * dt;
      ang = (ang + step) % 360;
      if (run) {
        run.turned += Math.abs(step); run.t += dt * 1000;
        if (run.t >= +inT.value) endRun();
      }
      paint();
      if (onSlide && (s() || run)) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
    }
    function kick() { if (onSlide && !raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function setCmd(v, fromRun) {
      if (!fromRun && run) stopRun(true);
      cmd = v; one.value = v; deg.textContent = v; codeOne.textContent = v;
      if (zero !== 90 && !fromRun && spin360(v, zero) === 0) { found = true; stopV = v; syncRun(); }
      paint(); paintTip(); kick();
    }
    function mark(i) { rows.forEach(function (r, k) { r.classList.toggle('is-run', k === i); }); }
    function predict() {
      var v = +inV.value, t = +inT.value, sp = spin360(v, zero), d = Math.abs(sp) * MAX360 * t / 1000, after = spin360(stopV, zero);
      if (!sp) return { cls: 'is-bad', html: '서보 값 ' + v + '은(는) 멈춤이라 돌지 않아요. 90에서 멀리 옮겨 보세요.' };
      var txt = (sp > 0 ? '시계' : '반시계') + ' 방향으로 약 <b>' + (d / 360).toFixed(1) + '바퀴</b>(' + Math.round(d) + '°)';
      if (after) return { cls: 'is-bad', html: txt + ' 돈 뒤에도 멈추지 않아요. 위 「서보 값 하나 보내기」로 <b>멈추는 값</b>을 먼저 찾아보세요.' };
      return { cls: 'is-ok', html: ic('check') + ' ' + txt + ' 돌고 멈춰요. 더 돌리려면 시간을 늘리거나 값을 90에서 멀리' };
    }
    function judge() { var p = predict(); verdict.className = 'servo__verdict ' + p.cls; verdict.innerHTML = p.html; }
    function syncRun() {
      $('[data-show="v"]', el).textContent = inV.value; $('[data-show="t"]', el).textContent = inT.value + 'ms';
      runV[0].textContent = inV.value; runV[1].textContent = stopV; runP.textContent = inT.value;
      runV[1].parentNode.classList.toggle('is-fixed', stopV !== 90);
      judge();
    }
    function endRun() {
      var turned = run.turned; run = null; mark(2); setCmd(stopV, true);
      runBtn.innerHTML = ic('play') + ' 다시 돌려 보기';
      var p = predict();
      verdict.className = 'servo__verdict ' + p.cls;
      verdict.innerHTML = spin360(stopV, zero) ? p.html : ic('check') + ' 약 <b>' + (turned / 360).toFixed(1) + '바퀴</b>(' + Math.round(turned) + '°) 돌고 멈췄어요.';
      setTimeout(function () { if (!run) mark(-1); }, 900);
    }
    function stopRun(silent) { run = null; mark(-1); runBtn.innerHTML = ic('play') + ' 돌려 보기'; if (!silent) judge(); }

    one.addEventListener('input', function () { setCmd(+one.value); });
    $$('[data-preset]', el).forEach(function (b) { b.addEventListener('click', function () { setCmd(+b.getAttribute('data-preset')); }); });
    [inV, inT].forEach(function (i) { i.addEventListener('input', function () { if (run) stopRun(true); syncRun(); }); });
    runBtn.addEventListener('click', function () {
      if (run) { stopRun(); setCmd(stopV, true); return; }
      run = { t: 0, turned: 0 }; mark(0); runBtn.innerHTML = '멈춤';
      verdict.className = 'servo__verdict'; verdict.textContent = '도는 중…';
      setCmd(+inV.value, true);
    });
    zeroBtn.addEventListener('click', function () {
      if (run) stopRun(true);
      if (zero === 90) {
        var picks = [85, 86, 87, 93, 94, 95];
        zero = picks[Math.floor(Math.random() * picks.length)]; found = false; stopV = 90;
        zeroBtn.textContent = '처음 서보로 돌아가기';
      } else { zero = 90; found = false; stopV = 90; zeroBtn.textContent = '멈추는 값이 어긋난 서보로 바꾸기'; }
      syncRun(); setCmd(90, true); paintTip();
    });
    document.addEventListener('deck:enter', function (e) { onSlide = e.detail.slide.contains(el); if (onSlide) kick(); });
    document.addEventListener('deck:leave', function (e) { if (e.detail.slide.contains(el)) { onSlide = false; if (run) stopRun(true); } });
    onSlide = !!(MK.deck && MK.deck.current && el.closest('.slide') === MK.deck.current());
    syncRun(); paint(); paintTip(); kick();
  };
  MK.widgets['servo360-lab'].once = true;

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
      ' title="' + esc(own ? '내 작품에는 하트를 누를 수 없어요' + (who ? ' · ' + who : '') : on ? '하트 취소' : '이 작품에 하트' + (who ? ' · ' + who : '')) + '">' + ic('heart') + '<span>' + names.length + '</span>' + (own ? '<small>내 작품</small>' : '') + '</button>';
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
     9. 카드 세 장 뽑기 (PART 1 · 막히면 카드를 뽑아 억지로 엮어 보기 = 강제 연결법)
        지능(AI가 알아보는 것) + 기능(서보가 하는 일) + 상황(어디서)
        뽑은 카드는 이 창에만 기억하고, 「이 카드로 내 도전과제 쓰기」를 누르면 카드 빈칸으로 들어갑니다 (cards.js)
     ========================================================= */
  var DRAW = {
    intel: { name: '지능', sub: 'AI가 무엇을 알아보나', icon: 'binoculars', color: 'blue',
      list: [['손 모양', '핸드포즈'], ['손가락 개수', '핸드포즈'], ['물체 종류', '이미지분류'], ['물체의 색', '이미지분류'], ['양손 높이', '모션인식']] },
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
  MK.draw = { current: function () { return { intel: drawnVal('intel'), func: drawnVal('func'), place: drawnVal('place') }; } };

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
  /* =========================================================
     11. 난이도·제약 조건 설계 (수업으로) — 조건 여섯 줄 × 기초·보통·도전
         출발 예시(오늘 연수 · 초등 고학년 · 영재교육)를 고르거나 칸을 눌러 바꾸면
         학생에게 줄 과제 문장과 난이도 막대가 함께 바뀜. 이 화면 안에서만 기억
     ========================================================= */
  var LV_ROWS = [
    { label: '문제', icon: 'target', cells: ['교사가 문제 제시', '상황 카드에서 고르기', '학생이 직접 찾기'],
      say: ['선생님이 정한 교실 문제를 풉니다', '상황 카드에서 고른 문제를 풉니다', '우리 학교에서 직접 찾은 불편을 풉니다'] },
    { label: 'AI 인식', icon: 'binoculars', cells: ['신호 2가지', '신호 3가지', '두 모델 비교해 고르기'],
      say: ['AI가 신호 2가지를 알아보면', 'AI가 신호 3가지를 알아보면', '두 AI 모델 중 더 잘 맞는 쪽을 골라 신호를 알아보면'] },
    { label: '서보', icon: 'gear', cells: ['1개 · 한 동작', '2개 · 각자 움직이기', '2개 · 차례로 이어 움직이기'],
      say: ['서보 1개가 움직이는', '서보 2개가 각자 움직이는', '서보 2개가 차례로 이어 움직이는'] },
    { label: '코드', icon: 'code', cells: ['완성 코드의 값만 바꾸기', '기본 코드에 조건 채우기', '직접 설계 · AI 도움 가능'],
      say: ['코드는 완성 코드의 값만 바꿉니다', '코드는 기본 코드에 조건을 채웁니다', '코드는 직접 설계합니다(생성형 AI 도움 가능)'] },
    { label: '재료·구조', icon: 'scissors', cells: ['도안 따라 만들기', '골판지로 자유롭게', 'A4 골판지 2장만'],
      say: ['도안을 따라', '골판지로 자유롭게', 'A4 골판지 2장만으로'] },
    { label: '시험·발표', icon: 'flag', cells: ['작동하면 성공', '친구가 5번 시험 · 횟수 기록', '조건 바꿔 비교 · 고친 근거'],
      say: ['작동하면 성공입니다', '옆 친구가 5번 시험해 성공 횟수를 기록합니다', '조건을 하나 바꿔 비교하고 고친 근거를 발표합니다'] }
  ];
  var LV_PRESETS = [
    { id: 'today', name: '오늘 연수', color: 'yellow', pick: [1, 0, 1, 1, 1, 1] },
    { id: 'upper', name: '5~6학년 · 첫 프로젝트', color: 'blue', pick: [0, 0, 0, 0, 1, 1] },
    { id: 'gifted', name: '영재학급 · 동아리', color: 'purple', pick: [2, 1, 2, 2, 2, 2] }
  ];
  MK.widgets['level-design'] = function (el) {
    var cur = LV_PRESETS[1].pick.slice(), preset = 'upper';
    var today = LV_PRESETS[0].pick;
    var head = '<div class="lv__h"></div>' + ['기초', '보통', '도전'].map(function (n, k) {
      return '<div class="lv__h lv__h--' + (k + 1) + '"><span class="lv__dots">' + '●●●'.slice(0, k + 1) + '<i>' + '●●●'.slice(k + 1) + '</i></span>' + n + '</div>';
    }).join('');
    var body = LV_ROWS.map(function (r, ri) {
      return '<div class="lv__label"><span class="circle">' + ic(r.icon) + '</span>' + esc(r.label) + '</div>' + r.cells.map(function (c, ci) {
        return '<button type="button" class="lv__cell" data-r="' + ri + '" data-c="' + ci + '">' + esc(c) + (today[ri] === ci ? '<span class="lv__today">오늘</span>' : '') + '</button>';
      }).join('');
    }).join('');
    el.innerHTML = '<div class="lv">' +
      '<div class="lv__main">' +
        '<div class="lv__presets" role="group" aria-label="출발 예시">' + LV_PRESETS.map(function (p) {
          return '<button type="button" class="lv__preset c-' + p.color + '" data-preset="' + p.id + '">' + esc(p.name) + '</button>';
        }).join('') + '</div>' +
        '<div class="lv__table">' + head + body + '</div>' +
        '<div class="lv__fix"><div class="lv__fix-a"><span>정해 준 것</span>이 표의 조건</div><div class="lv__fix-b"><span>열어 둔 것</span>어떤 문제를, 어떤 구조로 풀지</div></div>' +
      '</div>' +
      '<div class="lv__side">' +
        '<div class="lv__card"><div class="lv__tag" data-tag></div><div class="kk">학생에게 줄 과제</div><p class="lv__task" data-task aria-live="polite"></p>' +
          '<p class="lv__more" data-more hidden>더 조이려면: 서보 1개로 두 가지 일 하기</p>' +
          '<div class="lv__meter"><div class="lv__bar"><i data-pin></i></div><div class="lv__scale"><span>기초</span><span>보통</span><span>도전</span></div></div></div>' +
      '</div></div>';
    var root = $('.lv', el), tag = $('[data-tag]', el), task = $('[data-task]', el), pin = $('[data-pin]', el);
    function paint() {
      var p = LV_PRESETS.filter(function (x) { return x.id === preset; })[0];
      root.className = 'lv c-' + (p ? p.color : 'green');
      $$('.lv__preset', el).forEach(function (b) { var on = b.getAttribute('data-preset') === preset; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $$('.lv__cell', el).forEach(function (b) { var on = cur[+b.getAttribute('data-r')] === +b.getAttribute('data-c'); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      tag.textContent = p ? p.name : '내가 고친 설계';
      $('[data-more]', el).hidden = preset !== 'gifted';
      var s = function (k) { return LV_ROWS[k].say[cur[k]]; };
      task.textContent = s(0) + '. ' + s(1) + ' ' + s(2) + ' 장치를 ' + s(4) + ' 만듭니다. ' + s(3) + '. ' + s(5) + '.';
      var sum = cur.reduce(function (a, b) { return a + b; }, 0); // 0~12
      pin.style.left = (sum / 12 * 100).toFixed(1) + '%';
    }
    $$('.lv__preset', el).forEach(function (b) {
      b.addEventListener('click', function () {
        preset = b.getAttribute('data-preset');
        cur = LV_PRESETS.filter(function (x) { return x.id === preset; })[0].pick.slice(); paint();
      });
    });
    $$('.lv__cell', el).forEach(function (b) {
      b.addEventListener('click', function () {
        cur[+b.getAttribute('data-r')] = +b.getAttribute('data-c');
        var same = LV_PRESETS.filter(function (x) { return x.pick.join() === cur.join(); })[0];
        preset = same ? same.id : 'mine'; paint();
      });
    });
    paint();
  };
  MK.widgets['level-design'].once = true;

  /* =========================================================
     12. 선생님도 바이브코딩으로 (수업으로) — 이 교안의 실제 화면 + 그 화면을 만드는 요청문
     ========================================================= */
  var VIBE = [
    { id: 'flow', name: '수업 흐름 안내', slide: 's-flow', img: 'assets/img/910/vibe-flow.jpg', title: '오늘의 과제',
      why: '지금 어느 단계인지, 시간이 얼마나 남았는지 모두가 같은 화면으로 봅니다.',
      prompt: '초등 6학년 피지컬 AI 수업(80분) 안내 화면을 HTML 파일 하나로 만들어 줘. 문제 찾기 10분 → 만들기 40분 → 시험·고치기 20분 → 발표 10분. 지금 단계를 크게 보여 주고, 단계마다 할 일 두 가지와 체크 상자, 교사가 누르면 시작하는 타이머를 넣어 줘. 교실 TV에서 보이게 글씨는 크게.',
      more: [['s-make', '같은 타이머'], ['s-check5', '체크 목록']] },
    { id: 'sim', name: '시뮬레이션 안내', slide: 's-servo', img: 'assets/img/910/vibe-servo.jpg', title: '서보 각도 감 잡기',
      why: '기기 없이도 값을 바꿔 보며 예상하고, 실제 서보로 확인할 때 덜 헤맵니다.',
      prompt: '초등 5학년용 서보모터 시뮬레이션을 HTML 파일 하나로 만들어 줘. 0~180 슬라이더를 움직이면 서보 팔이 그 각도로 돌아가고, 0·90·180 버튼도 넣어 줘. 아래에는 MakeCode 블록 「P0에 서보 값 ○ 출력」과 「일시중지」를 넣고 빼며 순서대로 돌려 볼 수 있게 해 줘. 설명은 짧게.',
      more: [['s-servo360', '360° 서보'], ['s-levels', '난이도 표']] },
    { id: 'links', name: '필요한 사이트 모아 두기', slide: 's-code', img: 'assets/img/910/vibe-links.jpg', title: '나의 모델 코드 확인하기',
      why: '주소를 하나씩 불러 주지 않아도 누르면 바로 들어가니, 수업이 끊기지 않고 이어집니다.',
      prompt: '우리 반 피지컬 AI 수업의 바로가기 화면을 HTML 파일 하나로 만들어 줘. 아래 주소를 수업 순서대로 1·2·3 번호를 붙인 큰 버튼으로 모으고, 누르면 새 창으로 열리게 해 줘. 버튼마다 언제 쓰는지 한 줄 설명도 붙여 줘.\n① MakeCode 기본 코드: (주소)\n② 바운더리엑스 손동작 인식: (주소)\n③ 음성인식: (주소)',
      more: [['s-voice', '음성인식 연결'], ['s-buy', '재료 구매처']] }
  ];
  function pageOf(id) {
    var s = document.getElementById(id), all = MK.deck && MK.deck.slides ? MK.deck.slides() : [];
    var n = all.indexOf(s); return n >= 0 ? n + 1 : '';
  }
  MK.widgets['teach-vibe'] = function (el) {
    var at = 0;
    el.innerHTML = '<div class="tv">' +
      '<div class="tv__left">' +
        '<div class="tv__tabs" role="tablist">' + VIBE.map(function (v, k) { return '<button type="button" role="tab" class="tv__tab" data-k="' + k + '">' + esc(v.name) + '</button>'; }).join('') + '</div>' +
        '<p class="tv__why" data-why></p>' +
        '<button type="button" class="tv__shot" data-go><img alt="" data-img><span class="tv__cap" data-cap></span></button>' +
        '<div class="tv__more" data-more></div>' +
      '</div>' +
      '<div class="tv__right">' +
        '<div class="card c-row tv__say"><span class="circle c-yellow">' + ic('chat') + '</span><div style="min-width:0"><div class="kk">생성형 AI에게 이렇게 말하면</div><p class="tv__q" data-q></p>' +
          '<div class="tv__act"><button type="button" class="btn btn--ghost btn--sm" data-copy>' + ic('doc') + ' 요청문 복사</button><span class="tv__where">생성형 AI의 미리 보기(캔버스)에서 바로 열어 볼 수 있어요</span></div></div></div>' +
        '<div class="tv__steps">' +
          '<div class="tv__step"><b>1</b><div><strong>말로 요청</strong><span>대상·시간·화면</span></div></div>' +
          '<div class="tv__step"><b>2</b><div><strong>보고 고치기</strong><span>“버튼 더 크게”</span></div></div>' +
          '<div class="tv__step"><b>3</b><div><strong>기기로 확인</strong><span>주소로 나누기</span></div></div>' +
        '</div>' +
        '<div class="warn tv__warn"><span class="circle">' + ic('alert') + '</span><div><div class="warn__h">시뮬레이션은 실제와 조금 다릅니다</div><div class="warn__t">실제 서보로 꼭 확인하고, 학생 이름 같은 개인정보는 넣지 않습니다.</div></div></div>' +
      '</div></div>';
    var why = $('[data-why]', el), img = $('[data-img]', el), cap = $('[data-cap]', el), q = $('[data-q]', el), more = $('[data-more]', el), go = $('[data-go]', el), copyBtn = $('[data-copy]', el);
    function paint() {
      var v = VIBE[at];
      $$('.tv__tab', el).forEach(function (b, k) { b.classList.toggle('is-on', k === at); b.setAttribute('aria-selected', k === at ? 'true' : 'false'); });
      img.src = v.img; img.alt = '이 교안의 「' + v.title + '」 화면';
      why.innerHTML = ic('check') + ' ' + esc(v.why);
      cap.innerHTML = '이 교안 <b>' + pageOf(v.slide) + '쪽 · ' + esc(v.title) + '</b> ' + ic('expand') + ' 눌러서 가 보기';
      q.textContent = '“' + v.prompt + '”';
      more.innerHTML = '<span>다른 예</span>' + v.more.map(function (m) { return '<button type="button" class="tag" data-goto="' + m[0] + '">' + esc(m[1]) + ' <small>' + pageOf(m[0]) + '쪽</small></button>'; }).join('');
      $$('[data-goto]', more).forEach(function (b) { b.addEventListener('click', function () { MK.deck.goto(b.getAttribute('data-goto')); }); });
    }
    $$('.tv__tab', el).forEach(function (b) { b.addEventListener('click', function () { at = +b.getAttribute('data-k'); paint(); }); });
    go.addEventListener('click', function () { MK.deck.goto(VIBE[at].slide); });
    copyBtn.addEventListener('click', function () {
      var text = VIBE[at].prompt;
      var done = function () { MK.ui.toast('요청문을 복사했어요. 생성형 AI에 붙여 넣으세요.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { MK.ui.toast('복사하지 못했어요. 글을 길게 눌러 복사하세요.', true); }
        ta.remove();
      }
    });
    paint();
    document.addEventListener('deck:enter', function (e) { if (e.detail.slide.contains(el)) paint(); });
  };
  MK.widgets['teach-vibe'].once = true;

})();
