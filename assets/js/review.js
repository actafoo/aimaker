/* =========================================================
   편집·메모 — 관리자만 보입니다
   - 메모: 쪽마다 "여기 고칠 것"을 남깁니다. 오른쪽 위 「메모」 버튼, 편집 막대의 「메모」
   - 보낸 편집: 웹 교안에서 고쳐 「보내기」한 글자들 (서버의 편집 탭, 상태 '대기')
   - 기기는 두 가지입니다
       보내는 기기: 보낸 편집을 확인만 합니다(보낸 것 취소 가능)
       반영하는 기기: 교안 파일(site 폴더)이 있는 컴퓨터. 「모두 내 파일에 반영」 = 적용 + 저장을 한 번에.
                     파일 저장에 성공한 것만 서버에서 '반영'이 되어 목록에서 빠집니다.
     내 컴퓨터(파일·localhost)로 열면 반영하는 기기, 웹 주소면 「이 기기에서 반영하기」를 눌러 바꿉니다.
   - 처리한 편집(반영·버림)은 「다시 받기」로 되살릴 수 있습니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n) { return MK.icon(n); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var R = { edits: [], memos: [], done: null, loaded: false, busy: null, res: {}, showDone: false, showHist: false };
  var NAME_KEY = 'mk-reviewer-name', OWNER_KEY = 'mk-review-owner';
  var fab = null, memoDlg = null;

  function on() { return !!(MK.store && MK.store.review && (MK.store.canEdit ? MK.store.canEdit() : MK.store.isAdmin()) && MK.store.supports('review')); }
  function full() { return MK.store.isAdmin(); } // 관리자(교안 담당자). 편집자는 false
  function deckFile() { return MK.editor ? MK.editor.deckFile : decodeURIComponent(location.pathname.split('/').pop() || ''); }
  function bad(err) { MK.ui.toast((err && err.message) || '처리하지 못했어요.', true); }

  /* 반영하는 기기인가: 내 컴퓨터에서 열었거나, 이 브라우저에서 「이 기기에서 반영하기」를 눌렀을 때 */
  function isOwner() {
    if (!full()) return false; // 편집자는 반영할 수 없음 (서버도 막음)
    if (MK.editor && MK.editor.isLocal) return true;
    try { return localStorage.getItem(OWNER_KEY) === '1'; } catch (e) { return false; }
  }
  function setOwner(v) { try { if (v) localStorage.setItem(OWNER_KEY, '1'); else localStorage.removeItem(OWNER_KEY); } catch (e) {} paint(); }

  function call(action, args) {
    return MK.store.review(action, Object.assign({ deck: deckFile() }, args || {})).then(function (r) { set(r); return r || {}; });
  }
  function set(r) {
    if (!r || !Array.isArray(r.edits)) return;
    R.edits = r.edits; R.memos = r.memos || []; R.done = Array.isArray(r.done) ? r.done : null; R.loaded = true;
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
  function toText(html, max) {
    var box = document.createElement('div'); box.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, ' ⏎ ');
    var t = box.textContent.replace(/\s+/g, ' ').trim();
    max = max || 400;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }
  function openMemos() { return R.memos.filter(function (m) { return !m.done; }); }
  function byRank(list) { return list.slice().sort(function (a, b) { var x = slideIndex(a.slide), y = slideIndex(b.slide); return (x < 0 ? 1e6 : x) - (y < 0 ? 1e6 : y) || (a.at || 0) - (b.at || 0); }); }
  function editById(id) {
    return R.edits.filter(function (x) { return x.id === id; })[0] || (R.done || []).filter(function (x) { return x.id === id; })[0];
  }

  /* ---------- 화면에 표시: 오른쪽 위 버튼, 아래 막대 점 ---------- */
  function paint() {
    var ok = on();
    if (!fab && ok) {
      // 오른쪽 위: [메모] 버튼 + (있으면) [받은/보낸 편집 N] 버튼
      fab = document.createElement('div'); fab.id = 'rv-fab'; fab.className = 'rv-fab ui';
      fab.innerHTML = '<button type="button" class="rv-fab__memo" title="이 쪽의 메모 (관리자·편집자만 보입니다)"></button><button type="button" class="rv-fab__e" title="편집·메모 탭에서 봅니다"></button>';
      fab.querySelector('.rv-fab__memo').addEventListener('click', function () { openMemo(); });
      fab.querySelector('.rv-fab__e').addEventListener('click', function () { if (MK.admin) MK.admin.open('review'); });
      document.body.appendChild(fab);
    }
    if (fab) {
      fab.classList.toggle('is-on', ok);
      if (ok) {
        var cur = MK.deck && MK.deck.current && MK.deck.current(), here = cur ? openMemos().filter(function (m) { return m.slide === cur.id; }).length : 0;
        var mb = fab.querySelector('.rv-fab__memo'), eb = fab.querySelector('.rv-fab__e');
        mb.classList.toggle('has-memo', here > 0);
        mb.innerHTML = ic('doc') + '<span>메모</span>' + (here ? '<b class="rv-fab__n">' + here + '</b>' : '');
        eb.hidden = !R.edits.length;
        eb.textContent = (isOwner() ? '받은 편집 ' : '보낸 편집 ') + R.edits.length;
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
  function mineOrFull(by) { return full() || (by && by === savedName()); }
  function memoItem(m, withGo) {
    var can = mineOrFull(m.by);
    return '<div class="memo-item' + (m.done ? ' is-done' : '') + '"><div class="memo-item__t">' + esc(m.text) + '</div>' +
      '<div class="memo-item__meta"><span>' + esc(m.by || '') + ' · ' + when(m.at) + (m.done ? ' · 완료 ' + esc(m.doneBy || '') : '') + '</span><span class="sp"></span>' +
      (withGo ? '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="go" data-slide="' + esc(m.slide) + '">가기</button>' : '') +
      (can ? '<button class="ubtn ubtn--sm ' + (m.done ? 'ubtn--ghost' : 'ubtn--green') + '" data-rv="memo-done" data-id="' + esc(m.id) + '" data-done="' + (m.done ? '0' : '1') + '">' + (m.done ? '다시 열기' : ic('check') + ' 완료') + '</button>' +
      '<button class="icon-btn" data-rv="memo-del" data-id="' + esc(m.id) + '" title="지우기">' + ic('trash') + '</button>' : '') + '</div></div>';
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
  function editCard(e, owner) {
    var r = R.res[e.id] || {}, st = r.status;
    var msg = '';
    if (owner) msg = st === 'ok' ? '<div class="rv-st rv-st--ok">' + ic('check') + ' 화면에 넣었어요 · 아직 파일에 저장 전</div>' :
      st === 'already' ? '<div class="rv-st rv-st--info">이미 이 글자로 되어 있어요.</div>' :
      st === 'conflict' ? '<div class="rv-st rv-st--bad">그사이 이 자리 글자가 바뀌어 넣지 않았어요. 지금: “' + esc(toText(r.now, 120)) + '”</div>' :
      st === 'missing' ? '<div class="rv-st rv-st--bad">이 쪽에서 원래 글자를 찾지 못해 넣지 않았어요. 직접 고쳐 주세요.</div>' : '';
    var btns = '';
    if (owner) {
      if (st === 'conflict') btns += '<button class="ubtn ubtn--sm" data-rv="apply" data-force="1" data-id="' + esc(e.id) + '">그래도 넣기</button>';
      if (st === 'already' || st === 'missing') btns += '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="mark" data-id="' + esc(e.id) + '">목록에서 빼기</button>';
      btns += '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="drop" data-id="' + esc(e.id) + '">반영 안 함</button>';
    } else if (mineOrFull(e.by)) {
      btns += '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="drop" data-id="' + esc(e.id) + '">보낸 것 취소</button>';
    }
    return '<div class="acard rv-item"><div class="rv-diff"><del>' + esc(toText(e.before)) + '</del><ins>' + esc(toText(e.after)) + '</ins></div>' +
      '<div class="acard__meta">' + esc(e.by || '') + ' · ' + when(e.at) + (e.field ? ' · 데이터 칸 ' + esc(e.field) : '') + '</div>' + msg +
      '<div class="acard__row">' + btns + '</div></div>';
  }
  function grouped(list, card) {
    var h = '', last = null;
    list.forEach(function (x) {
      if (x.slide !== last) { last = x.slide; h += '<div class="rv-sec"><b>' + esc(slideName(x.slide, x.slideTitle)) + '</b><button class="ubtn ubtn--sm ubtn--ghost" data-rv="go" data-slide="' + esc(x.slide) + '">가기</button></div>'; }
      h += card(x);
    });
    return h;
  }
  function adminHtml() {
    if (!MK.store.supports('review')) {
      return '<div class="admin__notice"><b>서버 코드가 예전 버전</b>이라 편집 보내기와 메모가 꺼져 있어요. <b>backend/Code.gs</b>를 Apps Script에 새로 붙여 넣고 <b>배포 관리 → 새 버전</b>으로 배포해 주세요.</div>';
    }
    var h = '', owner = isOwner();
    if (!MK.store.isShared) h += '<div class="admin__notice"><b>데모 모드</b> · 편집과 메모가 <b>이 브라우저에만</b> 남습니다.</div>';
    var E = byRank(R.edits), open = byRank(openMemos()), doneM = byRank(R.memos.filter(function (m) { return m.done; }));
    var applied = MK.editor && MK.editor.hasApplied ? MK.editor.hasApplied() : 0;

    if (owner) {
      h += '<div class="acard acard--hot"><div class="acard__top"><div class="acard__title">받은 편집 ' + E.length + '곳 · 열린 메모 ' + open.length + '개</div>' +
        '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="refresh">새로 받기</button></div>' +
        '<div class="acard__meta">이 기기는 <b>반영하는 기기</b>입니다(교안 파일 site 폴더가 있는 컴퓨터).<br>' +
        '<b>모두 내 파일에 반영</b>을 누르면 받은 편집을 넣고 site 폴더의 파일에 바로 저장합니다. 저장된 것만 목록에서 빠지고, 그다음 <b>배포하기.command</b>를 누르면 웹에 올라갑니다.</div>' +
        '<div class="acard__row">' +
          (E.length ? '<button class="ubtn ubtn--green" data-rv="apply-save">' + ic('download') + (applied ? ' 내 파일에 저장 (' + applied + '곳)' : ' 모두 내 파일에 반영 (' + E.length + '곳)') + '</button>' : '') +
          (E.length || open.length ? '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="summary">' + ic('doc') + ' 글로 정리해 보기</button>' : '') +
        '</div>' +
        (E.length || open.length ? '<div class="acard__row">' +
          (E.length ? '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="clear-edits">받은 편집 모두 목록에서 빼기</button>' : '') +
          (open.length ? '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="done-memos">열린 메모 모두 완료</button>' : '') +
          '</div><div class="acard__meta">이미 파일에 들어간 것(예: Claude에게 부탁해 고친 것)을 정리할 때 씁니다. 파일은 바뀌지 않습니다.</div>' : '') +
        '</div>';
      if (E.length) h += '<h4>받은 편집</h4>' + grouped(E, function (e) { return editCard(e, true); });
    } else {
      h += '<div class="acard"><div class="acard__top"><div class="acard__title">보낸 편집 ' + E.length + '곳 · 열린 메모 ' + open.length + '개</div>' +
        '<button class="ubtn ubtn--sm ubtn--ghost" data-rv="refresh">새로 받기</button></div>' +
        '<div class="acard__meta">여기는 <b>보내는 기기</b>입니다. 보낸 편집은 교안 담당자 컴퓨터로 모이고, 담당자가 파일에 반영해 배포하면 웹 교안에 보입니다. 여기서는 확인과 취소만 할 수 있어요.</div>' +
        (E.length || open.length ? '<div class="acard__row"><button class="ubtn ubtn--sm ubtn--ghost" data-rv="summary">' + ic('doc') + ' 글로 정리해 보기</button></div>' : '') + '</div>';
      if (E.length) h += '<h4>보낸 편집 · 반영 대기</h4>' + grouped(E, function (e) { return editCard(e, false); });
    }

    h += '<h4>메모</h4>';
    if (!open.length) h += '<p class="small">열린 메모가 없습니다. 쪽마다 오른쪽 위 <b>메모</b> 버튼으로 남길 수 있어요.</p>';
    var lastM = null;
    open.forEach(function (m) {
      if (m.slide !== lastM) { lastM = m.slide; h += '<div class="rv-sec"><b>' + esc(slideName(m.slide, m.slideTitle)) + '</b></div>'; }
      h += memoItem(m, true);
    });
    if (doneM.length) {
      h += '<button class="rv-more" data-rv="toggle-done">' + (R.showDone ? '완료한 메모 숨기기' : '완료한 메모 ' + doneM.length + '개 보기') + '</button>';
      if (R.showDone) doneM.forEach(function (m) { h += memoItem(m, true); });
    }

    // 처리한 편집: 잘못 눌렀을 때 되살리기
    if (!full()) return h; // 편집자: 여기까지 (되살리기·반영 기기 바꾸기는 관리자만)
    if (R.done && R.done.length) {
      h += '<button class="rv-more" data-rv="toggle-hist">' + (R.showHist ? '처리한 편집 숨기기' : '처리한 편집 ' + R.done.length + '곳 보기 (되살리기)') + '</button>';
      if (R.showHist) R.done.forEach(function (e) {
        h += '<div class="acard rv-item is-past"><div class="rv-diff"><del>' + esc(toText(e.before)) + '</del><ins>' + esc(toText(e.after)) + '</ins></div>' +
          '<div class="acard__meta">' + esc(slideName(e.slide, e.slideTitle)) + '<br>' + esc(e.by || '') + ' · ' + when(e.at) + ' → <b>' + esc(e.status) + '</b> ' + esc(e.doneBy || '') + ' · ' + when(e.doneAt) + '</div>' +
          '<div class="acard__row"><button class="ubtn ubtn--sm" data-rv="revive" data-id="' + esc(e.id) + '">다시 받기</button></div></div>';
      });
    } else if (!R.done) {
      h += '<p class="small">처리한 편집을 되살리려면 서버 코드를 새 버전으로 바꿔 주세요. 지금은 구글 시트 <b>편집</b> 탭의 <b>상태</b>를 ‘대기’로 바꾸면 다시 나타납니다.</p>';
    }

    h += owner
      ? (MK.editor && MK.editor.isLocal ? '' : '<p class="small" style="margin-top:18px">이 기기가 반영하는 기기가 아니라면 <button class="linkbtn" data-rv="owner-off">보내는 기기로 바꾸기</button></p>')
      : '<div class="acard" style="margin-top:18px"><div class="acard__top"><div class="acard__title">교안 파일이 있는 컴퓨터인가요?</div><button class="ubtn ubtn--sm" data-rv="owner-on">이 기기에서 반영하기</button></div>' +
        '<div class="acard__meta">site 폴더(교안 파일)가 있는 교안 담당자 컴퓨터에서만 누르세요. 받은 편집을 파일에 반영하는 버튼이 생깁니다.</div></div>';
    return h;
  }

  /* ---------- 글로 정리 ---------- */
  function summaryText() {
    var E = byRank(R.edits), M = byRank(openMemos()), d = new Date();
    var out = ['[' + deckFile() + '] ' + (isOwner() ? '받은' : '보낸') + ' 편집 ' + E.length + '곳 · 메모 ' + M.length + '개 · ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + when(d.getTime()).split(' ')[1]];
    var last = null;
    if (E.length) out.push('', '■ 고친 글자');
    E.forEach(function (e) {
      if (e.slide !== last) { last = e.slide; out.push('', '[' + slideName(e.slide, e.slideTitle) + ' · ' + e.slide + ']'); }
      out.push('- “' + toText(e.before, 2000) + '”', '  → “' + toText(e.after, 2000) + '”  (' + (e.by || '') + ' ' + when(e.at) + ')');
    });
    last = null;
    if (M.length) out.push('', '■ 메모');
    M.forEach(function (m) {
      if (m.slide !== last) { last = m.slide; out.push('', '[' + slideName(m.slide, m.slideTitle) + ' · ' + m.slide + ']'); }
      out.push('- ' + String(m.text).replace(/\n/g, '\n  ') + '  (' + (m.by || '') + ' ' + when(m.at) + ')');
    });
    return out.join('\n');
  }
  function showSummary() {
    var text = summaryText();
    var d = document.createElement('dialog'); d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box modal__box--wide"><button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="modal__kicker">편집·메모</div><h3 class="modal__title">글로 정리한 목록</h3>' +
      '<p class="modal__desc">쪽 순서로 정리했습니다. 복사해서 메신저로 보내거나 기록해 둘 수 있어요.</p>' +
      '<div class="field"><textarea class="rv-sum" readonly></textarea></div>' +
      '<div class="modal__actions"><button type="button" class="ubtn ubtn--ghost" data-close>닫기</button><button type="button" class="ubtn" data-copy>' + ic('doc') + ' 복사</button></div></div>';
    document.body.appendChild(d);
    var ta = d.querySelector('textarea'); ta.value = text;
    var close = function () { d.close(); };
    d.querySelector('.modal__close').onclick = close; d.querySelector('[data-close]').onclick = close;
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 50); });
    d.querySelector('[data-copy]').onclick = function () {
      var done = function () { MK.ui.toast('복사했어요.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() { ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { MK.ui.toast('글을 길게 눌러 직접 복사해 주세요.', true); } }
    };
    d.showModal();
  }

  /* ---------- 받은 편집을 내 파일에 반영 ---------- */
  function applyOne(e, force) {
    if (!MK.editor || !MK.editor.applyRemote) return { status: 'missing' };
    var r = MK.editor.applyRemote(e, force);
    R.res[e.id] = r;
    return r;
  }
  function applyAndSave() {
    if (!MK.editor) return;
    var n = { ok: 0, already: 0, conflict: 0, missing: 0 }, already = [];
    byRank(R.edits).forEach(function (x) {
      if ((R.res[x.id] || {}).status === 'ok') return;
      var st = applyOne(x).status; n[st]++;
      if (st === 'already') already.push(x.id);
    });
    paint();
    // 파일에 이미 같은 글자가 들어가 있는 편집(예: 반영·배포 뒤 다시 보내진 것)은 바로 '반영'으로 정리
    var tidy = already.length ? mark(already, '반영', '이미 파일에 들어가 있는 편집 ' + already.length + '곳을 목록에서 정리했어요.') : Promise.resolve();
    if (!MK.editor.hasApplied()) {
      tidy.then(function () {
        if (n.conflict + n.missing) MK.ui.toast('넣지 못한 곳만 남았어요. 각 편집의 안내를 봐 주세요.', true);
        else if (!already.length) MK.ui.toast('새로 넣을 편집이 없어요.');
      });
      return;
    }
    // 저장에 성공하면 editor가 넣은 편집들을 서버에 '반영'으로 표시합니다
    tidy.then(function () { return MK.editor.save(); }).then(function () { paint(); });
  }

  /* ---------- 클릭 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-rv]'); if (!b) return;
    var a = b.getAttribute('data-rv'), id = b.getAttribute('data-id');
    var e = id && editById(id);
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
    else if (a === 'apply-save') applyAndSave();
    else if (a === 'apply' && e) {
      var r = applyOne(e, b.getAttribute('data-force') === '1');
      if (r.status === 'ok') MK.ui.toast('화면에 넣었어요. 위의 「내 파일에 저장」을 눌러야 파일에 들어갑니다.');
      paint();
    }
    else if (a === 'summary') showSummary();
    else if (a === 'owner-on') {
      MK.ui.confirm({ title: '이 기기에서 반영할까요?', desc: '교안 파일(site 폴더)이 있는 컴퓨터에서만 누르세요.<br>받은 편집을 파일에 넣는 <b>모두 내 파일에 반영</b> 버튼이 생깁니다. 처음 저장할 때 site 폴더를 한 번 고릅니다.', okText: '이 기기에서 반영하기' })
        .then(function (y) { if (y) setOwner(true); });
    }
    else if (a === 'owner-off') setOwner(false);
    else if (a === 'mark' && e) {
      MK.ui.confirm({ title: '목록에서 뺄까요?', desc: '파일은 바뀌지 않습니다. 이미 반영된 것이거나 직접 고친 경우에만 빼 주세요.<br>뺀 것은 아래 <b>처리한 편집</b>에서 다시 받을 수 있어요.', okText: '목록에서 빼기' })
        .then(function (y) { if (y) mark([e.id], '반영', '목록에서 뺐어요.'); });
    }
    else if (a === 'drop' && e) {
      var mine = !isOwner();
      MK.ui.confirm({ title: mine ? '보낸 것을 취소할까요?' : '이 편집을 반영하지 않을까요?', desc: '“' + esc(toText(e.after, 200)) + '”<br>목록에서 빠지고, 아래 <b>처리한 편집</b>에서 다시 받을 수 있어요.', okText: mine ? '보낸 것 취소' : '반영 안 함', danger: true })
        .then(function (y) { if (y) mark([e.id], '버림', mine ? '보낸 것을 취소했어요.' : '반영하지 않기로 했어요.'); });
    }
    else if (a === 'revive' && e) mark([e.id], '대기', '다시 받았어요. 받은 편집 목록에 있어요.');
    else if (a === 'clear-edits') {
      var ids = R.edits.map(function (x) { return x.id; });
      MK.ui.confirm({ title: '받은 편집 ' + ids.length + '곳을 모두 목록에서 뺄까요?', desc: '파일은 바뀌지 않습니다. 이미 파일에 들어간 경우에만 쓰세요.<br>뺀 것은 <b>처리한 편집</b>에서 다시 받을 수 있어요.', okText: '모두 빼기' })
        .then(function (y) { if (y) mark(ids, '반영', ids.length + '곳을 목록에서 뺐어요.'); });
    }
    else if (a === 'done-memos') {
      var ms = openMemos();
      MK.ui.confirm({ title: '열린 메모 ' + ms.length + '개를 모두 완료할까요?', desc: '완료한 메모는 아래 <b>완료한 메모</b>에서 다시 열 수 있어요.', okText: '모두 완료' })
        .then(function (y) {
          if (!y) return;
          ms.reduce(function (p, m) { return p.then(function () { return call('memoUpdate', { id: m.id, done: true, by: savedName() }); }); }, Promise.resolve())
            .then(function () { MK.ui.toast('메모 ' + ms.length + '개를 완료했어요.'); }, bad);
        });
    }
    else if (a === 'toggle-done') { R.showDone = !R.showDone; paint(); }
    else if (a === 'toggle-hist') { R.showHist = !R.showHist; paint(); }
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

  function mark(ids, status, msg) {
    return call('reviewMark', { ids: ids, status: status, by: savedName() }).then(function () {
      MK.ui.toast(msg || (status === '반영' ? '파일에 반영했어요. 이제 배포하기.command를 눌러 올리세요.' : '처리했어요.'));
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
    adminHtml: adminHtml, badge: badge, isOn: on, isOwner: isOwner,
    state: function () { return R; }
  };
})();
