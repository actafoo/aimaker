/* =========================================================
   저장 계층
   - RemoteStore: 구글 시트(Apps Script)에 저장. config.js에 apiUrl이 있으면 이것을 씁니다.
   - LocalStore : 이 브라우저에만 저장(데모). apiUrl이 비어 있으면 이것을 씁니다.
   두 저장소는 함수 이름이 같아서, 교안의 다른 부분은 어느 쪽인지 몰라도 됩니다.

   모든 함수는 Promise를 돌려주고, 실패하면 한국어 메시지를 담은 Error를 던집니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var cfg = MK.config;
  var KEY = cfg.storageKey;
  var ME_KEY = cfg.storageKey + '-me';
  var ADMIN_KEY = cfg.storageKey + '-admin';

  /* ---------- 공통 도우미 ---------- */
  function hashPin(pin) { // 데모용 간단 해시(FNV-1a). 보안 목적 아님
    var h = 0x811c9dc5, s = 'mk:' + String(pin);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function fail(msg) { return Promise.reject(new Error(msg)); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function blank() {
    var cap = {};
    MK.challenges.forEach(function (c) { cap[c.id] = cfg.defaultCapacity; });
    return { version: 1, settings: { open: true, capacity: cap, closed: {}, timer: {} }, enrollments: [], submissions: [], help: [], hearts: [], ideas: [] };
  }
  var FEATURES = ['help', 'timer', 'hearts', 'ideas', 'shuffle'];
  var IDEA_MAX = 80;

  /* 화면에 내보내는 모양: 대기 중인 도움 요청만, 하트는 작품별 이름 목록 */
  function publicView(d) {
    var v = copy(d), ids = {};
    v.submissions.forEach(function (s) { ids[s.id] = 1; });
    v.help = (d.help || []).filter(function (h) { return !h.done; });
    var hearts = {};
    (d.hearts || []).forEach(function (h) { if (ids[h.submissionId]) (hearts[h.submissionId] = hearts[h.submissionId] || []).push(h.name); });
    v.hearts = hearts;
    v.features = FEATURES;
    return v;
  }

  /* 주소 검사 */
  MK.parseMakecode = function (url) {
    var u = clean(url);
    if (!u) return null;
    var m = u.match(/^https?:\/\/(?:www\.)?makecode\.microbit\.org\/(?:#pub:|---codeembed#pub:|---run\?id=)?(_[A-Za-z0-9]{6,}|S?\d{5}-\d{5}-\d{5}-\d{5})\/?$/);
    if (m) return m[1];
    m = u.match(/^https?:\/\/(?:www\.)?makecode\.microbit\.org\/.*#pub:(_[A-Za-z0-9]{6,}|S?\d{5}-\d{5}-\d{5}-\d{5})/);
    return m ? m[1] : null;
  };
  MK.isHttpUrl = function (url) {
    try { var u = new URL(clean(url)); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { return false; }
  };

  /* =========================================================
     LocalStore
     ========================================================= */
  function LocalStore() {
    this.listeners = [];
    var self = this;
    window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === ME_KEY) self._emit(); });
  }

  LocalStore.prototype = {
    kind: 'local',
    isShared: false, // 다른 사람의 신청이 보이는가

    _read: function () {
      var d;
      try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
      if (!d || d.version !== 1) d = blank();
      // 새로 생긴 도전과제에 기본 정원 채우기
      MK.challenges.forEach(function (c) { if (d.settings.capacity[c.id] == null) d.settings.capacity[c.id] = cfg.defaultCapacity; });
      // 예전에 저장한 데이터에 새 칸 채우기
      if (!d.settings.timer) d.settings.timer = {};
      if (!Array.isArray(d.help)) d.help = [];
      if (!Array.isArray(d.hearts)) d.hearts = [];
      if (!Array.isArray(d.ideas)) d.ideas = [];
      return d;
    },
    _write: function (d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); }
      catch (e) { throw new Error('브라우저 저장 공간에 쓸 수 없습니다. 사생활 보호 창이면 일반 창으로 열어 주세요.'); }
      this._emit();
    },
    _emit: function () { var s = this; this.listeners.forEach(function (fn) { try { fn(s); } catch (e) { console.error(e); } }); },
    subscribe: function (fn) { this.listeners.push(fn); var l = this.listeners; return function () { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; },

    /* ---------- 읽기 ---------- */
    getState: function () {
      var pub = publicView(this._read());
      // 비밀번호 해시는 화면에 내보내지 않음
      [pub.enrollments, pub.submissions, pub.help, pub.ideas].forEach(function (list) { list.forEach(function (r) { delete r.pin; }); });
      return Promise.resolve(pub);
    },
    getStateSync: function () { return publicView(this._read()); },
    supports: function () { return true; },
    now: function () { return Date.now(); },

    /* ---------- 나 (이 기기의 연수생) ---------- */
    getMe: function () { try { return JSON.parse(localStorage.getItem(ME_KEY)) || null; } catch (e) { return null; } },
    setMe: function (me) { try { if (me) localStorage.setItem(ME_KEY, JSON.stringify(me)); else localStorage.removeItem(ME_KEY); } catch (e) {} this._emit(); },

    /* 이름+비밀번호 확인. 처음 쓰는 이름이면 등록 */
    _checkPerson: function (d, name, pin) {
      name = clean(name); pin = clean(pin);
      if (!name) throw new Error('이름을 적어 주세요.');
      if (name.length > 20) throw new Error('이름은 20자 이내로 적어 주세요.');
      if (!/^\d{4}$/.test(pin)) throw new Error('비밀번호는 숫자 4자리입니다.');
      var h = hashPin(pin);
      var known = d.enrollments.concat(d.submissions, d.help, d.ideas).filter(function (r) { return r.name === name && r.pin; });
      if (known.length && known[0].pin !== h) throw new Error('같은 이름이 이미 있는데 비밀번호가 다릅니다. 내 이름이 맞다면 비밀번호를 확인하고, 다른 사람이라면 이름 뒤에 학교 이름을 붙여 주세요.');
      return { name: name, pin: h };
    },

    /* 이름 등록만 (신청 전) */
    identify: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      this.setMe({ name: p.name, pin: clean(o.pin) });
      return Promise.resolve({});
    },

    /* ---------- 신청 ---------- */
    apply: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var ch = MK.challengeById(o.challengeId);
      if (!ch) return fail('도전과제를 찾을 수 없습니다.');
      if (!d.settings.open) return fail('지금은 신청을 받지 않습니다.');
      if (d.settings.closed[ch.id]) return fail('이 도전과제는 신청이 마감되었습니다.');
      var mine = d.enrollments.filter(function (e) { return e.name === p.name; })[0];
      if (mine && mine.challengeId === ch.id) { this.setMe({ name: p.name, pin: o.pin }); return Promise.resolve({ moved: false, already: true }); }
      var count = d.enrollments.filter(function (e) { return e.challengeId === ch.id; }).length;
      if (count >= (d.settings.capacity[ch.id] || 0)) return fail('정원이 다 찼습니다. 다른 도전과제를 골라 주세요.');
      var moved = null;
      if (mine) { moved = mine.challengeId; d.enrollments = d.enrollments.filter(function (e) { return e !== mine; }); }
      d.enrollments.push({ id: uid('e'), name: p.name, pin: p.pin, challengeId: ch.id, at: Date.now() });
      // 이미 제출한 결과물이 있으면 과제를 따라 옮김
      d.submissions.forEach(function (s) { if (s.name === p.name) s.challengeId = ch.id; });
      try { this._write(d); } catch (e) { return fail(e.message); }
      this.setMe({ name: p.name, pin: o.pin });
      return Promise.resolve({ moved: moved });
    },

    cancel: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var before = d.enrollments.length;
      d.enrollments = d.enrollments.filter(function (e) { return e.name !== p.name; });
      if (d.enrollments.length === before) return fail('신청한 도전과제가 없습니다.');
      try { this._write(d); } catch (e) { return fail(e.message); }
      return Promise.resolve({});
    },

    /* ---------- 제출 (다시 내면 수정) ---------- */
    submit: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var en = d.enrollments.filter(function (e) { return e.name === p.name; })[0];
      if (!en) return fail('먼저 도전과제를 신청해 주세요.');
      var title = clean(o.title), desc = String(o.desc || '').trim(), mc = clean(o.makecodeUrl), video = clean(o.videoUrl);
      if (!title) return fail('작품 제목을 적어 주세요.');
      if (title.length > 40) return fail('작품 제목은 40자 이내로 적어 주세요.');
      if (!desc) return fail('간단한 설명을 적어 주세요.');
      if (desc.length > cfg.descMax) return fail('설명은 ' + cfg.descMax + '자 이내로 적어 주세요.');
      if (!MK.parseMakecode(mc)) return fail('MakeCode 공유 주소를 확인해 주세요. https://makecode.microbit.org/_ 로 시작하는 주소입니다.');
      if (!MK.isHttpUrl(video)) return fail('작동 영상 주소를 확인해 주세요. https:// 로 시작하는 주소입니다.');
      var now = Date.now();
      var s = d.submissions.filter(function (x) { return x.name === p.name; })[0];
      if (s) {
        s.title = title; s.desc = desc; s.makecodeUrl = mc; s.videoUrl = video; s.challengeId = en.challengeId; s.updatedAt = now;
      } else {
        var maxOrder = d.submissions.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
        d.submissions.push({ id: uid('s'), name: p.name, pin: p.pin, challengeId: en.challengeId, title: title, desc: desc, makecodeUrl: mc, videoUrl: video, at: now, updatedAt: now, include: true, hidden: false, order: maxOrder + 1 });
      }
      try { this._write(d); } catch (e) { return fail(e.message); }
      this.setMe({ name: p.name, pin: o.pin });
      return Promise.resolve({ updated: !!s });
    },

    /* ---------- 도움 요청 ---------- */
    requestHelp: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var en = d.enrollments.filter(function (e) { return e.name === p.name; })[0];
      var step = String(Math.max(0, Math.min(9, parseInt(o.step, 10) || 0)));
      var checked = String(o.checked || '').replace(/[^0-9,]/g, '').slice(0, 20), note = clean(o.note).slice(0, 60);
      var open = d.help.filter(function (h) { return !h.done; });
      var mine = open.filter(function (h) { return h.name === p.name; })[0];
      if (mine) { mine.step = step; mine.checked = checked; mine.note = note; mine.challengeId = en ? en.challengeId : ''; }
      else d.help.push({ id: uid('h'), name: p.name, pin: p.pin, challengeId: en ? en.challengeId : '', step: step, checked: checked, note: note, at: Date.now(), done: false, by: '', doneAt: 0 });
      try { this._write(d); } catch (e) { return fail(e.message); }
      this.setMe({ name: p.name, pin: clean(o.pin) });
      return Promise.resolve({ updated: !!mine });
    },
    cancelHelp: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      d.help.forEach(function (h) { if (!h.done && h.name === p.name) { h.done = true; h.by = '본인'; h.doneAt = Date.now(); } });
      try { this._write(d); } catch (e) { return fail(e.message); }
      return Promise.resolve({});
    },

    /* ---------- 작품 하트 ---------- */
    setHeart: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var s = d.submissions.filter(function (x) { return x.id === o.submissionId; })[0];
      if (!s || s.hidden) return fail('작품을 찾을 수 없습니다.');
      if (s.name === p.name) return fail('내 작품에는 하트를 누를 수 없어요.');
      var had = d.hearts.filter(function (h) { return h.submissionId === s.id && h.name === p.name; })[0];
      if (o.on && !had) d.hearts.push({ id: uid('k'), submissionId: s.id, name: p.name, at: Date.now() });
      if (!o.on && had) d.hearts = d.hearts.filter(function (h) { return h !== had; });
      try { this._write(d); } catch (e) { return fail(e.message); }
      return Promise.resolve({ on: !!o.on });
    },

    /* ---------- 수업 아이디어 ---------- */
    postIdea: function (o) {
      var d = this._read(), p;
      try { p = this._checkPerson(d, o.name, o.pin); } catch (e) { return fail(e.message); }
      var text = clean(o.text), grade = clean(o.grade);
      if (!text) return fail('아이디어를 적어 주세요.');
      if (text.length > IDEA_MAX) return fail('아이디어는 ' + IDEA_MAX + '자 이내로 적어 주세요.');
      if (grade.length > 20) return fail('학년·교과는 20자 이내로 적어 주세요.');
      if (d.ideas.some(function (x) { return x.name === p.name && x.text === text; })) return Promise.resolve({ already: true });
      if (d.ideas.filter(function (x) { return x.name === p.name; }).length >= 5) return fail('아이디어는 한 사람이 5개까지 올릴 수 있어요.');
      var en = d.enrollments.filter(function (e) { return e.name === p.name; })[0];
      d.ideas.push({ id: uid('i'), name: p.name, pin: p.pin, challengeId: en ? en.challengeId : '', grade: grade, text: text, at: Date.now() });
      try { this._write(d); } catch (e) { return fail(e.message); }
      this.setMe({ name: p.name, pin: clean(o.pin) });
      return Promise.resolve({});
    },
    deleteIdea: function (id, person) {
      var d = this._read(), x = d.ideas.filter(function (i) { return i.id === id; })[0];
      if (!x) return Promise.resolve({});
      if (!this.isAdmin()) {
        var p;
        try { p = this._checkPerson(d, person && person.name, person && person.pin); } catch (e) { return fail(e.message); }
        if (x.name !== p.name) return fail('내가 쓴 아이디어만 지울 수 있어요.');
      }
      d.ideas = d.ideas.filter(function (i) { return i !== x; });
      try { this._write(d); } catch (e) { return fail(e.message); }
      return Promise.resolve({});
    },

    /* =========================================================
       관리자
       ========================================================= */
    isAdmin: function () { try { return sessionStorage.getItem(ADMIN_KEY) === '1'; } catch (e) { return false; } },
    adminLogin: function (pw) {
      if (!cfg.adminPassword) return fail('관리자 비밀번호가 설정되지 않았습니다. config.js를 확인해 주세요.');
      if (String(pw) !== String(cfg.adminPassword)) return fail('비밀번호가 맞지 않습니다.');
      try { sessionStorage.setItem(ADMIN_KEY, '1'); } catch (e) {}
      this._emit();
      return Promise.resolve({});
    },
    adminLogout: function () { try { sessionStorage.removeItem(ADMIN_KEY); } catch (e) {} this._emit(); return Promise.resolve({}); },
    _admin: function (fn) {
      if (!this.isAdmin()) return fail('관리자만 할 수 있습니다.');
      var d = this._read();
      try { var r = fn(d); this._write(d); return Promise.resolve(r || {}); } catch (e) { return fail(e.message); }
    },

    setCapacity: function (challengeId, n) {
      return this._admin(function (d) { d.settings.capacity[challengeId] = Math.max(0, Math.min(40, parseInt(n, 10) || 0)); });
    },
    setOpen: function (challengeId, open) { // challengeId 가 null 이면 전체
      return this._admin(function (d) {
        if (challengeId == null) d.settings.open = !!open;
        else if (open) delete d.settings.closed[challengeId]; else d.settings.closed[challengeId] = true;
      });
    },
    removeEnrollment: function (id) {
      return this._admin(function (d) { d.enrollments = d.enrollments.filter(function (e) { return e.id !== id; }); });
    },
    moveEnrollment: function (id, challengeId) {
      return this._admin(function (d) {
        var e = d.enrollments.filter(function (x) { return x.id === id; })[0];
        if (!e) throw new Error('신청을 찾을 수 없습니다.');
        e.challengeId = challengeId;
        d.submissions.forEach(function (s) { if (s.name === e.name) s.challengeId = challengeId; });
      });
    },
    addEnrollment: function (name, challengeId, pin) {
      var self = this;
      return this._admin(function (d) {
        name = clean(name);
        if (!name) throw new Error('이름을 적어 주세요.');
        var known = d.enrollments.concat(d.submissions).filter(function (r) { return r.name === name; })[0];
        d.enrollments = d.enrollments.filter(function (e) { return e.name !== name; });
        d.enrollments.push({ id: uid('e'), name: name, pin: known ? known.pin : hashPin(pin || '0000'), challengeId: challengeId, at: Date.now() });
      });
    },
    updateSubmission: function (id, patch) {
      return this._admin(function (d) {
        var s = d.submissions.filter(function (x) { return x.id === id; })[0];
        if (!s) throw new Error('제출물을 찾을 수 없습니다.');
        ['title', 'desc', 'makecodeUrl', 'videoUrl', 'include', 'hidden', 'challengeId'].forEach(function (k) { if (k in patch) s[k] = patch[k]; });
        s.updatedAt = Date.now();
      });
    },
    moveSubmission: function (id, dir) {
      return this._admin(function (d) {
        var list = d.submissions.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        list.forEach(function (s, i) { s.order = i + 1; });
        var i = list.findIndex(function (s) { return s.id === id; }), j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        var t = list[i].order; list[i].order = list[j].order; list[j].order = t;
      });
    },
    deleteSubmission: function (id) {
      return this._admin(function (d) {
        d.submissions = d.submissions.filter(function (s) { return s.id !== id; });
        d.hearts = d.hearts.filter(function (h) { return h.submissionId !== id; });
      });
    },
    resolveHelp: function (id) {
      return this._admin(function (d) { d.help.forEach(function (h) { if (h.id === id && !h.done) { h.done = true; h.by = '강사'; h.doneAt = Date.now(); } }); });
    },
    setTimer: function (cmd, o) { // 데모 모드는 이 브라우저 안의 타이머라 누구나 조작
      var d = this._read();
      try { d.settings.timer = MK.timerStep(d.settings.timer, cmd, o || {}, Date.now()); this._write(d); } catch (e) { return fail(e.message); }
      return Promise.resolve({});
    },
    shuffleOrder: function () {
      return this._admin(function (d) {
        var list = d.submissions.slice();
        for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
        list.forEach(function (s, i) { s.order = i + 1; });
      });
    },
    seedSamples: function () {
      return this._admin(function (d) {
        var maxOrder = d.submissions.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
        MK.sampleResults.forEach(function (r, i) {
          if (d.submissions.some(function (s) { return s.sample && s.title === r.title; })) return;
          d.submissions.push({ id: uid('s'), name: r.name, pin: hashPin('0000'), challengeId: r.challengeId, title: r.title, desc: r.desc, makecodeUrl: '', videoUrl: '', at: Date.now(), updatedAt: Date.now(), include: true, hidden: false, order: maxOrder + i + 1, sample: true });
          if (!d.enrollments.some(function (e) { return e.name === r.name; })) d.enrollments.push({ id: uid('e'), name: r.name, pin: hashPin('0000'), challengeId: r.challengeId, at: Date.now(), sample: true });
        });
      });
    },
    clearSamples: function () {
      return this._admin(function (d) {
        d.submissions = d.submissions.filter(function (s) { return !s.sample; });
        d.enrollments = d.enrollments.filter(function (e) { return !e.sample; });
        var ids = {}; d.submissions.forEach(function (s) { ids[s.id] = 1; });
        d.hearts = d.hearts.filter(function (h) { return ids[h.submissionId]; });
      });
    },
    exportAll: function () {
      if (!this.isAdmin()) return fail('관리자만 할 수 있습니다.');
      return Promise.resolve(this._read());
    },
    importAll: function (data) {
      return this._admin(function (d) {
        if (!data || data.version !== 1 || !data.settings || !Array.isArray(data.enrollments) || !Array.isArray(data.submissions)) throw new Error('이 교안에서 내보낸 JSON 파일이 아닙니다.');
        d.settings = data.settings; d.enrollments = data.enrollments; d.submissions = data.submissions;
        if (!d.settings.timer) d.settings.timer = {};
        d.help = Array.isArray(data.help) ? data.help : []; d.ideas = Array.isArray(data.ideas) ? data.ideas : [];
        d.hearts = Array.isArray(data.hearts) ? data.hearts : [];
      });
    },
    reset: function () {
      return this._admin(function (d) { var b = blank(); d.settings = b.settings; d.enrollments = []; d.submissions = []; d.help = []; d.hearts = []; d.ideas = []; });
    }
  };

  /* =========================================================
     RemoteStore — 구글 시트 + Apps Script
     - 현황은 몇 초마다 다시 받아 옵니다(화면을 보고 있을 때만)
     - 신청·제출·관리자 동작은 서버가 정원과 비밀번호를 확인합니다
     ========================================================= */
  var CACHE_KEY = cfg.storageKey + '-remote-cache';
  var PW_KEY = cfg.storageKey + '-adminpw';

  function normalize(st) {
    var d = blank();
    if (!st) return d;
    d.settings.open = st.settings ? st.settings.open !== false : true;
    var cap = (st.settings && st.settings.capacity) || {};
    Object.keys(cap).forEach(function (k) { if (cap[k] !== '' && cap[k] != null) d.settings.capacity[k] = Number(cap[k]); });
    d.settings.closed = (st.settings && st.settings.closed) || {};
    d.settings.timer = (st.settings && st.settings.timer) || {};
    d.features = st.features || []; // 예전 서버면 비어 있음 → 새 기능은 꺼진 채로
    d.help = st.help || [];
    d.hearts = st.hearts || {};
    d.ideas = st.ideas || [];
    d.enrollments = st.enrollments || [];
    d.submissions = st.submissions || [];
    return d;
  }

  function isLiveView() {
    if (document.querySelector('#admin.is-open')) return true;
    if (MK.store && MK.store.isAdmin()) return true; // 관리자는 도움 요청을 바로 봐야 함
    var sl = document.querySelector('.slide.is-active');
    if (!sl) return true;
    if (/^(s-show|show-)/.test(sl.id)) return true;
    return !!sl.querySelector('[data-widget="apply-panel"], [data-widget="seat-board"], [data-widget="submit-board"], [data-widget="challenge-overview"], [data-widget="my-submission"], [data-widget="timer"], [data-widget="help-request"], [data-widget="idea-wall"]');
  }

  function RemoteStore(url) {
    var self = this;
    this.url = url; this.listeners = []; this.online = null; this.loaded = false; this.lastJson = '';
    this.offset = 0; this.rtt = Infinity; // 서버 시계 - 이 노트북 시계 (같은 타이머용)
    var cached = null; try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) {}
    this.state = normalize(cached);
    if (cached) this.lastJson = JSON.stringify(this.state);
    window.addEventListener('storage', function (e) { if (e.key === ME_KEY) self._emit(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') self.refresh(); });
    // 살아 있는 현황을 보여 주는 쪽에서만 자주(기본 10초), 나머지는 1분마다 받아 옵니다
    this.lastFetch = 0;
    var every = Math.max(4, cfg.pollSeconds || 10) * 1000;
    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (isLiveView() || Date.now() - self.lastFetch > 60000) self.refresh();
    }, every);
    document.addEventListener('deck:enter', function () { if (isLiveView() && Date.now() - self.lastFetch > 5000) self.refresh(); });
    setTimeout(function () { self.refresh(); }, 0);
  }

  RemoteStore.prototype = {
    kind: 'remote',
    isShared: true,

    _emit: LocalStore.prototype._emit,
    subscribe: LocalStore.prototype.subscribe,
    getMe: LocalStore.prototype.getMe,
    setMe: LocalStore.prototype.setMe,
    supports: function (f) { return (this.state.features || []).indexOf(f) >= 0; },
    now: function () { return Date.now() + this.offset; },

    _setOnline: function (on) {
      if (this.online === on) return;
      this.online = on; this._emit();
    },
    _setState: function (st) {
      var d = normalize(st), j = JSON.stringify(d), first = !this.loaded;
      this.loaded = true;
      if (j === this.lastJson) { if (first) this._emit(); return; } // 처음 받은 게 저장해 둔 것과 같아도 '연결하는 중' 표시는 지움
      this.lastJson = j; this.state = d;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(st)); } catch (e) {}
      this._emit();
    },
    _fetch: function (opts) {
      var self = this, u = this.url, t0 = Date.now();
      var req = opts ? fetch(u, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(opts) })
                     : fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 'action=state&t=' + Date.now(), { redirect: 'follow' });
      return req.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          self._setOnline(true);
          // 왕복 시간이 가장 짧았던 응답으로 서버 시계를 맞춤
          var t1 = Date.now();
          if (j && j.now && t1 - t0 <= self.rtt) { self.rtt = t1 - t0; self.offset = j.now - Math.round((t0 + t1) / 2); }
          return j;
        }, function (err) {
          self._setOnline(false);
          throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
        });
    },
    refresh: function () {
      var self = this;
      if (this._busy) return this._busy;
      this.lastFetch = Date.now();
      this._busy = this._fetch(null).then(function (j) { if (j.ok && j.state) self._setState(j.state); }, function () {})
        .then(function () { self._busy = null; });
      return this._busy;
    },
    _call: function (action, args, admin) {
      var self = this, body = Object.assign({ action: action }, args || {});
      if (admin) {
        var pw = this._pw();
        if (!pw) return fail('관리자만 할 수 있습니다.');
        body.pw = pw;
      }
      // 사람이 몰려 실패하면 자동으로 다시 보냄 (두 번 보내도 결과가 같은 요청만)
      var canRetry = action !== 'moveSubmission' && action !== 'shuffleOrder' && !(action === 'setTimer' && body.cmd === 'add');
      var waits = [1500, 3500], attempt = 0, sentOnce = false;
      function once() {
        return self._fetch(body).then(function (j) {
          if (j.state) self._setState(j.state);
          if (!j.ok) {
            if (j.code === 'not_admin') { try { sessionStorage.removeItem(PW_KEY); } catch (e) {} self._emit(); }
            if (canRetry && /잠시 밀렸어요/.test(j.error || '') && attempt < waits.length) return again();
            // 앞서 보낸 취소가 실제로는 처리됐던 경우
            if (action === 'cancel' && sentOnce && /신청한 도전과제가 없습니다/.test(j.error || '')) { self._busy = null; self.refresh(); return {}; }
            if (/^알 수 없는 요청입니다/.test(j.error || '')) throw new Error('서버 코드가 예전 버전이라 이 기능을 쓸 수 없어요. 강사에게 알려 주세요.');
            throw new Error(j.error || '처리하지 못했습니다.');
          }
          return j.result || {};
        }, function (err) {
          sentOnce = true;
          if (canRetry && attempt < waits.length) return again();
          throw err;
        });
      }
      function again() {
        var ms = waits[attempt++];
        return new Promise(function (res) { setTimeout(res, ms); }).then(once);
      }
      return once();
    },

    getState: function () { return Promise.resolve(copy(this.state)); },
    getStateSync: function () { return this.state; },

    identify: function (o) {
      var self = this;
      return this._call('identify', { name: o.name, pin: o.pin }).then(function () { self.setMe({ name: clean(o.name), pin: clean(o.pin) }); return {}; });
    },
    apply: function (o) {
      var self = this;
      return this._call('apply', { name: o.name, pin: o.pin, challengeId: o.challengeId }).then(function (r) { self.setMe({ name: clean(o.name), pin: clean(o.pin) }); return r; });
    },
    cancel: function (o) { return this._call('cancel', { name: o.name, pin: o.pin }); },
    requestHelp: function (o) {
      var self = this;
      return this._call('helpRequest', { name: o.name, pin: o.pin, step: o.step, checked: o.checked, note: o.note })
        .then(function (r) { self.setMe({ name: clean(o.name), pin: clean(o.pin) }); return r; });
    },
    cancelHelp: function (o) { return this._call('helpCancel', { name: o.name, pin: o.pin }); },
    setHeart: function (o) { return this._call('setHeart', { name: o.name, pin: o.pin, submissionId: o.submissionId, on: !!o.on }); },
    postIdea: function (o) {
      var self = this;
      return this._call('ideaPost', { name: o.name, pin: o.pin, grade: o.grade, text: o.text })
        .then(function (r) { self.setMe({ name: clean(o.name), pin: clean(o.pin) }); return r; });
    },
    deleteIdea: function (id, person) {
      if (this.isAdmin()) return this._call('ideaDelete', { id: id }, true);
      return this._call('ideaDelete', { id: id, name: person && person.name, pin: person && person.pin });
    },
    submit: function (o) {
      var self = this;
      return this._call('submit', { name: o.name, pin: o.pin, title: o.title, desc: o.desc, makecodeUrl: o.makecodeUrl, videoUrl: o.videoUrl })
        .then(function (r) { self.setMe({ name: clean(o.name), pin: clean(o.pin) }); return r; });
    },

    /* ---------- 관리자 ---------- */
    _pw: function () { try { return sessionStorage.getItem(PW_KEY) || ''; } catch (e) { return ''; } },
    isAdmin: function () { return !!this._pw(); },
    adminLogin: function (pw) {
      var self = this;
      return this._fetch({ action: 'adminLogin', pw: String(pw) }).then(function (j) {
        if (!j.ok) throw new Error(j.error || '비밀번호가 맞지 않습니다.');
        try { sessionStorage.setItem(PW_KEY, String(pw)); } catch (e) {}
        self._emit(); return {};
      });
    },
    adminLogout: function () { try { sessionStorage.removeItem(PW_KEY); } catch (e) {} this._emit(); return Promise.resolve({}); },
    setCapacity: function (id, n) { return this._call('setCapacity', { challengeId: id, n: n }, true); },
    setOpen: function (id, open) { return this._call('setOpen', { challengeId: id, open: !!open }, true); },
    removeEnrollment: function (id) { return this._call('removeEnrollment', { id: id }, true); },
    moveEnrollment: function (id, challengeId) { return this._call('moveEnrollment', { id: id, challengeId: challengeId }, true); },
    addEnrollment: function (name, challengeId, pin) { return this._call('addEnrollment', { name: name, challengeId: challengeId, pin: pin }, true); },
    updateSubmission: function (id, patch) { return this._call('updateSubmission', { id: id, patch: patch }, true); },
    moveSubmission: function (id, dir) { return this._call('moveSubmission', { id: id, dir: dir }, true); },
    deleteSubmission: function (id) { return this._call('deleteSubmission', { id: id }, true); },
    resolveHelp: function (id) { return this._call('helpDone', { id: id }, true); },
    setTimer: function (cmd, o) { o = o || {}; return this._call('setTimer', { cmd: cmd, total: o.total, ms: o.ms, label: o.label }, true); },
    shuffleOrder: function () { return this._call('shuffleOrder', {}, true); },
    seedSamples: function () { return this._call('seedSamples', { samples: MK.sampleResults }, true); },
    clearSamples: function () { return this._call('clearSamples', {}, true); },
    exportAll: function () { return this._call('exportAll', {}, true).then(function (r) { return r.data; }); },
    importAll: function (data) { return this._call('importAll', { data: data }, true); },
    reset: function () { return this._call('reset', {}, true); }
  };

  /* 같은 타이머 계산 (Code.gs의 setTimer와 같은 규칙) — 데모 모드에서 씀 */
  MK.timerStep = function (t, cmd, o, now) {
    t = t || {};
    var total = Number(t.total) || 0, left = Number(t.left) || 0, running = !!t.running;
    if (running) left = Math.max(0, (Number(t.endAt) || 0) - now);
    var want = Math.max(0, Math.min(3 * 3600000, Math.round(Number(o.total) || 0)));
    if (cmd === 'start') {
      if (want && !running && (!total || left <= 0 || left === total)) { total = want; left = want; }
      if (!total) { total = 40 * 60000; left = total; }
      if (left <= 0) left = total;
      running = true;
    } else if (cmd === 'pause') running = false;
    else if (cmd === 'reset') { running = false; if (want) total = want; left = total; }
    else if (cmd === 'add') {
      var ms = Math.max(-30 * 60000, Math.min(30 * 60000, Math.round(Number(o.ms) || 0)));
      left = Math.max(0, left + ms); total = Math.max(total, left);
    } else throw new Error('알 수 없는 타이머 명령입니다.');
    return { total: total, left: left, endAt: running ? now + left : 0, running: running, label: clean(o.label || t.label || '').slice(0, 20), at: now };
  };

  MK.LocalStore = LocalStore;
  MK.RemoteStore = RemoteStore;
  MK.store = cfg.apiUrl ? new RemoteStore(cfg.apiUrl) : new LocalStore();
})();
