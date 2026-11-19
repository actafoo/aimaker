/* =========================================================
   Fable 구성판에서 새로 넣은 조작 부품
   - card-quick  : 내 도전과제를 한 쪽에서 네 칸으로 정하고 등록 (움직임은 자유롭게 적음)
   - (돌아가기)  : 버튼으로 다른 쪽에 건너뛰면 원래 쪽으로 돌아가는 버튼
   - pace        : (지금은 쓰지 않음) 시각별 체크포인트
   - self-test   : 「내 작품 시험해 보기」 줄마다 됨·가끔·안 됨 표시, 안 된 줄은 「안 된 곳 고치기」로
   - peer-result : 시험하며 고친 곳(AI 인식·코드·구조)을 고름 (제출 설명 문장에 들어감)
   - class-stats : 오늘 우리 반 숫자 (카드·모델·제출)
   기록은 모두 이 브라우저에만 남습니다(localStorage). 서버는 바꾸지 않았습니다.
   ========================================================= */
window.MK = window.MK || {};
MK.widgets = MK.widgets || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n) { return MK.icon(n); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var KEY = MK.config.storageKey + '-fable-';
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(KEY + k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function editing() { return MK.editor && MK.editor.isOn && MK.editor.isOn(); }
  function toast(m, bad) { if (MK.ui && MK.ui.toast) MK.ui.toast(m, bad); }
  function batchim(w) {
    var t = String(w || '').trim(); if (!t) return false;
    var c = t.charCodeAt(t.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 > 0;
    return /[013678LMNRlmnr]$/.test(t);
  }
  function copyText(text, okMsg) {
    function done() { toast(okMsg || '복사했어요.'); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사하지 못했어요. 글자를 직접 선택해 주세요.', true); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  /* ---------- 연수 날의 지금 시각(분). 미리 보기: 주소 끝에 ?now=16:35 ---------- */
  function courseDay() {
    var m = String(MK.config.date || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function nowMin() {
    var q = location.search.match(/[?&]now=(\d{1,2}):?(\d{2})/);
    if (q) return +q[1] * 60 + +q[2];
    var c = courseDay(); if (!c) return null;
    var d = new Date(MK.store && MK.store.now ? MK.store.now() : Date.now());
    if (d.getFullYear() !== c.y || d.getMonth() + 1 !== c.mo || d.getDate() !== c.d) return null;
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
  function toMin(hm) { var m = String(hm || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }

  /* =========================================================
     1. 내 도전과제 정하기 — <div data-widget="card-quick">
        한 쪽에서 네 칸만: 작품 이름 · AI 모델 · 첫 번째 움직임 · 두 번째 움직임
        움직임은 자유롭게 적습니다(각도·횟수·멈춤은 코드에서 각자 정함). 예시는 일부러 두지 않았습니다(예시가 답처럼 읽히므로).
     ========================================================= */
  var PINS = ['P0', 'P1'];
  var VOICE = '음성인식';
  function sayJosa(w) { return batchim(w) ? '이라고 하면' : '라고 하면'; }
  function qcBlank() { return { title: '', model: '', where: '', team: '', rows: [{ sig: '', act: '' }, { sig: '', act: '' }] }; }
  function qcFromCard(c) { // 이미 등록한 카드를 다시 칸으로
    var v = qcBlank(); v.title = c.title || ''; v.model = c.model || ''; v.where = c.situation || ''; v.team = c.team || '';
    [c.servo1, c.servo2].forEach(function (line, i) {
      line = String(line || '').trim();
      var m = line.match(/^‘(.{1,8}?)’(?:이라고|라고) 하면 (.+)$/);
      if (m) { v.rows[i].sig = m[1]; v.rows[i].act = m[2]; return; }
      m = line.match(/^(\S{1,8}?)(?:이면|면) (.+)$/);
      if (m) { v.rows[i].sig = m[1]; v.rows[i].act = m[2]; } else v.rows[i].act = line;
    });
    return v;
  }
  function qcSig(S, i) { return (S.rows[i].sig || '').trim(); }
  function qcAct(S, i) { return (S.rows[i].act || '').trim().replace(/[.。]+$/, ''); }
  function qcLine(S, i) {
    var sig = qcSig(S, i), a = qcAct(S, i);
    var head = !sig ? '' : S.model === VOICE ? '‘' + sig + '’' + sayJosa(sig) + ' ' : sig + (batchim(sig) ? '이면 ' : '면 ');
    return head + a;
  }
  function qcCard(S) { // 서버에 보내는 카드 모양으로 (예전 문장 틀의 칸은 네 칸에서 만든다)
    var a = qcSig(S, 0), b = qcSig(S, 1), act = qcAct(S, 0) + ' · ' + qcAct(S, 1);
    if (act.length > 30) act = act.slice(0, 29) + '…';
    return {
      title: (S.title || '').trim(), model: S.model || '', situation: (S.where || '').trim(), who: '', team: (S.team || '').trim(), from: '',
      sense: a && b ? a + (batchim(a) ? '과 ' : '와 ') + b : a || b,
      act: act, servo1: qcLine(S, 0), servo2: qcLine(S, 1)
    };
  }
  function qcDone(S) { // 네 칸이 찼는지
    return [!!(S.title || '').trim(), !!S.model, !!(qcSig(S, 0) && qcAct(S, 0)), !!(qcSig(S, 1) && qcAct(S, 1))];
  }
  /* 카드 한 줄 소개: 문장 틀 칸(인식·동작·누가)이 있으면 7~8차시 문장 그대로, 없으면(예전 네 칸 카드) 서보 두 줄 */
  var baseSentence = MK.cardSentence;
  MK.cardSentence = function (c) {
    c = c || {};
    var a = String(c.servo1 || '').trim().replace(/[.。]+$/, ''), b = String(c.servo2 || '').trim().replace(/[.。]+$/, '');
    if ((!a && !b) || String(c.sense || c.act || c.who || '').trim()) return baseSentence ? baseSentence(c) : ''; // 7~8차시 문장 틀로 쓴 카드는 문장 그대로
    var sit = String(c.situation || '').trim();
    return (sit ? sit + (/(에서|에)$/.test(sit) ? '' : '에서') + ' 씁니다. ' : '') + [a, b].filter(Boolean).join('. ') + '.';
  };

  /* 도전과제 예시 7가지: 다른 쪽으로 가지 않고 큰 창으로 봅니다.
     사진을 크게, 그 옆에 「무엇을 보면 → 어떻게 움직이나」 두 줄만. 아래 작은 사진이나 ← → 로 넘깁니다.
     두 줄의 글은 challenges.js 각 과제의 io 에서 고칩니다. 보기만 하고, 칸은 채우지 않습니다. */
  MK.openIdeas = function (id) { openIdeas(id); };
  document.addEventListener('click', function (e) { // 「내 도전과제 정하기」(my-card)의 보여 주고 싶은 작품 예시 보기
    var b = e.target.closest('[data-ideas]');
    if (b && !editing() && !b.closest('[data-widget="card-quick"]')) openIdeas();
  });
  function openIdeas(startId) {
    var list = MK.challenges || []; if (!list.length) return;
    var cur = 0; list.forEach(function (c, i) { if (c.id === startId) cur = i; });
    var d = document.createElement('dialog'); d.className = 'modal ui fb-ig';
    d.innerHTML = '<div class="fb-ig__box"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="fb-ig__head"><span class="fb-ig__count" data-count></span><h3 class="fb-ig__title" data-title></h3><span data-cat></span></div>' +
      '<div class="fb-ig__main"><div class="fb-ig__photo"><img alt="" data-img>' +
          '<button type="button" class="fb-ig__nav is-prev" data-step="-1" aria-label="앞 예시">' + ic('left') + '</button>' +
          '<button type="button" class="fb-ig__nav is-next" data-step="1" aria-label="다음 예시">' + ic('right') + '</button></div>' +
        '<div class="fb-ig__side"><div class="fb-ig__k">이렇게 움직여요</div><div class="fb-ig__io" data-io></div>' +
          '<p class="fb-ig__q" data-q></p><button type="button" class="linkish" data-more>문제 상황 · 준비물까지 자세히</button></div></div>' +
      '<div class="fb-ig__thumbs" role="tablist">' + list.map(function (c, i) {
        return '<button type="button" class="fb-ig__thumb" role="tab" data-go="' + i + '"><span style="background-image:url(' + MK.challengeImage(c.id) + ')"></span><b>' + esc(c.title) + '</b></button>';
      }).join('') + '</div></div>';
    document.body.appendChild(d);
    function show(i) {
      cur = (i + list.length) % list.length;
      var c = list[cur], cat = MK.catOf(c);
      d.querySelector('[data-count]').textContent = '보여 주고 싶은 작품 예시 ' + (cur + 1) + ' / ' + list.length;
      d.querySelector('[data-title]').textContent = c.title;
      d.querySelector('[data-cat]').innerHTML = '<span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.category) + '</span>';
      var img = d.querySelector('[data-img]'); img.src = MK.challengeImage(c.id); img.alt = c.title + ' 예시 사진';
      d.querySelector('[data-io]').innerHTML = (c.io || []).map(function (p, k) {
        return '<div class="fb-ig__row c-' + (k ? 'green' : 'blue') + '"><span class="fb-ig__sig">' + esc(p[0]) + '</span><span class="fb-ig__arrow">' + ic('right') + '</span><b>' + esc(p[1]) + '</b></div>';
      }).join('');
      d.querySelector('[data-q]').textContent = c.question || '';
      $$('.fb-ig__thumb', d).forEach(function (b, k) { b.classList.toggle('is-on', k === cur); b.setAttribute('aria-selected', k === cur ? 'true' : 'false'); });
    }
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (e) {
      if (e.target === d) { d.close(); return; }
      var b;
      if ((b = e.target.closest('[data-step]'))) show(cur + +b.getAttribute('data-step'));
      else if ((b = e.target.closest('[data-go]'))) show(+b.getAttribute('data-go'));
      else if (e.target.closest('[data-more]') && MK.cards && MK.cards.openIdea) MK.cards.openIdea(list[cur].id);
    });
    d.addEventListener('keydown', function (e) {
      if (document.querySelectorAll('dialog[open]').length > 1) return; // 자세히 창이 위에 떠 있으면 넘기지 않음
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
    });
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 50); });
    d.showModal(); show(cur);
  }

  /* 카드 자세히 창 맨 위 한 줄: 아래에 서보 두 줄이 따로 나오므로 겹치지 않게 '어디서 · 무엇을 알아보나'만 */
  MK.cardIntro = function (c) {
    c = c || {};
    var sit = String(c.situation || '').trim(), sense = String(c.sense || '').trim();
    return (sit ? sit + (/(에서|에)$/.test(sit) ? '' : '에서') + ' 씁니다 · ' : '') + 'AI가 알아보는 것: ' + (sense || '—');
  };

  MK.widgets['card-quick'] = function (el) {
    var mine0 = MK.state.myCard(MK.store.getStateSync());
    var S = load('qc2', null) || (mine0 ? qcFromCard(mine0) : qcBlank());
    if (!S.rows || S.rows.length !== 2) S = qcBlank();
    var busy = false;
    function keep() { save('qc2', S); }
    function mine() { return MK.state.myCard(MK.store.getStateSync()); }
    function dirty() {
      var c = mine(); if (!c) return true;
      var v = qcCard(S);
      return ['title', 'model', 'situation', 'team', 'servo1', 'servo2'].some(function (k) { return String(c[k] || '') !== String(v[k] || ''); });
    }

    function rowHtml(i) {
      return '<div class="fb-qc__row" data-row="r' + i + '"><span class="fb-qc__n">' + (i + 3) + '</span><div class="fb-qc__b">' +
        '<div class="fb-qc__q">' + (i ? '두 번째' : '첫 번째') + ' 움직임 <small>AI가 무엇을 보면, ' + PINS[i] + ' 서보가 어떻게 움직이나요? 자유롭게 적으세요</small></div>' +
        '<div class="fb-qc__sent"><input type="text" class="fb-qc__in is-sig" data-sig="' + i + '" maxlength="8" autocomplete="off" spellcheck="false"><i data-josa="' + i + '"></i>' +
          '<input type="text" class="fb-qc__in is-act" data-act="' + i + '" maxlength="22" placeholder="무엇이 어떻게 움직이나요?" autocomplete="off" spellcheck="false"></div>' +
        '</div></div>';
    }
    el.innerHTML =
      '<div class="fb-qc">' +
        '<div class="fb-qc__form">' +
          '<div class="fb-qc__row is-slim" data-row="title"><span class="fb-qc__n">1</span><div class="fb-qc__b"><div class="fb-qc__q">작품 이름</div>' +
            '<input type="text" class="fb-qc__in is-title" data-f="title" maxlength="30" placeholder="내 작품에 붙일 이름" autocomplete="off" spellcheck="false"></div></div>' +
          '<div class="fb-qc__row is-slim" data-row="model"><span class="fb-qc__n">2</span><div class="fb-qc__b"><div class="fb-qc__q">쓸 AI <small>7~8차시에 해 본 세 가지 중 하나</small></div>' +
            '<div class="fb-qc__models">' + (MK.cardModels || []).map(function (k) {
              var cat = MK.categories[k];
              return '<button type="button" class="tag fb-qc__model c-' + cat.color + '" data-model-pick="' + esc(k) + '">' + ic(cat.icon) + ' ' + esc(k) + '</button>';
            }).join('') + '</div></div></div>' +
          rowHtml(0) + rowHtml(1) +
          '<div class="fb-qc__opt"><span>더 적고 싶다면</span><input type="text" class="fb-qc__in" data-f="where" maxlength="40" placeholder="어디에서, 누구를 위해 쓰나요?" autocomplete="off" spellcheck="false">' +
            '<input type="text" class="fb-qc__in" data-f="team" maxlength="40" placeholder="함께 만드는 사람" autocomplete="off" spellcheck="false">' +
            '<button type="button" class="btn btn--sm btn--ghost" data-ideas>' + ic('bulb') + ' 보여 주고 싶은 작품 예시 보기</button></div>' +
        '</div>' +
        '<div class="fb-qc__side">' +
          '<div class="fb-qc__card" data-card></div>' +
          '<div class="fb-qc__free"><b>움직임은 자유입니다</b><span>몇 도로, 몇 번, 얼마나 멈출지는 만들면서 코드에서 각자 정합니다. 여기에는 하고 싶은 움직임을 말로만 적어 두세요.</span></div>' +
          '<button type="button" class="btn btn--green fb-qc__save" data-save></button>' +
          '<div class="fb-qc__st" data-st></div>' +
        '</div>' +
      '</div>';

    function paint() {
      var done = qcDone(S), voice = S.model === VOICE, keys = ['title', 'model', 'r0', 'r1'], next = done.indexOf(false);
      keys.forEach(function (k, i) {
        var row = $('[data-row="' + k + '"]', el);
        row.classList.toggle('is-done', done[i]); row.classList.toggle('is-next', i === next);
      });
      $$('[data-model-pick]', el).forEach(function (b) { var on = b.getAttribute('data-model-pick') === S.model; b.classList.toggle('tag--solid', on); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      [0, 1].forEach(function (i) {
        var r = S.rows[i], sig = $('[data-sig="' + i + '"]', el), act = $('[data-act="' + i + '"]', el), sv = qcSig(S, i);
        if (document.activeElement !== sig) sig.value = r.sig || '';
        sig.placeholder = S.model === '이미지분류' ? '물건' : S.model === '핸드포즈' ? '손 모양' : voice ? '말' : '신호';
        if (document.activeElement !== act) act.value = r.act || '';
        $('[data-josa="' + i + '"]', el).textContent = (voice ? (sv ? sayJosa(sv) : '(이)라고 하면') : (sv ? (batchim(sv) ? '이면' : '면') : '(이)면')) + ' → ' + PINS[i] + ' 서보가';
      });
      ['title', 'where', 'team'].forEach(function (k) { var f = $('[data-f="' + k + '"]', el); if (document.activeElement !== f) f.value = S[k] || ''; });
      var cat = S.model ? MK.categories[S.model] : null;
      $('[data-card]', el).innerHTML = '<div class="kk">내 카드</div><div class="fb-qc__ct">' + (S.title ? esc(S.title) : '<i>작품 이름</i>') + (cat ? '<span class="tag tag--solid c-' + cat.color + '">' + esc(S.model) + '</span>' : '') + '</div>' +
        [0, 1].map(function (i) { return '<div class="fb-qc__cl"><span class="pin">' + PINS[i] + '</span><span>' + (qcSig(S, i) || qcAct(S, i) ? esc(qcLine(S, i)) : '<i>' + (i ? '두 번째' : '첫 번째') + ' 움직임</i>') + '</span></div>'; }).join('');
      paintStatus();
    }
    function paintStatus() {
      var done = qcDone(S), left = done.filter(function (x) { return !x; }).length, c = mine(), m = MK.store.getMe(), d = dirty();
      var btn = $('[data-save]', el), box = $('[data-st]', el);
      btn.disabled = busy;
      btn.classList.toggle('is-wait', left > 0);
      btn.innerHTML = left ? '네 칸 중 ' + left + '칸 남았어요' : ic('check') + (c ? (d ? ' 고친 내용 저장' : ' 등록됐어요') : ' 내 도전과제 등록');
      box.className = 'fb-qc__st' + (c && !d ? ' is-ok' : '');
      box.innerHTML = c && !d ? '<b>우리 반 보드에 올라갔어요.</b> 다음 쪽(→)에서 볼 수 있습니다. 고치면 다시 저장하세요.'
        : c ? '<b>고친 내용이 있어요.</b> 저장을 눌러야 보드에 반영됩니다.'
        : left ? '왼쪽의 노란 칸부터 채워 주세요.' : (m ? '<b>' + esc(m.name) + '</b> 별명으로 등록합니다.' : '누르면 별명과 비밀번호 4자리를 먼저 묻습니다.');
    }
    function withMe(then) {
      var m = MK.store.getMe(); if (m) return then(m);
      MK.ui.form({ kicker: '별명 등록', title: '먼저 별명을 등록해 주세요', desc: '내 도전과제를 등록할 별명과 비밀번호 4자리를 적어 주세요.',
        fields: MK.ui.personFields(null), note: MK.ui.PERSON_NOTE, submitText: '등록',
        onSubmit: function (v) { return MK.store.identify(v).then(function () { setTimeout(function () { var n = MK.store.getMe(); if (n) then(n); }, 80); }); } });
    }
    function submit() {
      var done = qcDone(S), i = done.indexOf(false);
      if (i >= 0) {
        var what = ['① 작품 이름을 적어 주세요.', '② 쓸 AI를 골라 주세요.', '③ 첫 번째 움직임의 두 칸을 채워 주세요.', '④ 두 번째 움직임의 두 칸을 채워 주세요.'][i];
        toast(what, true);
        var f = i === 0 ? $('[data-f="title"]', el) : i === 1 ? $('[data-model-pick]', el) : (qcSig(S, i - 2) ? $('[data-act="' + (i - 2) + '"]', el) : $('[data-sig="' + (i - 2) + '"]', el));
        if (f) f.focus();
        return;
      }
      if (!dirty()) return;
      var v; try { v = MK.cleanCard(qcCard(S)); } catch (e) { toast(e.message, true); return; }
      withMe(function (m) {
        busy = true; paintStatus();
        MK.store.saveCard({ name: m.name, pin: m.pin, card: v }).then(function (r) {
          toast(r && r.updated ? '내 도전과제를 고쳤어요.' : '등록했어요! 우리 반 보드에 올라갔어요.');
        }, function (err) { toast((err && err.message) || '등록하지 못했어요.', true); }).then(function () { busy = false; paint(); });
      });
    }

    el.addEventListener('click', function (e) {
      if (editing()) return;
      var b;
      if ((b = e.target.closest('[data-model-pick]'))) { S.model = b.getAttribute('data-model-pick'); keep(); paint(); return; }
      if (e.target.closest('[data-ideas]')) { openIdeas(); return; }
      if (e.target.closest('[data-save]')) submit();
    });
    el.addEventListener('input', function (e) {
      var t = e.target, k;
      if ((k = t.getAttribute('data-f'))) S[k] = t.value;
      else if ((k = t.getAttribute('data-sig')) != null) S.rows[+k].sig = t.value;
      else if ((k = t.getAttribute('data-act')) != null) S.rows[+k].act = t.value;
      else return;
      keep(); paint();
    });
    el.addEventListener('keydown', function (e) { // Enter는 다음 칸으로
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      var ins = $$('input', el).filter(function (x) { return !x.readOnly; }), i = ins.indexOf(e.target);
      if (i >= 0 && ins[i + 1]) ins[i + 1].focus(); else e.target.blur();
    });
    MK.store.subscribe(function () { setTimeout(paintStatus, 40); });
    document.addEventListener('deck:enter', function (e) { if (e.detail && e.detail.slide && e.detail.slide.contains(el)) paint(); });
    paint();
  };
  MK.widgets['card-quick'].once = true;

  /* =========================================================
     0. 돌아가기 — 버튼을 눌러 다른 쪽으로 건너뛰면, 원래 쪽으로 돌아가는 버튼을 아래 가운데에 띄움
     ========================================================= */
  (function () {
    var trail = [], pending = null, chip = null;
    function curId() { var s = $('section.slide.is-active'); return s ? s.id : ''; }
    function titleOf(id) { var s = document.getElementById(id); return s ? (s.getAttribute('data-title') || '') : ''; }
    function draw() {
      if (!chip) {
        chip = document.createElement('div'); chip.className = 'fb-back ui'; chip.hidden = true;
        chip.innerHTML = '<button type="button" class="fb-back__go"></button><button type="button" class="fb-back__x" aria-label="돌아가기 버튼 닫기">×</button>';
        document.body.appendChild(chip);
        chip.querySelector('.fb-back__go').onclick = function () { var id = trail[trail.length - 1]; if (id && MK.deck) MK.deck.goto(id); };
        chip.querySelector('.fb-back__x').onclick = function () { trail = []; draw(); };
      }
      var id = trail[trail.length - 1];
      chip.hidden = !id;
      if (id) chip.querySelector('.fb-back__go').innerHTML = ic('left') + ' <span>‘' + esc(titleOf(id)) + '’ 쪽으로 돌아가기</span>';
    }
    function mark() { pending = curId(); setTimeout(function () { pending = null; }, 400); }
    document.addEventListener('click', function (e) {
      if (e.target.closest('.fb-back')) return;
      if (e.target.closest('[data-goto]')) mark();
    }, true);
    document.addEventListener('deck:enter', function (e) {
      var id = e.detail && e.detail.slide ? e.detail.slide.id : '';
      if (pending && id && id !== pending) { if (trail[trail.length - 1] !== pending) trail.push(pending); if (trail.length > 6) trail.shift(); }
      pending = null;
      var k = trail.lastIndexOf(id);
      if (k >= 0) trail = trail.slice(0, k); // 원래 쪽에 돌아왔으면 그 뒤 기록은 지움
      draw();
    });
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { // 부품이 직접 부르는 MK.deck.goto 도 같은 식으로
        if (!MK.deck || MK.deck._fbWrapped) return;
        var g = MK.deck.goto; MK.deck._fbWrapped = true;
        MK.deck.goto = function () { if (!pending) mark(); return g.apply(this, arguments); };
      }, 0);
    });
  })();

  /* =========================================================
     2. 만들기 체크포인트 — <ol data-widget="pace"><li data-at="16:22">…</li></ol>
        앞 화면(강사 화면)에 띄워 두는 안내. 연수 날 시각에 맞춰 '지금'과 지나간 줄만 표시 (누르는 것 없음)
     ========================================================= */
  function paintPace(el) {
    var n = nowMin(), rows = $$('li', el), nowSet = false;
    rows.forEach(function (li) {
      var at = toMin(li.getAttribute('data-at'));
      var past = n != null && at != null && n >= at, isNow = n != null && at != null && !past && !nowSet;
      if (isNow) nowSet = true;
      li.classList.toggle('is-past', past); li.classList.toggle('is-now', isNow);
    });
  }
  MK.widgets.pace = function (el) { paintPace(el); };
  setInterval(function () { $$('[data-widget="pace"]').forEach(paintPace); }, 20000);

  /* =========================================================
     3. 시험하고 고치기
        self-test   : 「내 작품 시험해 보기」 줄마다 됨 / 가끔 / 안 됨 (이 브라우저에만 기억). 안 된 줄은 「안 된 곳 고치기」 쪽으로
        peer-result : 고친 곳 고르기(AI 인식·코드·구조 / 고칠 것 없었음). 제출 설명에 한 문장으로 들어감 (부품 이름은 예전 그대로)
        카메라를 켜 두면 AI가 계속 알아보므로 몇 번 됐는지는 세지 않습니다.
     ========================================================= */
  var ST_ROWS = [
    { t: '신호 1 → 움직임 1', d: '카드의 첫 번째 움직임이 나오나요?', card: 'servo1', fix: 'AI 인식·코드' },
    { t: '신호 2 → 움직임 2', d: '카드의 두 번째 움직임이 나오나요?', card: 'servo2', fix: 'AI 인식·코드' },
    { t: '신호를 바꾸면 바로 따라 바뀌기', d: '1 → 2 → 1로 바꿔 가며 해 봐요', fix: 'AI 인식' },
    { t: '옆 사람이 설명 없이 해도', d: '자리를 바꿔 옆 사람이 해 봐요', fix: 'AI 인식' },
    { t: '자리·거리·조명이 달라져도', d: '조금 떨어지거나 배경이 바뀌어도 되나요?', fix: 'AI 인식' },
    { t: '외형을 붙인 채로 끝까지', d: '걸리거나 떨어지지 않고 움직이나요?', fix: '구조' }
  ];
  var ST_MARKS = [['ok', '됨'], ['some', '가끔'], ['no', '안 됨']];
  function stState() { var v = load('selftest', null); return v && typeof v === 'object' ? v : {}; }
  MK.widgets['self-test'] = function (el, st) {
    var S = stState(); st = st || (MK.store.getStateSync ? MK.store.getStateSync() : {});
    var card = MK.state && MK.state.myCard ? MK.state.myCard(st) : null, bad = 0, done = 0;
    var rows = ST_ROWS.map(function (r, i) {
      var v = S[i] || '', line = card && r.card ? String(card[r.card] || '').trim() : '';
      if (v) done++;
      if (v && v !== 'ok') bad++;
      return '<li class="fb-st__row' + (v ? ' is-' + v : '') + '"><span class="fb-st__n">' + (i + 1) + '</span>' +
        '<div class="fb-st__txt"><b>' + esc(r.t) + '</b><span>' + esc(line || r.d) + '</span></div>' +
        (v && v !== 'ok' ? '<button type="button" class="fb-st__fix" data-goto="s-fix">' + esc(r.fix) + ' 고치기 ' + ic('right') + '</button>' : '') +
        '<div class="fb-st__marks" role="group" aria-label="' + esc(r.t) + '">' + ST_MARKS.map(function (m) {
          return '<button type="button" class="fb-st__c is-' + m[0] + (v === m[0] ? ' is-on' : '') + '" data-st="' + i + '" data-v="' + m[0] + '" aria-pressed="' + (v === m[0]) + '">' + m[1] + '</button>';
        }).join('') + '</div></li>';
    }).join('');
    var sum = !done ? '<b>해 본 줄마다 눌러 표시해요</b><span>표시는 이 브라우저에만 남아요. 같은 칸을 다시 누르면 지워져요.</span>'
      : bad ? '<b>' + bad + '줄이 아직이에요</b><span>줄 옆 「고치기」를 누르거나, 아래 버튼으로 고칠 곳을 찾아요.</span><button type="button" class="btn btn--yellow" data-goto="s-fix">' + ic('binoculars') + ' 고칠 곳 찾기</button>'
      : done < ST_ROWS.length ? '<b>지금까지 모두 됐어요</b><span>남은 줄도 해 보세요.</span>'
      : '<b>모두 됐어요!</b><span>이제 30초 영상을 찍어요.</span><button type="button" class="btn btn--green" data-goto="s-video">' + ic('video') + ' 영상 찍으러 가기</button>';
    el.innerHTML = '<div class="fb-st"><ol class="fb-st__list">' + rows + '</ol>' +
      '<div class="fb-st__side"><div class="fb-st__sum' + (done && !bad ? ' is-good' : bad ? ' is-bad' : '') + '">' + sum + '</div>' +
      '<div class="fb-st__tip"><b>몇 번 됐는지는 세지 않아요</b><span>카메라를 켜 두면 AI가 계속 알아봅니다. 신호를 바꿀 때 바로 따라 움직이는지를 봐요.</span></div>' +
      '<div class="fb-st__tip is-voice"><b>음성인식이라면</b><span>정해 둔 말 두 가지만 옆 사람에게 알려 주고 직접 말해 보게 해요.</span></div>' +
      (done ? '<button type="button" class="linkish fb-st__reset" data-st-reset>표시 모두 지우기</button>' : '') +
      '</div></div>';
  };
  function paintST() { $$('[data-widget="self-test"]').forEach(function (x) { MK.widgets['self-test'](x); }); }

  var FIX_OPTS = ['AI 인식', '코드', '구조'];
  function fxState() {
    var v = load('fixed', null) || {};
    return { list: FIX_OPTS.filter(function (k) { return Array.isArray(v.list) && v.list.indexOf(k) >= 0; }), none: !!v.none };
  }
  MK.peerSentence = function () {
    var S = fxState();
    if (S.none) return '시험해 보니 고칠 곳 없이 잘 움직였습니다.';
    if (!S.list.length) return '';
    var last = S.list[S.list.length - 1];
    return '시험해 보고 ' + S.list.join('·') + (batchim(last) ? '을' : '를') + ' 고쳤습니다.';
  };
  MK.widgets['peer-result'] = function (el) {
    var S = fxState(), compact = el.hasAttribute('data-compact');
    var chips = FIX_OPTS.map(function (k) {
      var on = S.list.indexOf(k) >= 0;
      return '<button type="button" class="fb-pr__c' + (on ? ' is-on' : '') + '" data-fx="' + esc(k) + '" aria-pressed="' + on + '">' + esc(k) + '</button>';
    }).join('') + '<button type="button" class="fb-pr__c is-none' + (S.none ? ' is-on' : '') + '" data-fx="" aria-pressed="' + S.none + '">고칠 것 없었음</button>';
    var note = MK.peerSentence() || '고르면 제출 설명에 한 문장으로 들어갑니다. 안 골라도 됩니다.';
    el.innerHTML = '<div class="fb-pr' + (compact ? ' fb-pr--compact' : '') + '">' + (compact ? '' : '<div class="kk">시험하며 고친 곳 · 여러 개 골라도 돼요</div>') +
      '<div class="fb-pr__row">' + chips + '</div><p class="fb-pr__n">' + esc(note) + '</p></div>';
  };
  document.addEventListener('click', function (e) {
    if (editing()) return;
    var b = e.target.closest('[data-st]');
    if (b) {
      var S = stState(), i = b.getAttribute('data-st'), v = b.getAttribute('data-v');
      if (S[i] === v) delete S[i]; else S[i] = v; // 다시 누르면 지움
      save('selftest', S); paintST(); return;
    }
    if (e.target.closest('[data-st-reset]')) { save('selftest', {}); paintST(); return; }
    var f = e.target.closest('[data-fx]');
    if (f) {
      var F = fxState(), k = f.getAttribute('data-fx');
      if (!k) { F.none = !F.none; if (F.none) F.list = []; }
      else { var at = F.list.indexOf(k); if (at >= 0) F.list.splice(at, 1); else F.list.push(k); F.none = false; }
      save('fixed', F);
      $$('[data-widget="peer-result"]').forEach(function (x) { MK.widgets['peer-result'](x); });
    }
  });

  /* =========================================================
     4. 오늘 우리 반 숫자 — <div data-widget="class-stats">
     ========================================================= */
  MK.widgets['class-stats'] = function (el, st) {
    st = st || MK.store.getStateSync();
    var cards = (st.cards || []).filter(function (c) { return !c.hidden; });
    var subs = (st.submissions || []).filter(function (s) { return !s.hidden; });
    var by = {}; cards.forEach(function (c) { by[c.model || '기타'] = (by[c.model || '기타'] || 0) + 1; });
    var models = (MK.cardModels || []).filter(function (k) { return by[k]; }).map(function (k) {
      var cat = MK.categories[k]; return '<span class="tag c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(k) + ' ' + by[k] + '</span>';
    }).join('');
    if (!cards.length && !subs.length) { el.innerHTML = '<div class="fb-cs is-empty">카드와 결과물이 등록되면 오늘 우리 반 숫자가 여기에 나옵니다.</div>'; return; }
    el.innerHTML = '<div class="fb-cs"><div class="fb-cs__n"><b>' + cards.length + '</b><span>장의 카드</span></div>' +
      '<div class="fb-cs__n"><b>' + subs.length + '</b><span>개의 작품</span></div>' +
      '<div class="fb-cs__m">' + (models || '') + '<small>같은 도구, 같은 기본 코드에서 나온 숫자입니다</small></div></div>';
  };

  /* =========================================================
     5. 난이도 설계 쪽: 과제 문장 복사 버튼
     ========================================================= */
  function addLevelCopy() {
    var card = $('.lv__card'); if (!card || $('[data-lv-copy]', card)) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn--sm btn--ghost fb-lvcopy'; b.setAttribute('data-lv-copy', '');
    b.innerHTML = ic('doc') + ' 과제 문장 복사';
    b.onclick = function () { var t = $('[data-task]', card); if (t) copyText(t.textContent, '과제 문장을 복사했어요.'); };
    card.appendChild(b);
  }
  document.addEventListener('deck:enter', function () { setTimeout(addLevelCopy, 0); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(addLevelCopy, 400); });

  /* =========================================================
     6. 참고 화면 크게 보기 — <button data-zoom data-zoom-title="제목" data-zoom-w="최대 너비px">
        안의 .fb-ref__pic(사진 + 위에 얹은 표시)을 큰 창에 그대로 보여 줌
     ========================================================= */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-zoom]'); if (!b || editing()) return;
    var pic = $('.fb-ref__pic', b); if (!pic) return;
    var w = parseInt(b.getAttribute('data-zoom-w'), 10) || 1200;
    var d = document.createElement('dialog'); d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box fb-zoom"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="modal__kicker">참고 화면</div><h3 class="modal__title">' + esc(b.getAttribute('data-zoom-title') || '') + '</h3>' +
      '<div class="fb-ref__pic" style="width:min(' + w + 'px, 86vw)">' + pic.innerHTML + '</div></div>';
    document.body.appendChild(d);
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  });
})();
