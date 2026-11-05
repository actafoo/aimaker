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

  function media(s) {
    var v = MK.showcase.video(s.videoUrl);
    var img = MK.challengeImage(s.challengeId);
    if (v && v.kind === 'iframe') return '<iframe data-src="' + esc(v.src) + '" title="' + esc(s.title) + ' 작동 영상" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    if (v && v.kind === 'video') return '<video data-src="' + esc(v.src) + '" controls playsinline></video>';
    return '<div class="sv-media__fallback" style="background-image:url(' + img + ')">' +
      (v ? '<a class="btn" href="' + esc(v.src) + '" target="_blank" rel="noopener">' + ic('play') + ' 영상 열기</a><div class="sv-media__note">새 창에서 재생됩니다</div>'
         : '<div class="sv-media__note">' + (s.sample ? '샘플 결과물 · 영상이 없습니다' : '영상 주소가 없습니다') + '</div>') + '</div>';
  }

  /* ---------- 슬라이드 만들기 ---------- */
  function generate(st) {
    var items = MK.showcase.items(st), N = items.length;
    var sec = '4. 작품 발표회';
    var h = '<section class="slide slide--pastel" id="s-show" data-section="' + sec + '" data-title="작품 발표회">' +
      '<div class="show-cover"><span class="divider__part">PART 4</span><h2 class="show-cover__title">작품 발표회</h2>' +
      '<p class="show-cover__text">' + (N ? N + '개의 작품을 함께 봅니다. 작품을 누르면 바로 이동합니다.' : '아직 발표할 작품이 없습니다.') + '</p></div>';
    if (N) {
      h += '<div class="show-grid">';
      items.slice(0, 25).forEach(function (s, i) {
        var cat = MK.catOf(MK.challengeById(s.challengeId));
        h += '<button class="show-tile c-' + cat.color + '" data-goto="show-' + s.id + '"><span class="show-tile__n">' + (i + 1) + ' · ' + esc(s.name) + '</span><span class="show-tile__t">' + esc(s.title) + '</span></button>';
      });
      if (N > 25) h += '<div class="show-tile" style="background:#fff"><span class="show-tile__t">외 ' + (N - 25) + '개</span></div>';
      h += '</div>';
    } else {
      h += '<div class="show-empty dashed t-md" style="text-align:center">연수생이 결과물을 제출하면 관리자가 <b>관리자 › 발표자료</b>에서 발표 슬라이드를 만듭니다.</div>';
    }
    h += '</section>';

    items.forEach(function (s, i) {
      var ch = MK.challengeById(s.challengeId) || MK.challenges[0], cat = MK.catOf(ch);
      var mcId = MK.parseMakecode(s.makecodeUrl);
      var long = (s.desc || '').length > 150;
      h += '<section class="slide slide--body c-' + cat.color + '" id="show-' + s.id + '" data-section="' + sec + '" data-title="' + (i + 1) + '. ' + esc(s.title) + '">' +
        '<div class="sv-head"><div class="sv-head__tags"><span class="tag tag--solid c-' + cat.color + '">' + ic(cat.icon) + ' ' + esc(ch.category) + '</span><span class="tag">작품 ' + (i + 1) + ' / ' + N + '</span>' + (s.sample ? '<span class="sample-flag">샘플</span>' : '') + '</div>' +
        '<h2 class="sv-head__title">' + esc(s.title) + '</h2><p class="sv-head__who">' + esc(s.name) + ' · ' + esc(ch.title) + '</p></div>' +
        '<div class="sv-grid">' +
          '<div class="window sv-media"><div class="window__bar">작동 영상' + (MK.isHttpUrl(s.videoUrl) ? '<a class="sv-open" href="' + esc(s.videoUrl) + '" target="_blank" rel="noopener">새 창에서 열기 ' + ic('external') + '</a>' : '') + '</div><div class="window__body window__body--flush" style="aspect-ratio:16/9">' + media(s) + '</div></div>' +
          '<div class="sv-side">' +
            '<div class="bubble sv-desc"' + (long ? ' style="font-size:22px !important"' : '') + '>' + esc(s.desc || '') + '</div>' +
            '<div class="sv-links">' +
              (mcId ? '<a class="btn btn--ghost btn--sm" href="' + esc(s.makecodeUrl) + '" target="_blank" rel="noopener">' + ic('code') + ' MakeCode 열기</a><button class="btn btn--sm" data-code="' + esc(mcId) + '" data-title="' + esc(s.title) + '">' + ic('box') + ' 블록 보기</button>' : '<span class="t-sm t-muted">MakeCode 주소 없음</span>') +
            '</div>' +
          '</div>' +
        '</div></section>';
    });
    return h;
  }
  generate.signature = function (st) {
    return JSON.stringify(MK.showcase.items(st).map(function (s) { return [s.id, s.title, s.name, s.desc, s.makecodeUrl, s.videoUrl, s.challengeId, s.sample]; }));
  };
  MK.generators.showcase = generate;

  /* ---------- 영상은 그 슬라이드에 들어갈 때만 불러오기 ---------- */
  document.addEventListener('deck:enter', function (e) {
    $$('iframe[data-src], video[data-src]', e.detail.slide).forEach(function (f) { if (!f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-src')); });
  });
  document.addEventListener('deck:leave', function (e) {
    $$('iframe[data-src], video[data-src]', e.detail.slide).forEach(function (f) { f.removeAttribute('src'); if (f.tagName === 'VIDEO') f.load(); });
  });

  /* ---------- 블록 보기: MakeCode 코드 임베드 ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-code]'); if (!b) return;
    var id = b.getAttribute('data-code');
    var d = document.createElement('dialog');
    d.className = 'modal ui';
    d.innerHTML = '<div class="modal__box" style="width:min(1100px,94vw);height:min(760px,90vh);display:flex;flex-direction:column;padding:20px">' +
      '<button type="button" class="icon-btn modal__close" aria-label="닫기">' + ic('x') + '</button>' +
      '<div class="modal__kicker">MakeCode 블록</div><h3 class="modal__title">' + esc(b.getAttribute('data-title')) + '</h3>' +
      '<iframe style="flex:1;width:100%;border:2px solid var(--line);border-radius:12px" src="https://makecode.microbit.org/---codeembed#pub:' + encodeURIComponent(id) + '" sandbox="allow-popups allow-forms allow-scripts allow-same-origin" title="MakeCode 블록"></iframe></div>';
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
    return fetch(path).then(function (r) { if (!r.ok) throw new Error(path); return r.text(); }).then(function (css) {
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
    Array.prototype.forEach.call(holder.querySelectorAll('[data-code]'), function (b) { b.remove(); }); // 블록 보기는 교안에서만
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
  };
})();
