/* =========================================================
   위젯 — 슬라이드 안의 움직이는 부분
   <div data-widget="이름"> 에 그려지고, 데이터가 바뀌면 다시 그려집니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n, c) { return MK.icon(n, c); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* =========================================================
     화면 UI: 알림, 입력 창
     ========================================================= */
  MK.ui = {};
  var toastT;
  MK.ui.toast = function (msg, isError) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast ui'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('is-error', !!isError); t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 3000);
  };

  function dialog(html, wide) {
    var d = document.createElement('dialog');
    d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box' + (wide ? ' modal__box--wide' : '') + '"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' + html + '</div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 50); });
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.showModal();
    return d;
  }

  /* 입력 창: fields=[{name,label,type,value,placeholder,help,maxlength,inputmode,small}] */
  MK.ui.form = function (o) {
    var f = '<form method="dialog" novalidate>';
    if (o.kicker) f += '<div class="modal__kicker">' + esc(o.kicker) + '</div>';
    f += '<h3 class="modal__title">' + esc(o.title) + '</h3>';
    if (o.desc) f += '<p class="modal__desc">' + o.desc + '</p>';
    var rows = o.fields || [];
    for (var i = 0; i < rows.length; i++) {
      var x = rows[i];
      if (x.pair) { // 이름 + 비밀번호 한 줄
        f += '<div class="pin-row">' + fieldHtml(x.pair[0]) + fieldHtml(x.pair[1]) + '</div>';
      } else f += fieldHtml(x);
    }
    f += '<div class="modal__msg" role="alert"></div>';
    f += '<div class="modal__wait" role="status">사람이 몰려 차례대로 처리하는 중이에요. 창을 닫지 말고 잠시만 기다려 주세요.</div>';
    if (o.note) f += '<div class="modal__note">' + o.note + '</div>';
    f += '<div class="modal__actions">' + (o.extra || '') + '<button type="button" class="ubtn ubtn--ghost" data-cancel>취소</button><button type="submit" class="ubtn' + (o.danger ? ' ubtn--danger' : '') + '">' + esc(o.submitText || '확인') + '</button></div></form>';
    var d = dialog(f, o.wide);
    var form = d.querySelector('form'), msg = d.querySelector('.modal__msg'), wait = d.querySelector('.modal__wait');
    d.querySelector('[data-cancel]').onclick = function () { d.close(); };
    $$('textarea[maxlength]', d).forEach(function (ta) {
      var c = ta.parentNode.querySelector('.count');
      var upd = function () { if (c) c.textContent = ta.value.length + ' / ' + ta.maxLength; };
      ta.addEventListener('input', upd); upd();
    });
    var first = d.querySelector('input:not([type=hidden]):not([value]), input[value=""], textarea:empty') || d.querySelector('input, textarea');
    if (first) first.focus(); // 바로 첫 빈칸으로 (늦게 옮기면 빠르게 입력하는 중에 커서를 빼앗음)
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var vals = {};
      $$('input, textarea, select', form).forEach(function (el) { if (el.name) vals[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      var btn = form.querySelector('[type=submit]'), label = btn.textContent;
      if (btn.disabled) return;
      btn.disabled = true;
      var slow = setTimeout(function () { btn.textContent = '처리 중…'; }, 300); // 서버를 기다리는 동안
      var crowd = setTimeout(function () { wait.classList.add('is-on'); }, 5000); // 오래 걸리면 안내
      msg.classList.remove('is-on');
      Promise.resolve().then(function () { return o.onSubmit(vals, d); }).then(function (r) {
        clearTimeout(slow); clearTimeout(crowd); wait.classList.remove('is-on'); btn.disabled = false; btn.textContent = label;
        if (r !== false) d.close();
      }, function (err) {
        clearTimeout(slow); clearTimeout(crowd); wait.classList.remove('is-on'); btn.disabled = false; btn.textContent = label;
        msg.textContent = (err && err.message) || '처리하지 못했습니다.'; msg.classList.add('is-on');
      });
    });
    if (o.onOpen) o.onOpen(d);
    return d;
  };
  function fieldHtml(x) {
    var id = 'f-' + x.name + '-' + Math.random().toString(36).slice(2, 6);
    var h = '<div class="field"><label for="' + id + '">' + esc(x.label) + (x.small ? '<small>' + esc(x.small) + '</small>' : '') + '</label>';
    var attrs = ' id="' + id + '" name="' + x.name + '"' + (x.placeholder ? ' placeholder="' + esc(x.placeholder) + '"' : '') + (x.maxlength ? ' maxlength="' + x.maxlength + '"' : '') + (x.inputmode ? ' inputmode="' + x.inputmode + '"' : '') + (x.autocomplete ? ' autocomplete="' + x.autocomplete + '"' : ' autocomplete="off"');
    if (x.type === 'textarea') h += '<textarea' + attrs + '>' + esc(x.value || '') + '</textarea>' + (x.maxlength ? '<span class="count"></span>' : '');
    else if (x.type === 'select') h += '<select' + attrs + '>' + x.options.map(function (op) { return '<option value="' + esc(op.value) + '"' + (op.value === x.value ? ' selected' : '') + '>' + esc(op.label) + '</option>'; }).join('') + '</select>';
    else h += '<input type="' + (x.type || 'text') + '"' + attrs + ' value="' + esc(x.value || '') + '">';
    if (x.help) h += '<span class="help">' + x.help + '</span>';
    return h + '</div>';
  }

  MK.ui.confirm = function (o) {
    return new Promise(function (resolve) {
      var done = false;
      MK.ui.form({ kicker: o.kicker, title: o.title, desc: o.desc, submitText: o.okText || '확인', danger: o.danger, fields: o.fields || [],
        onSubmit: function (v) { done = true; resolve(v || true); } }).addEventListener('close', function () { if (!done) resolve(false); });
    });
  };

  /* =========================================================
     나(연수생) 관련
     ========================================================= */
  function me() { return MK.store.getMe(); }
  function myEnrollment(state) {
    var m = me(); if (!m) return null;
    return state.enrollments.filter(function (e) { return e.name === m.name; })[0] || null;
  }
  function mySubmission(state) {
    var m = me(); if (!m) return null;
    return state.submissions.filter(function (s) { return s.name === m.name; })[0] || null;
  }
  function enrolledIn(state, id) { return state.enrollments.filter(function (e) { return e.challengeId === id; }).sort(function (a, b) { return a.at - b.at; }); }
  function capOf(state, id) { return state.settings.capacity[id] != null ? state.settings.capacity[id] : MK.config.defaultCapacity; }
  function isClosed(state, id) { return !state.settings.open || !!state.settings.closed[id]; }
  MK.state = { me: me, myEnrollment: myEnrollment, mySubmission: mySubmission, enrolledIn: enrolledIn, capOf: capOf, isClosed: isClosed };

  function personFields(m) {
    return [{ pair: [
      { name: 'name', label: '이름', value: m ? m.name : '', placeholder: '예: 김하늘', maxlength: 20, autocomplete: 'name' },
      { name: 'pin', label: '비밀번호', small: '숫자 4자리', type: 'password', value: m ? m.pin : '', placeholder: '0000', maxlength: 4, inputmode: 'numeric' }
    ] }];
  }
  var PIN_NOTE = '비밀번호는 내 신청을 바꾸거나 결과물을 고칠 때만 씁니다. 쉬운 숫자 4자리면 됩니다.';

  MK.actions = {
    identify: function () {
      var m = me();
      MK.ui.form({ kicker: '이름 등록', title: '이 노트북을 쓰는 사람', desc: '신청과 제출에 쓸 이름을 적어 주세요. 같은 이름이 있으면 이름 뒤에 학교 이름을 붙여 주세요.', fields: personFields(m), note: PIN_NOTE, submitText: '등록',
        onSubmit: function (v) { return MK.store.identify(v).then(function () { MK.ui.toast(v.name.trim() + ' 선생님, 반갑습니다!'); }); } });
    },
    apply: function (challengeId) {
      var ch = MK.challengeById(challengeId), st = MK.store.getStateSync(), mine = myEnrollment(st);
      var note = PIN_NOTE;
      if (mine && mine.challengeId !== challengeId) note = '<b>지금 신청한 「' + esc(MK.challengeById(mine.challengeId).title) + '」은 자동으로 취소됩니다.</b><br>' + PIN_NOTE;
      MK.ui.form({ kicker: ch.category + ' · 개인 도전', title: ch.title + ' 신청', desc: '도전과제는 한 사람이 하나만 신청합니다. 정원 ' + capOf(st, challengeId) + '명.', fields: personFields(me()), note: note, submitText: '이 도전 신청하기',
        onSubmit: function (v) {
          return MK.store.apply({ name: v.name, pin: v.pin, challengeId: challengeId }).then(function (r) {
            MK.ui.toast(r.already ? '이미 신청한 도전과제입니다.' : '「' + ch.title + '」에 신청했어요. 이제 만들어 봅시다!');
          });
        } });
    },
    cancel: function () {
      var st = MK.store.getStateSync(), mine = myEnrollment(st); if (!mine) return;
      var ch = MK.challengeById(mine.challengeId);
      MK.ui.form({ kicker: '신청 취소', title: '「' + ch.title + '」 신청을 취소할까요?', desc: '취소하면 자리가 다른 사람에게 돌아갑니다. 제출한 결과물은 남아 있습니다.', fields: personFields(me()), submitText: '신청 취소', danger: true,
        onSubmit: function (v) { return MK.store.cancel(v).then(function () { MK.ui.toast('신청을 취소했어요.'); }); } });
    },
    submit: function () {
      var st = MK.store.getStateSync(), m = me(), mine = myEnrollment(st), sub = mySubmission(st);
      if (!mine) { MK.ui.toast('먼저 도전과제를 신청해 주세요.', true); return; }
      var ch = MK.challengeById(mine.challengeId);
      MK.ui.form({ wide: true, kicker: ch.title, title: sub ? '내 결과물 고치기' : '내 결과물 제출', desc: '30초 이내 영상으로 서로 다른 행동 두 가지 이상을 보여 주세요. 다시 제출하면 고쳐집니다.',
        fields: personFields(m).concat([
          { name: 'title', label: '작품 제목', value: sub ? sub.title : '', placeholder: '예: 손끝으로 지휘하는 작은 무대', maxlength: 40 },
          { name: 'desc', label: '간단한 설명', small: '무엇을 인식하면 어떻게 움직이는지 2~3문장', type: 'textarea', value: sub ? sub.desc : '', maxlength: MK.config.descMax, placeholder: '예: 주먹을 쥐면 서보가 북을 치고, 손바닥을 펴면 탬버린을 흔듭니다.' },
          { name: 'makecodeUrl', label: 'MakeCode 공유 주소', value: sub ? sub.makecodeUrl : '', placeholder: 'https://makecode.microbit.org/_…', help: 'MakeCode 오른쪽 위 <b>공유</b> → 공유 링크 만들기 → 주소 복사' },
          { name: 'videoUrl', label: '작동 영상 주소', value: sub ? sub.videoUrl : '', placeholder: 'https://drive.google.com/… 또는 https://youtu.be/…', help: '구글 드라이브는 공유 설정을 <b>링크가 있는 모든 사용자</b>로 바꿔야 발표 때 재생됩니다.' }
        ]), submitText: sub ? '고친 내용 제출' : '결과물 제출하기',
        onSubmit: function (v) { return MK.store.submit(v).then(function (r) { MK.ui.toast(r.updated ? '결과물을 고쳤어요.' : '결과물을 제출했어요. 수고하셨습니다!'); }); } });
    },
    switchUser: function () {
      MK.ui.confirm({ title: '다른 사람으로 바꿀까요?', desc: '이 노트북에 저장된 이름과 비밀번호를 지웁니다. 신청과 제출 기록은 그대로 남습니다.', okText: '바꾸기' })
        .then(function (ok) { if (ok) { MK.store.setMe(null); MK.actions.identify(); } });
    }
  };

  /* =========================================================
     위젯
     ========================================================= */
  MK.widgets = {};

  function seatDots(n, cap) {
    var h = '<span class="seats" aria-hidden="true">';
    for (var i = 0; i < Math.min(cap, 12); i++) h += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return h + '</span>';
  }
  function nameChips(list, opts) {
    var m = me();
    return list.map(function (e) {
      var isMe = m && e.name === m.name;
      return '<span class="name-chip' + (isMe ? ' is-me' : '') + (opts && opts.pending && opts.pending(e) ? ' is-pending' : '') + '">' + (opts && opts.done && opts.done(e) ? '<span class="sub-mark">' + ic('check') + '</span>' : '') + esc(e.name) +
        '<button class="x" data-admin-remove="' + e.id + '" title="명단에서 빼기">' + ic('x') + '</button></span>';
    }).join('');
  }

  /* 도전과제 한눈에 보기 */
  MK.widgets['challenge-overview'] = function (el, st) {
    var mine = myEnrollment(st);
    var h = '<div class="ch-overview">';
    MK.challenges.forEach(function (c, i) {
      var cat = MK.catOf(c), n = enrolledIn(st, c.id).length, cap = capOf(st, c.id), left = cap - n;
      var closed = isClosed(st, c.id);
      h += '<button class="ch-card c-' + cat.color + (mine && mine.challengeId === c.id ? ' is-mine' : '') + '" data-goto="ch-' + c.id + '">' +
        '<div class="ch-card__img" style="background-image:url(' + MK.challengeImage(c.id) + ')"></div>' +
        (mine && mine.challengeId === c.id ? '<span class="tag tag--solid c-yellow ch-card__mine">내 신청</span>' : '') +
        '<div class="ch-card__body"><div class="ch-card__cat">' + ic(cat.icon) + ' ' + esc(c.category) + ' · ' + (i + 1) + '</div>' +
        '<div class="ch-card__title">' + esc(c.title) + '</div>' +
        '<div class="ch-card__seats">' + seatDots(n, cap) + (closed ? '<span class="full">마감</span>' : left > 0 ? '<span class="left">' + left + '자리 남음</span>' : '<span class="full">정원 마감</span>') + '</div></div></button>';
    });
    h += '<div class="dashed" style="display:flex;flex-direction:column;justify-content:center;gap:12px;padding:22px 26px">' +
      '<div class="t-lg" style="font-size:26px">카드를 누르면<br>자세한 설명으로</div>' +
      '<div class="t-sm t-muted" style="font-size:20px;line-height:1.45">한 사람이 하나만 신청합니다.<br>바꾸면 이전 신청은 자동 취소.</div></div>';
    el.innerHTML = h + '</div>';
  };

  /* 도전과제별 신청 패널 */
  MK.widgets['apply-panel'] = function (el, st) {
    var id = el.getAttribute('data-challenge'), c = MK.challengeById(id); if (!c) return;
    var list = enrolledIn(st, id), n = list.length, cap = capOf(st, id), closed = isClosed(st, id);
    var mine = myEnrollment(st), isMine = mine && mine.challengeId === id;
    var btn;
    if (isMine) btn = '<button class="btn btn--green" data-goto="s-submit">' + ic('send') + ' 결과물 제출로</button><button class="btn btn--ghost btn--sm" data-act="cancel">신청 취소</button>';
    else if (closed) btn = '<button class="btn" disabled>신청 마감</button>';
    else if (n >= cap) btn = '<button class="btn" disabled>정원이 찼어요</button>';
    else btn = '<button class="btn" data-act="apply" data-id="' + id + '">' + ic('hand') + ' 신청하기</button>';
    el.innerHTML = '<div class="apply c-' + MK.catOf(c).color + '">' +
      '<div class="apply__h">신청 현황</div>' +
      '<div class="apply__count">' + n + '<small> / ' + cap + '명</small></div>' + seatDots(n, cap).replace('class="seats"', 'class="seats seats--lg"') +
      '<div class="apply__names">' + (n ? nameChips(list) : '<span class="apply__empty">아직 신청한 사람이 없어요.<br>첫 번째 도전자가 되어 보세요.</span>') + '</div>' +
      (isMine ? '<div class="apply__state">내가 신청한 도전과제입니다.</div>' : mine ? '<div class="apply__state">지금 신청: ' + esc(MK.challengeById(mine.challengeId).title) + '</div>' : '') +
      btn + '<button class="apply__back" data-goto="s-overview">' + ic('left') + ' 다른 도전과제 보기</button></div>';
  };

  /* 신청 현황판 */
  MK.widgets['seat-board'] = function (el, st) {
    var total = st.enrollments.length, cap = 0;
    var h = '<div class="board">';
    MK.challenges.forEach(function (c) {
      var cat = MK.catOf(c), list = enrolledIn(st, c.id), k = capOf(st, c.id), closed = isClosed(st, c.id); cap += k;
      h += '<div class="board__card c-' + cat.color + '">' +
        '<div class="board__top"><span class="tag c-' + cat.color + '"><span class="dot"></span>' + esc(c.category) + '</span><span class="board__count">' + list.length + '<small> / ' + k + '</small></span></div>' +
        '<div class="board__title">' + esc(c.title) + '</div>' +
        '<div class="board__names">' + nameChips(list) + '</div>' +
        (closed ? '<div class="board__closed">' + ic('lock') + ' 신청 마감</div>' : '') +
        '<div class="board__admin"><button class="btn btn--sm btn--ghost" data-admin-toggle="' + c.id + '">' + (st.settings.closed[c.id] ? '신청 다시 열기' : '이 과제 마감') + '</button></div>' +
        '</div>';
    });
    h += '<div class="board__summary"><div class="t-sm t-muted" style="font-size:21px;font-weight:800">전체 신청</div><div class="big">' + total + '<small style="font-size:28px;color:var(--muted)"> / ' + cap + '명</small></div>' +
      '<div class="t-sm" style="font-size:20px">' + (st.settings.open ? '신청을 받고 있어요' : '<b style="color:var(--red)">전체 신청 마감</b>') + '</div>' +
      '<button class="btn btn--sm btn--ghost admin-only" data-admin-open-all="' + (st.settings.open ? '0' : '1') + '">' + (st.settings.open ? '전체 마감' : '전체 다시 열기') + '</button></div>';
    el.innerHTML = h + '</div>';
  };

  /* 내 결과물 (제출 슬라이드) */
  MK.widgets['my-submission'] = function (el, st) {
    var m = me(), mine = myEnrollment(st), sub = mySubmission(st);
    var rows = function (k, v, link) {
      return '<div class="mine__row"><dt>' + k + '</dt><dd class="' + (v ? '' : 'empty') + '">' + (v ? (link ? '<a class="link" href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + '</a>' : esc(v)) : '아직 없음') + '</dd></div>';
    };
    var h = '<div class="window fill"><div class="window__bar">내 결과물' + (sub ? ' · 제출 완료' : '') + '</div><div class="window__body" style="display:flex;flex-direction:column;gap:22px">';
    if (!m) {
      h += '<div class="t-lg">먼저 이름을 등록하고 도전과제를 신청해 주세요.</div><div class="row"><button class="btn" data-act="identify">' + ic('user') + ' 이름 등록</button><button class="btn btn--ghost" data-goto="s-overview">도전과제 보러 가기</button></div>';
    } else if (!mine) {
      h += '<div class="t-lg">' + esc(m.name) + ' 선생님, 아직 신청한 도전과제가 없어요.</div><div class="row"><button class="btn" data-goto="s-overview">도전과제 고르러 가기</button></div>';
    } else {
      var ch = MK.challengeById(mine.challengeId);
      h += '<dl class="mine" style="margin:0">' + rows('이름', m.name) + rows('도전과제', ch.title) + rows('작품 제목', sub && sub.title) + rows('간단한 설명', sub && sub.desc) + rows('MakeCode', sub && sub.makecodeUrl, true) + rows('작동 영상', sub && sub.videoUrl, true) + '</dl>' +
        '<div class="row" style="margin-top:auto"><button class="btn ' + (sub ? 'btn--ghost' : 'btn--green') + '" data-act="submit">' + ic(sub ? 'edit' : 'send') + (sub ? ' 고치기' : ' 결과물 제출하기') + '</button></div>';
    }
    el.innerHTML = h + '</div></div>';
  };

  /* 제출 현황판 */
  MK.widgets['submit-board'] = function (el, st) {
    var subBy = {}; st.submissions.forEach(function (s) { subBy[s.name] = s; });
    var total = st.enrollments.length, done = st.enrollments.filter(function (e) { return subBy[e.name]; }).length;
    var h = '<div class="board">';
    MK.challenges.forEach(function (c) {
      var cat = MK.catOf(c), list = enrolledIn(st, c.id), d = list.filter(function (e) { return subBy[e.name]; }).length;
      h += '<div class="board__card c-' + cat.color + '"><div class="board__top"><span class="tag c-' + cat.color + '"><span class="dot"></span>' + esc(c.category) + '</span><span class="board__count">' + d + '<small> / ' + list.length + '</small></span></div>' +
        '<div class="board__title">' + esc(c.title) + '</div><div class="board__names">' +
        nameChips(list, { done: function (e) { return subBy[e.name]; }, pending: function (e) { return !subBy[e.name]; } }) + '</div></div>';
    });
    h += '<div class="board__summary"><div class="t-sm t-muted" style="font-size:21px;font-weight:800">제출</div><div class="big">' + done + '<small style="font-size:28px;color:var(--muted)"> / ' + total + '명</small></div><div class="t-sm" style="font-size:20px">' + ic('check') + ' 표시가 제출한 사람</div></div>';
    el.innerHTML = h + '</div>';
  };

  /* 공유 주소 */
  MK.widgets['share-url'] = function (el) {
    var u = MK.config.shareUrl || (location.protocol.indexOf('http') === 0 ? location.origin + location.pathname : '');
    el.innerHTML = u ? '<span class="mono">' + esc(u.replace(/^https?:\/\//, '')) + '</span>' : '<span class="t-muted">배포 뒤 config.js의 shareUrl에 주소를 적어 주세요</span>';
  };

  /* 설정 글자 채우기: <span data-widget="cfg" data-key="date"> */
  MK.widgets.cfg = function (el) { var k = el.getAttribute('data-key'); el.setAttribute('data-field', 'cfg:' + k); el.textContent = MK.config[k] || ''; };

  /* 타이머: <div data-widget="timer" data-minutes="40" data-id="make"> */
  var timers = {};
  MK.widgets.timer = function (el) {
    var id = el.getAttribute('data-id') || 'timer', total = (parseFloat(el.getAttribute('data-minutes')) || 10) * 60000;
    var key = MK.config.storageKey + '-timer-' + id;
    if (!timers[id]) {
      var saved = null; try { saved = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      timers[id] = saved && saved.total === total ? saved : { total: total, left: total, endAt: 0, running: false };
    }
    var t = timers[id];
    function save() { try { localStorage.setItem(key, JSON.stringify(t)); } catch (e) {} }
    function left() { return t.running ? Math.max(0, t.endAt - Date.now()) : t.left; }
    function fmt(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); s = s % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    el.innerHTML = '<div class="timer"><div class="timer__face"></div><div class="timer__bar"><i></i></div><div class="timer__btns">' +
      '<button class="btn" data-t="toggle"></button><button class="btn btn--ghost" data-t="reset">' + ic('clock') + ' 처음으로</button></div></div>';
    var face = el.querySelector('.timer__face'), bar = el.querySelector('.timer__bar i'), tog = el.querySelector('[data-t=toggle]'), box = el.querySelector('.timer');
    function paint() {
      var l = left();
      face.textContent = fmt(l); bar.style.width = (l / t.total * 100) + '%';
      tog.innerHTML = t.running ? '멈춤' : (l < t.total && l > 0 ? ic('play') + ' 이어서' : ic('play') + ' 시작');
      box.classList.toggle('is-done', l <= 0);
      if (t.running && l <= 0) { t.running = false; t.left = 0; save(); }
    }
    tog.onclick = function () {
      if (t.running) { t.left = left(); t.running = false; }
      else { if (left() <= 0) t.left = t.total; t.endAt = Date.now() + t.left; t.running = true; }
      save(); paint();
    };
    el.querySelector('[data-t=reset]').onclick = function () { t.running = false; t.left = t.total; save(); paint(); };
    clearInterval(el._iv); el._iv = setInterval(paint, 250); paint();
  };

  /* =========================================================
     모두 그리기 + 클릭 처리
     ========================================================= */
  MK.renderWidgets = function (root) {
    var st = MK.store.getStateSync();
    $$('[data-widget]', root || document).forEach(function (el) {
      var w = MK.widgets[el.getAttribute('data-widget')];
      if (!w) return;
      if (el.getAttribute('data-widget') === 'timer' && el._iv) return; // 타이머는 한 번만
      var ae = document.activeElement; if (ae && ae.isContentEditable && el.contains(ae)) return; // 고치는 중인 글자는 건드리지 않음
      try { w(el, st); } catch (e) { console.error(e); }
    });
    renderMe(st);
  };

  /* 오른쪽 위 내 정보 칩 */
  function renderMe(st) {
    var box = $('#me');
    if (!box) { box = document.createElement('div'); box.id = 'me'; box.className = 'me ui'; document.body.appendChild(box); }
    var m = me(), mine = myEnrollment(st), admin = MK.store.isAdmin();
    var h = '';
    if (m) h += '<span class="me__text">' + ic('user') + ' <b>' + esc(m.name) + '</b>' + (mine ? ' · ' + esc(MK.challengeById(mine.challengeId).title) : ' · 신청 전') + '</span>' +
      '<button class="ghost" data-act="switch">바꾸기</button>';
    else h += '<span class="me__text">신청하려면 이름을 등록하세요</span><button data-act="identify">이름 등록</button>';
    if (admin) h += '<button data-act="edit" style="background:var(--green-tab)">' + ic('edit') + (MK.editor && MK.editor.isOn() ? ' 편집 끝' : ' 편집') + '</button><button data-act="admin" style="background:var(--navy);color:#fff">' + ic('lock') + ' 관리자</button>';
    box.innerHTML = h;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a) {
      var act = a.getAttribute('data-act');
      if (act === 'apply') MK.actions.apply(a.getAttribute('data-id'));
      else if (act === 'cancel') MK.actions.cancel();
      else if (act === 'submit') MK.actions.submit();
      else if (act === 'identify') MK.actions.identify();
      else if (act === 'switch') MK.actions.switchUser();
      else if (act === 'admin' && MK.admin) MK.admin.open();
      else if (act === 'edit' && MK.editor) { MK.editor.toggle(); renderMe(MK.store.getStateSync()); }
      return;
    }
    var r = e.target.closest('[data-admin-remove]');
    if (r && MK.store.isAdmin()) {
      e.stopPropagation();
      MK.store.removeEnrollment(r.getAttribute('data-admin-remove')).then(function () { MK.ui.toast('명단에서 뺐어요.'); }, function (err) { MK.ui.toast(err.message, true); });
      return;
    }
    var t = e.target.closest('[data-admin-toggle]');
    if (t && MK.store.isAdmin()) {
      var id = t.getAttribute('data-admin-toggle'), st = MK.store.getStateSync();
      MK.store.setOpen(id, !!st.settings.closed[id]);
      return;
    }
    var o = e.target.closest('[data-admin-open-all]');
    if (o && MK.store.isAdmin()) { MK.store.setOpen(null, o.getAttribute('data-admin-open-all') === '1'); }
  });

  /* =========================================================
     동적 슬라이드: 도전과제 상세 7장
     ========================================================= */
  MK.generators.challenges = function () {
    return MK.challenges.map(function (c, i) {
      var cat = MK.catOf(c), guide = MK.guideUrl(c.ref);
      return '<section class="slide slide--body c-' + cat.color + '" id="ch-' + c.id + '" data-section="1. 도전과제 고르기" data-title="도전과제 ' + (i + 1) + ' · ' + esc(c.title) + '">' +
        '<div class="ch-head"><div class="ch-head__tags"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(c.category) + '</span><span class="tag">도전과제 ' + (i + 1) + ' / ' + MK.challenges.length + '</span><span class="tag">개인 도전</span>' +
        '<button class="btn btn--ghost btn--sm ch-back" data-goto="s-overview">' + ic('left') + ' 도전과제 목록</button></div>' +
        '<h2 class="ch-head__title" data-field="ch:' + c.id + ':title">' + esc(c.title) + '</h2><p class="ch-head__q" data-field="ch:' + c.id + ':question">' + esc(c.question) + '</p></div>' +
        '<div class="ch-grid">' +
          '<div class="col">' +
            '<div><div class="ch-photo" style="background-image:url(' + MK.challengeImage(c.id) + ')"></div><div class="ch-photo-note">참고 이미지</div></div>' +
            '<div class="ch-sec ch-materials"><div class="ch-sec__h"><span class="ico c-green">' + ic('gear') + '</span>준비물</div><p data-field="ch:' + c.id + ':materials">' + esc(c.materials) + '</p></div>' +
          '</div>' +
          '<div class="col" style="gap:22px">' +
            '<div class="ch-sec"><div class="ch-sec__h"><span class="ico c-blue">' + ic('doc') + '</span>문제 상황</div><p data-field="ch:' + c.id + ':problem">' + esc(c.problem) + '</p></div>' +
            '<div class="ch-sec"><div class="ch-sec__h"><span class="ico c-purple">' + ic('flag') + '</span>성공 기준</div><p data-field="ch:' + c.id + ':success">' + esc(c.success) + '</p></div>' +
            (c.start ? '<div class="callout ch-hint"><b>이렇게 시작해 보세요</b><br><span data-field="ch:' + c.id + ':start">' + c.start + '</span></div>' : '') +
          '</div>' +
          '<div class="col">' +
            '<div data-widget="apply-panel" data-challenge="' + c.id + '"></div>' +
            '<div class="ch-model"><div class="ch-model__name">' + ic(cat.icon) + ' ' + esc(cat.model) + '</div><div class="ch-model__sends">' + esc(cat.sends) + '</div>' +
              '<div style="display:flex;gap:16px;flex-wrap:wrap">' + (cat.app ? '<a class="link" href="' + cat.app + '" target="_blank" rel="noopener">웹앱 ↗</a>' : '') + (guide ? '<a class="link" href="' + guide + '" target="_blank" rel="noopener">모델 안내 ↗</a>' : '') + '</div></div>' +
          '</div>' +
        '</div></section>';
    }).join('');
  };
})();
