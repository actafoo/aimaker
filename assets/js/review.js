/* =========================================================
   편집·메모 — 관리자만 보입니다
   - 메모: 쪽마다 "여기 고칠 것"을 남깁니다. 오른쪽 위 「메모」 버튼, 편집 막대의 「메모」
   - 받은 편집: 웹 교안에서 고쳐 「보내기」한 글자들. 관리자 › 편집·메모 탭에서 적용합니다.
     적용 → 「내 컴퓨터에 저장」 → 배포하기 순서로 반영하면, 저장할 때 서버에 '반영'으로 표시됩니다.
   - 데이터는 서버(구글 시트의 편집·메모 탭)에 있습니다. 데모 모드면 이 브라우저에만.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n) { return MK.icon(n); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var R = { edits: [], memos: [], loaded: false, busy: null, res: {}, showDone: false };
  var NAME_KEY = 'mk-reviewer-name';
  var fab = null, memoDlg = null;

  function on() { return !!(MK.store && MK.store.review && MK.store.isAdmin() && MK.store.supports('review')); }
  function deckFile() { return MK.editor ? MK.editor.deckFile : decodeURIComponent(location.pathname.split('/').pop() || ''); }
  function bad(err) { MK.ui.toast((err && err.message) || '처리하지 못했어요.', true); }

  function call(action, args) {
    return MK.store.review(action, Object.assign({ deck: deckFile() }, args || {})).then(function (r) { set(r); return r || {}; });
  }
  function set(r) {
    if (!r || !Array.isArray(r.edits)) return;
    R.edits = r.edits; R.memos = r.memos || []; R.loaded = true;
    var ids = {}; R.edits.forEach(function (e) { ids[e.id] = 1; });
    Object.keys(R.res).forEach(function (id) { if (!ids[id]) delete R.res[id]; });
    paint();
  }
  function refresh() {
    if (!on()) { paint(); return Promise.resolve(); }
    if (R.busy) return R.busy;
    R.busy = call('reviewGet').catch(function () {}).then(function () { R.busy = null; });
    return R.busy;
  }

  /* ---------- 이름 (누가 남겼는지) ---------- */
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function withName() {
    var n = savedName();
    if (n) return Promise.resolve(n);
    return new Promise(function (resolve) {
      var done = false;
      MK.ui.form({ kicker: '편집·메모', title: '이름을 적어 주세요', desc: '보낸 편집과 메모에 누가 남겼는지 함께 표시됩니다. 이 브라우저가 기억해 둡니다.',
        fields: [{ name: 'name', label: '이름', maxlength: 20, placeholder: '이름' }], submitText: '확인',
        onSubmit: function (v) {
          var name = String(v.name || '').replace(/\s+/g, ' ').trim();
          if (!name) throw new Error('이름을 적어 주세요.');
          try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
          done = true; resolve(name);
        } }).addEventListener('close', function () { if (!done) resolve(null); });
    });
  }

  /* ---------- 도우미 ---------- */
  function slides() { return MK.deck && MK.deck.slides ? MK.deck.slides() : []; }
  function slideIndex(id) { var s = slides(); for (var i = 0; i < s.length; i++) if (s[i].id === id) return i; return -1; }
  function slideName(id, fallback) {
    var i = slideIndex(id);
    return i >= 0 ? (i + 1) + '쪽 · ' + MK.deck.titleOf(slides()[i]) : (fallback || '쪽을 찾을 수 없음');
  }
  function when(t) {
    if (!t) return '';
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function toText(html) {
    var box = document.createElement('div'); box.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, ' ⏎ ');
    var t = box.textContent.replace(/\s+/g, ' ').trim();
    return t.length > 400 ? t.slice(0, 400) + '…' : t;
  }
  function openMemos() { return R.memos.filter(function (m) { return !m.done; }); }
  function byRank(list) { return list.slice().sort(function (a, b) { var x = slideIndex(a.slide), y = slideIndex(b.slide); return (x < 0 ? 1e6 : x) - (y < 0 ? 1e6 : y) || (a.at || 0) - (b.at || 0); }); }

  /* ---------- 화면에 표시: 오른쪽 위 버튼, 아래 막대 점 ---------- */
  function paint() {
    var ok = on();
    if (!fab && ok) {
      fab = document.createElement('button'); fab.type = 'button'; fab.id = 'rv-fab'; fab.className = 'rv-fab ui';
      fab.title = '이 쪽의 메모 (관리자만 보입니다)';
      fab.addEventListener('click', function () { openMemo(); });
      document.body.appendChild(fab);
    }
    if (fab) {
      fab.classList.toggle('is-on', ok);
      if (ok) {
        var cur = MK.deck && MK.deck.current && MK.deck.current(), here = cur ? openMemos().filter(function (m) { return m.slide === cur.id; }).length : 0;
        fab.classList.toggle('has-memo', here > 0);
        fab.innerHTML = ic('doc') + '<span>메모</span>' + (here ? '<b class="rv-fab__n">' + here + '</b>' : '') +
          (R.edits.length ? '<span class="rv-fab__e" title="받은 편집 · 관리자 › 편집·메모">받은 편집 ' + R.edits.length + '</span>' : '');
      }
    }
    paintMarks();
    if (memoDlg && memoDlg.open) renderMemo();
    if (MK.admin && $('#admin.is-open')) MK.admin.render();
  }
  function paintMarks() {
    var ok = on(), memoAt = {}, editAt = {};
    if (ok) { openMemos().forEach(function (m) { memoAt[m.slide] = 1; }); R.edits.forEach(function (e) { editAt[e.slide] = 1; }); }
    var s = slides();
    $$('.sbar__tick').forEach(function (t) {
      var sl = s[+t.dataset.i], id = sl && sl.id;
      t.classList.toggle('has-memo', !!(id && memoAt[id]));
      t.classList.toggle('has-edit', !!(id && editAt[id]));
    });
  }

  /* ---------- 이 쪽 메모 창 ---------- */
  function openMemo(slide) {
    if (!on()) { MK.ui.toast('관리자로 들어가야 메모를 쓸 수 있어요.', true); return; }
    slide = slide || MK.deck.current();
    if (!slide) return;
    if (memoDlg && memoDlg.open) memoDlg.close();
    var d = document.createElement('dialog'); d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box modal__box--wide rv-memo"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button><div class="rv-memo__body"></div></div>';
    d.dataset.slide = slide.id;
    document.body.appendChild(d);
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 50); if (memoDlg === d) memoDlg = null; });
    memoDlg = d;
    renderMemo(true);
    d.showModal();
    var ta = d.querySelector('textarea'); if (ta) ta.focus();
    refresh();
  }
  function memoItem(m, withGo) {
    return '<div class="memo-item' + (m.done ? ' is-done' : '') + '"><div class="memo-item__t">' + esc(m.text) + '</div>' +
      '<div class="memo-item__meta"><span>' + esc(m.by || '') + ' · ' + when(m.at) + (m.done ? ' · 완료 ' + esc(m.doneBy || '') : '') + '</span><span class="sp"></span>' +
      (withGo ? '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="go" data-slide="' + esc(m.slide) + '">가기</button>' : '') +
      '<button class="ubtn ubtn--sm ' + (m.done ? 'ubtn--ghost' : 'ubtn--green') + '" data-rv="memo-done" data-id="' + esc(m.id) + '" data-done="' + (m.done ? '0' : '1') + '">' + (m.done ? '다시 열기' : ic('check') + ' 완료') + '</button>' +
      '<button class="icon-btn" data-rv="memo-del" data-id="' + esc(m.id) + '" title="지우기">' + ic('trash') + '</button></div></div>';
  }
  function renderMemo(first) {
    var d = memoDlg; if (!d) return;
    var id = d.dataset.slide, box = d.querySelector('.rv-memo__body');
    var list = R.memos.filter(function (m) { return m.slide === id; }).sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.at || 0) - (b.at || 0); });
    var draft = first ? '' : ((box.querySelector('textarea') || {}).value || '');
    var others = openMemos().filter(function (m) { return m.slide !== id; }).length;
    box.innerHTML = '<div class="modal__kicker">메모 · 관리자만 보입니다</div><h3 class="modal__title">' + esc(slideName(id)) + '</h3>' +
      '<div class="memo-list">' + (list.length ? list.map(function (m) { return memoItem(m, false); }).join('') : '<p class="modal__desc" style="margin:0">이 쪽에는 아직 메모가 없어요.</p>') + '</div>' +
      '<div class="field"><label>새 메모<small>' + esc(savedName() ? savedName() + '(으)로 남깁니다' : '처음 남길 때 이름을 물어봅니다') + '</small></label>' +
      '<textarea maxlength="500" placeholder="이 쪽에서 고칠 것을 적어 주세요. 예: 사진을 실물 사진으로 바꿔 주세요.">' + esc(draft) + '</textarea></div>' +
      '<div class="modal__actions"><button type="button" class="ubtn ubtn--ghost" data-rv="all">' + (others ? '다른 쪽 메모 ' + others + '개 · ' : '') + '모두 보기</button>' +
      '<button type="button" class="ubtn" data-rv="memo-add">' + ic('plus') + ' 메모 남기기</button></div>';
  }

  /* ---------- 관리자 › 편집·메모 탭 ---------- */
  function badge() { return R.edits.length + openMemos().length; }
  function adminHtml() {
    var h = '';
    if (!MK.store.supports('review')) {
      return '<div class="admin__notice"><b>서버 코드가 예전 버전</b>이라 편집 보내기와 메모가 꺼져 있어요. <b>backend/Code.gs</b>를 Apps Script에 새로 붙여 넣고 <b>배포 관리 → 새 버전</b>으로 배포해 주세요.</div>';
    }
    if (!MK.store.isShared) h += '<div class="admin__notice"><b>데모 모드</b> · 편집과 메모가 <b>이 브라우저에만</b> 남습니다. 다른 사람과 주고받으려면 온라인 저장소를 연결해야 합니다.</div>';
    var E = byRank(R.edits), open = byRank(openMemos()), done = byRank(R.memos.filter(function (m) { return m.done; }));
    var applied = MK.editor && MK.editor.hasApplied ? MK.editor.hasApplied() : 0;
    h += '<div class="acard"><div class="acard__top"><div class="acard__title">받은 편집 ' + E.length + '곳 · 열린 메모 ' + open.length + '개</div>' +
      '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="refresh">' + ic('download') + ' 새로 받기</button></div>' +
      '<div class="acard__meta">' + esc(deckFile()) + '에 대해 웹 교안에서 보낸 편집과 메모입니다.<br>' +
      '<b>적용</b> → <b>내 컴퓨터에 저장</b> → <b>배포하기</b> 순서로 반영하세요. 저장하면 적용한 편집은 서버에서 ‘반영’으로 바뀝니다.</div>' +
      (E.length || applied ? '<div class="acard__row">' + (E.length ? '<button class="ubtn ubtn--sm" data-rv="apply-all">' + ic('check') + ' 모두 적용</button>' : '') +
        (applied ? '<button class="ubtn ubtn--sm ubtn--green" data-rv="save">' + ic('download') + ' 내 컴퓨터에 저장 (' + applied + '곳)</button>' : '') + '</div>' : '') + '</div>';

    if (E.length) {
      h += '<h4>받은 편집</h4>';
      var last = null;
      E.forEach(function (e) {
        if (e.slide !== last) { last = e.slide; h += '<div class="rv-sec"><b>' + esc(slideName(e.slide, e.slideTitle)) + '</b><button class="ubtn ubtn--sm ubtn--ghost" data-rv="go" data-slide="' + esc(e.slide) + '">가기</button></div>'; }
        var r = R.res[e.id] || {}, st = r.status;
        var msg = st === 'ok' ? '<div class="rv-st rv-st--ok">' + ic('check') + ' 화면에 적용했어요 · 저장하면 파일에 들어갑니다</div>' :
          st === 'already' ? '<div class="rv-st rv-st--info">이미 이 글자로 되어 있어요.</div>' :
          st === 'conflict' ? '<div class="rv-st rv-st--bad">그사이 이 자리 글자가 바뀌었어요. 지금: “' + esc(toText(r.now)) + '”</div>' :
          st === 'missing' ? '<div class="rv-st rv-st--bad">이 쪽에서 원래 글자를 찾지 못했어요. 직접 고친 뒤 ‘반영됨’을 눌러 주세요.</div>' : '';
        h += '<div class="acard rv-item"><div class="rv-diff"><del>' + esc(toText(e.before)) + '</del><ins>' + esc(toText(e.after)) + '</ins></div>' +
          '<div class="acard__meta">' + esc(e.by || '') + ' · ' + when(e.at) + (e.field ? ' · 데이터 칸 ' + esc(e.field) : '') + '</div>' + msg +
          '<div class="acard__row">' +
            (st === 'ok' ? '' : st === 'conflict' ? '<button class="ubtn ubtn--sm" data-rv="apply" data-force="1" data-id="' + esc(e.id) + '">덮어쓰기</button>' :
              st === 'already' || st === 'missing' ? '<button class="ubtn ubtn--sm ubtn--green" data-rv="mark" data-id="' + esc(e.id) + '">반영됨</button>' :
              '<button class="ubtn ubtn--sm" data-rv="apply" data-id="' + esc(e.id) + '">' + ic('check') + ' 적용</button>') +
            '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="drop" data-id="' + esc(e.id) + '">버리기</button></div></div>';
      });
    }

    h += '<h4>메모</h4>';
    if (!open.length) h += '<p class="small">열린 메모가 없습니다. 쪽마다 오른쪽 위 <b>메모</b> 버튼으로 남길 수 있어요.</p>';
    var lastM = null;
    open.forEach(function (m) {
      if (m.slide !== lastM) { lastM = m.slide; h += '<div class="rv-sec"><b>' + esc(slideName(m.slide, m.slideTitle)) + '</b></div>'; }
      h += memoItem(m, true);
    });
    if (done.length) {
      h += '<button class="rv-more" data-rv="toggle-done">' + (R.showDone ? '완료한 메모 숨기기' : '완료한 메모 ' + done.length + '개 보기') + '</button>';
      if (R.showDone) done.forEach(function (m) { h += memoItem(m, true); });
    }
    return h;
  }

  /* ---------- 받은 편집 적용 ---------- */
  function applyOne(e, force) {
    if (!MK.editor || !MK.editor.applyRemote) return { status: 'missing' };
    var r = MK.editor.applyRemote(e, force);
    R.res[e.id] = r;
    return r;
  }

  /* ---------- 클릭 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-rv]'); if (!b) return;
    var a = b.getAttribute('data-rv'), id = b.getAttribute('data-id');
    var e = id && R.edits.filter(function (x) { return x.id === id; })[0];
    if (a === 'refresh') { b.disabled = true; refresh().then(function () { MK.ui.toast('새로 받았어요.'); }); }
    else if (a === 'go') {
      var sid = b.getAttribute('data-slide');
      if (memoDlg) memoDlg.close();
      if (MK.admin) MK.admin.close();
      if (slideIndex(sid) >= 0) MK.deck.goto(sid); else MK.ui.toast('이 쪽을 찾지 못했어요. 쪽 id가 바뀌었을 수 있어요.', true);
      var k = R.edits.filter(function (x) { return x.slide === sid && R.res[x.id] && R.res[x.id].key; })[0];
      if (k && MK.editor) setTimeout(function () { MK.editor.flashKey(R.res[k.id].key); }, 350);
    }
    else if (a === 'all') { if (memoDlg) memoDlg.close(); if (MK.admin) MK.admin.open('review'); }
    else if (a === 'apply' && e) {
      var r = applyOne(e, b.getAttribute('data-force') === '1');
      if (r.status === 'ok') MK.ui.toast('적용했어요. 「내 컴퓨터에 저장」을 눌러야 파일에 들어갑니다.');
      paint();
    }
    else if (a === 'apply-all') {
      var n = { ok: 0, already: 0, conflict: 0, missing: 0 };
      byRank(R.edits).forEach(function (x) { if ((R.res[x.id] || {}).status === 'ok') return; n[applyOne(x).status]++; });
      MK.ui.toast(n.ok + '곳 적용했어요.' + (n.conflict + n.missing ? ' 확인이 필요한 곳 ' + (n.conflict + n.missing) + '곳이 있어요.' : '') + (n.ok ? ' 「내 컴퓨터에 저장」을 눌러 주세요.' : ''), !!(n.conflict + n.missing));
      paint();
    }
    else if (a === 'save') { if (MK.editor) MK.editor.save().then(function () { paint(); }); }
    else if (a === 'mark' && e) mark([e.id], '반영');
    else if (a === 'drop' && e) {
      MK.ui.confirm({ title: '이 편집을 버릴까요?', desc: '“' + esc(toText(e.after)) + '”<br>서버에서 ‘버림’으로 표시합니다. 보낸 사람이 다시 보내면 다시 생깁니다.', okText: '버리기', danger: true })
        .then(function (y) { if (y) mark([e.id], '버림'); });
    }
    else if (a === 'toggle-done') { R.showDone = !R.showDone; paint(); }
    else if (a === 'memo-add') {
      var d = memoDlg, ta = d && d.querySelector('textarea'), text = ta ? ta.value.trim() : '';
      if (!text) { MK.ui.toast('메모를 적어 주세요.', true); return; }
      var sl = document.getElementById(d.dataset.slide);
      b.disabled = true;
      withName().then(function (by) {
        if (!by) { b.disabled = false; return; }
        return call('memoAdd', { by: by, slide: d.dataset.slide, slideTitle: slideName(d.dataset.slide, sl ? MK.deck.titleOf(sl) : ''), text: text }).then(function () {
          if (memoDlg) { var t2 = memoDlg.querySelector('textarea'); if (t2) t2.value = ''; renderMemo(true); }
          MK.ui.toast('메모를 남겼어요.');
        });
      }).catch(function (err) { b.disabled = false; bad(err); });
    }
    else if (a === 'memo-done') {
      b.disabled = true;
      call('memoUpdate', { id: id, done: b.getAttribute('data-done') === '1', by: savedName() }).catch(function (err) { b.disabled = false; bad(err); });
    }
    else if (a === 'memo-del') {
      MK.ui.confirm({ title: '메모를 지울까요?', desc: '되돌릴 수 없습니다. 끝난 메모는 지우지 않고 ‘완료’로 남겨 둘 수도 있어요.', okText: '지우기', danger: true })
        .then(function (y) { if (y) call('memoDelete', { id: id }).then(function () { MK.ui.toast('메모를 지웠어요.'); }, bad); });
    }
  });

  function mark(ids, status) {
    return call('reviewMark', { ids: ids, status: status, by: savedName() }).then(function () {
      MK.ui.toast(status === '반영' ? '반영됨으로 표시했어요.' : status === '버림' ? '버렸어요.' : '되돌렸어요.');
    }, bad);
  }

  /* ---------- 언제 받아 오나 ---------- */
  MK.store.subscribe(function () {
    if (on() && !R.loaded && !R.busy) refresh();
    setTimeout(paint, 0); // 슬라이드 막대를 다시 그린 뒤에 점 찍기
  });
  document.addEventListener('deck:enter', function () { setTimeout(paint, 0); });
  setInterval(function () { if (document.visibilityState === 'visible' && on()) refresh(); }, 30000);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (on()) refresh(); else paint(); }, 300); });

  MK.review = {
    refresh: refresh, call: call, withName: withName, openMemo: openMemo, mark: mark,
    adminHtml: adminHtml, badge: badge, isOn: on,
    state: function () { return R; }
  };
})();
