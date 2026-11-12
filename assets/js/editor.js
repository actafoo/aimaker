/* =========================================================
   교안 편집 — 화면에서 글자를 바로 고치고 파일로 저장
   - 관리자만 켤 수 있습니다 (Ctrl+Shift+E 또는 관리자 › 교안 편집)
   - 저장: 크롬·엣지에서 site 폴더를 한 번 고르면, 그 안의 파일을 직접 고칩니다
       슬라이드 글자     → deck-9-10.html (지금 열린 교안 파일)
       도전과제·공통 조건 → assets/js/challenges.js
       표지의 연수 정보   → assets/js/config.js
   - 저장 전 원래 파일은 site/_backup/날짜-시각/ 에 남깁니다
   - 보내기: 웹 주소에서 고친 사람은 고친 곳(원래 글자 → 고친 글자)을 서버로 보내고,
     교안 담당자가 자기 컴퓨터의 교안에서 받아 적용(applyRemote)한 뒤 저장·배포합니다 (review.js)
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n) { return MK.icon(n); };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var pristineRoot = null, pristineStage = null, pmap = {};
  var savedStageHtml = '';          // 마지막으로 저장(또는 처음 연) 슬라이드 원본
  var editing = false, backedUp = false, bar = null;
  var dirty = { deck: 0, challenges: 0, config: 0 };
  // 보내기·받은 편집용: 고친 자리와 처음(교안을 열었을 때) 글자
  var touched = {}, orig = {}, touchedF = {}, origF = {}, applied = [], rc = 0;
  var LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var DECK_FILE = decodeURIComponent(location.pathname.split('/').pop() || '') || 'deck-9-10.html';
  var FS = typeof window.showDirectoryPicker === 'function';

  /* ---------- 원본 뜨기 (app.js가 맨 처음 부름) ---------- */
  function snapshot() {
    var stage = $('#stage'); if (!stage) return;
    $$('*', stage).forEach(function (el, i) { el.setAttribute('data-ek', String(i)); });
    pristineRoot = document.documentElement.cloneNode(true);
    pristineStage = pristineRoot.querySelector('#stage');
    $$('[data-ek]', pristineStage).forEach(function (el) { pmap[el.getAttribute('data-ek')] = el; });
    savedStageHtml = stageHtml(pristineStage);
  }
  function stageHtml(stageEl) {
    var c = stageEl.cloneNode(true);
    $$('[data-ek]', c).forEach(function (el) { el.removeAttribute('data-ek'); });
    $$('[contenteditable], [data-edit-host]', c).forEach(function (el) { el.removeAttribute('contenteditable'); el.removeAttribute('data-edit-host'); });
    return c.innerHTML;
  }

  /* ---------- 고칠 수 있는 곳 표시 ---------- */
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    return false;
  }
  function mark() {
    var stage = $('#stage'); if (!stage || !editing) return;
    // 1) 직접 쓴 슬라이드 글자
    $$('[data-ek]', stage).forEach(function (el) {
      if (el.hasAttribute('data-edit-host')) return;
      if (el.closest('[data-widget], [data-generate], .slide__footer')) return;
      if (/^(SCRIPT|STYLE|svg|use|IMG|path)$/i.test(el.tagName)) return;
      if (el.querySelector('[data-widget], [data-field]')) return;
      if (el.parentElement && el.parentElement.closest('[data-edit-host]')) return;
      if (!hasOwnText(el)) return;
      el.setAttribute('data-edit-host', 'ek'); el.setAttribute('contenteditable', 'true'); el.spellcheck = false;
    });
    // 2) 데이터에서 온 글자 (도전과제, 공통 조건, 연수 정보)
    $$('[data-field]', stage).forEach(function (el) {
      if (el.hasAttribute('data-edit-host')) return;
      el.setAttribute('data-edit-host', 'field'); el.setAttribute('contenteditable', 'true'); el.spellcheck = false;
    });
  }
  function unmark() {
    $$('[data-edit-host]').forEach(function (el) { el.removeAttribute('data-edit-host'); el.removeAttribute('contenteditable'); });
  }

  /* ---------- 고친 내용 반영 ---------- */
  function cleanHtml(html) {
    var box = document.createElement('div'); box.innerHTML = html;
    // 브라우저가 몰래 넣는 span/font/div 정리 (원래 있던 요소는 data-ek가 있음)
    $$('*', box).forEach(function (el) {
      if (el.hasAttribute('data-ek')) return;
      var t = el.tagName;
      if (t === 'B' || t === 'STRONG' || t === 'I' || t === 'EM' || t === 'BR') { el.removeAttribute('style'); return; }
      if (t === 'DIV' || t === 'P') { el.insertAdjacentHTML('beforebegin', '<br>'); }
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    $$('[contenteditable]', box).forEach(function (el) { el.removeAttribute('contenteditable'); });
    // 맨 끝에 혼자 남은 <br>은 화면에 안 보이니 지움 (Enter를 누르고 아무것도 안 쓴 경우)
    var last = box.lastChild;
    while (last && last.nodeType === 3 && !/\S/.test(last.nodeValue)) last = last.previousSibling;
    if (last && last.nodeName === 'BR') {
      var prev = last.previousSibling;
      while (prev && prev.nodeType === 3 && !/\S/.test(prev.nodeValue)) prev = prev.previousSibling;
      if (!prev || prev.nodeName !== 'BR') last.remove();
    }
    return box.innerHTML;
  }
  function cleanInline(html) { // 도전과제 힌트: b, br 만 남김
    var box = document.createElement('div'); box.innerHTML = html.replace(/\r?\n/g, '<br>');
    $$('*', box).forEach(function (el) {
      if (el.tagName === 'B' || el.tagName === 'BR') { Array.prototype.slice.call(el.attributes).forEach(function (a) { el.removeAttribute(a.name); }); return; }
      if (el.tagName === 'STRONG') { var b = document.createElement('b'); b.innerHTML = el.innerHTML; el.replaceWith(b); return; }
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    return box.innerHTML.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().replace(/(\s*<br>)+$/, '');
  }
  function plain(el) { return el.innerText.replace(/\s+/g, ' ').trim(); }
  // 줄바꿈을 살리는 칸: 줄마다 공백을 정리하고 \n 으로 잇기
  function plainLines(el) {
    return el.innerText.replace(/\r/g, '').split('\n').map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // Enter로 줄을 바꿀 수 있는 칸인지 (제목·질문·공통 조건 한 줄·연수 정보는 한 줄짜리)
  var MULTI = /^(ch:[^:]+:(materials|problem|success|start)|freedom)$/;
  function multiLine(host) {
    return host.getAttribute('data-edit-host') === 'ek' || MULTI.test(host.getAttribute('data-field') || '');
  }
  function lineBreakOrEnd(host) {
    if (multiLine(host)) document.execCommand('insertLineBreak');
    else host.blur(); // 한 줄짜리 칸은 Enter로 끝내기
  }

  /* 비교·보내기용 글자: 편집 표시용 속성을 뺀 HTML */
  function norm(html) {
    var box = document.createElement('div'); box.innerHTML = html;
    $$('*', box).forEach(function (el) { ['data-ek', 'contenteditable', 'data-edit-host', 'spellcheck'].forEach(function (a) { el.removeAttribute(a); }); });
    return box.innerHTML.trim();
  }
  function getField(fk) {
    var f = String(fk || '').split(':'), c;
    if (f[0] === 'ch') { c = MK.challengeById(f[1]); return c && c[f[2]] != null ? String(c[f[2]]) : null; }
    if (f[0] === 'notice') return MK.commonNotice[+f[1]] != null ? String(MK.commonNotice[+f[1]]) : null;
    if (f[0] === 'freedom') return String(MK.designFreedom || '');
    if (f[0] === 'cfg') return MK.config[f[1]] != null ? String(MK.config[f[1]]) : null;
    return null;
  }
  function setField(fk, v) {
    var f = String(fk).split(':');
    if (f[0] === 'ch') { var c = MK.challengeById(f[1]); if (c) { c[f[2]] = v; dirty.challenges++; } }
    else if (f[0] === 'notice') { MK.commonNotice[+f[1]] = v; dirty.challenges++; }
    else if (f[0] === 'freedom') { MK.designFreedom = v; dirty.challenges++; }
    else if (f[0] === 'cfg') { MK.config[f[1]] = v; dirty.config++; }
  }

  function apply(host) {
    var kind = host.getAttribute('data-edit-host');
    if (kind === 'ek') {
      var k = host.getAttribute('data-ek'), p = pmap[k];
      if (p) {
        if (!(k in orig)) orig[k] = norm(p.innerHTML);
        p.innerHTML = cleanHtml(host.innerHTML); dirty.deck++; touched[k] = 1;
      }
    } else {
      var fk = host.getAttribute('data-field') || '';
      if (!(fk in origF)) { var o = getField(fk); if (o != null) origF[fk] = o; }
      touchedF[fk] = 1;
      var f = fk.split(':');
      if (f[0] === 'ch') {
        var ch = MK.challengeById(f[1]);
        if (ch) { ch[f[2]] = f[2] === 'start' ? cleanInline(host.innerHTML) : (multiLine(host) ? plainLines(host) : plain(host)); dirty.challenges++; }
      } else if (f[0] === 'notice') { MK.commonNotice[+f[1]] = plain(host); dirty.challenges++; }
      else if (f[0] === 'freedom') { MK.designFreedom = plainLines(host); dirty.challenges++; }
      else if (f[0] === 'cfg') { MK.config[f[1]] = plain(host); dirty.config++; }
    }
    paintBar();
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('input', function (e) {
    if (!editing) return;
    var host = e.target.closest && e.target.closest('[data-edit-host]');
    if (host) apply(host);
  });
  // 위 keydown이 못 막은 Enter(입력기에 따라 조합 확정과 함께 오는 경우)도 같은 방식으로 처리
  document.addEventListener('beforeinput', function (e) {
    if (!editing || e.inputType !== 'insertParagraph') return;
    var host = e.target.closest && e.target.closest('[data-edit-host]');
    if (!host) return;
    e.preventDefault();
    lineBreakOrEnd(host);
  });
  document.addEventListener('paste', function (e) {
    if (!editing || !e.target.closest || !e.target.closest('[data-edit-host]')) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  document.addEventListener('keydown', function (e) {
    // Ctrl+S(맥은 ⌘S): 글자를 고치는 중이어도 바로 보내기·저장
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 's' || e.key === 'S') && editing) {
      e.preventDefault();
      if (canSend() && !owner()) MK.editor.send(); else MK.editor.save();
      return;
    }
    var host = editing && e.target.closest && e.target.closest('[data-edit-host]');
    if (host) {
      if (e.key === 'Escape') { e.preventDefault(); host.blur(); }
      else if (e.key === 'Enter') {
        // 한글을 조합하던 중의 Enter는 글자를 확정하는 데 쓰이고, 곧 Enter가 한 번 더 옵니다.
        // 여기서 처리하면 줄이 두 번 바뀌거나 꼬이므로 그냥 둡니다.
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        lineBreakOrEnd(host);
      }
      return;
    }
    if (e.shiftKey && (e.ctrlKey || e.metaKey) && (e.key === 'E' || e.key === 'e')) { e.preventDefault(); MK.editor.toggle(); }
  });
  // 편집 중에는 슬라이드 안 버튼·링크가 동작하지 않게 (글자만 고치도록)
  document.addEventListener('click', function (e) {
    if (!editing) return;
    var stage = $('#stage');
    if (!stage || !stage.contains(e.target)) return;
    if (e.target.closest('a, button, [data-goto], [data-act], [data-code]')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('deck:enter', function () { if (editing) mark(); });
  window.addEventListener('beforeunload', function (e) { if (total()) { e.preventDefault(); e.returnValue = ''; } });

  function total() { return dirty.deck + dirty.challenges + dirty.config; }

  /* ---------- 위쪽 편집 막대 ---------- */
  function canEditNow() { return (MK.store.canEdit ? MK.store.canEdit() : MK.store.isAdmin()); } // 관리자 또는 편집자
  function canSend() { return canEditNow() && MK.store.supports('review') && !!MK.store.review; }
  // 반영하는 기기(교안 파일이 있는 컴퓨터)인가 — review.js가 정함. 없으면 내 컴퓨터에서 열었을 때
  function owner() { return MK.review && MK.review.isOwner ? MK.review.isOwner() : LOCAL; }
  function paintBar() {
    if (!bar) return;
    var n = total(), send = canSend(), own = owner();
    bar.querySelector('.editbar__count').textContent = n ? (send && !own ? '보내지 않은 변경 있음' : '저장 안 한 변경 있음') : '변경 없음';
    var sv = bar.querySelector('[data-ed=save]'), sd = bar.querySelector('[data-ed=send]'), mm = bar.querySelector('[data-ed=memo]');
    sv.disabled = !n; sd.disabled = !n;
    sd.hidden = !send; mm.hidden = !send;
    sv.hidden = send && !own; // 보내는 기기에는 교안 파일이 없으니 「내 컴퓨터에 저장」을 숨김
    sd.classList.toggle('ubtn--ghost', own);
    if (MK.admin && $('#admin.is-open')) MK.admin.render();
  }
  function showBar(on) {
    if (on && !bar) {
      bar = document.createElement('div');
      bar.className = 'editbar ui';
      bar.innerHTML = '<span class="editbar__title">' + ic('edit') + ' 편집 모드</span><span class="editbar__hint">글자를 눌러 고치세요 · Enter 줄바꿈(제목·질문은 한 줄) · Esc 끝</span>' +
        '<span class="editbar__count"></span>' +
        '<button class="ubtn ubtn--sm ubtn--ghost" data-ed="memo" title="이 쪽에 고칠 것을 메모로 남깁니다">' + ic('doc') + ' 메모</button>' +
        '<button class="ubtn ubtn--sm" data-ed="send" title="고친 곳을 서버로 보냅니다. 교안 담당자가 받아서 반영합니다.">' + ic('send') + ' 보내기</button>' +
        '<button class="ubtn ubtn--sm" data-ed="save" title="내 컴퓨터의 site 폴더에 바로 저장합니다">' + ic('download') + ' 내 컴퓨터에 저장</button>' +
        '<button class="ubtn ubtn--sm ubtn--ghost" data-ed="off">끝내기</button>';
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ed]'); if (!b) return;
        var a = b.dataset.ed;
        if (a === 'save') MK.editor.save(); else if (a === 'send') MK.editor.send();
        else if (a === 'memo') { if (MK.review) MK.review.openMemo(); }
        else MK.editor.off();
      });
      document.body.appendChild(bar);
    }
    if (bar) bar.classList.toggle('is-on', on);
    paintBar();
  }

  /* =========================================================
     저장
     ========================================================= */
  // 폴더 핸들을 기억해 두는 작은 IndexedDB
  function idb(mode, val) {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open('mk-editor', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onerror = function () { res(null); };
        r.onsuccess = function () {
          var tx = r.result.transaction('kv', mode === 'set' ? 'readwrite' : 'readonly'), st = tx.objectStore('kv');
          var q = mode === 'set' ? st.put(val, 'siteDir') : st.get('siteDir');
          q.onsuccess = function () { res(mode === 'set' ? true : q.result || null); };
          q.onerror = function () { res(null); };
        };
      } catch (e) { res(null); }
    });
  }
  function hasFile(dir, name) { return dir.getFileHandle(name).then(function () { return true; }, function () { return false; }); }
  function dirOf(root, parts) { return parts.reduce(function (p, n) { return p.then(function (d) { return d.getDirectoryHandle(n); }); }, Promise.resolve(root)); }
  function readFile(root, path) {
    var parts = path.split('/'), name = parts.pop();
    return dirOf(root, parts).then(function (d) { return d.getFileHandle(name); }).then(function (h) { return h.getFile(); }).then(function (f) { return f.text(); });
  }
  function writeFile(root, path, text, create) {
    var parts = path.split('/'), name = parts.pop();
    var dp = parts.reduce(function (p, n) { return p.then(function (d) { return d.getDirectoryHandle(n, { create: !!create }); }); }, Promise.resolve(root));
    return dp.then(function (d) { return d.getFileHandle(name, { create: !!create }); })
      .then(function (h) { return h.createWritable(); })
      .then(function (w) { return w.write(text).then(function () { return w.close(); }); });
  }

  function getDir(pickNew) {
    return (pickNew ? Promise.resolve(null) : idb('get')).then(function (h) {
      if (!h) return null;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        return p === 'granted' ? p : h.requestPermission({ mode: 'readwrite' });
      }).then(function (p) {
        if (p !== 'granted') return null;
        return hasFile(h, DECK_FILE).then(function (ok) { return ok ? h : null; });
      }, function () { return null; });
    }).then(function (h) {
      if (h) return h;
      return window.showDirectoryPicker({ id: 'mk-site', mode: 'readwrite' }).then(function (d) {
        return hasFile(d, DECK_FILE).then(function (ok) {
          if (!ok) throw new Error('「site」 폴더를 골라 주세요. 그 안에 ' + DECK_FILE + ' 파일이 있어야 합니다.');
          return idb('set', d).then(function () { return d; });
        });
      });
    });
  }

  /* 파일 내용 고치기 */
  function jsStr(v) { return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'"; }
  var STR = "'(?:[^'\\\\\\n]|\\\\.)*'";

  function patchDeck(text) {
    var a = text.search(/<main[^>]*id="stage"[^>]*>/);
    var b = text.lastIndexOf('</main>');
    var html = stageHtml(pristineStage);
    if (a < 0 || b < a) throw new Error(DECK_FILE + '에서 슬라이드 영역(<main id="stage">)을 찾지 못했습니다.');
    var open = text.slice(a).match(/<main[^>]*>/)[0];
    return { text: text.slice(0, a) + open + html + text.slice(b), html: html };
  }
  function stageOf(text) {
    var d = new DOMParser().parseFromString(text, 'text/html'), s = d.getElementById('stage');
    return s ? s.innerHTML : null;
  }
  function patchChallenges(text) {
    MK.challenges.forEach(function (c) {
      var i = text.indexOf("id: '" + c.id + "'"); if (i < 0) return;
      var j = text.indexOf('\n  }', i); if (j < 0) return;
      var block = text.slice(i, j);
      ['title', 'question', 'problem', 'materials', 'success', 'start'].forEach(function (k) {
        block = block.replace(new RegExp('(\\b' + k + ':\\s*)' + STR), function (m, pre) { return pre + jsStr(c[k] || ''); });
      });
      text = text.slice(0, i) + block + text.slice(j);
    });
    text = text.replace(/MK\.commonNotice = \[[\s\S]*?\n\];/, 'MK.commonNotice = [\n' + MK.commonNotice.map(function (t) { return '  ' + jsStr(t); }).join(',\n') + '\n];');
    text = text.replace(new RegExp('MK\\.designFreedom = ' + STR + ';'), function () { return 'MK.designFreedom = ' + jsStr(MK.designFreedom) + ';'; });
    return text;
  }
  function patchConfig(text) {
    ['course', 'session', 'title', 'tagline', 'date', 'place', 'instructor', 'instructorRole'].forEach(function (k) {
      if (MK.config[k] == null) return;
      text = text.replace(new RegExp('(\\n\\s*' + k + ':\\s*)' + STR), function (m, pre) { return pre + jsStr(MK.config[k]); });
    });
    return text;
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function saveToFolder(pickNew) {
    var dir, plan = [], newStage = null;
    return getDir(pickNew).then(function (d) {
      dir = d;
      var jobs = [];
      if (dirty.deck) jobs.push(readFile(dir, DECK_FILE).then(function (t) {
        // 다른 편집기로 파일이 바뀌었는지 확인
        var onDisk = stageOf(t);
        var changedOutside = onDisk != null && onDisk !== savedStageHtml;
        var r = patchDeck(t); newStage = r.html;
        plan.push({ path: DECK_FILE, before: t, after: r.text, outside: changedOutside });
      }));
      if (dirty.challenges) jobs.push(readFile(dir, 'assets/js/challenges.js').then(function (t) { plan.push({ path: 'assets/js/challenges.js', before: t, after: patchChallenges(t) }); }));
      if (dirty.config) jobs.push(readFile(dir, 'assets/js/config.js').then(function (t) { plan.push({ path: 'assets/js/config.js', before: t, after: patchConfig(t) }); }));
      return Promise.all(jobs);
    }).then(function () {
      var outside = plan.some(function (p) { return p.outside; });
      if (!outside) return true;
      return MK.ui.confirm({ title: '파일이 바뀌어 있어요', desc: '이 교안을 연 뒤에 <b>' + esc(DECK_FILE) + '</b> 파일이 다른 곳에서 고쳐졌습니다. 그대로 저장하면 그 변경은 사라집니다(원래 파일은 _backup에 남습니다).', okText: '그래도 저장' });
    }).then(function (go) {
      if (!go) throw new Error('저장을 취소했어요.');
      var folder = '_backup/' + stamp() + '/';
      var b = backedUp ? Promise.resolve() : Promise.all(plan.map(function (p) { return writeFile(dir, folder + p.path.replace(/\//g, '__'), p.before, true); }));
      return b.then(function () { backedUp = true; return Promise.all(plan.map(function (p) { return writeFile(dir, p.path, p.after); })); });
    }).then(function () {
      if (newStage != null) savedStageHtml = newStage;
      dirty = { deck: 0, challenges: 0, config: 0 };
      afterSaved();
      paintBar();
      return plan.map(function (p) { return p.path.split('/').pop(); });
    });
  }
  // 받은 편집을 적용해 저장했으면 서버에 '반영'으로 표시
  function afterSaved() {
    if (!applied.length || !MK.review) return;
    var ids = applied.slice(); applied = [];
    MK.review.mark(ids, '반영');
  }

  /* 폴더 쓰기를 못 하는 브라우저: 고친 파일을 내려받기 */
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function saveByDownload() {
    var names = [], jobs = [];
    if (dirty.deck) {
      var root = pristineRoot.cloneNode(true);
      $$('[data-ek]', root).forEach(function (el) { el.removeAttribute('data-ek'); });
      download(DECK_FILE, '<!doctype html>\n' + root.outerHTML, 'text/html'); names.push(DECK_FILE);
    }
    function viaFetch(path, patch, label) {
      return fetch(path).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) { download(label, patch(t), 'text/javascript'); names.push(label); },
        function () { throw new Error(label + '은(는) 이 브라우저에서 저장할 수 없습니다. 크롬이나 엣지에서 열어 주세요.'); });
    }
    if (dirty.challenges) jobs.push(viaFetch('assets/js/challenges.js', patchChallenges, 'challenges.js'));
    if (dirty.config) jobs.push(viaFetch('assets/js/config.js', patchConfig, 'config.js'));
    return Promise.all(jobs).then(function () {
      dirty = { deck: 0, challenges: 0, config: 0 }; afterSaved(); paintBar();
      MK.ui.confirm({ title: '파일을 내려받았어요', desc: '이 브라우저는 폴더에 바로 쓸 수 없어 고친 파일을 내려받았습니다.<br><b>' + names.map(esc).join(', ') + '</b>을(를) site 폴더의 같은 이름 파일과 바꿔 넣어 주세요. (크롬·엣지에서는 바로 저장됩니다)', okText: '알겠어요' });
      return names;
    });
  }

  /* =========================================================
     보내기 · 받은 편집 적용
     ========================================================= */
  function slideLabel(sl) {
    if (!sl) return '';
    var i = MK.deck.slides().indexOf(sl);
    return (i >= 0 ? (i + 1) + '쪽 · ' : '') + MK.deck.titleOf(sl);
  }
  function changeList() {
    var items = [];
    Object.keys(touched).forEach(function (k) {
      var p = pmap[k], live = $('#stage [data-ek="' + k + '"]'); if (!p || !live || !(k in orig)) return;
      var sl = live.closest('.slide');
      items.push({ key: k, field: '', slide: sl ? sl.id : '', slideTitle: slideLabel(sl), before: orig[k], after: norm(p.innerHTML) });
    });
    Object.keys(touchedF).forEach(function (fk) {
      var now = getField(fk); if (now == null || !(fk in origF)) return;
      var el = $('[data-field="' + fk + '"]'), sl = el && el.closest('.slide');
      items.push({ key: '', field: fk, slide: sl ? sl.id : '', slideTitle: slideLabel(sl), before: origF[fk], after: now });
    });
    return items;
  }
  function send() {
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    if (!canSend()) { MK.ui.toast('서버 코드가 예전 버전이라 보낼 수 없어요. 저장을 써 주세요.', true); return Promise.resolve(); }
    var items = changeList();
    if (!items.some(function (x) { return x.before !== x.after; }) && !total()) { MK.ui.toast('보낼 고친 내용이 없어요.'); return Promise.resolve(); }
    return MK.review.withName().then(function (by) {
      if (!by) return;
      return MK.review.call('reviewSend', { by: by, items: items }).then(function (r) {
        if (!applied.length) dirty = { deck: 0, challenges: 0, config: 0 }; // 받은 편집을 적용 중이면 저장 전까지 남겨 둠
        paintBar();
        var n = (r.added || 0) + (r.updated || 0);
        MK.ui.toast(n || r.removed ? '보냈어요. 교안 담당자 컴퓨터에서 파일에 반영하고 배포하면 웹 교안에 보입니다.' + (r.removed ? ' (원래대로 되돌린 ' + r.removed + '곳은 뺐어요)' : '') : '이미 보낸 내용과 같아요.');
      });
    }).catch(function (err) { MK.ui.toast((err && err.message) || '보내지 못했어요.', true); });
  }

  // 받은 편집 한 곳을 이 화면(과 저장할 원본)에 넣기. 결과: ok | already | conflict | missing
  function scopeOf(item) { var sl = item.slide && document.getElementById(item.slide); return sl && $('#stage').contains(sl) ? sl : $('#stage'); }
  function findHost(item) {
    var scope = scopeOf(item), k = String(item.key || ''), live = k && $('#stage [data-ek="' + k + '"]');
    var inScope = live && scope.contains(live) && pmap[k];
    if (inScope && norm(pmap[k].innerHTML) === item.before) return { key: k };
    var cands = $$('[data-ek]', scope).filter(function (el) { var q = pmap[el.getAttribute('data-ek')]; return q && norm(q.innerHTML) === item.before; });
    if (cands.length) return { key: cands[0].getAttribute('data-ek') };
    if (inScope && norm(pmap[k].innerHTML) === item.after) return { already: true, key: k };
    var done = $$('[data-ek]', scope).filter(function (el) { var q = pmap[el.getAttribute('data-ek')]; return q && norm(q.innerHTML) === item.after; });
    if (done.length) return { already: true, key: done[0].getAttribute('data-ek') };
    if (inScope) return { conflict: true, key: k, now: norm(pmap[k].innerHTML) };
    return { missing: true };
  }
  function applyRemote(item, force) {
    if (!pristineStage) return { status: 'missing' };
    if (item.field) {
      var cur = getField(item.field);
      if (cur == null) return { status: 'missing' };
      if (cur === item.after) return { status: 'already' };
      if (cur !== item.before && !force) return { status: 'conflict', now: cur };
      if (!(item.field in origF)) origF[item.field] = cur;
      setField(item.field, item.after); touchedF[item.field] = 1;
      if (item.id && applied.indexOf(item.id) < 0) applied.push(item.id);
      MK.deck.refresh(true); MK.renderWidgets(); if (editing) mark(); paintBar();
      return { status: 'ok' };
    }
    var f = findHost(item);
    if (f.already) return { status: 'already', key: f.key };
    if (f.missing) return { status: 'missing' };
    if (f.conflict && !force) return { status: 'conflict', key: f.key, now: f.now };
    var k = f.key, p = pmap[k], live = $('#stage [data-ek="' + k + '"]');
    if (!(k in orig)) orig[k] = norm(p.innerHTML);
    p.innerHTML = item.after; live.innerHTML = item.after;
    // 새로 들어간 요소에도 짝 번호를 붙여, 나중에 다시 고쳐도 서식이 남게 함
    var pe = $$('*', p), le = $$('*', live);
    pe.forEach(function (el, i) { var id = 'r' + (++rc); el.setAttribute('data-ek', id); if (le[i]) le[i].setAttribute('data-ek', id); pmap[id] = el; });
    touched[k] = 1; dirty.deck++;
    if (item.id && applied.indexOf(item.id) < 0) applied.push(item.id);
    if (editing) mark();
    paintBar();
    return { status: 'ok', key: k };
  }
  function flashKey(k) {
    var el = k && $('#stage [data-ek="' + k + '"]'); if (!el) return;
    el.classList.remove('rv-flash'); void el.offsetWidth; el.classList.add('rv-flash');
    setTimeout(function () { el.classList.remove('rv-flash'); }, 2600);
  }

  /* =========================================================
     공개 함수
     ========================================================= */
  MK.editor = {
    snapshot: snapshot,
    canWriteFolder: FS,
    deckFile: DECK_FILE,
    isLocal: LOCAL,
    canSend: canSend,
    send: send,
    applyRemote: applyRemote,
    hasApplied: function () { return applied.length; },
    flashKey: flashKey,
    isOn: function () { return editing; },
    changes: function () { return total(); },
    detail: function () { return { deck: dirty.deck, challenges: dirty.challenges, config: dirty.config }; },
    on: function () {
      if (!canEditNow()) { MK.ui.toast('관리자(또는 편집자)로 들어가야 편집할 수 있어요.', true); if (MK.admin) MK.admin.open(); return; }
      if (!pristineStage) { MK.ui.toast('편집 준비가 안 됐어요. 새로고침해 주세요.', true); return; }
      editing = true; document.body.classList.add('is-editing'); mark(); showBar(true);
      if (MK.admin) MK.admin.close();
      MK.ui.toast('편집 모드: 슬라이드의 글자를 눌러 고치세요.');
    },
    off: function () {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      editing = false; document.body.classList.remove('is-editing'); unmark(); showBar(false);
      if (total()) MK.ui.toast('고친 내용은 아직 저장되지 않았어요. 관리자 › 교안 편집에서 저장할 수 있어요.');
      MK.renderWidgets();
    },
    toggle: function () { if (editing) MK.editor.off(); else MK.editor.on(); },
    remark: function () { if (editing) mark(); },
    save: function (pickNew) {
      if (!total()) { MK.ui.toast('고친 내용이 없어요.'); return Promise.resolve(); }
      if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
      var p = FS ? saveToFolder(pickNew) : saveByDownload();
      return p.then(function (names) {
        if (names && FS) MK.ui.toast('저장했어요: ' + names.join(', '));
      }, function (err) {
        if (err && err.name === 'AbortError') return MK.ui.toast('폴더 고르기를 취소했어요.', true);
        MK.ui.toast((err && err.message) || '저장하지 못했어요.', true);
      });
    },
    discard: function () {
      MK.ui.confirm({ title: '저장 안 한 변경 버리기', desc: '마지막 저장 이후 고친 내용을 모두 버리고 다시 엽니다.', okText: '버리기', danger: true })
        .then(function (ok) { if (ok) { dirty = { deck: 0, challenges: 0, config: 0 }; location.reload(); } });
    }
  };
})();
