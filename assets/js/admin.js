/* =========================================================
   관리자 — Ctrl+Shift+A 또는 주소 끝 #admin
   정원·마감 / 신청 명단 / 도움 요청 / 제출물 / 발표자료 / 데이터
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n, c) { return MK.icon(n, c); };
  function $(s, r) { return (r || document).querySelector(s); }
  var tab = 'cap', panel;

  function ok(msg) { return function () { if (msg) MK.ui.toast(msg); }; }
  function bad(err) { MK.ui.toast(err.message, true); }

  function build() {
    if (panel) return;
    document.body.insertAdjacentHTML('beforeend',
      '<aside class="admin ui" id="admin" aria-label="관리자">' +
        '<div class="admin__head">' + ic('lock') + '<b>관리자</b><button class="icon-btn" id="admin-out" title="관리자 나가기">' + ic('power') + '</button><button class="icon-btn" id="admin-close" aria-label="닫기">' + ic('x') + '</button></div>' +
        '<div class="admin__tabs" role="tablist">' +
          '<button data-tab="edit">교안 편집</button><button data-tab="review">편집·메모</button><button data-tab="cap">정원·마감</button><button data-tab="roster">신청 명단</button><button data-tab="help">도움</button><button data-tab="subs">제출물</button><button data-tab="show">발표자료</button><button data-tab="data">데이터</button>' +
        '</div><div class="admin__body" id="admin-body"></div></aside>');
    panel = $('#admin');
    $('#admin-close').onclick = function () { MK.admin.close(); };
    $('#admin-out').onclick = function () { MK.store.adminLogout(); MK.admin.close(); MK.ui.toast('관리자 모드를 껐어요.'); };
    panel.querySelector('.admin__tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; render();
    });
    panel.addEventListener('click', onClick);
    panel.addEventListener('change', onChange);
  }

  /* ---------- 탭 그리기 ---------- */
  function render() {
    if (!panel) return;
    var st = MK.store.getStateSync(), S = MK.state, h = '';
    var helpN = (st.help || []).length;
    // 편집자: 교안 편집·편집·메모 탭만 (나머지는 서버도 거절)
    var editorOnly = !MK.store.isAdmin() && !!(MK.store.isEditor && MK.store.isEditor());
    if (editorOnly && tab !== 'edit' && tab !== 'review') tab = 'review';
    panel.querySelector('.admin__head b').textContent = editorOnly ? '편집자' : '관리자';
    Array.prototype.forEach.call(panel.querySelectorAll('[data-tab]'), function (b) {
      b.hidden = editorOnly && b.dataset.tab !== 'edit' && b.dataset.tab !== 'review';
      b.classList.toggle('is-on', b.dataset.tab === tab);
      if (b.dataset.tab === 'help') b.innerHTML = '도움' + (helpN ? ' <span class="tab-badge">' + helpN + '</span>' : '');
      if (b.dataset.tab === 'review') { var rn = MK.review ? MK.review.badge() : 0; b.innerHTML = '편집·메모' + (rn ? ' <span class="tab-badge">' + rn + '</span>' : ''); }
    });
    if (editorOnly) h += '<div class="admin__notice"><b>편집자</b>로 들어왔습니다. 글자를 고쳐 <b>보내기</b>와 쪽마다 <b>메모</b>를 할 수 있어요. 보낸 내용은 교안 담당자가 확인하고 반영합니다.</div>';
    else if (!MK.store.isShared) h += '<div class="admin__notice"><b>데모 모드</b> · 모든 데이터가 <b>이 브라우저에만</b> 저장됩니다. 다른 연수생의 신청·제출은 여기 보이지 않습니다. 연수 전에 온라인 저장소를 연결해야 합니다.</div>';
    else if (MK.store.loaded && !MK.store.supports('help')) h += '<div class="admin__notice"><b>서버 코드가 예전 버전</b>입니다. 도움 요청·모두 같은 타이머·작품 하트·수업 아이디어가 꺼져 있어요. <b>backend/Code.gs</b>를 Apps Script에 새로 붙여 넣고 <b>배포 관리 → 새 버전</b>으로 배포해 주세요.</div>';

    if (tab === 'help') {
      var q = (st.help || []).slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      h += '<p class="small">연수생이 「안 될 때 다섯 가지 확인」 쪽에서 보낸 요청입니다. 도와준 뒤 <b>처리</b>를 누르면 줄에서 빠집니다. 연수생이 스스로 「해결됐어요」를 눌러도 빠집니다.</p>';
      if (!q.length) h += '<div class="acard"><div class="acard__meta">지금 대기 중인 도움 요청이 없습니다.</div></div>';
      q.forEach(function (x, i) {
        var c = MK.challengeById(x.challengeId), cat = c ? MK.catOf(c) : null;
        var mins = Math.max(0, Math.round((MK.store.now() - (x.at || 0)) / 60000));
        var step = x.step === '9' ? '재료·조립 등 다른 것' : x.step && x.step !== '0' ? x.step + '번에서 막힘' : '어디서 막혔는지 모름';
        h += '<div class="acard' + (cat ? ' c-' + cat.color : '') + '"><div class="acard__top">' + (cat ? '<span class="cat-dot"></span>' : '') + '<div class="acard__title">' + (i + 1) + '. ' + esc(x.name) +
          ' <small style="color:var(--muted);font-weight:600">· ' + (mins ? mins + '분 전' : '방금') + '</small></div><button class="ubtn ubtn--sm ubtn--green" data-help-resolve="' + esc(x.id) + '">' + ic('check') + ' 처리</button></div>' +
          '<div class="acard__meta">' + esc(c ? c.title : '신청 전') + '<br><b>' + esc(step) + '</b>' + (x.checked ? ' · 확인한 것 ' + esc(x.checked.split(',').join('·')) + '번' : '') + (x.note ? '<br>“' + esc(x.note) + '”' : '') + '</div></div>';
      });
    }

    if (tab === 'review' && MK.review) h += MK.review.adminHtml();

    if (tab === 'edit' && MK.editor) {
      var E = MK.editor, dd = E.detail(), n = E.changes();
      h += '<div class="acard"><div class="acard__top"><div class="acard__title">편집 모드</div><button class="ubtn ubtn--sm' + (E.isOn() ? ' ubtn--ghost' : '') + '" data-ed-toggle>' + ic('edit') + (E.isOn() ? ' 끝내기' : ' 켜기') + '</button></div>' +
        '<div class="acard__meta">켜면 슬라이드의 글자를 눌러 바로 고칠 수 있습니다. 단축키 Ctrl+Shift+E · 저장 Ctrl+S</div></div>';
      var canSend = E.canSend && E.canSend();
      var what = n ? [dd.deck ? '슬라이드 글자' : '', dd.challenges ? '도전과제·공통 조건' : '', dd.config ? '연수 정보' : ''].filter(Boolean).join(', ') : '';
      var own = MK.review && MK.review.isOwner ? MK.review.isOwner() : E.isLocal;
      if (canSend) h += '<div class="acard' + (own ? '' : ' acard--hot') + '"><div class="acard__top"><div class="acard__title">보내기 <small style="color:var(--muted);font-weight:600">· 웹 주소에서 고쳤을 때</small></div><button class="ubtn ubtn--sm" data-ed-send ' + (n ? '' : 'disabled') + '>' + ic('send') + ' 보내기</button></div>' +
        '<div class="acard__meta">고친 곳(원래 글자 → 고친 글자)을 서버로 보냅니다. 교안 담당자 컴퓨터의 <b>편집·메모</b> 탭에 모이고, 담당자가 파일에 반영해 배포하면 웹 교안에 보입니다. 같은 곳을 다시 고쳐 보내면 하나로 합쳐집니다.' + (own ? '' : ' 단축키 Ctrl+S') + '</div></div>';
      if (!canSend || own) h += '<div class="acard"><div class="acard__top"><div class="acard__title">내 컴퓨터에 저장 <small style="color:var(--muted);font-weight:600">· 교안 파일이 있을 때</small></div><button class="ubtn ubtn--sm ubtn--green" data-ed-save ' + (n ? '' : 'disabled') + '>' + ic('download') + ' 저장</button></div>' +
        '<div class="acard__meta">' + (n ? '바뀐 것: ' + what : '저장 안 한 변경이 없습니다.') + '</div>' +
        (n ? '<div class="acard__row"><button class="ubtn ubtn--sm ubtn--ghost" data-ed-discard>변경 버리기</button></div>' : '') + '</div>';
      if (!canSend || own) h += '<div class="acard"><div class="acard__title">어디에 저장되나요?</div><div class="acard__meta">' +
        (E.canWriteFolder ? '처음 저장할 때 <b>site 폴더</b>를 한 번 고르면, 그 안의 파일을 직접 고칩니다. 브라우저가 "파일 수정 허용"을 물으면 허용해 주세요.' : '이 브라우저는 폴더에 바로 쓸 수 없어 <b>고친 파일을 내려받습니다</b>. 크롬·엣지에서는 바로 저장됩니다.') +
        '<br>· 슬라이드 글자 → ' + esc(E.deckFile) + '<br>· 도전과제 설명·공통 조건 → assets/js/challenges.js<br>· 표지의 연수 정보 → assets/js/config.js' +
        '<br>저장 전 원래 파일은 <b>site/_backup</b> 폴더에 남깁니다.</div>' +
        (E.canWriteFolder ? '<div class="acard__row"><button class="ubtn ubtn--sm ubtn--ghost" data-ed-pick>다른 폴더로 저장</button></div>' : '') + '</div>';
      h += '<div class="acard"><div class="acard__title">여기서 못 바꾸는 것</div><div class="acard__meta">그림, 배치, 색, 슬라이드 추가·삭제·순서는 파일에서 고칩니다(README 참고). 편집 중에는 다른 편집기로 같은 파일을 고치지 마세요.</div></div>';
    }

    if (tab === 'cap') {
      h += '<div class="acard"><div class="acard__top"><div class="acard__title">전체 신청 받기</div><label class="switch"><input type="checkbox" data-open-all ' + (st.settings.open ? 'checked' : '') + '>' + (st.settings.open ? '받는 중' : '마감') + '</label></div><div class="acard__meta">끄면 모든 도전과제의 신청 버튼이 막힙니다.</div></div>';
      h += '<h4>도전과제별 정원</h4>';
      MK.challenges.forEach(function (c) {
        var cat = MK.catOf(c), n = S.enrolledIn(st, c.id).length, cap = S.capOf(st, c.id);
        h += '<div class="acard c-' + cat.color + '"><div class="acard__top"><span class="cat-dot"></span><div class="acard__title">' + esc(c.title) + '</div></div>' +
          '<div class="acard__row"><span class="stepper"><button data-cap="' + c.id + '" data-d="-1">−</button><input data-cap-input="' + c.id + '" value="' + cap + '" inputmode="numeric" aria-label="정원"><button data-cap="' + c.id + '" data-d="1">+</button></span>' +
          '<span class="acard__meta" style="margin:0">신청 ' + n + '명' + (n > cap ? ' · <b style="color:var(--red)">정원 초과</b>' : '') + '</span><span style="flex:1"></span>' +
          '<label class="switch"><input type="checkbox" data-open="' + c.id + '" ' + (st.settings.closed[c.id] ? '' : 'checked') + '>' + (st.settings.closed[c.id] ? '마감' : '받는 중') + '</label></div></div>';
      });
    }

    if (tab === 'roster') {
      var opts = MK.challenges.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title) + '</option>'; }).join('');
      h += '<div class="acard"><div class="acard__title">직접 추가</div><div class="acard__row"><input id="add-name" class="mini-select" style="max-width:130px;padding:0 8px" placeholder="이름"><select id="add-ch" class="mini-select">' + opts + '</select><button class="ubtn ubtn--sm" data-add>추가</button></div><div class="acard__meta">직접 추가한 사람의 비밀번호는 0000입니다 (이미 있던 이름이면 원래 비밀번호).</div></div>';
      MK.challenges.forEach(function (c) {
        var cat = MK.catOf(c), list = S.enrolledIn(st, c.id);
        h += '<h4 class="c-' + cat.color + '" style="display:flex;align-items:center;gap:8px"><span class="cat-dot"></span>' + esc(c.title) + ' · ' + list.length + ' / ' + S.capOf(st, c.id) + '</h4>';
        if (!list.length) h += '<p class="small">신청자가 없습니다.</p>';
        list.forEach(function (e) {
          h += '<div class="acard" style="padding:10px 14px"><div class="acard__top"><div class="acard__title">' + esc(e.name) + (e.sample ? ' <small style="color:var(--muted)">샘플</small>' : '') + '</div>' +
            '<select class="mini-select" data-move="' + e.id + '">' + MK.challenges.map(function (x) { return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select>' +
            '<button class="icon-btn" data-remove="' + e.id + '" title="명단에서 빼기">' + ic('trash') + '</button></div></div>';
        });
      });
    }

    if (tab === 'subs') {
      var subs = st.submissions.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      h += '<p class="small">제출 ' + subs.length + '개 · 발표에 넣은 것 ' + MK.showcase.items(st).length + '개. 순서는 발표 순서입니다.</p>';
      if (!subs.length) h += '<div class="acard"><div class="acard__meta">아직 제출물이 없습니다. 테스트하려면 데이터 탭의 <b>샘플 넣기</b>를 누르세요.</div></div>';
      subs.forEach(function (s, i) {
        var c = MK.challengeById(s.challengeId) || {}, cat = MK.catOf(c);
        h += '<div class="acard c-' + cat.color + (s.hidden ? ' is-hidden' : '') + '"><div class="acard__top"><span class="cat-dot"></span><div class="acard__title">' + (i + 1) + '. ' + esc(s.title) + (s.sample ? ' <small style="color:var(--muted)">샘플</small>' : '') + '</div>' +
          '<button class="icon-btn" data-up="' + s.id + '" title="앞으로">' + ic('up') + '</button><button class="icon-btn" data-down="' + s.id + '" title="뒤로">' + ic('down') + '</button></div>' +
          '<div class="acard__meta">' + esc(s.name) + ' · ' + esc(c.title || '') + '<br>' + esc(s.desc) + '<br>' +
            (s.makecodeUrl ? '<a href="' + esc(s.makecodeUrl) + '" target="_blank" rel="noopener">MakeCode</a> · ' : '') + (s.videoUrl ? '<a href="' + esc(s.videoUrl) + '" target="_blank" rel="noopener">영상</a>' : '') + '</div>' +
          '<div class="acard__row"><label class="switch"><input type="checkbox" data-include="' + s.id + '" ' + (s.include ? 'checked' : '') + '>발표에 넣기</label><label class="switch"><input type="checkbox" data-hide="' + s.id + '" ' + (s.hidden ? 'checked' : '') + '>숨기기</label><span style="flex:1"></span>' +
          '<button class="ubtn ubtn--sm ubtn--ghost" data-edit="' + s.id + '">' + ic('edit') + ' 고치기</button><button class="icon-btn" data-del="' + s.id + '" title="삭제">' + ic('trash') + '</button></div></div>';
      });
    }

    if (tab === 'show') {
      var items = MK.showcase.items(st);
      h += '<div class="acard"><div class="acard__title">발표 슬라이드</div><div class="acard__meta">제출물 탭에서 <b>발표에 넣기</b>를 켠 작품이 정한 순서대로 한 장씩 만들어집니다. 지금 ' + items.length + '개.</div>' +
        '<div class="acard__row"><button class="ubtn" data-show-go>' + ic('play') + ' 발표 슬라이드로 이동</button>' +
        (MK.store.supports('shuffle') && items.length > 1 ? '<button class="ubtn ubtn--ghost" data-shuffle>' + ic('spark') + ' 발표 순서 뽑기</button>' : '') + '</div></div>';
      h += '<div class="acard"><div class="acard__title">단일 HTML로 저장</div><div class="acard__meta">발표 슬라이드만 파일 하나로 저장합니다. 현장 인터넷이 불안할 때 대비용입니다(영상 재생은 인터넷 필요). 로컬 서버나 배포 주소에서 열었을 때 동작합니다.</div>' +
        '<div class="acard__row"><button class="ubtn ubtn--ghost" data-export-html>' + ic('download') + ' 발표 파일 저장</button></div></div>';
      h += '<h4>발표 순서</h4>';
      items.forEach(function (s, i) {
        var hearts = ((st.hearts || {})[s.id] || []).length;
        h += '<div class="acard" style="padding:8px 14px"><div class="acard__top"><div class="acard__title" style="font-size:14px">' + (i + 1) + '. ' + esc(s.title) + ' <span style="color:var(--muted);font-weight:600">· ' + esc(s.name) + '</span></div>' +
          (MK.store.supports('hearts') ? '<span class="heart-n" title="하트">' + ic('heart') + ' ' + hearts + '</span>' : '') + '</div></div>';
      });
    }

    if (tab === 'data') {
      h += '<div class="acard"><div class="acard__title">내보내기</div><div class="acard__meta">신청·제출 기록을 파일로 저장합니다.</div><div class="acard__row"><button class="ubtn ubtn--ghost ubtn--sm" data-export-json>' + ic('download') + ' JSON</button><button class="ubtn ubtn--ghost ubtn--sm" data-export-csv>' + ic('download') + ' CSV (엑셀)</button></div></div>';
      h += '<div class="acard"><div class="acard__title">가져오기</div><div class="acard__meta">이 교안에서 내보낸 JSON을 불러옵니다. 지금 데이터는 덮어씁니다.</div><div class="acard__row"><input type="file" accept="application/json,.json" data-import style="font-size:13px"></div></div>';
      h += '<div class="acard"><div class="acard__title">샘플 결과물</div><div class="acard__meta">목업의 샘플 6개를 넣어 발표 슬라이드를 미리 봅니다. "샘플" 표시가 붙습니다.</div><div class="acard__row"><button class="ubtn ubtn--sm" data-seed>샘플 넣기</button><button class="ubtn ubtn--sm ubtn--ghost" data-unseed>샘플 지우기</button></div></div>';
      h += '<div class="acard"><div class="acard__title">전체 초기화</div><div class="acard__meta">신청·제출·정원 설정, 도움 요청·하트·수업 아이디어·타이머를 모두 지웁니다. 되돌릴 수 없으니 먼저 내보내기를 하세요.</div><div class="acard__row"><button class="ubtn ubtn--sm ubtn--danger" data-reset>' + ic('trash') + ' 초기화</button></div></div>';
    }
    $('#admin-body').innerHTML = h;
  }

  /* ---------- 클릭 ---------- */
  function onClick(e) {
    var t = e.target.closest('button'); if (!t) return;
    var d = t.dataset, st = MK.store.getStateSync();
    if (d.cap) { var cur = MK.state.capOf(st, d.cap); MK.store.setCapacity(d.cap, cur + parseInt(d.d, 10)).catch(bad); }
    else if (d.remove) MK.store.removeEnrollment(d.remove).then(ok('명단에서 뺐어요.'), bad);
    else if (d.helpResolve) { t.disabled = true; MK.store.resolveHelp(d.helpResolve).then(ok('처리했어요.'), bad); }
    else if (t.hasAttribute('data-add')) MK.store.addEnrollment($('#add-name').value, $('#add-ch').value).then(ok('추가했어요.'), bad);
    else if (d.up) MK.store.moveSubmission(d.up, -1).catch(bad);
    else if (d.down) MK.store.moveSubmission(d.down, 1).catch(bad);
    else if (d.del) MK.ui.confirm({ title: '이 제출물을 삭제할까요?', desc: '되돌릴 수 없습니다.', okText: '삭제', danger: true }).then(function (y) { if (y) MK.store.deleteSubmission(d.del).then(ok('삭제했어요.'), bad); });
    else if (d.edit) editSub(d.edit);
    else if (t.hasAttribute('data-ed-toggle')) MK.editor.toggle();
    else if (t.hasAttribute('data-ed-save')) MK.editor.save();
    else if (t.hasAttribute('data-ed-send')) MK.editor.send();
    else if (t.hasAttribute('data-ed-pick')) MK.editor.save(true);
    else if (t.hasAttribute('data-ed-discard')) MK.editor.discard();
    else if (t.hasAttribute('data-show-go')) { MK.deck.refresh(true); MK.deck.goto('s-show'); MK.admin.close(); }
    else if (t.hasAttribute('data-shuffle')) { /* interact.js가 처리 */ }
    else if (t.hasAttribute('data-export-html')) MK.showcase.exportHtml().then(ok('발표 파일을 저장했어요.'), bad);
    else if (t.hasAttribute('data-export-json')) MK.store.exportAll().then(function (data) { download('신청제출-' + today() + '.json', JSON.stringify(data, null, 2), 'application/json'); }, bad);
    else if (t.hasAttribute('data-export-csv')) MK.store.exportAll().then(function (data) { download('신청제출-' + today() + '.csv', '﻿' + toCsv(data), 'text/csv'); }, bad);
    else if (t.hasAttribute('data-seed')) MK.store.seedSamples().then(ok('샘플 6개를 넣었어요.'), bad);
    else if (t.hasAttribute('data-unseed')) MK.store.clearSamples().then(ok('샘플을 지웠어요.'), bad);
    else if (t.hasAttribute('data-reset')) MK.ui.confirm({ title: '전체 초기화', desc: '모든 신청·제출·정원 설정을 지웁니다. 계속하려면 <b>초기화</b>라고 적어 주세요.', okText: '모두 지우기', danger: true, fields: [{ name: 'word', label: '확인 글자', placeholder: '초기화' }] })
      .then(function (v) { if (!v) return; if (v.word !== '초기화') return MK.ui.toast('확인 글자가 달라서 취소했어요.', true); MK.store.reset().then(ok('초기화했어요.'), bad); });
  }
  function onChange(e) {
    var t = e.target, d = t.dataset;
    if ('openAll' in d) MK.store.setOpen(null, t.checked).catch(bad);
    else if (d.open) MK.store.setOpen(d.open, t.checked).catch(bad);
    else if (d.capInput) MK.store.setCapacity(d.capInput, t.value).catch(bad);
    else if (d.move) MK.store.moveEnrollment(d.move, t.value).then(ok('옮겼어요.'), bad);
    else if (d.include) MK.store.updateSubmission(d.include, { include: t.checked }).catch(bad);
    else if (d.hide) MK.store.updateSubmission(d.hide, { hidden: t.checked }).catch(bad);
    else if ('import' in d && t.files[0]) {
      var fr = new FileReader();
      fr.onload = function () { var data; try { data = JSON.parse(fr.result); } catch (err) { return MK.ui.toast('JSON 파일을 읽을 수 없습니다.', true); } MK.store.importAll(data).then(ok('불러왔어요.'), bad); };
      fr.readAsText(t.files[0]);
    }
  }

  function editSub(id) {
    var s = MK.store.getStateSync().submissions.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    MK.ui.form({ wide: true, kicker: '관리자 · ' + s.name, title: '제출물 고치기', submitText: '저장',
      fields: [
        { name: 'title', label: '작품 제목', value: s.title, maxlength: 40 },
        { name: 'desc', label: '간단한 설명', type: 'textarea', value: s.desc, maxlength: MK.config.descMax },
        { name: 'makecodeUrl', label: 'MakeCode 공유 주소', value: s.makecodeUrl },
        { name: 'videoUrl', label: '작동 영상 주소', value: s.videoUrl },
        { name: 'challengeId', label: '도전과제', type: 'select', value: s.challengeId, options: MK.challenges.map(function (c) { return { value: c.id, label: c.title }; }) }
      ],
      onSubmit: function (v) { return MK.store.updateSubmission(id, v).then(ok('저장했어요.')); } });
  }

  /* ---------- 파일 ---------- */
  function today() { return new Date().toISOString().slice(0, 10); }
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function toCsv(d) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var subBy = {}; d.submissions.forEach(function (s) { subBy[s.name] = s; });
    var rows = [['이름', '도전과제', '분류', '신청 시각', '작품 제목', '간단한 설명', 'MakeCode', '작동 영상', '발표 포함']];
    var names = {};
    d.enrollments.forEach(function (e) { names[e.name] = e; });
    d.submissions.forEach(function (s) { if (!names[s.name]) names[s.name] = { name: s.name, challengeId: s.challengeId }; });
    Object.keys(names).forEach(function (n) {
      var e = names[n], s = subBy[n] || {}, c = MK.challengeById(s.challengeId || e.challengeId) || {};
      rows.push([n, c.title, c.category, e.at ? new Date(e.at).toLocaleString('ko-KR') : '', s.title, s.desc, s.makecodeUrl, s.videoUrl, s.id ? (s.include && !s.hidden ? 'O' : 'X') : '']);
    });
    return rows.map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }

  /* ---------- 열기·닫기 ---------- */
  function login() {
    MK.ui.form({ kicker: '관리자 · 편집자', title: '비밀번호', desc: '관리자 비밀번호 또는 편집자 비밀번호를 넣어 주세요.', fields: [{ name: 'pw', label: '비밀번호', type: 'password' }], submitText: '들어가기',
      onSubmit: function (v) { return MK.store.adminLogin(v.pw).then(function () { MK.admin.open(); }); } });
  }

  MK.admin = {
    open: function (toTab) {
      if (!MK.store.isAdmin() && !(MK.store.isEditor && MK.store.isEditor())) return login();
      if (toTab) tab = toTab;
      build(); render(); panel.classList.add('is-open');
    },
    close: function () { if (panel) panel.classList.remove('is-open'); },
    toggle: function () { if (panel && panel.classList.contains('is-open')) MK.admin.close(); else MK.admin.open(); },
    render: render
  };

  document.addEventListener('keydown', function (e) {
    if (e.shiftKey && (e.ctrlKey || e.metaKey) && (e.key === 'A' || e.key === 'a')) { e.preventDefault(); MK.admin.toggle(); }
  });
  function checkHash() { if (location.hash === '#admin') { history.replaceState(null, '', location.pathname + location.search); MK.admin.open(); } }
  window.addEventListener('hashchange', checkHash);
  MK.admin.checkHash = checkHash;
})();
