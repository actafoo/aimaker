/* =========================================================
   작품 발표회 — 제출물로 발표 슬라이드를 만듭니다
   관리자가 "발표 포함"을 켠 제출물만, 정한 순서대로 나옵니다.
   ========================================================= */
window.MK = window.MK || {};

(function () {
  var esc = function (s) { return MK.esc(s); };
  var ic = function (n, c) { return MK.icon(n, c); };
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  MK.showcase = {};

  MK.showcase.items = function (st) {
    return st.submissions.filter(function (s) { return s.include && !s.hidden; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  };

  /* 영상 주소 → 넣을 수 있는 형태 */
  MK.showcase.video = function (url) {
    var u = String(url || '').trim(), m;
    if (!u) return null;
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/))) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0', label: 'YouTube' };
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/))) return { kind: 'iframe', src: 'https://drive.google.com/file/d/' + m[1] + '/preview', label: 'Google Drive' };
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: 'video', src: u, label: '영상 파일' };
    if (/^https?:\/\//.test(u)) return { kind: 'link', src: u, label: '영상 링크' };
    return null;
  };

  /* 작품의 도전과제 정보: 아이디어 카드가 있으면 카드(모델·문장), 없으면 예전 도전과제 */
  function infoOf(s, st) {
    var card = MK.state && MK.state.cardOf ? MK.state.cardOf(st || MK.store.getStateSync(), s.name) : null;
    if (card) {
      var cat = MK.categories[card.model] || MK.catOf(null);
      return { cat: cat, label: card.model, sub: card.team ? s.name + ' · ' + card.team : s.name, sentence: MK.cardSentence ? MK.cardSentence(card) : '', img: card.from ? MK.challengeImage(card.from) : '' };
    }
    var ch = MK.challengeById(s.challengeId) || MK.challenges[0];
    return { cat: MK.catOf(ch), label: ch.category, sub: s.name + ' · ' + ch.title, sentence: '', img: MK.challengeImage(ch.id) };
  }
  MK.showcase.infoOf = infoOf;

  function media(s) {
    var v = MK.showcase.video(s.videoUrl);
    var img = infoOf(s).img;
    if (v && v.kind === 'iframe') return '<iframe data-src="' + esc(v.src) + '" title="' + esc(s.title) + ' 작동 영상" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    if (v && v.kind === 'video') return '<video data-src="' + esc(v.src) + '" controls playsinline></video>';
    return '<div class="sv-media__fallback"' + (img ? ' style="background-image:url(' + img + ')"' : '') + '>' +
      (v ? '<a class="btn" href="' + esc(v.src) + '" target="_blank" rel="noopener">' + ic('play') + ' 영상 열기</a><div class="sv-media__note">새 창에서 재생됩니다</div>'
         : '<div class="sv-media__note">' + (s.sample ? '샘플 결과물 · 영상이 없습니다' : '영상 주소가 없습니다') + '</div>') + '</div>';
  }

  /* ---------- 슬라이드 만들기 ---------- */
  function generate(st) {
    var items = MK.showcase.items(st), N = items.length;
    var sec = '4. 작품 발표회';
    var h = '<section class="slide slide--pastel" id="s-show" data-section="' + sec + '" data-title="작품 발표회">' +
      '<div class="show-cover"><span class="divider__part">PART 4</span><h2 class="show-cover__title">작품 발표회</h2>' +
      '<p class="show-cover__text">' + (N ? N + '개의 작품을 함께 봅니다. 작품을 누르면 바로 이동합니다.' : '아직 발표할 작품이 없습니다.') + '</p></div>' +
      (N > 1 ? '<button type="button" class="btn btn--sm btn--yellow admin-only show-shuffle" data-shuffle>' + ic('spark') + ' 발표 순서 뽑기</button>' : '');
    if (N) {
      h += '<div class="show-grid">';
      items.slice(0, 25).forEach(function (s, i) {
        var cat = infoOf(s, st).cat;
        h += '<button class="show-tile c-' + cat.color + '" data-goto="show-' + s.id + '"><span class="show-tile__n">' + (i + 1) + ' · ' + esc(s.name) + '</span><span class="show-tile__t">' + esc(s.title) + '</span>' +
          '<span class="show-tile__heart" data-widget="heart-count" data-sub="' + esc(s.id) + '"></span></button>';
      });
      if (N > 25) h += '<div class="show-tile" style="background:#fff"><span class="show-tile__t">외 ' + (N - 25) + '개</span></div>';
      h += '</div>';
    } else {
      h += '<div class="show-empty dashed t-md" style="text-align:center">연수생이 결과물을 제출하면 관리자가 <b>관리자 › 발표자료</b>에서 발표 슬라이드를 만듭니다.</div>';
    }
    h += '</section>';

    items.forEach(function (s, i) {
      var inf = infoOf(s, st), cat = inf.cat;
      var mcId = MK.parseMakecode(s.makecodeUrl);
      var long = (s.desc || '').length > 170;
      h += '<section class="slide slide--body c-' + cat.color + '" id="show-' + s.id + '" data-section="' + sec + '" data-title="' + (i + 1) + '. ' + esc(s.title) + '">' +
        '<div class="sv-head"><div class="sv-head__tags"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(inf.label) + '</span><span class="tag">작품 ' + (i + 1) + ' / ' + N + '</span>' + (s.sample ? '<span class="sample-flag">샘플</span>' : '') + '</div>' +
        '<h2 class="sv-head__title">' + esc(s.title) + '</h2><p class="sv-head__who">' + esc(inf.sub) + '</p>' + (inf.sentence ? '<p class="sv-head__card">' + esc(inf.sentence) + '</p>' : '') + '</div>' +
        '<div class="sv-heart" data-widget="hearts" data-sub="' + esc(s.id) + '"></div>' +
        '<div class="sv-grid">' +
          '<div class="window sv-media"><div class="window__bar">작동 영상' + (MK.isHttpUrl(s.videoUrl) ? '<a class="sv-open" href="' + esc(s.videoUrl) + '" target="_blank" rel="noopener">새 창에서 열기 ' + ic('external') + '</a>' : '') + '</div><div class="window__body window__body--flush" style="aspect-ratio:16/9">' + media(s) + '</div></div>' +
          '<div class="window sv-code"><div class="window__bar">MakeCode 블록' +
            (mcId ? '<a class="sv-open" href="' + esc(s.makecodeUrl) + '" target="_blank" rel="noopener">MakeCode에서 열기 ' + ic('external') + '</a>' : '') + '</div>' +
            '<div class="window__body window__body--flush sv-code__body">' +
              (mcId ? '<button class="sv-code__view" data-mc="' + esc(mcId) + '" data-title="' + esc(s.title) + '" title="눌러서 크게 보기"><span class="sv-code__msg">블록을 불러오는 중…</span></button>'
                    : '<div class="sv-code__view is-empty"><span class="sv-code__msg">' + (s.sample ? '샘플 결과물 · MakeCode 주소가 없습니다' : 'MakeCode 주소가 없습니다') + '</span></div>') +
            '</div></div>' +
          '<div class="callout sv-desc"' + (long ? ' style="font-size:19px !important"' : '') + '>' + esc(s.desc || '') + '</div>' +
        '</div></section>';
    });
    return h;
  }
  generate.signature = function (st) {
    return JSON.stringify(MK.showcase.items(st).map(function (s) { var i = infoOf(s, st); return [s.id, s.title, s.name, s.desc, s.makecodeUrl, s.videoUrl, s.challengeId, s.sample, i.label, i.sub, i.sentence]; }));
  };
  MK.generators.showcase = generate;

  /* ---------- 영상은 그 슬라이드에 들어갈 때만 불러오기 ---------- */
  document.addEventListener('deck:enter', function (e) {
    $$('iframe[data-src], video[data-src]', e.detail.slide).forEach(function (f) { if (!f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-src')); });
  });
  document.addEventListener('deck:leave', function (e) {
    $$('iframe[data-src], video[data-src]', e.detail.slide).forEach(function (f) { f.removeAttribute('src'); if (f.tagName === 'VIDEO') f.load(); });
  });

  /* =========================================================
     MakeCode 블록 그림
     1) 공유 주소의 코드를 MakeCode에서 받아 오고 (api/<id>/text)
     2) MakeCode 공식 블록 렌더러(--docs?render=1)에 보내 블록 그림(PNG)을 받습니다
     한 번 그린 그림은 이 창을 닫을 때까지 기억합니다.
     ========================================================= */
  var MC = 'https://makecode.microbit.org';
  MK.mcBlocks = (function () {
    var frame = null, ready = false, queue = [], pending = {}, cache = {};
    function ensure() {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-20px;top:-20px;width:10px;height:10px;border:0;opacity:0;pointer-events:none';
      frame.src = MC + '/--docs?render=1&lang=ko';
      document.body.appendChild(frame);
    }
    function send(job) { frame.contentWindow.postMessage({ type: 'renderblocks', id: job.id, code: job.code, options: { packageId: job.id } }, MC + '/'); }
    window.addEventListener('message', function (ev) {
      var m = ev.data;
      if (!m || m.source !== 'makecode') return;
      if (m.type === 'renderready') { ready = true; queue.splice(0).forEach(send); }
      if (m.type === 'renderblocks' && pending[m.id]) {
        var p = pending[m.id]; delete pending[m.id];
        if (m.error || !m.uri) p.reject(new Error('블록을 그리지 못했어요'));
        else { cache[m.id] = { uri: m.uri, w: m.width, h: m.height }; p.resolve(cache[m.id]); }
      }
    });
    function render(id) {
      if (cache[id]) return Promise.resolve(cache[id]);
      if (pending[id]) return pending[id].promise;
      ensure();
      var p = {}; p.promise = new Promise(function (res, rej) { p.resolve = res; p.reject = rej; });
      pending[id] = p;
      fetch(MC + '/api/' + encodeURIComponent(id) + '/text').then(function (r) { if (!r.ok) throw new Error('공유 주소를 찾을 수 없어요'); return r.json(); })
        .then(function (files) {
          var job = { id: id, code: files['main.ts'] || '' };
          if (ready) send(job); else queue.push(job);
        })
        .catch(function (err) { if (pending[id] === p) { delete pending[id]; p.reject(err); } });
      setTimeout(function () { if (pending[id] === p) { delete pending[id]; p.reject(new Error('시간이 오래 걸려 멈췄어요')); } }, 40000);
      return p.promise;
    }
    return { render: render, cached: function (id) { return cache[id] || null; } };
  })();

  /* 창 안에 블록 전체가 들어가게, 원래 크기의 1.5배까지만 키움 */
  var MAX_UP = 1.5, PAD = 18;
  function fitSize(r, boxW, boxH) {
    var w = r.w || 400, h = r.h || 300;
    var k = Math.min(MAX_UP, (boxW - PAD * 2) / w, (boxH - PAD * 2) / h);
    return { w: Math.round(w * k), h: Math.round(h * k) };
  }
  function blockImg(r, boxW, boxH) {
    var f = fitSize(r, boxW, boxH);
    return '<span class="sv-code__img" role="img" aria-label="MakeCode 블록" style="background-image:url(\'' + r.uri + '\');background-size:' + f.w + 'px ' + f.h + 'px"></span>';
  }
  function fillBlocks(el) {
    var id = el.getAttribute('data-mc'); if (!id) return;
    var hit = MK.mcBlocks.cached(id);
    var put = function (r) {
      var bw = el.clientWidth || 748, bh = el.clientHeight || 392;
      el.innerHTML = blockImg(r, bw, bh) + '<span class="sv-code__zoom">' + ic('expand') + ' 크게 보기</span>';
      el.classList.add('is-ready');
    };
    if (hit) return put(hit);
    MK.mcBlocks.render(id).then(put, function (err) {
      el.classList.add('is-error');
      el.innerHTML = '<span class="sv-code__msg">' + esc(err.message || '블록을 불러오지 못했어요') + '<br><small>위의 \'MakeCode에서 열기\'로 볼 수 있어요</small></span>';
    });
  }
  // 발표회에 들어오면 모든 작품의 블록을 미리 그려 둡니다 (한 장씩 넘길 때 바로 보이도록)
  function prefetchAll() {
    Array.prototype.forEach.call(document.querySelectorAll('.sv-code__view[data-mc]'), function (el) { MK.mcBlocks.render(el.getAttribute('data-mc')).catch(function () {}); });
  }
  document.addEventListener('deck:enter', function (e) {
    var sl = e.detail.slide;
    if (!/^(s-show|show-)/.test(sl.id)) return;
    prefetchAll();
    $$('.sv-code__view[data-mc]:not(.is-ready)', sl).forEach(fillBlocks);
  });

  /* 크게 보기 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.sv-code__view.is-ready'); if (!b) return;
    var r = MK.mcBlocks.cached(b.getAttribute('data-mc')); if (!r) return;
    var d = document.createElement('dialog');
    d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box" style="width:min(1500px,96vw);max-height:92vh;display:flex;flex-direction:column;padding:20px">' +
      '<button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="modal__kicker">MakeCode 블록</div><h3 class="modal__title">' + esc(b.getAttribute('data-title')) + '</h3>' +
      '<div style="flex:1;min-height:0;overflow:auto;border:2px solid var(--line);border-radius:12px;background:#fff;padding:12px"><img src="' + r.uri + '" alt="MakeCode 블록" style="display:block;max-width:100%;height:auto;margin:0 auto"></div></div>';
    document.body.appendChild(d);
    d.querySelector('.modal__close').onclick = function () { d.close(); };
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  });

  /* =========================================================
     단일 HTML로 저장 — 인터넷이 불안할 때를 대비한 발표 파일
     (CSS·배경·폰트·사진을 파일 하나에 넣습니다. 영상은 인터넷이 있어야 재생됩니다)
     ========================================================= */
  function toDataUrl(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
    });
  }
  function inlineCss(path) {
    var base = path.replace(/[^/]+$/, '');
    // 화면에 실제로 붙어 있는 주소(버전 번호 포함)로 받아야 예전 파일이 섞이지 않음
    var link = document.querySelector('link[rel=stylesheet][href^="' + path + '"]');
    return fetch(link ? link.getAttribute('href') : path).then(function (r) { if (!r.ok) throw new Error(path); return r.text(); }).then(function (css) {
      css = css.replace(/,\s*url\('https:[^']+'\) format\('woff2'\)/g, ''); // CDN 예비 주소 빼기
      var urls = []; css.replace(/url\('(\.\.\/[^']+)'\)/g, function (m, u) { if (urls.indexOf(u) < 0) urls.push(u); });
      return Promise.all(urls.map(function (u) { return toDataUrl(base + u).then(function (d) { return [u, d]; }); })).then(function (pairs) {
        pairs.forEach(function (p) { css = css.split("url('" + p[0] + "')").join("url('" + p[1] + "')"); });
        return css;
      });
    });
  }

  MK.showcase.exportHtml = function () {
    var st = MK.store.getStateSync();
    if (!MK.showcase.items(st).length) return Promise.reject(new Error('발표에 넣은 작품이 없습니다.'));
    if (location.protocol === 'file:') return Promise.reject(new Error('파일을 직접 연 상태에서는 저장할 수 없습니다. 로컬 서버나 배포 주소로 열어 주세요.'));
    var holder = document.createElement('div'); holder.innerHTML = generate(st);
    var views = Array.prototype.slice.call(holder.querySelectorAll('.sv-code__view[data-mc]'));
    return Promise.all(views.map(function (v) {
      return MK.mcBlocks.render(v.getAttribute('data-mc')).then(function (r) {
        v.outerHTML = '<div class="sv-code__view is-ready">' + blockImg(r, 748, 392) + '</div>';
      }, function () { v.outerHTML = '<div class="sv-code__view is-empty"><span class="sv-code__msg">블록을 불러오지 못했어요</span></div>'; });
    })).then(function () {
    var slidesHtml = holder.innerHTML;
    var imgs = []; slidesHtml.replace(/url\((assets\/img\/[^)]+)\)/g, function (m, u) { if (imgs.indexOf(u) < 0) imgs.push(u); });
    return Promise.all([
      inlineCss('assets/css/tokens.css'), inlineCss('assets/css/components.css'), inlineCss('assets/css/deck.css'),
      Promise.all(imgs.map(function (u) { return toDataUrl(u).then(function (d) { return [u, d]; }); }))
    ]).then(function (r) {
      r[3].forEach(function (p) { slidesHtml = slidesHtml.split('url(' + p[0] + ')').join("url('" + p[1] + "')"); });
      var sprite = document.getElementById('mk-icon-sprite').outerHTML;
      var footer = esc(MK.config.session + ' · ' + MK.config.title);
      var doc = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>작품 발표회 · ' + esc(MK.config.session) + '</title><style>' + r[0] + r[1] + r[2] +
        '.nav{position:fixed;right:14px;bottom:14px;display:flex;gap:6px;font:800 14px var(--font)}.nav button{height:36px;padding:0 14px;border:2px solid var(--navy);border-radius:999px;background:#fff;color:var(--navy);font:inherit;cursor:pointer}.nav span{align-self:center;padding:0 8px;color:var(--navy)}</style></head>' +
        '<body class="deck-page">' + sprite + '<div class="deck-viewport"><div class="deck-stage" id="stage">' + slidesHtml + '</div></div>' +
        '<div class="nav"><button id="p">이전</button><span id="c"></span><button id="n">다음</button></div>' +
        '<script>(function(){var st=document.getElementById("stage"),S=[].slice.call(st.querySelectorAll(".slide")),i=0,F=' + JSON.stringify(footer) + ';' +
        'S.forEach(function(s,k){var f=document.createElement("div");f.className="slide__footer";f.innerHTML=F+"<b>"+(k+1)+"</b>";s.appendChild(f)});' +
        'function fit(){var w=innerWidth,h=innerHeight,s=Math.min(w/1920,h/1080);st.style.transform="translate("+(w-1920*s)/2+"px,"+(h-1080*s)/2+"px) scale("+s+")"}' +
        'function show(k){k=Math.max(0,Math.min(S.length-1,k));[].forEach.call(S[i].querySelectorAll("[data-src]"),function(f){f.removeAttribute("src")});S[i].classList.remove("is-active");i=k;S[i].classList.add("is-active");[].forEach.call(S[i].querySelectorAll("[data-src]"),function(f){f.src=f.getAttribute("data-src")});document.getElementById("c").textContent=(i+1)+" / "+S.length}' +
        'addEventListener("resize",fit);fit();show(0);document.getElementById("p").onclick=function(){show(i-1)};document.getElementById("n").onclick=function(){show(i+1)};' +
        'addEventListener("keydown",function(e){if(["ArrowRight","PageDown"," "].indexOf(e.key)>=0){e.preventDefault();show(i+1)}if(["ArrowLeft","PageUp"].indexOf(e.key)>=0){e.preventDefault();show(i-1)}});' +
        'st.addEventListener("click",function(e){var g=e.target.closest("[data-goto]");if(g){var id=g.getAttribute("data-goto");S.forEach(function(s,k){if(s.id===id)show(k)})}})})();<\/script></body></html>';
      var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '작품발표회-' + new Date().toISOString().slice(0, 10) + '.html';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
      return true;
    });
    });
  };
})();
