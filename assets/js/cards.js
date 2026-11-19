/* =========================================================
   내 분류기 카드 (9~10차시 공통과제: 섞인 바둑돌을 검은돌·흰돌끼리 나누기)
   - tick-list    : 눌러서 체크하는 목록 (이 브라우저에만)
   - my-card      : 슬라이드 위에서 인식 설정·분류 방법·서보 동작을 채우고 등록
   - card-board   : 우리 반 분류기 보드 (분류 방법·시험 기록, 누르면 크게)
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
  /* ---------- 공통과제(바둑돌 분류기) 카드 ----------
     AI 모델은 연수생이 고릅니다(MK.cardModels). 돌을 직접 보거나(이미지분류), 사람이 돌을 보고 손 모양(핸드포즈)·말(음성인식)로 알려 주거나,
     손 높이(모션인식)로 서보를 직접 움직입니다. 모션인식은 ID가 없어 ID 표시를 숨기고 「왼손 올리기」처럼 적습니다.
     ID1 → 검은돌 쪽, ID2 → 흰돌 쪽, ID3(선택) → 가만히. 서버 카드 탭의 칸을 그대로 씁니다(서버 코드는 바꾸지 않음):
       title=분류기 이름 · model=AI 모델 · sense=ID별로 알아볼 것(「검은돌·흰돌·빈 판」, 「주먹·보」) · act=분류 방법 · servo1·servo2 · team */
  var ROWS = [{ id: 1, s: 's1', to: '검은돌 쪽으로' }, { id: 2, s: 's2', to: '흰돌 쪽으로' }, { id: 3, s: 's3', to: '가만히 · 선택' }];
  var MODEL_GUIDE = {
    '이미지분류': { hint: 'AI가 카메라로 돌을 직접 봅니다', ph: ['검은돌', '흰돌', '빈 판'], rows: 3 },
    '핸드포즈': { hint: '사람이 돌을 보고 손 모양으로 알려 줍니다', ph: ['예: 주먹', '예: 보', '예: 손 내리기'], rows: 3 },
    '음성인식': { hint: '사람이 돌을 보고 말로 알려 줍니다', ph: ['예: 검은돌', '예: 흰돌', ''], rows: 2 },
    '모션인식': { hint: '사람이 돌을 보고 손 높이로 서보를 움직입니다 · 왼손 P0, 오른손 P1', ph: ['예: 왼손 올리기', '예: 오른손 올리기', '예: 양손 가운데'], rows: 3, noId: true,
      servo: ['예: 왼손을 올리면 90°→150°, 판을 왼쪽으로', '예: 오른손을 올리면 90°→150°, 판을 오른쪽으로'] }
  };
  var SERVO_PH = ['예: ID1이면 90°→30°, 판을 왼쪽으로', '예: ID2이면 90°→150°, 판을 오른쪽으로'];
  function tagOf(model, r) { return (MODEL_GUIDE[model] || {}).noId ? '' : 'ID' + r.id; } // 모션인식은 ID가 없음
  function guideOf(model) { return MODEL_GUIDE[model] || { hint: '먼저 AI 모델을 고르세요', ph: ['', '', ''], rows: 3 }; }
  function unpack(c) {
    var n = {}, sig = String(c.sense || '').split('·');
    ROWS.forEach(function (r, i) { n[r.s] = (sig[i] || '').trim(); });
    return n;
  }
  function pack(n, model) { // 화면 칸 → sense 한 줄
    var sig = ROWS.slice(0, guideOf(model).rows).map(function (r) { return String(n[r.s] || '').replace(/·/g, ' ').trim(); });
    while (sig.length && !sig[sig.length - 1]) sig.pop(); // 뒤쪽 빈칸(ID3)은 빼기
    return { sense: sig.join('·') };
  }
  // 한눈에 보기 줄: [이름, 내용]. 보드·제출·내려받기에서 같이 씀
  MK.sorterLines = function (c) {
    c = c || {}; var n = unpack(c);
    var sees = ROWS.filter(function (r) { return n[r.s]; }).map(function (r) { var t = tagOf(c.model, r); return (t ? t + ' ' : '') + n[r.s] + ' → ' + r.to.replace(' · 선택', '').replace('으로', ''); }).join(' · ');
    return [['AI 모델', c.model || ''], ['알아보는 것', sees], ['분류 방법', c.act || ''], ['서보 1 (P0)', c.servo1 || ''], ['서보 2 (P1)', c.servo2 || '']];
  };
  MK.cardSentence = function (c) {
    c = c || {}; var n = unpack(c);
    var t1 = tagOf(c.model, ROWS[0]), t2 = tagOf(c.model, ROWS[1]);
    var sig = n.s1 && n.s2 ? ' · ' + (t1 ? t1 + ' ' : '') + n.s1 + ' / ' + (t2 ? t2 + ' ' : '') + n.s2 : '';
    return (c.model ? c.model + ' · ' : '') + (c.act ? String(c.act).trim() : '분류 방법을 아직 적지 않았어요') + sig;
  };

  /* 이름이 필요할 때: 등록돼 있으면 바로, 아니면 이름 등록 창을 먼저 */
  function withMe(then, why) {
    var m = me();
    if (m) return then(m);
    MK.ui.form({ kicker: '별명 등록', title: '먼저 별명을 등록해 주세요', desc: why || '내 분류기와 제출에 쓰는 별명입니다.',
      fields: MK.ui.personFields(null), note: MK.ui.PERSON_NOTE, submitText: '등록',
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
     2. 내 분류기 카드 (공통과제: 섞인 바둑돌을 검은돌·흰돌끼리 나누기) — 칸을 채우고 등록
        ① 인식: AI 모델 고르기 + ID마다 알아볼 것 (모델에 따라 칸이 바뀜) ② 분류 방법 ③ 서보가 하는 일·각도
     ========================================================= */
  var DRAFT_KEY = MK.config.storageKey + '-carddraft';
  var FIELDS = ['title', 'sense', 'act', 'servo1', 'servo2', 'team'];
  var form = { el: null, dirty: false, owner: null, from: '', model: '' };

  MK.widgets['my-card'] = function (el) {
    form.el = el;
    var ids = ROWS.map(function (r) {
      return '<div class="mc-id' + (r.id < 3 ? '' : ' is-opt') + '" data-row="' + r.id + '"><span class="mc-id__tag">ID' + r.id + '</span>' +
        '<input class="mc-sig" data-k="' + r.s + '" maxlength="9" autocomplete="off" spellcheck="false" aria-label="ID' + r.id + '에서 AI가 알아볼 것">' +
        '<span class="mc-id__to">→ ' + esc(r.to) + '</span></div>';
    }).join('');
    el.innerHTML =
      '<div class="mc mc--sort">' +
        '<div class="mc-card">' +
          '<div class="mc-title"><span class="mc-k">분류기 이름</span><input class="mc-title__in" data-k="title" maxlength="30" placeholder="예: 기우뚱 시소 분류기" autocomplete="off" spellcheck="false"></div>' +
          '<div class="mc-sec"><div class="mc-sec__h"><span class="mc-k">① 인식 · AI 모델</span><span class="mc-models">' + (MK.cardModels || []).map(function (k) {
              var cat = MK.categories[k];
              return '<button type="button" class="tag mc-model c-' + cat.color + '" data-mc-model="' + esc(k) + '" aria-pressed="false">' + ic(cat.icon) + ' ' + esc(k) + '</button>';
            }).join('') + '</span></div>' +
            '<div class="mc-hint" data-mc-hint></div>' +
            '<div class="mc-ids">' + ids + '</div></div>' +
          '<div class="mc-sec mc-row mc-line"><span class="mc-k">② 분류 방법</span><input data-k="act" maxlength="30" placeholder="예: 판을 기울여 왼쪽·오른쪽 통으로" autocomplete="off" spellcheck="false"></div>' +
          '<div class="mc-sec"><span class="mc-k">③ 서보가 하는 일 · 각도</span>' +
            '<div class="mc-servo"><span class="pin">P0</span><b>서보 1</b><input data-k="servo1" maxlength="40" placeholder="' + SERVO_PH[0] + '" autocomplete="off" spellcheck="false"></div>' +
            '<div class="mc-servo"><span class="pin">P1</span><b>서보 2</b><input data-k="servo2" maxlength="40" placeholder="' + SERVO_PH[1] + '" autocomplete="off" spellcheck="false"></div></div>' +
          '<div class="mc-sec mc-row mc-team"><span class="mc-k">함께 만드는 사람</span><input data-k="team" maxlength="40" placeholder="별명으로 · 혼자면 비워 두세요" autocomplete="off" spellcheck="false"></div>' +
        '</div>' +
        '<div class="mc-side">' +
          '<div class="mc-status" data-mc-status></div>' +
          '<button type="button" class="btn btn--green mc-save" data-mc-save>' + ic('check') + ' 내 분류기 등록</button>' +
          '<div class="mc-preview"><div class="mc-k">한눈에 보기</div><dl class="mc-sum" data-mc-preview></dl></div>' +
          '<div class="mc-links"><button type="button" class="btn btn--ghost btn--sm" data-goto="s-cardboard">우리 반 분류기 보기 ' + ic('right') + '</button></div>' +
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
  // 화면 칸 → 서버 카드 모양 (ID별 칸을 sense 한 줄로 묶음)
  function values() {
    var v = {}, n = {}; if (!form.el) return v;
    $$('[data-k]', form.el).forEach(function (i) { var k = i.getAttribute('data-k'); (/^s\d$/.test(k) ? n : v)[k] = i.value.trim(); });
    Object.assign(v, pack(n, form.model));
    v.model = form.model || ''; v.from = '';
    return v;
  }
  // 모델에 맞게 칸 바꾸기: 알아볼 것의 예시 글자, ID3 줄(음성인식은 없음), ID 표시(모션인식은 없음), 서보 예시
  function paintModel() {
    if (!form.el) return;
    var g = guideOf(form.model);
    $$('.mc-model', form.el).forEach(function (b) { var on = b.getAttribute('data-mc-model') === form.model; b.classList.toggle('is-on', on); b.classList.toggle('tag--solid', on); b.setAttribute('aria-pressed', on); });
    var h = $('[data-mc-hint]', form.el); if (h) h.textContent = g.hint;
    ROWS.forEach(function (r, i) {
      var row = $('[data-row="' + r.id + '"]', form.el); if (!row) return;
      row.hidden = i >= g.rows;
      $('.mc-sig', row).placeholder = g.ph[i] || '';
      var tag = $('.mc-id__tag', row), t = tagOf(form.model, r);
      tag.textContent = t; tag.style.display = t ? '' : 'none'; row.classList.toggle('is-notag', !t);
      $('.mc-sig', row).setAttribute('aria-label', (t ? t + '에서 ' : '') + r.to.replace(' · 선택', '') + ' 보낼 신호');
    });
    ['servo1', 'servo2'].forEach(function (k, i) { var inp = $('[data-k="' + k + '"]', form.el); if (inp) inp.placeholder = (g.servo || SERVO_PH)[i]; });
  }
  function fill(v, dirty) {
    if (!form.el) return;
    v = v || {};
    var n = unpack(v);
    $$('[data-k]', form.el).forEach(function (i) { var k = i.getAttribute('data-k'); i.value = (/^s\d$/.test(k) ? n[k] : v[k]) || ''; });
    form.model = (MK.cardModels || []).indexOf(v.model) >= 0 ? v.model : '';
    paintModel();
    form.dirty = !!dirty;
    form.owner = me() ? me().name : null;
    live();
  }
  function sumHtml(c) {
    return MK.sorterLines(c).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd' + (r[1] ? '' : ' class="is-empty"') + '>' + esc(r[1] || '아직 비어 있음') + '</dd></div>'; }).join('');
  }
  function live() {
    if (!form.el) return;
    var p = $('[data-mc-preview]', form.el); if (p) p.innerHTML = sumHtml(values());
  }
  function paintStatus() {
    if (!form.el) return;
    var box = $('[data-mc-status]', form.el), btn = $('[data-mc-save]', form.el), m = me(), c = myCardNow();
    if (!has('cards')) {
      box.innerHTML = '<div class="mc-st mc-st--warn">' + ic('alert') + '<span>서버 코드가 예전 버전이라 등록할 수 없어요. 강사에게 알려 주세요.</span></div>';
      btn.disabled = true; return;
    }
    btn.disabled = false;
    if (!m) box.innerHTML = '<div class="mc-st">' + ic('user') + '<span>등록하려면 먼저 별명이 필요해요.<br><button type="button" class="linkish" data-act="identify">별명 등록하기</button></span></div>';
    else if (!c) box.innerHTML = '<div class="mc-st">' + ic('doc') + '<span><b>' + esc(m.name) + '</b> 님 · 아직 등록 전<br>빈칸을 채우고 등록하세요.</span></div>';
    else box.innerHTML = '<div class="mc-st mc-st--ok">' + ic('check') + '<span><b>등록됨</b> · 보드에 올라갔어요' + (form.dirty ? '<br><b class="t-blue">고친 내용이 있어요. 다시 저장하세요.</b>' : '<br>고치면 다시 저장하면 됩니다.') + '</span></div>';
    btn.innerHTML = ic('check') + (c ? ' 고친 내용 저장' : ' 내 분류기 등록');
    btn.classList.toggle('btn--ghost', !!c && !form.dirty);
  }
  function save() {
    var v = values();
    if (!v.title) { MK.ui.toast('분류기 이름을 적어 주세요.', true); return; }
    if (!v.model) { MK.ui.toast('① 쓸 AI 모델을 골라 주세요.', true); return; }
    var n = unpack(v);
    if (v.model === '이미지분류' && (!n.s1 || !n.s2)) { // 돌을 직접 보는 경우 기본값
      n.s1 = n.s1 || '검은돌'; n.s2 = n.s2 || '흰돌'; v.sense = pack(n, v.model).sense;
    }
    n = unpack(v);
    if (!n.s1 || !n.s2) { MK.ui.toast('① ID1·ID2에서 AI가 알아볼 것을 적어 주세요.', true); return; }
    if (!v.act) { MK.ui.toast('② 분류 방법을 한 줄로 적어 주세요.', true); return; }
    try { MK.cleanCard(v); } catch (e) { MK.ui.toast(e.message, true); return; }
    withMe(function (m) {
      var btn = $('[data-mc-save]', form.el); if (btn) btn.disabled = true;
      MK.store.saveCard({ name: m.name, pin: m.pin, card: v }).then(function (r) {
        form.dirty = false; writeDraft(null);
        MK.ui.toast(r && r.updated ? '내 분류기를 고쳤어요.' : '내 분류기를 등록했어요! 우리 반 보드에 올라갔어요.');
        paintStatus();
      }, bad).then(function () { if (btn) btn.disabled = false; });
    }, '내 분류기를 등록할 별명과 비밀번호 4자리를 적어 주세요.');
  }
  function touched() { form.dirty = true; live(); paintStatus(); var v = values(); v.at = Date.now(); v.owner = me() ? me().name : ''; writeDraft(v); }

  document.addEventListener('input', function (e) {
    if (!form.el || !form.el.contains(e.target)) return;
    var t = e.target;
    if (!t.hasAttribute('data-k')) return;
    touched();
  });
  document.addEventListener('keydown', function (e) {
    if (form.el && form.el.contains(e.target) && e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
  });
  document.addEventListener('click', function (e) {
    var mb = e.target.closest('.mc-model');
    if (mb && form.el && form.el.contains(mb)) { form.model = mb.getAttribute('data-mc-model'); paintModel(); touched(); return; }
    if (e.target.closest('[data-mc-save]')) save();
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
     3. 우리 반 분류기 보드 — 분류 방법과 시험 기록을 한눈에 (공통과제라 모델 거르기는 없음)
     ========================================================= */
  MK.widgets['card-board'] = function (el, s) {
    if (!has('cards')) { el.innerHTML = '<div class="dashed t-md">서버 코드가 예전 버전이라 분류기 보드를 볼 수 없어요. 강사에게 알려 주세요.</div>'; return; }
    var all = cardsOf(s), m = me(), subBy = {};
    (s.submissions || []).forEach(function (x) { subBy[x.name] = x; });
    var list = all.slice().sort(function (a, b) { var am = m && a.name === m.name ? -1 : 0, bm = m && b.name === m.name ? -1 : 0; return am - bm || (a.at || 0) - (b.at || 0); });
    var counts = {}; all.forEach(function (c) { counts[c.model] = (counts[c.model] || 0) + 1; });
    var h = '<div class="cb"><div class="cb-bar"><span class="tag tag--solid c-green">' + ic('binoculars') + ' 공통과제 · 바둑돌 분류기</span>' +
      (MK.cardModels || []).map(function (k) { var cat = MK.categories[k]; return '<span class="tag c-' + cat.color + '"><span class="dot"></span>' + esc(k) + ' <b>' + (counts[k] || 0) + '</b></span>'; }).join('') +
      '<span class="cb-bar__sp"></span><span class="cb-bar__n">' + ic('users') + ' 등록 ' + all.filter(function (c) { return !c.hidden; }).length + '명 · 제출 ' + all.filter(function (c) { return subBy[c.name]; }).length + '명</span></div>';
    if (!list.length) {
      h += '<div class="cb-empty dashed"><div class="t-lg">아직 등록한 분류기가 없어요.</div>' +
        '<div class="t-sm t-muted">앞 쪽 「내 분류기 등록」에서 칸을 채워 등록하면 여기에 바로 나타납니다.</div><button class="btn btn--sm" data-goto="s-mycard">' + ic('edit') + ' 내 분류기 등록하러 가기</button></div>';
    } else {
      h += '<div class="cb-grid">' + list.map(function (c) {
        var mine = m && c.name === m.name, sub = subBy[c.name];
        var cat = catOf(c.model);
        return '<button type="button" class="cb-tile c-' + cat.color + (mine ? ' is-mine' : '') + (c.hidden ? ' is-hidden' : '') + '" data-cb-open="' + esc(c.id) + '">' +
          '<span class="cb-tile__top"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.model) + '</span>' + (sub ? '' : '<span class="tag">만드는 중</span>') +
            (sub ? '<span class="cb-tile__ok" title="제출 완료">' + ic('check') + '</span>' : '') + (mine ? '<span class="cb-tile__me">내 카드</span>' : '') + (c.hidden ? '<span class="cb-tile__me">숨김</span>' : '') + '</span>' +
          '<span class="cb-tile__t">' + esc(c.title) + '</span>' +
          '<span class="cb-tile__s">' + esc(c.act || '') + '</span>' +
          '<span class="cb-tile__who">' + esc(c.name) + (c.team ? ' · ' + esc(c.team) : '') + '</span></button>';
      }).join('') + '</div>';
    }
    el.innerHTML = h + '</div>';
  };
  function cardHtml(c, s) {
    var sub = (s.submissions || []).filter(function (x) { return x.name === c.name; })[0];
    var rows = MK.sorterLines(c);
    return '<div class="modal__kicker">' + esc(c.name) + (c.team ? ' · 함께: ' + esc(c.team) : '') + ' 선생님의 분류기</div>' +
      '<h3 class="modal__title">' + esc(c.title) + '</h3>' +
      '<div class="cd-tags">' + (c.model ? '<span class="tag tag--solid c-' + catOf(c.model).color + '">' + ic(catOf(c.model).icon) + ' ' + esc(c.model) + '</span>' : '') + (sub ? '<span class="tag c-green">' + ic('check') + ' 제출 완료</span>' : '<span class="tag">만드는 중</span>') + '</div>' +
      '<dl class="cd-servo cd-sort">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + (r[1] ? esc(r[1]) : '<span class="t-muted">비어 있음</span>') + '</dd></div>'; }).join('') + '</dl>' +
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
        MK.ui.confirm({ title: '이 분류기 카드를 지울까요?', desc: '「' + esc(c.title) + '」 · ' + esc(c.name) + '<br>되돌릴 수 없습니다. 제출한 결과물은 남습니다.', okText: '지우기', danger: true })
          .then(function (y) { if (y) MK.store.deleteCard(c.id).then(function () { MK.ui.toast('지웠어요.'); }, bad); });
      }
    });
  }
  document.addEventListener('click', function (e) {
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
