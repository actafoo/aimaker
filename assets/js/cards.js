/* =========================================================
   내 도전과제 = 7~8차시 아이디어 카드 (9~10차시)
   - card-check   : 아이디어 카드 다듬기 (눌러서 체크, 이 브라우저에만)
   - my-card      : 슬라이드 위에서 카드 빈칸을 바로 채우고 등록 (문장이 저절로 완성)
   - card-board   : 우리 반 도전과제 보드 (모델별 거르기, 누르면 크게)
   - idea-gallery : 도전과제 예시 7가지 = 원래 오늘 하려다 접은 도전과제 (PART 5 덤. 누르면 자세히, 내 도전과제로 가져오기)
   데이터: 서버의 카드 탭(한 사람에 한 장). 제출물은 카드와 이름으로 이어집니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n) { return MK.icon(n); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function st() { return MK.store.getStateSync(); }
  function me() { return MK.store.getMe(); }
  function has(f) { return MK.store.supports && MK.store.supports(f); }
  function editing() { return MK.editor && MK.editor.isOn && MK.editor.isOn(); }
  function bad(err) { MK.ui.toast((err && err.message) || '처리하지 못했어요.', true); }
  function cardsOf(s) { return (s.cards || []).filter(function (c) { return !c.hidden || MK.store.isAdmin(); }); }
  function catOf(model) { return MK.categories[model] || MK.categories['자유발명']; }

  /* ---------- 문장 만들기 (받침에 따라 조사) ---------- */
  function batchim(w) {
    var t = String(w || '').trim(); if (!t) return false;
    var c = t.charCodeAt(t.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 > 0;
    return /[013678LMNRlmnr]$/.test(t);
  }
  function iGa(w) { return batchim(w) ? '이' : '가'; }
  function eulReul(w) { return batchim(w) ? '을' : '를'; }
  function actPhrase(a) {
    a = String(a || '').trim();
    if (!a) return '○○하도록';
    if (/도록$/.test(a)) return a;
    if (/기$/.test(a)) return a.slice(0, -1) + '도록';  // 깃발 올리기 → 깃발 올리도록
    return a + '하도록';
  }
  MK.cardSentence = function (c) {
    c = c || {};
    var sit = String(c.situation || '').trim(), who = String(c.who || '').trim(), sense = String(c.sense || '').trim();
    var h = '';
    if (sit) h += sit + (/(에서|에)$/.test(sit) ? '' : '에서') + ' ';
    if (who) h += who + iGa(who) + ' 겪는 불편을 줄이기 위해, ';
    h += 'AI가 ' + (sense ? sense + eulReul(sense) : '○을') + ' 인식하면 서보모터가 ' + actPhrase(c.act) + ' 만든다.';
    return h;
  };

  /* 이름이 필요할 때: 등록돼 있으면 바로, 아니면 이름 등록 창을 먼저 */
  function withMe(then, why) {
    var m = me();
    if (m) return then(m);
    MK.ui.form({ kicker: '이름 등록', title: '먼저 이름을 등록해 주세요', desc: why || '내 도전과제와 제출에 쓰는 이름입니다.',
      fields: MK.ui.personFields(null), note: MK.ui.PIN_NOTE, submitText: '등록',
      onSubmit: function (v) { return MK.store.identify(v).then(function () { setTimeout(function () { var n = me(); if (n) then(n); }, 80); }); } });
  }

  /* 큰 창 (카드·아이디어 자세히) */
  function modal(html, wide) {
    var d = document.createElement('dialog'); d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box' + (wide ? ' modal__box--wide' : '') + ' cd-modal"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' + html + '</div>';
    document.body.appendChild(d);
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 50); });
    d.showModal();
    return d;
  }

  /* =========================================================
     1. 눌러서 체크하는 목록 — <ul data-widget="tick-list" data-tick="이름">
        (아이디어 카드 다듬기, 영상 찍기, 제출 준비 등. 이 브라우저에만 기억)
     ========================================================= */
  function tickKey(el) { return MK.config.storageKey + '-tick-' + (el.getAttribute('data-tick') || 'list'); }
  function tickRead(el) { try { return JSON.parse(sessionStorage.getItem(tickKey(el))) || []; } catch (e) { return []; } }
  MK.widgets['tick-list'] = function (el) {
    var done = tickRead(el);
    $$('li', el).forEach(function (li, i) { li.classList.toggle('is-done', done.indexOf(i) >= 0); });
  };
  MK.widgets['card-check'] = MK.widgets['tick-list']; // 예전 이름
  document.addEventListener('click', function (e) {
    var li = e.target.closest('[data-widget="tick-list"] li, [data-widget="card-check"] li'); if (!li || editing()) return;
    li.classList.toggle('is-done');
    var ul = li.parentNode, list = [];
    $$('li', ul).forEach(function (x, i) { if (x.classList.contains('is-done')) list.push(i); });
    try { sessionStorage.setItem(tickKey(ul), JSON.stringify(list)); } catch (err) {}
  });

  /* 제출 체크리스트 — 내 결과물이 채워지면 저절로 체크 (제출 창에 쓰는 동안에도 바로) */
  function readyOk(k, v) {
    if (k === 'title') return !!String(v.title || '').trim();
    if (k === 'desc') return !!String(v.desc || '').trim();
    if (k === 'mc') return !!MK.parseMakecode(v.makecodeUrl);
    if (k === 'video') return MK.isHttpUrl(v.videoUrl);
    return false;
  }
  function submitDraft() { // 제출 창이 열려 있으면 그 칸의 값
    var f = document.querySelector('dialog[open] input[name="makecodeUrl"]'); if (!f) return null;
    var d = f.closest('form'), v = {};
    ['title', 'desc', 'makecodeUrl', 'videoUrl'].forEach(function (n) { var i = d.querySelector('[name="' + n + '"]'); v[n] = i ? i.value : ''; });
    return v;
  }
  function paintReady() {
    var v = submitDraft() || (MK.subDraft ? MK.subDraft() : null) || (MK.state && MK.state.mySubmission ? MK.state.mySubmission(st()) : null) || {}; // 열린 창 → 저장된 초안 → 제출한 것
    $$('[data-widget="submit-ready"] li').forEach(function (li) { li.classList.toggle('is-done', readyOk(li.getAttribute('data-need'), v)); });
  }
  MK.widgets['submit-ready'] = function () { paintReady(); };
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('dialog[open]') && submitDraft()) paintReady(); });
  document.addEventListener('close', function () { setTimeout(paintReady, 60); }, true);
  document.addEventListener('click', function (e) { if (e.target.closest('[data-act="submit"]')) setTimeout(paintReady, 120); }); // 제출 창이 열리면 미리 채워진 칸도 바로 체크

  /* =========================================================
     2. 내 도전과제 카드 — 빈칸을 바로 채우고 등록
     ========================================================= */
  var DRAFT_KEY = MK.config.storageKey + '-carddraft';
  var FIELDS = ['title', 'situation', 'who', 'sense', 'act', 'servo1', 'servo2', 'team'];
  var form = { el: null, dirty: false, owner: null, from: '' };

  function blankIn(k, ph, color, max) {
    return '<input class="mc-blank c-' + color + '" data-k="' + k + '" maxlength="' + max + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false">';
  }
  MK.widgets['my-card'] = function (el) {
    form.el = el;
    el.innerHTML =
      '<div class="mc">' +
        '<div class="mc-card">' +
          '<div class="mc-title"><span class="mc-k">작품 이름</span><input class="mc-title__in" data-k="title" maxlength="30" placeholder="예: 손 대신 들어 주는 도움 깃발" autocomplete="off" spellcheck="false"></div>' +
          '<div class="mc-sec"><div class="mc-sec__h"><span class="mc-k">① 문장 틀</span><span class="mc-genres" role="group" aria-label="작품 종류"><button type="button" class="mc-genre" data-mc-genre="fix">문제 해결 작품</button><button type="button" class="mc-genre" data-mc-genre="show">표현·놀이 작품</button></span></div>' +
            '<p class="mc-frame">' + blankIn('situation', '○○한 상황', 'purple', 40) + '에서 <span class="mc-who">' + blankIn('who', '○○이', 'yellow', 20) + '<span class="mc-josa" data-josa="who">가</span> 겪는 불편을 줄이기 위해,</span> ' +
              'AI가 ' + blankIn('sense', '○', 'blue', 30) + '<span class="mc-josa" data-josa="sense">을</span> 인식하면 서보모터가 ' + blankIn('act', '○○하도록', 'green', 30) + ' 만든다.</p></div>' +
          '<div class="mc-sec mc-row"><span class="mc-k">② 쓸 AI 모델</span><span class="mc-models">' + (MK.cardModels || []).map(function (k) {
            var cat = MK.categories[k];
            return '<button type="button" class="tag mc-model c-' + cat.color + '" data-mc-model="' + esc(k) + '" aria-pressed="false">' + ic(cat.icon) + ' ' + esc(k) + '</button>';
          }).join('') + '</span></div>' +
          '<div class="mc-sec"><span class="mc-k">③ 서보가 하는 일</span>' +
            '<div class="mc-servo"><span class="pin">P0</span><b>서보 1</b><input data-k="servo1" maxlength="40" placeholder="예: 주먹이면 깃발을 든다" autocomplete="off" spellcheck="false"></div>' +
            '<div class="mc-servo"><span class="pin">P1</span><b>서보 2</b><input data-k="servo2" maxlength="40" placeholder="예: 보면 깃발을 내린다" autocomplete="off" spellcheck="false"></div></div>' +
          '<div class="mc-sec mc-row mc-team"><span class="mc-k">함께 만드는 사람</span><input data-k="team" maxlength="40" placeholder="혼자면 비워 두세요" autocomplete="off" spellcheck="false"></div>' +
        '</div>' +
        '<div class="mc-side">' +
          '<div class="mc-status" data-mc-status></div>' +
          '<button type="button" class="btn btn--green mc-save" data-mc-save>' + ic('check') + ' 내 도전과제 등록</button>' +
          '<div class="mc-preview"><div class="mc-k">완성된 문장</div><p data-mc-preview></p></div>' +
          '<div class="mc-from" data-mc-from></div>' +
          '<div class="mc-links"><button type="button" class="btn btn--ghost btn--sm" data-goto="s-draw">' + ic('spark') + ' 카드 뽑기</button><button type="button" class="btn btn--ghost btn--sm" data-mc-import>' + ic('bulb') + ' 도전과제 예시에서 가져오기</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-goto="s-cardboard">우리 반 도전과제 보기 ' + ic('right') + '</button></div>' +
        '</div>' +
      '</div>';
    var iv = initialValues(); fill(iv.v, iv.dirty);
    paintStatus();
  };
  MK.widgets['my-card'].once = true;

  function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch (e) { return null; } }
  function writeDraft(v) { try { if (v) localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); else localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  function myCardNow() { return MK.state && MK.state.myCard ? MK.state.myCard(st()) : null; }
  // 처음 채울 값: 저장 안 한 초안(같은 사람, 저장한 카드보다 새것)이 있으면 초안, 아니면 저장한 카드
  function initialValues() {
    var c = myCardNow(), d = readDraft(), m = me();
    if (d && hasText(d) && (!d.owner || !m || d.owner === m.name) && (!c || (d.at || 0) > (c.updatedAt || 0))) return { v: d, dirty: true };
    return { v: c ? Object.assign({}, c) : {}, dirty: false };
  }
  function hasText(v) { return FIELDS.some(function (k) { return v[k]; }) || !!v.model; }
  function values() {
    var v = {}; if (!form.el) return v;
    $$('[data-k]', form.el).forEach(function (i) { v[i.getAttribute('data-k')] = i.value.trim(); });
    var on = $('.mc-model.is-on', form.el); v.model = on ? on.getAttribute('data-mc-model') : '';
    v.genre = form.genre || 'fix'; if (v.genre === 'show') v.who = ''; // 표현·놀이 작품: ‘누가 겪는 불편’ 없이
    v.from = form.from || '';
    return v;
  }
  function fill(v, dirty) {
    if (!form.el) return;
    v = v || {};
    $$('[data-k]', form.el).forEach(function (i) { i.value = v[i.getAttribute('data-k')] || ''; });
    $$('.mc-model', form.el).forEach(function (b) { var on = b.getAttribute('data-mc-model') === v.model; b.classList.toggle('is-on', on); b.classList.toggle('tag--solid', on); b.setAttribute('aria-pressed', on); });
    form.from = v.from || '';
    form.genre = v.genre || (v.who || !(v.title || v.sense || v.act) ? 'fix' : 'show');
    paintGenre();
    form.dirty = !!dirty;
    form.owner = me() ? me().name : null;
    live();
  }
  function paintGenre() {
    var root = form.el && $('.mc', form.el); if (!root) return;
    root.classList.toggle('is-show', form.genre === 'show');
    $$('.mc-genre', form.el).forEach(function (b) { var on = b.getAttribute('data-mc-genre') === form.genre; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  // 빈칸 너비를 글자에 맞추고, 조사와 완성 문장을 바로 바꿈
  var measurer = null;
  function textWidth(input, text) {
    if (!measurer) { measurer = document.createElement('span'); measurer.className = 'mc-measure'; document.body.appendChild(measurer); }
    var cs = getComputedStyle(input);
    measurer.style.font = cs.font; measurer.style.letterSpacing = cs.letterSpacing;
    measurer.textContent = text;
    return measurer.getBoundingClientRect().width / (MK.deck && MK.deck.scale ? MK.deck.scale : 1);
  }
  function live() {
    if (!form.el) return;
    var v = values();
    $$('.mc-blank', form.el).forEach(function (i) { i.style.width = Math.ceil(textWidth(i, i.value || i.placeholder) + 30) + 'px'; });
    var jw = $('[data-josa="who"]', form.el), js = $('[data-josa="sense"]', form.el);
    if (jw) jw.textContent = v.who ? iGa(v.who) : '가';
    if (js) js.textContent = v.sense ? eulReul(v.sense) : '을';
    var p = $('[data-mc-preview]', form.el); if (p) p.textContent = MK.cardSentence(v);
    var fr = $('[data-mc-from]', form.el), ch = v.from && MK.challengeById(v.from);
    if (fr) fr.innerHTML = ch ? '<span class="mc-k">가져온 도전과제 예시</span> ' + esc(ch.title) + ' · <span class="t-muted">' + esc(ch.question) + '</span> <button type="button" class="linkish" data-mc-unfrom>빼기</button>' : '';
  }
  function paintStatus() {
    if (!form.el) return;
    var box = $('[data-mc-status]', form.el), btn = $('[data-mc-save]', form.el), m = me(), c = myCardNow();
    if (!has('cards')) {
      box.innerHTML = '<div class="mc-st mc-st--warn">' + ic('alert') + '<span>서버 코드가 예전 버전이라 등록할 수 없어요. 강사에게 알려 주세요.</span></div>';
      btn.disabled = true; return;
    }
    btn.disabled = false;
    if (!m) box.innerHTML = '<div class="mc-st">' + ic('user') + '<span>등록하려면 먼저 이름이 필요해요.<br><button type="button" class="linkish" data-act="identify">이름 등록하기</button></span></div>';
    else if (!c) box.innerHTML = '<div class="mc-st">' + ic('doc') + '<span><b>' + esc(m.name) + '</b> 선생님 · 아직 등록 전<br>빈칸을 채우고 등록하세요.</span></div>';
    else box.innerHTML = '<div class="mc-st mc-st--ok">' + ic('check') + '<span><b>등록됨</b> · 보드에 올라갔어요' + (form.dirty ? '<br><b class="t-blue">고친 내용이 있어요. 다시 저장하세요.</b>' : '<br>고치면 다시 저장하면 됩니다.') + '</span></div>';
    btn.innerHTML = ic('check') + (c ? ' 고친 내용 저장' : ' 내 도전과제 등록');
    btn.classList.toggle('btn--ghost', !!c && !form.dirty);
  }
  function save() {
    var v = values();
    try { MK.cleanCard(v); } catch (e) { MK.ui.toast(e.message, true); return; }
    withMe(function (m) {
      var btn = $('[data-mc-save]', form.el); if (btn) btn.disabled = true;
      MK.store.saveCard({ name: m.name, pin: m.pin, card: v }).then(function (r) {
        form.dirty = false; writeDraft(null);
        MK.ui.toast(r && r.updated ? '내 도전과제를 고쳤어요.' : '내 도전과제를 등록했어요! 우리 반 보드에 올라갔어요.');
        paintStatus();
      }, bad).then(function () { if (btn) btn.disabled = false; });
    }, '내 도전과제를 등록할 이름과 비밀번호 4자리를 적어 주세요.');
  }

  document.addEventListener('input', function (e) {
    if (!form.el || !form.el.contains(e.target) || !e.target.hasAttribute('data-k')) return;
    form.dirty = true; live(); paintStatus();
    var v = values(); v.at = Date.now(); v.owner = me() ? me().name : ''; writeDraft(v);
  });
  document.addEventListener('keydown', function (e) {
    if (form.el && form.el.contains(e.target) && e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    var gb = t.closest('.mc-genre');
    if (gb && form.el && form.el.contains(gb)) {
      form.genre = gb.getAttribute('data-mc-genre'); paintGenre();
      form.dirty = true; live(); paintStatus(); var gv = values(); gv.at = Date.now(); gv.owner = me() ? me().name : ''; writeDraft(gv);
      return;
    }
    var mb = t.closest('.mc-model');
    if (mb && form.el && form.el.contains(mb)) {
      $$('.mc-model', form.el).forEach(function (b) { var on = b === mb; b.classList.toggle('is-on', on); b.classList.toggle('tag--solid', on); b.setAttribute('aria-pressed', on); });
      form.dirty = true; live(); paintStatus(); var v = values(); v.at = Date.now(); v.owner = me() ? me().name : ''; writeDraft(v);
      return;
    }
    if (t.closest('[data-mc-save]')) { save(); return; }
    if (t.closest('[data-mc-import]')) { pickIdea(); return; }
    if (t.closest('[data-mc-unfrom]')) { form.from = ''; form.dirty = true; live(); paintStatus(); return; }
  });
  // 서버에서 내 카드가 오거나 사람이 바뀌면: 고치는 중이 아니면 다시 채움
  MK.store.subscribe(function () {
    if (!form.el) return;
    var m = me(), owner = m ? m.name : null;
    if (owner !== form.owner) { var iv = initialValues(); fill(iv.v, iv.dirty); }
    else if (!form.dirty) { var c = myCardNow(); if (c) { var cur = values(), changed = FIELDS.some(function (k) { return (cur[k] || '') !== (c[k] || ''); }) || cur.model !== c.model; if (changed) fill(c, false); } }
    paintStatus();
  });

  /* 도전과제 예시에서 가져오기 */
  function fromIdea(id) {
    var c = MK.challengeById(id); if (!c) return;
    var cur = values();
    var v = Object.assign({}, cur, { title: cur.title || c.title, model: (MK.cardModels || []).indexOf(c.category) >= 0 ? c.category : cur.model, from: c.id });
    fill(v, true);
    var d = values(); d.at = Date.now(); d.owner = me() ? me().name : ''; writeDraft(d);
    paintStatus();
  }
  /* 카드 뽑기(강제 연결법)에서 가져오기: 지능 → AI가 알아보는 것·모델, 기능 → 서보가 하는 일, 상황 → 상황 */
  function fromDraw() {
    var d = MK.draw && MK.draw.current ? MK.draw.current() : null;
    if (!d || !d.intel || !d.func || !d.place) { MK.ui.toast('먼저 카드 세 장을 뽑아 주세요.', true); return false; }
    var cur = values();
    var v = Object.assign({}, cur, { sense: d.intel[0], act: d.func[0], situation: d.place[0], from: '' });
    if ((MK.cardModels || []).indexOf(d.intel[1]) >= 0) v.model = d.intel[1];
    fill(v, true);
    var w = values(); w.at = Date.now(); w.owner = me() ? me().name : ''; writeDraft(w);
    paintStatus();
    return true;
  }
  /* 다른 부품(움직임 고르기 등)이 카드 빈칸 일부를 채울 때 */
  MK.cardValues = function () { return values(); };
  MK.cardPatch = function (patch) {
    if (!form.el) return false;
    var v = Object.assign({}, values(), patch || {});
    fill(v, true);
    var w = values(); w.at = Date.now(); w.owner = me() ? me().name : ''; writeDraft(w);
    paintStatus();
    return true;
  };
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-draw-use]') || editing()) return;
    if (fromDraw()) { MK.deck.goto('s-mycard'); MK.ui.toast('뽑은 카드를 넣었어요. 작품 이름과 ‘누가’를 채워 주세요.'); }
  });

  function pickIdea() {
    var h = '<div class="modal__kicker">도전과제 예시에서 가져오기</div><h3 class="modal__title">어떤 아이디어로 시작할까요?</h3>' +
      '<p class="modal__desc">작품 이름과 AI 모델을 채워 드립니다. 문장 틀은 <b>내 상황에 맞게</b> 직접 채워 주세요.</p><div class="cd-pick">' +
      MK.challenges.map(function (c) {
        var cat = MK.catOf(c);
        return '<button type="button" class="cd-pick__i c-' + cat.color + '" data-pick="' + c.id + '"><span class="cd-pick__img" style="background-image:url(' + MK.challengeImage(c.id) + ')"></span>' +
          '<span><span class="cd-pick__cat">' + ic(cat.icon) + ' ' + esc(c.category) + '</span><b>' + esc(c.title) + '</b><small>' + esc(c.question) + '</small></span></button>';
      }).join('') + '</div>';
    var d = modal(h, true);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]'); if (!b) return;
      fromIdea(b.getAttribute('data-pick')); d.close();
      if (MK.deck.current().id !== 's-mycard') MK.deck.goto('s-mycard');
      MK.ui.toast('가져왔어요. 문장 틀을 내 상황에 맞게 채워 주세요.');
    });
  }

  /* =========================================================
     3. 우리 반 도전과제 보드
     ========================================================= */
  var boardFilter = null;
  MK.widgets['card-board'] = function (el, s) {
    if (!has('cards')) { el.innerHTML = '<div class="dashed t-md">서버 코드가 예전 버전이라 도전과제 보드를 볼 수 없어요. 강사에게 알려 주세요.</div>'; return; }
    var all = cardsOf(s), m = me(), subBy = {};
    (s.submissions || []).forEach(function (x) { subBy[x.name] = x; });
    var counts = {}; all.forEach(function (c) { counts[c.model] = (counts[c.model] || 0) + 1; });
    var list = all.filter(function (c) { return !boardFilter || c.model === boardFilter; })
      .sort(function (a, b) { var am = m && a.name === m.name ? -1 : 0, bm = m && b.name === m.name ? -1 : 0; return am - bm || (a.at || 0) - (b.at || 0); });
    var h = '<div class="cb"><div class="cb-bar"><button type="button" class="tag cb-f' + (!boardFilter ? ' tag--solid is-on' : '') + '" data-cb-f="">전체 <b>' + all.length + '</b></button>' +
      (MK.cardModels || []).map(function (k) {
        var cat = MK.categories[k], on = boardFilter === k;
        return '<button type="button" class="tag cb-f c-' + cat.color + (on ? ' tag--solid is-on' : '') + '" data-cb-f="' + esc(k) + '"><span class="dot"></span>' + esc(k) + ' <b>' + (counts[k] || 0) + '</b></button>';
      }).join('') +
      '<span class="cb-bar__sp"></span><span class="cb-bar__n">' + ic('users') + ' 등록 ' + all.filter(function (c) { return !c.hidden; }).length + '명 · 제출 ' + all.filter(function (c) { return subBy[c.name]; }).length + '명</span></div>';
    if (!list.length) {
      h += '<div class="cb-empty dashed"><div class="t-lg">' + (all.length ? '이 모델로 등록한 도전과제가 없어요.' : '아직 등록한 도전과제가 없어요.') + '</div>' +
        '<div class="t-sm t-muted">앞 쪽 「내 도전과제 정하기」에서 네 칸을 채워 등록하면 여기에 바로 나타납니다.</div><button class="btn btn--sm" data-goto="s-mycard">' + ic('edit') + ' 내 도전과제 등록하러 가기</button></div>';
    } else {
      h += '<div class="cb-grid">' + list.map(function (c) {
        var cat = catOf(c.model), mine = m && c.name === m.name, sub = subBy[c.name];
        return '<button type="button" class="cb-tile c-' + cat.color + (mine ? ' is-mine' : '') + (c.hidden ? ' is-hidden' : '') + '" data-cb-open="' + esc(c.id) + '">' +
          '<span class="cb-tile__top"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.model) + '</span>' +
            (sub ? '<span class="cb-tile__ok" title="제출 완료">' + ic('check') + '</span>' : '') + (mine ? '<span class="cb-tile__me">내 카드</span>' : '') + (c.hidden ? '<span class="cb-tile__me">숨김</span>' : '') + '</span>' +
          '<span class="cb-tile__t">' + esc(c.title) + '</span>' +
          '<span class="cb-tile__s">AI가 ' + esc(c.sense) + ' → ' + esc(c.act) + '</span>' +
          '<span class="cb-tile__who">' + esc(c.name) + (c.team ? ' · ' + esc(c.team) : '') + '</span></button>';
      }).join('') + '</div>';
    }
    el.innerHTML = h + '</div>';
  };
  function cardHtml(c, s) {
    var cat = catOf(c.model), sub = (s.submissions || []).filter(function (x) { return x.name === c.name; })[0], from = c.from && MK.challengeById(c.from);
    return '<div class="modal__kicker">' + esc(c.name) + (c.team ? ' · 함께: ' + esc(c.team) : '') + ' 선생님의 도전과제</div>' +
      '<h3 class="modal__title">' + esc(c.title) + '</h3>' +
      '<div class="cd-tags"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.model) + '</span>' + (sub ? '<span class="tag c-green">' + ic('check') + ' 제출 완료</span>' : '<span class="tag">만드는 중</span>') + (from ? '<span class="tag c-yellow">수업 아이디어: ' + esc(from.title) + '</span>' : '') + '</div>' +
      '<div class="cd-sentence">' + esc(MK.cardIntro ? MK.cardIntro(c) : MK.cardSentence(c)) + '</div>' +
      '<dl class="cd-servo"><div><dt><span class="pin">P0</span> 서보 1</dt><dd>' + (c.servo1 ? esc(c.servo1) : '<span class="t-muted">비어 있음</span>') + '</dd></div>' +
        '<div><dt><span class="pin">P1</span> 서보 2</dt><dd>' + (c.servo2 ? esc(c.servo2) : '<span class="t-muted">비어 있음</span>') + '</dd></div></dl>' +
      (sub ? '<div class="cd-sub"><b>제출한 결과물</b> · ' + esc(sub.title) + (MK.isHttpUrl(sub.videoUrl) ? ' · <a class="link" href="' + esc(sub.videoUrl) + '" target="_blank" rel="noopener">영상 ↗</a>' : '') + (sub.makecodeUrl ? ' · <a class="link" href="' + esc(sub.makecodeUrl) + '" target="_blank" rel="noopener">MakeCode ↗</a>' : '') + '</div>' : '');
  }
  function openCard(id) {
    var s = st(), c = (s.cards || []).filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var m = me(), mine = m && c.name === m.name, admin = MK.store.isAdmin();
    var d = modal(cardHtml(c, s) +
      '<div class="modal__actions">' +
        (admin ? '<button type="button" class="ubtn ubtn--ghost" data-cd-hide>' + (c.hidden ? '다시 보이기' : '숨기기') + '</button><button type="button" class="ubtn ubtn--danger" data-cd-del>' + ic('trash') + ' 지우기</button>' : '') +
        (mine ? '<button type="button" class="ubtn ubtn--ghost" data-cd-edit>' + ic('edit') + ' 내 카드 고치기</button>' : '') +
        '<button type="button" class="ubtn" data-cd-close>닫기</button></div>', true);
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-cd-close]')) d.close();
      else if (e.target.closest('[data-cd-edit]')) { d.close(); MK.deck.goto('s-mycard'); }
      else if (e.target.closest('[data-cd-hide]')) { d.close(); MK.store.hideCard(c.id, !c.hidden).then(function () { MK.ui.toast(c.hidden ? '다시 보이게 했어요.' : '숨겼어요. 관리자에게만 흐리게 보입니다.'); }, bad); }
      else if (e.target.closest('[data-cd-del]')) {
        d.close();
        MK.ui.confirm({ title: '이 도전과제를 지울까요?', desc: '「' + esc(c.title) + '」 · ' + esc(c.name) + '<br>되돌릴 수 없습니다. 제출한 결과물은 남습니다.', okText: '지우기', danger: true })
          .then(function (y) { if (y) MK.store.deleteCard(c.id).then(function () { MK.ui.toast('지웠어요.'); }, bad); });
      }
    });
  }
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-cb-f]');
    if (f) { var k = f.getAttribute('data-cb-f') || null; boardFilter = boardFilter === k ? null : k; MK.renderWidgets(f.closest('.slide')); return; }
    var o = e.target.closest('[data-cb-open]');
    if (o && !editing()) openCard(o.getAttribute('data-cb-open'));
  });

  /* =========================================================
     4. 도전과제 예시 갤러리 (PART 5 덤)
     ========================================================= */
  var galFilter = null;
  MK.widgets['idea-gallery'] = function (el) {
    var h = '<div class="ig-bar">' + MK.categoryOrder.map(function (k) {
      var cat = MK.categories[k], on = galFilter === k, n = MK.challenges.filter(function (c) { return c.category === k; }).length;
      return n ? '<button type="button" class="tag ch-filter__btn c-' + cat.color + (on ? ' tag--solid is-on' : '') + '" data-ig-f="' + esc(k) + '"><span class="dot"></span>' + esc(k) + '</button>' : '';
    }).join('') + '</div><div class="ch-overview ig-grid">';
    MK.challenges.forEach(function (c, i) {
      var cat = MK.catOf(c), dim = galFilter && c.category !== galFilter;
      h += '<button class="ch-card c-' + cat.color + (dim ? ' is-dim' : '') + '" data-ig-open="' + c.id + '">' +
        '<div class="ch-card__img" style="background-image:url(' + MK.challengeImage(c.id) + ')"></div>' +
        '<div class="ch-card__body"><div class="ch-card__cat">' + ic(cat.icon) + ' ' + esc(c.category) + ' · ' + (i + 1) + '</div>' +
        '<div class="ch-card__title">' + esc(c.title) + '</div><div class="ig-q">' + esc(c.question) + '</div></div></button>';
    });
    h += '<div class="dashed ig-note"><div class="t-lg" style="font-size:23px">카드를 누르면<br>자세히 볼 수 있어요.</div>' +
      '<div class="t-sm t-muted" style="font-size:19px;line-height:1.45">원래 오늘 연수에서<br>해 보려다 접은 과제입니다.<br>초등학생과 해 봐도<br>좋을 것 같아 남겨 둡니다.</div></div>';
    el.innerHTML = h + '</div>';
  };
  function openIdea(id) {
    var c = MK.challengeById(id); if (!c) return;
    var cat = MK.catOf(c), guide = MK.guideUrl(c.ref);
    var sec = function (icon, color, t, body) { return '<div class="ig-sec"><div class="ig-sec__h"><span class="circle circle--sm c-' + color + '">' + ic(icon) + '</span>' + t + '</div><div class="ig-sec__b">' + body + '</div></div>'; };
    var d = modal(
      '<div class="modal__kicker">도전과제 예시 · ' + esc(c.category) + '</div><h3 class="modal__title">' + esc(c.title) + '</h3>' +
      '<p class="modal__desc" style="font-size:16px;color:var(--navy);font-weight:700">' + esc(c.question) + '</p>' +
      '<div class="ig-detail"><div class="ig-photo" style="background-image:url(' + MK.challengeImage(c.id) + ')"></div><div class="ig-secs">' +
        sec('doc', 'blue', '문제 상황', esc(c.problem).replace(/\n/g, '<br>')) +
        sec('flag', 'purple', '성공 기준', esc(c.success)) +
        sec('gear', 'green', '준비물', esc(c.materials)) +
        (c.start ? sec('bulb', 'yellow', '이렇게 시작해 보세요', c.start) : '') +
        ((MK.challengeLinks || {})[c.id] ? sec('book', 'sky', '교과와 잇기', '<b>' + esc(MK.challengeLinks[c.id][0]) + '</b> · ' + esc(MK.challengeLinks[c.id][1])) : '') +
      '</div></div>' +
      '<div class="ig-links">' + (cat.app ? '<a class="link" href="' + cat.app + '" target="_blank" rel="noopener">' + esc(cat.model) + ' 웹앱 ↗</a>' : '') + (guide ? '<a class="link" href="' + guide + '" target="_blank" rel="noopener">모델 안내 ↗</a>' : '') + '</div>' +
      '<div class="modal__actions"><button type="button" class="ubtn ubtn--ghost" data-ig-close>닫기</button><button type="button" class="ubtn" data-ig-use>' + ic('edit') + ' 이 아이디어로 내 도전과제 쓰기</button></div>', true);
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-ig-close]')) d.close();
      else if (e.target.closest('[data-ig-use]')) { d.close(); fromIdea(c.id); MK.deck.goto('s-mycard'); MK.ui.toast('가져왔어요. 문장 틀을 내 상황에 맞게 채워 주세요.'); }
    });
  }
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-ig-f]');
    if (f) { var k = f.getAttribute('data-ig-f'); galFilter = galFilter === k ? null : k; MK.renderWidgets(f.closest('.slide')); return; }
    var o = e.target.closest('[data-ig-open]');
    if (o && !editing()) openIdea(o.getAttribute('data-ig-open'));
  });

  MK.cards = { sentence: MK.cardSentence, openCard: openCard, openIdea: openIdea, fromIdea: fromIdea };
})();
