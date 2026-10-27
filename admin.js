/* ==========================================================================
   The Shelf: "Add" page.
   Saves a new entry straight to your GitHub repository:
     1. uploads the cover image to covers/
     2. adds the entry to the top of its list in data.js
   It talks to GitHub with a fine-grained personal access token that is kept
   in this browser only. Without that token, this page can't change anything.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var TYPES = {
    books:  { label: 'Book',  dateKey: 'finished', dateLabel: 'Finished', byKey: 'author',   keys: ['title', 'author', 'cover', 'finished', 'rating', 'take', 'link'] },
    films:  { label: 'Film',  dateKey: 'watched',  dateLabel: 'Watched',  byKey: 'director', keys: ['title', 'director', 'year', 'cover', 'watched', 'rating', 'take', 'link'] },
    videos: { label: 'Video', dateKey: 'watched',  dateLabel: 'Watched',  byKey: 'channel',  keys: ['title', 'channel', 'url', 'watched', 'rating', 'take', 'link'] }
  };
  var LISTS = ['books', 'films', 'videos'];

  /* ---------- storage: settings in localStorage, token in local or session storage ---------- */
  var K = { owner: 'shelf.owner', repo: 'shelf.repo', branch: 'shelf.branch', token: 'shelf.token' };
  function sget(k) {
    try { return sessionStorage.getItem(k) || localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function sset(k, v, remember) {
    try {
      if (remember) { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
      else { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
    } catch (e) { /* storage blocked: the token only lives until the page closes */ }
  }
  function sdel(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }

  var cfg = { owner: '', repo: '', branch: 'main', token: '' };
  var state = { type: 'books', shelf: null, image: null, thumbUrl: '', busy: false, justAdded: null, urlSeq: 0 };

  /* ---------- small helpers ---------- */
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }
  function ytId(url) {
    var m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function setStatus(el, msg, kind) {
    el.className = 'status' + (kind ? ' ' + kind : '');
    el.textContent = msg || '';
  }
  function b64FromBytes(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64FromText(t) { return b64FromBytes(new TextEncoder().encode(t)); }
  function textFromB64(b) {
    var bin = atob(String(b).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function blobToB64(blob) {
    return blob.arrayBuffer().then(function (buf) { return b64FromBytes(new Uint8Array(buf)); });
  }

  /* ---------- colors (same idea as the site: the 3–4 main colors of the cover) ---------- */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function pickInk(bg) { var L = luminance(bg); return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.06) ? '#f6f2ea' : '#161412'; }
  function extractPalette(source) {
    var S = 48, c = document.createElement('canvas');
    c.width = S; c.height = S;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, S, S);
    var d = ctx.getImageData(0, 0, S, S).data, buckets = {};
    for (var i = 0; i < d.length; i += 4) {
      var key = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
      var b = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    var list = Object.keys(buckets).map(function (k) { var b = buckets[k]; return { n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }; })
      .sort(function (a, b) { return b.n - a.n; });
    var picks = [];
    list.forEach(function (c) {
      var best = -1, bestD = Infinity;
      picks.forEach(function (p, j) {
        var dd = Math.sqrt(Math.pow(p.r - c.r, 2) + Math.pow(p.g - c.g, 2) + Math.pow(p.b - c.b, 2));
        if (dd < bestD) { bestD = dd; best = j; }
      });
      if (best >= 0 && bestD < 60) {
        var p = picks[best], t = p.n + c.n;
        p.r = (p.r * p.n + c.r * c.n) / t; p.g = (p.g * p.n + c.g * c.n) / t; p.b = (p.b * p.n + c.b * c.n) / t; p.n = t;
      } else if (picks.length < 4) picks.push({ n: c.n, r: c.r, g: c.g, b: c.b });
      else picks[best].n += c.n;
    });
    picks.sort(function (a, b) { return b.n - a.n; });
    var total = picks.reduce(function (s, p) { return s + p.n; }, 0) || 1;
    return picks.map(function (p) { return [rgbToHex(p.r, p.g, p.b), Math.round(p.n / total * 100)]; }).filter(function (p) { return p[1] > 0; });
  }

  /* ---------- GitHub API ---------- */
  function repoPath() { return '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo); }
  function contentsPath(p) { return repoPath() + '/contents/' + p.split('/').map(encodeURIComponent).join('/'); }

  function explain(status, data, what) {
    var msg = data && data.message ? ' (GitHub says: ' + data.message + ')' : '';
    if (status === 401) return 'GitHub didn\'t accept the token. It may be mistyped or expired. Open Connection and paste a fresh one.';
    if (status === 403) return 'The token can\'t write to this repository. Make sure it has access to this repository with Contents set to "Read and write"' + msg + '.';
    if (status === 404) return 'Couldn\'t find ' + (what || 'that') + '. Check the username, repository and branch, and that the token has access to this repository.';
    if (status === 409) return 'data.js changed on GitHub while saving. Try again.';
    if (status === 422) return 'GitHub rejected the change' + msg + '.';
    return 'GitHub returned an error (' + status + ')' + msg + '.';
  }

  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      'Accept': opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'Authorization': 'Bearer ' + cfg.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: opts.method || 'GET', headers: headers, cache: 'no-store',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).catch(function () {
      throw new Error('Couldn\'t reach GitHub. Check your internet connection and try again.');
    }).then(function (res) {
      var parse = opts.raw && res.ok ? res.text() : res.json().catch(function () { return null; });
      return parse.then(function (data) {
        if (!res.ok) { var e = new Error(explain(res.status, data, opts.what)); e.status = res.status; throw e; }
        return data;
      });
    });
  }

  function ref() { return '?ref=' + encodeURIComponent(cfg.branch); }

  function loadShelf() {
    return gh(contentsPath('data.js') + ref(), { what: 'data.js' }).then(function (f) {
      var textP = f.content && f.encoding === 'base64'
        ? Promise.resolve(textFromB64(f.content))
        : gh(contentsPath('data.js') + ref(), { raw: true, what: 'data.js' });
      return textP.then(function (text) {
        var box = {};
        try { new Function('window', text)(box); }
        catch (e) { throw new Error('data.js has a typo, so it can\'t be read (' + e.message + '). Fix it on GitHub, or undo the last change there, then try again.'); }
        if (!box.SHELF || typeof box.SHELF !== 'object') throw new Error('data.js doesn\'t contain a shelf (window.SHELF). Did it get replaced?');
        state.shelf = box.SHELF;
        return { data: box.SHELF, sha: f.sha };
      });
    });
  }

  function putFile(path, b64, message, sha) {
    var body = { message: message, content: b64, branch: cfg.branch };
    if (sha) body.sha = sha;
    return gh(contentsPath(path), { method: 'PUT', body: body, what: path });
  }

  function freePath(base) {
    var dot = base.lastIndexOf('.'), stem = base.slice(0, dot), ext = base.slice(dot);
    function tryN(n) {
      var p = n === 1 ? base : stem + '-' + n + ext;
      return gh(contentsPath(p) + ref()).then(function () {
        if (n > 40) throw new Error('Too many covers with this name already.');
        return tryN(n + 1);
      }, function (e) { if (e.status === 404) return p; throw e; });
    }
    return tryN(1);
  }

  /* ---------- writing data.js back out ---------- */
  var HEADER = [
    '/* ==========================================================================',
    '   THE SHELF: your content lives in this file.',
    '',
    '   Easiest: add things with the form at  <your site>/admin.html',
    '',
    '   By hand: put the cover in "covers", copy an entry below, paste it at the',
    '   TOP of its list and change the values. Keep the comma between entries.',
    '   Dates are year-month, like "2026-08". Ratings are 1 to 5.',
    '   Videos only need the YouTube link (url): the thumbnail is fetched for you.',
    '',
    '   site.background      the background image (replace assets/background.jpg)',
    '   site.backgroundDim   0 = image at full strength, 1 = fully dark',
    '   ========================================================================== */',
    ''
  ].join('\n');

  function keyJS(k) { return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k); }
  function valJS(v) { return (typeof v === 'number' || typeof v === 'boolean') ? String(v) : JSON.stringify(v); }
  function objJS(o, order, indent) {
    var pad = new Array(indent + 1).join(' ');
    var keys = order.filter(function (k) { return Object.prototype.hasOwnProperty.call(o, k); })
      .concat(Object.keys(o).filter(function (k) { return order.indexOf(k) < 0; }))
      .filter(function (k) { return o[k] !== undefined && o[k] !== null && o[k] !== ''; });
    return pad + '{\n' + keys.map(function (k) { return pad + '  ' + keyJS(k) + ': ' + valJS(o[k]); }).join(',\n') + '\n' + pad + '}';
  }
  function serialize(d) {
    var parts = ['  site: ' + objJS(d.site || {}, ['title', 'tagline', 'background', 'backgroundDim'], 2).replace(/^\s+/, '')];
    LISTS.forEach(function (k) {
      var arr = Array.isArray(d[k]) ? d[k] : [];
      parts.push('  ' + k + ': [' + (arr.length ? '\n' + arr.map(function (e) { return objJS(e, TYPES[k].keys, 4); }).join(',\n') + '\n  ]' : ']'));
    });
    Object.keys(d).forEach(function (k) {
      if (k === 'site' || LISTS.indexOf(k) >= 0) return;
      parts.push('  ' + keyJS(k) + ': ' + JSON.stringify(d[k], null, 2).replace(/\n/g, '\n  '));
    });
    return HEADER + '\nwindow.SHELF = {\n' + parts.join(',\n\n') + '\n};\n';
  }

  /* ---------- UI: connection ---------- */
  var settingsEl = $('#settings'), formEl = $('#form'), connStatus = $('#connStatus'), saveStatus = $('#saveStatus');

  function guessRepo() {
    var m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return { owner: '', repo: '' };
    var seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m[1], repo: seg && !/\.html?$/i.test(seg) ? seg : location.hostname.toLowerCase() };
  }

  function showSettings(msg, kind) {
    settingsEl.hidden = false;
    formEl.hidden = true;
    $('#openSettings').hidden = !state.shelf;
    $('#owner').value = cfg.owner; $('#repo').value = cfg.repo; $('#branch').value = cfg.branch || 'main';
    $('#token').value = cfg.token ? cfg.token : '';
    setStatus(connStatus, msg, kind);
  }

  function showForm() {
    settingsEl.hidden = true;
    formEl.hidden = false;
    $('#openSettings').hidden = false;
    $('#connLine').textContent = 'Saving to ' + cfg.owner + '/' + cfg.repo + ' · ' + cfg.branch;
    renderRecent();
    checkDup();
  }

  function connect(silent) {
    var btn = $('#connect');
    if (!silent) {
      cfg.owner = $('#owner').value.trim();
      cfg.repo = $('#repo').value.trim().replace(/\.git$/, '');
      cfg.branch = $('#branch').value.trim() || 'main';
      cfg.token = $('#token').value.trim();
      if (!cfg.owner || !cfg.repo || !cfg.token) { setStatus(connStatus, 'Fill in your username, repository and token.', 'err'); return Promise.resolve(); }
      btn.disabled = true;
      setStatus(connStatus, 'Checking…');
    }
    return gh(repoPath(), { what: 'the repository ' + cfg.owner + '/' + cfg.repo })
      .then(loadShelf)
      .then(function () {
        try {
          localStorage.setItem(K.owner, cfg.owner);
          localStorage.setItem(K.repo, cfg.repo);
          localStorage.setItem(K.branch, cfg.branch);
        } catch (e) {}
        if (!silent) sset(K.token, cfg.token, $('#remember').checked);
        showForm();
      })
      .catch(function (e) {
        if (e.status === 401) { sdel(K.token); cfg.token = ''; }
        showSettings(e.message, 'err');
      })
      .then(function () { btn.disabled = false; });
  }

  $('#connect').addEventListener('click', function () { connect(false); });
  $('#token').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); connect(false); } });
  $('#forget').addEventListener('click', function () {
    sdel(K.token); cfg.token = ''; $('#token').value = '';
    setStatus(connStatus, 'Token removed from this browser.', 'ok');
  });
  $('#openSettings').addEventListener('click', function () {
    if (settingsEl.hidden) showSettings('');
    else if (state.shelf) showForm();
  });

  /* ---------- UI: form ---------- */
  var F = {
    url: $('#url'), title: $('#title'), author: $('#author'), director: $('#director'), year: $('#year'),
    channel: $('#channel'), cover: $('#cover'), date: $('#date'), take: $('#take')
  };

  function setType(t) {
    state.type = t;
    $$('.seg-b').forEach(function (b) {
      var on = b.getAttribute('data-type') === t;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('[data-for]').forEach(function (el) {
      el.hidden = el.getAttribute('data-for').split(' ').indexOf(t) < 0;
    });
    $('#dateLabel').textContent = TYPES[t].dateLabel;
    $('#pvCover').classList.toggle('wide', t === 'videos');
    setStatus(saveStatus, '');
    clearInvalid();
    renderPreview();
    renderRecent();
    checkDup();
  }
  $$('.seg-b').forEach(function (b) { b.addEventListener('click', function () { setType(b.getAttribute('data-type')); }); });

  function currentPalette() {
    if (state.type !== 'videos' && state.image) return state.image.pal;
    return null;
  }

  function renderPreview() {
    var cover = $('#pvCover'), empty = $('#pvEmpty');
    var old = cover.querySelector('img');
    var src = state.type === 'videos' ? state.thumbUrl : (state.image ? state.image.url : '');
    if (old && old.getAttribute('src') !== src) old.remove();
    if (src && !cover.querySelector('img')) {
      var im = document.createElement('img');
      im.alt = '';
      im.referrerPolicy = 'no-referrer';
      im.onerror = function () { im.remove(); empty.hidden = false; };
      im.src = src;
      cover.appendChild(im);
    }
    empty.hidden = !!src;
    empty.textContent = state.type === 'videos' ? 'Paste a YouTube link' : 'No cover yet';

    var pal = currentPalette();
    var spine = $('#pvSpine'), hist = $('#pvHist'), palEl = $('#pvPal');
    $('#pvTitle').textContent = F.title.value.trim() || 'Title';
    if (pal && pal.length) {
      var acc = 0;
      var bands = 'linear-gradient(90deg, ' + pal.map(function (p) { var a = acc; acc += p[1]; return p[0] + ' ' + a + '% ' + acc + '%'; }).join(', ') + ')';
      spine.style.background = pal[0][0];
      spine.style.color = pickInk(pal[0][0]);
      hist.style.background = bands;
      palEl.innerHTML = '';
      pal.forEach(function (p) {
        var s = document.createElement('span');
        s.style.background = p[0];
        s.style.setProperty('--w', p[1]);
        s.title = p[0] + ' · ' + p[1] + '%';
        palEl.appendChild(s);
      });
    } else {
      spine.style.background = ''; spine.style.color = ''; hist.style.background = '';
      palEl.innerHTML = '';
    }
  }

  function renderRecent() {
    var ol = $('#recent');
    ol.innerHTML = '';
    var list = state.shelf && Array.isArray(state.shelf[state.type]) ? state.shelf[state.type].slice(0, 5) : [];
    if (!list.length) {
      var li = document.createElement('li');
      li.innerHTML = '<small>Nothing here yet.</small>';
      ol.appendChild(li);
      return;
    }
    var t = TYPES[state.type];
    list.forEach(function (e, i) {
      var li = document.createElement('li');
      if (i === 0 && state.justAdded === e) li.className = 'new';
      var b = document.createElement('b'); b.textContent = e.title || '(untitled)';
      var s = document.createElement('small');
      s.textContent = [e[t.byKey], e[t.dateKey]].filter(Boolean).join(' · ');
      li.appendChild(b); li.appendChild(s);
      ol.appendChild(li);
    });
  }

  function checkDup() {
    var v = F.title.value.trim().toLowerCase();
    var list = state.shelf && Array.isArray(state.shelf[state.type]) ? state.shelf[state.type] : [];
    $('#dup').hidden = !v || !list.some(function (e) { return String(e.title || '').trim().toLowerCase() === v; });
  }

  F.title.addEventListener('input', function () { renderPreview(); checkDup(); F.title.removeAttribute('aria-invalid'); });

  /* cover image: read, shrink, get its colors */
  function prepImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('Use a JPG, PNG or WebP image.'));
    var url = URL.createObjectURL(file);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('That image couldn\'t be opened.')); };
      img.src = url;
    }).then(function (img) {
      var MAX = 1000, k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (blob) {
          if (!blob) return reject(new Error('Couldn\'t process that image.'));
          resolve({ blob: blob, url: URL.createObjectURL(blob), pal: extractPalette(c) });
        }, 'image/jpeg', 0.86);
      });
    }, function (e) { URL.revokeObjectURL(url); throw e; });
  }

  function useFile(file) {
    if (!file) return;
    $('#dropText').textContent = 'Reading ' + file.name + '…';
    prepImage(file).then(function (im) {
      if (state.image) URL.revokeObjectURL(state.image.url);
      state.image = im;
      $('#dropText').textContent = file.name + ' · change';
      renderPreview();
    }, function (e) {
      $('#dropText').textContent = 'Choose an image, or drop it here';
      F.cover.value = '';
      setStatus(saveStatus, e.message, 'err');
    });
  }
  F.cover.addEventListener('change', function () { useFile(F.cover.files && F.cover.files[0]); });
  var drop = $('#drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) useFile(f);
  });

  /* YouTube link: show the thumbnail and try to fill in title and channel */
  function fetchVideoMeta(u) {
    var tries = [
      'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u),
      'https://noembed.com/embed?url=' + encodeURIComponent(u)
    ];
    function next(i) {
      if (i >= tries.length) return Promise.resolve(null);
      return fetch(tries[i]).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        .then(function (j) { return j && j.title ? j : next(i + 1); });
    }
    return next(0);
  }
  function onUrl() {
    var id = ytId(F.url.value);
    state.thumbUrl = id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
    F.url.removeAttribute('aria-invalid');
    renderPreview();
    if (!id) return;
    var seq = ++state.urlSeq;
    fetchVideoMeta(F.url.value.trim()).then(function (meta) {
      if (!meta || seq !== state.urlSeq) return;
      if (!F.title.value.trim() && meta.title) { F.title.value = meta.title; renderPreview(); checkDup(); }
      if (!F.channel.value.trim() && meta.author_name) F.channel.value = meta.author_name;
    });
  }
  F.url.addEventListener('change', onUrl);
  F.url.addEventListener('paste', function () { setTimeout(onUrl, 0); });

  /* ---------- collect + validate ---------- */
  function clearInvalid() { $$('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); }); }
  function fail(el, msg) {
    el.setAttribute('aria-invalid', 'true');
    el.focus();
    setStatus(saveStatus, msg, 'err');
    return null;
  }
  function collect() {
    clearInvalid();
    var t = state.type, T = TYPES[t];
    var e = {};
    if (t === 'videos') {
      if (!ytId(F.url.value)) return fail(F.url, 'Paste a YouTube link (youtube.com/watch?v=… or youtu.be/…).');
    }
    var title = F.title.value.trim();
    if (!title) return fail(F.title, 'Give it a title.');
    e.title = title;
    if (t === 'books' && F.author.value.trim()) e.author = F.author.value.trim();
    if (t === 'films') {
      if (F.director.value.trim()) e.director = F.director.value.trim();
      var y = F.year.value.trim();
      if (y) {
        if (!/^\d{4}$/.test(y)) return fail(F.year, 'Release year should be four digits, like 2014.');
        e.year = +y;
      }
    }
    if (t === 'videos') {
      if (F.channel.value.trim()) e.channel = F.channel.value.trim();
      e.url = F.url.value.trim();
    }
    var d = F.date.value.trim();
    if (d) {
      if (!/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(d)) return fail(F.date, 'Use year-month, like ' + thisMonth() + '.');
      e[T.dateKey] = d;
    }
    var r = +(($('input[name=rating]:checked') || {}).value || 0);
    if (r) e.rating = r;
    var take = F.take.value.trim();
    if (take) e.take = take;
    return e;
  }

  function resetForm() {
    ['url', 'title', 'author', 'director', 'year', 'channel', 'take'].forEach(function (k) { F[k].value = ''; });
    F.date.value = thisMonth();
    F.cover.value = '';
    $('input[name=rating][value="0"]').checked = true;
    if (state.image) URL.revokeObjectURL(state.image.url);
    state.image = null; state.thumbUrl = '';
    $('#dropText').textContent = 'Choose an image, or drop it here';
    renderPreview(); checkDup();
  }

  /* ---------- save ---------- */
  formEl.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (state.busy) return;
    var entry = collect();
    if (!entry) return;
    var type = state.type, T = TYPES[type];
    var btn = $('#save');
    state.busy = true; btn.disabled = true;
    setStatus(saveStatus, 'Reading your shelf…');

    var coverDone = Promise.resolve();
    var uploadedCover = '';
    if (type !== 'videos' && state.image) {
      coverDone = freePath('covers/' + slugify(entry.title) + '.jpg').then(function (path) {
        setStatus(saveStatus, 'Uploading cover…');
        return blobToB64(state.image.blob).then(function (b64) {
          return putFile(path, b64, 'Add cover: ' + entry.title);
        }).then(function () { uploadedCover = path; entry.cover = path; });
      });
    }

    function saveEntry(attempt) {
      return loadShelf().then(function (res) {
        var data = JSON.parse(JSON.stringify(res.data));
        if (!Array.isArray(data[type])) data[type] = [];
        data[type].unshift(entry);
        setStatus(saveStatus, 'Saving to data.js…');
        return putFile('data.js', b64FromText(serialize(data)), 'Add ' + T.label.toLowerCase() + ': ' + entry.title, res.sha)
          .then(function () { state.shelf = data; });
      }).catch(function (e) {
        if ((e.status === 409 || e.status === 422) && attempt < 2) return saveEntry(attempt + 1);
        throw e;
      });
    }

    coverDone.then(function () { return saveEntry(0); }).then(function () {
      state.justAdded = entry;
      var link = new URL('./#' + type + '/' + slugify(entry.title), location.href).href;
      saveStatus.className = 'status ok';
      saveStatus.textContent = 'Added "' + entry.title + '". It goes live in a minute or two. ';
      var a = document.createElement('a');
      a.href = link; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'See it on your shelf';
      saveStatus.appendChild(a);
      resetForm();
      renderRecent();
    }).catch(function (e) {
      var msg = e.message;
      if (uploadedCover) msg += ' The cover was already uploaded to ' + uploadedCover + '; saving again will add a second copy, which is harmless.';
      setStatus(saveStatus, msg, 'err');
      if (e.status === 401) showSettings(e.message, 'err');
    }).then(function () {
      state.busy = false; btn.disabled = false;
    });
  });

  /* ---------- start ---------- */
  var g = guessRepo();
  try {
    cfg.owner = localStorage.getItem(K.owner) || g.owner;
    cfg.repo = localStorage.getItem(K.repo) || g.repo;
    cfg.branch = localStorage.getItem(K.branch) || 'main';
  } catch (e) { cfg.owner = g.owner; cfg.repo = g.repo; }
  cfg.token = sget(K.token);
  F.date.value = thisMonth();
  setType('books');

  if (cfg.owner && cfg.repo && cfg.token) {
    showSettings('Connecting…');
    connect(true);
  } else {
    showSettings('');
  }
})();
