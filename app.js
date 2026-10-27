/* ==========================================================================
   The Shelf: app logic. You shouldn't need to edit this file;
   add your books, films and videos in data.js instead.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SHELF;
  var $ = function (sel) { return document.querySelector(sel); };
  var stackEl = $('#stack');
  var detailEl = $('#detail');

  if (!CFG || typeof CFG !== 'object') {
    stackEl.innerHTML = '<div class="oops"><strong>The shelf could not read <code>data.js</code>.</strong><br>' +
      'This is almost always a missing comma, quote or bracket in the last thing you edited. ' +
      'Open the browser console (F12) to see the line number.</div>';
    return;
  }

  var TABS = {
    books:  { type: 'book',  label: 'Books',  kind: 'Book',  verb: 'Finished', dateKey: 'finished', byKey: 'author' },
    films:  { type: 'film',  label: 'Films',  kind: 'Film',  verb: 'Watched',  dateKey: 'watched',  byKey: 'director' },
    videos: { type: 'video', label: 'Videos', kind: 'Video', verb: 'Watched',  dateKey: 'watched',  byKey: 'channel' }
  };
  var ORDER = ['books', 'films', 'videos'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Stand-in palettes, used until a cover's colors are read (or when there is no cover). */
  var FALLBACK = [
    [['#c8742c', 45], ['#e9c27a', 25], ['#3b1f12', 20], ['#7a2f17', 10]],
    [['#f1ece1', 50], ['#1d2a44', 25], ['#d9a521', 15], ['#8b8b8b', 10]],
    [['#26323b', 50], ['#c9d3d6', 25], ['#b8442f', 15], ['#5d7380', 10]],
    [['#0f1b33', 45], ['#f0b43c', 25], ['#2f6f8f', 20], ['#e8e2d0', 10]],
    [['#e8ddc6', 45], ['#a33a2a', 25], ['#2d2a26', 20], ['#c9a873', 10]],
    [['#a8231d', 50], ['#111111', 30], ['#e9e3d6', 20]],
    [['#2f6f6a', 40], ['#e4c9a0', 25], ['#b0412e', 20], ['#1b2d2b', 15]],
    [['#d9dcd8', 45], ['#5f6b70', 30], ['#1f2326', 15], ['#9fb1b5', 10]],
    [['#07140c', 55], ['#2fbf5b', 25], ['#0f3a1e', 12], ['#b8f5c8', 8]],
    [['#1c1446', 45], ['#f26b5b', 25], ['#3ec7c2', 20], ['#ffd56b', 10]]
  ];

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u || /^(javascript|data|vbscript):/i.test(u)) return '';
    return u;
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }
  function parseDate(v) {
    var m = String(v || '').match(/^(\d{4})(?:-(\d{1,2}))?/);
    if (!m) return { y: 0, m: 0, key: 0, label: '' };
    var y = +m[1], mo = m[2] ? Math.min(12, Math.max(1, +m[2])) : 0;
    return { y: y, m: mo, key: y * 13 + mo, label: (mo ? MONTHS[mo - 1] + ' ' : '') + y };
  }
  function ytId(url) {
    var m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function stars(r) {
    if (!r) return '';
    return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
  }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }
  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function pickInk(bg) {
    var L = luminance(bg);
    return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.06) ? '#f6f2ea' : '#161412';
  }
  function bands(pal, dir) {
    var acc = 0;
    return 'linear-gradient(' + dir + ', ' + pal.map(function (p) {
      var a = acc; acc += p[1];
      return p[0] + ' ' + a + '% ' + acc + '%';
    }).join(', ') + ')';
  }
  function artFor(type, pal, v) {
    var c1 = pal[0][0], c2 = (pal[1] || pal[0])[0], c3 = (pal[2] || pal[1] || pal[0])[0], c4 = (pal[3] || pal[1] || pal[0])[0];
    if (type === 'video') return 'radial-gradient(circle at 28% 42%, ' + c2 + ' 0 18%, transparent 19%), radial-gradient(circle at 76% 68%, ' + c3 + ' 0 12%, transparent 13%), linear-gradient(135deg, ' + c1 + ', ' + c4 + ')';
    if (v === 1) return 'linear-gradient(155deg, transparent 0 52%, ' + c3 + ' 52% 56%, transparent 56%), radial-gradient(ellipse 90% 55% at 50% 100%, ' + c2 + ' 0 60%, transparent 61%), ' + c1;
    if (v === 2) return 'radial-gradient(circle at 50% 56%, ' + c3 + ' 0 16%, ' + c2 + ' 16% 18%, transparent 18.5%), linear-gradient(90deg, ' + c1 + ' 0 86%, ' + c4 + ' 86% 88%, ' + c1 + ' 88% 100%)';
    return 'radial-gradient(circle at 68% 36%, ' + c2 + ' 0 22%, transparent 22.5%), linear-gradient(180deg, ' + c1 + ' 0 62%, ' + c3 + ' 62% 70%, ' + c1 + ' 70% 100%)';
  }

  /* ---------- palette cache (so colors are read from each cover only once) ---------- */
  var CACHE_KEY = 'shelf-palettes-v1';
  var palCache = {};
  try { palCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { palCache = {}; }
  function savePal(src, pal) {
    palCache[src] = pal;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(palCache)); } catch (e) { /* storage full or blocked */ }
  }

  /* ---------- read the 3–4 dominant colors of an image ---------- */
  function extractPalette(img, isThumb) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    var S = 48, c = document.createElement('canvas');
    c.width = S; c.height = S;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    var sy = isThumb ? h * 0.125 : 0, sh = isThumb ? h * 0.75 : h; // YouTube thumbnails have black bars
    ctx.drawImage(img, 0, sy, w, sh, 0, 0, S, S);
    var d = ctx.getImageData(0, 0, S, S).data; // throws if the image is not allowed to be read
    var buckets = {};
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 125) continue;
      var key = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
      var b = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    var list = Object.keys(buckets).map(function (k) {
      var b = buckets[k];
      return { n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n };
    }).sort(function (a, b) { return b.n - a.n; });
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
      } else if (picks.length < 4) {
        picks.push({ n: c.n, r: c.r, g: c.g, b: c.b });
      } else {
        picks[best].n += c.n;
      }
    });
    if (!picks.length) return null;
    picks.sort(function (a, b) { return b.n - a.n; });
    var total = picks.reduce(function (s, p) { return s + p.n; }, 0);
    var pal = picks.map(function (p) { return [rgbToHex(p.r, p.g, p.b), Math.round(p.n / total * 100)]; });
    var sum = pal.reduce(function (s, p) { return s + p[1]; }, 0);
    pal[0][1] += 100 - sum;
    return pal.filter(function (p) { return p[1] > 0; });
  }

  /* ---------- turn data.js entries into items ---------- */
  var ITEMS = {}, BY_ID = {};
  function derive(it) {
    it.c1 = it.pal[0][0];
    it.ink = pickInk(it.c1);
    it.bandsH = bands(it.pal, '90deg');
    it.bandsV = bands(it.pal, '180deg');
    it.art = artFor(it.type, it.pal, it.v);
  }
  ORDER.forEach(function (tab) {
    var t = TABS[tab], used = {};
    var raw = Array.isArray(CFG[tab]) ? CFG[tab] : [];
    ITEMS[tab] = raw.map(function (r, i) {
      if (!r || !r.title) { console.warn('[shelf] ' + tab + ' entry #' + (i + 1) + ' has no title, so it was skipped.'); return null; }
      var it = {
        tab: tab, type: t.type, kind: t.kind, verb: t.verb,
        title: String(r.title),
        by: String(r[t.byKey] || r.by || ''),
        year: r.year ? String(r.year) : '',
        rating: Math.max(0, Math.min(5, Math.round(+r.rating || 0))),
        take: r.take ? String(r.take) : '',
        date: parseDate(r[t.dateKey] || r.date),
        cover: safeUrl(r.cover),
        link: safeUrl(r.link || r.url),
        thumb: false
      };
      if (t.type === 'video') {
        var id = ytId(r.url);
        if (!it.cover && id) { it.cover = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; it.thumb = true; }
      }
      var base = slugify(it.title), slug = base, n = 2;
      while (used[slug]) slug = base + '-' + (n++);
      used[slug] = true;
      it.id = slug;
      it.uid = tab + '/' + slug;
      var h = hashStr(it.title + '|' + it.by);
      it.v = h % 3;
      it.T = t.type === 'book' ? 48 + (h % 25) : (t.type === 'film' ? 60 : 34);
      it.D = t.type === 'book' ? 280 : (t.type === 'film' ? 270 : 260);
      it.pal = (it.cover && palCache[it.cover]) || FALLBACK[h % FALLBACK.length];
      it.palDone = !!(it.cover && palCache[it.cover]);
      derive(it);
      BY_ID[it.uid] = it;
      return it;
    }).filter(Boolean);
  });

  /* ---------- state ---------- */
  var state = { tab: 'books', q: '', minR: 0, year: 'all', sort: 'new', picked: null, openUid: null, first: true };
  var canHover = window.matchMedia ? window.matchMedia('(hover: hover)') : { matches: true };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return ITEMS[state.tab].filter(function (it) {
      if (q && (it.title + ' ' + it.by).toLowerCase().indexOf(q) < 0) return false;
      if (state.minR && it.rating < state.minR) return false;
      if (state.year !== 'all' && String(it.date.y) !== state.year) return false;
      return true;
    }).sort(function (a, b) {
      if (state.sort === 'az') return a.title.localeCompare(b.title);
      if (state.sort === 'rating') return (b.rating - a.rating) || (b.date.key - a.date.key);
      if (state.sort === 'old') return a.date.key - b.date.key;
      return b.date.key - a.date.key;
    });
  }

  /* ---------- markup ---------- */
  function vars(it) {
    return '--c1:' + it.c1 + ';--ink:' + it.ink + ';--bandsH:' + it.bandsH + ';--bandsV:' + it.bandsV + ';--art:' + it.art + ';';
  }
  function img(src) {
    return src ? '<img src="' + esc(src) + '" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
  }
  function byLine(it) {
    if (it.type === 'book') return it.by ? 'by ' + it.by : '';
    if (it.type === 'film') return [it.by ? 'Directed by ' + it.by : '', it.year].filter(Boolean).join(' · ');
    return it.by;
  }
  function lastName(s) { var p = String(s).trim().split(/\s+/); return p[p.length - 1] || ''; }

  function cardHTML(it) {
    var art;
    if (it.type === 'book') {
      art = it.cover ? img(it.cover) : '<span class="art-t">' + esc(it.title) + '</span><span class="art-b">' + esc(it.by) + '</span>';
    } else if (it.type === 'film') {
      art = it.cover ? img(it.cover) : '<span class="vart-s">VIDEO</span><span class="vart-t">' + esc(it.title) + '</span>';
    } else {
      art = img(it.cover) + '<span class="play"></span>';
    }
    return '<span class="card"><span class="art">' + art + '</span><span class="txt">' +
      '<span class="c-k">' + esc(it.kind + (it.date.label ? ' · ' + it.verb + ' ' + it.date.label : '')) + '</span>' +
      '<span class="c-t">' + esc(it.title) + '</span>' +
      '<span class="c-b">' + esc(byLine(it)) + '</span>' +
      (it.rating ? '<span class="c-s">' + stars(it.rating) + '</span>' : '') +
      (it.take ? '<span class="c-x">' + esc(it.take) + '</span>' : '') +
      '<span class="c-h">' + (canHover.matches ? 'Click to open' : 'Tap again to open') + '</span>' +
      '</span></span>';
  }

  function spineHTML(it) {
    if (it.type === 'book') {
      return '<span class="hist"></span><span class="s-title">' + esc(it.title) + '</span>' +
        '<span class="s-meta"><span>' + esc(lastName(it.by)) + '</span>' + (it.rating ? '<span class="s-stars">' + stars(it.rating) + '</span>' : '') + '</span>';
    }
    if (it.type === 'film') {
      return '<span class="vhist"></span><span class="vlab"><span>' + esc(it.title) + '</span></span>' +
        '<span class="vtag">VHS' + (it.year ? ' · ' + esc(it.year) : '') + '</span>';
    }
    return '<span class="led"></span><span class="p-title">' + esc(it.title) + '</span><span class="p-ch">' + esc(it.by) + '</span>';
  }

  function slotHTML(it, i, n) {
    var faces = { book: ['pages', 'pages', 'dim'], film: ['vdark', 'vdark', 'vdark'], video: ['pgray', 'pgray', 'pbackl'] }[it.type];
    var delay = ((state.first ? 0.7 : 0.05) + (n - 1 - i) * 0.08).toFixed(2);
    return '<div class="slot" style="--delay:' + delay + 's">' +
      '<div class="bob" style="--bob:' + (-i * 0.7).toFixed(1) + 's">' +
      '<button class="item t-' + it.type + (state.picked === it.uid ? ' picked' : '') + '" type="button" data-uid="' + esc(it.uid) + '"' +
      ' style="--t:' + it.T + 'px;--d:' + it.D + 'px;' + vars(it) + '" aria-label="' + esc('Open ' + it.title + (it.by ? ' by ' + it.by : '')) + '">' +
      '<span class="obj">' +
      '<span class="f back ' + faces[0] + '"></span>' +
      '<span class="f end l ' + faces[1] + '"></span>' +
      '<span class="f end r ' + faces[1] + '"></span>' +
      '<span class="f bot ' + faces[2] + '"></span>' +
      '<span class="f top">' + cardHTML(it) + '</span>' +
      '<span class="f front spine">' + spineHTML(it) + '</span>' +
      '</span></button></div></div>';
  }

  function barsFor(it, delay) {
    var maxP = Math.max.apply(null, it.pal.map(function (p) { return p[1]; }));
    return it.pal.map(function (p, i) {
      return '<div class="bar"><span class="bar-fill" style="height:' + Math.max(8, Math.round(p[1] / maxP * 60)) + 'px;background:' + p[0] + ';animation-delay:' + (delay + i * 0.1).toFixed(2) + 's"></span><span class="bar-pct">' + p[1] + '%</span></div>';
    }).join('');
  }

  function detailHTML(it, idx, total) {
    var dims = it.type === 'book'
      ? { bs: Math.round(it.T * 1.25), bh: 460, bd: 304 }
      : (it.type === 'film' ? { bs: 70, bh: 440, bd: 250 } : { bs: 36, bh: 470, bd: 236 });
    var faces;
    if (it.type === 'book') {
      faces = '<span class="bf tp pages"></span><span class="bf bt pages"></span><span class="bf back pages"></span>' +
        '<span class="bf bcv dim"></span>' +
        '<span class="bf cov">' + (it.cover ? img(it.cover) : '<span class="cv-t">' + esc(it.title) + '</span><span class="cv-b">' + esc(it.by) + '</span>') + '</span>' +
        '<span class="bf front"><span class="bhist"></span><span class="bsp-t"><span>' + esc(it.title) + '</span></span><span class="bsp-a"><span>' + esc(lastName(it.by)) + '</span></span></span>';
    } else if (it.type === 'film') {
      faces = '<span class="bf tp vdarkv"></span><span class="bf bt vdarkv"></span><span class="bf back vdarkv"></span><span class="bf bcv vdarkv"></span>' +
        '<span class="bf cov">' + (it.cover ? img(it.cover) : '<span class="vc-s">VIDEO</span><span class="vc-t">' + esc(it.title) + '</span><span class="vc-y">' + esc(it.year) + '</span>') + '</span>' +
        '<span class="bf front"><span class="bvhist"></span><span class="bvlab"><span>' + esc(it.title) + '</span></span><span class="bvtag">VHS</span></span>';
    } else {
      faces = '<span class="bf tp pgray"></span><span class="bf bt pgray"></span><span class="bf back pgray"></span><span class="bf bcv"></span>' +
        '<span class="bf cov"><span class="scr"><span class="scr-th">' + img(it.cover) + '<span class="play"></span></span>' +
        '<span class="scr-t">' + esc(it.title) + '</span><span class="scr-c">' + esc(it.by) + '</span></span></span>' +
        '<span class="bf front"><span class="bled"></span><span class="bpe-t">' + esc(it.title) + '</span></span>';
    }
    var barsHTML = barsFor(it, 1.3);
    var linkLabel = it.type === 'video' ? 'Watch on YouTube' : 'Open link';
    return '<div class="d-top">' +
      '<button class="d-btn" type="button" data-act="close"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Back to shelf</span></button>' +
      '<span class="d-idx">' + idx + ' / ' + total + '</span></div>' +
      '<div class="stagew"><div class="tilt" id="tilt"><div class="sway">' +
      '<div class="spin" id="spin" style="--bs:' + dims.bs + 'px;--bh:' + dims.bh + 'px;--bd:' + dims.bd + 'px">' + faces + '<span class="shadow"></span></div>' +
      '</div></div></div>' +
      '<div class="d-info">' +
      '<p class="d-kick">' + esc(it.kind + (it.date.label ? ' · ' + it.verb + ' ' + it.date.label : '')) + '</p>' +
      '<h2 class="d-title" id="dTitle">' + esc(it.title) + '</h2>' +
      (byLine(it) ? '<p class="d-by">' + esc(byLine(it)) + '</p>' : '') +
      (it.rating ? '<p class="d-stars" aria-label="' + it.rating + ' out of 5">' + stars(it.rating) + '</p>' : '') +
      (it.take ? '<p class="d-take">' + esc(it.take) + '</p>' : '') +
      (it.link ? '<div class="d-row"><a class="d-link" href="' + esc(it.link) + '" target="_blank" rel="noopener">' + linkLabel + '</a></div>' : '') +
      '<div class="d-hist"><span class="d-hist-cap">Cover colors</span><div class="bars">' + barsHTML + '</div></div>' +
      '</div>' +
      '<div class="d-nav">' +
      '<button class="d-arrow" type="button" data-act="prev" aria-label="Previous"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button class="d-arrow" type="button" data-act="next" aria-label="Next"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div>';
  }

  /* ---------- rendering ---------- */
  var countEl = $('#count'), yearChipsEl = $('#yearChips');

  function renderStack() {
    var list = filtered(), n = list.length;
    countEl.textContent = n + ' of ' + ITEMS[state.tab].length;
    if (!n) {
      stackEl.innerHTML = '<div class="empty"><span class="empty-t">' +
        (ITEMS[state.tab].length ? 'Nothing matches.' : 'Nothing here yet.') + '</span><span>' +
        (ITEMS[state.tab].length ? 'Try a different search or loosen the filters.' : 'Add your first one in data.js.') + '</span>' +
        (ITEMS[state.tab].length ? '<button class="ghost" type="button" data-act="clear">Clear filters</button>' : '') + '</div>';
    } else {
      stackEl.innerHTML = list.map(function (it, i) { return slotHTML(it, i, n); }).join('');
    }
    state.first = false;
  }

  function renderTabs() {
    document.body.setAttribute('data-tab', state.tab);
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === state.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('#tabInd').style.transform = 'translateX(' + (ORDER.indexOf(state.tab) * 100) + '%)';
  }

  function renderYearChips() {
    var years = [];
    ITEMS[state.tab].forEach(function (it) { if (it.date.y && years.indexOf(String(it.date.y)) < 0) years.push(String(it.date.y)); });
    years.sort().reverse();
    yearChipsEl.innerHTML = [['all', 'All years']].concat(years.map(function (y) { return [y, y]; })).map(function (d) {
      var on = state.year === d[0];
      return '<button class="chip' + (on ? ' on' : '') + '" type="button" data-year="' + d[0] + '" aria-pressed="' + on + '">' + d[1] + '</button>';
    }).join('');
  }

  function setChipState(container, attr, value) {
    container.querySelectorAll('.chip').forEach(function (c) {
      var on = c.getAttribute(attr) === String(value);
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* update colors in place once a cover has been read (no re-render, no replayed animation) */
  function applyPalette(it) {
    if (state.openUid === it.uid) {
      var bars = detailEl.querySelector('.bars');
      if (bars) bars.innerHTML = barsFor(it, 0);
    }
    document.querySelectorAll('[data-uid="' + CSS.escape(it.uid) + '"]').forEach(function (el) {
      el.style.setProperty('--c1', it.c1);
      el.style.setProperty('--ink', it.ink);
      el.style.setProperty('--bandsH', it.bandsH);
      el.style.setProperty('--bandsV', it.bandsV);
      el.style.setProperty('--art', it.art);
    });
  }

  function loadPalettes() {
    ORDER.forEach(function (tab) {
      ITEMS[tab].forEach(function (it) {
        if (!it.cover || it.palDone) return;
        var im = new Image();
        im.crossOrigin = 'anonymous';
        im.decoding = 'async';
        im.onload = function () {
          try {
            var pal = extractPalette(im, it.thumb);
            if (!pal) return;
            it.pal = pal; it.palDone = true;
            derive(it);
            applyPalette(it);
            savePal(it.cover, pal);
          } catch (e) { /* this image's colors can't be read (e.g. opened from file://); keep the stand-in colors */ }
        };
        im.src = it.cover;
      });
    });
  }

  /* ---------- detail page ---------- */
  var lastFocus = null, spinTimer = null;

  function openDetail(it) {
    var list = filtered();
    var idx = list.indexOf(it);
    if (idx < 0) { list = ITEMS[it.tab]; idx = list.indexOf(it); }
    state.openUid = it.uid;
    state.picked = null;
    if (detailEl.hidden) lastFocus = document.activeElement;
    detailEl.className = 'detail t-' + it.type;
    detailEl.setAttribute('data-uid', it.uid);
    detailEl.setAttribute('style', vars(it));
    detailEl.innerHTML = detailHTML(it, idx + 1, list.length);
    detailEl.hidden = false;
    detailEl.style.animation = 'none'; void detailEl.offsetWidth; detailEl.style.animation = '';
    document.body.classList.add('locked');
    clearTimeout(spinTimer);
    spinTimer = setTimeout(function () { var s = $('#spin'); if (s) s.classList.add('spun'); }, 450);
    var back = detailEl.querySelector('[data-act="close"]');
    if (back) back.focus({ preventScroll: true });
  }

  function closeDetail() {
    if (detailEl.hidden) return;
    clearTimeout(spinTimer);
    detailEl.hidden = true;
    detailEl.innerHTML = '';
    state.openUid = null;
    document.body.classList.remove('locked');
    var target = lastFocus && document.contains(lastFocus) ? lastFocus : null;
    if (!target && state.lastUid) target = stackEl.querySelector('[data-uid="' + CSS.escape(state.lastUid) + '"]');
    if (target) target.focus({ preventScroll: true });
  }

  function step(dir) {
    var list = filtered();
    var cur = BY_ID[state.openUid];
    var i = list.indexOf(cur);
    if (i < 0 || !list.length) return;
    var next = list[(i + dir + list.length) % list.length];
    location.replace('#' + next.uid);
  }

  /* ---------- routing: #books, #films/arrival, ... ---------- */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    var parts = h.split('/');
    var tab = TABS[parts[0]] ? parts[0] : (state.rendered ? state.tab : 'books');
    if (tab !== state.tab || !state.rendered) {
      var changed = state.rendered && tab !== state.tab;
      state.tab = tab;
      state.picked = null;
      if (changed) state.year = 'all';
      renderTabs();
      renderYearChips();
      renderStack();
      state.rendered = true;
    }
    var it = parts[1] ? BY_ID[tab + '/' + parts[1]] : null;
    if (it) { state.lastUid = it.uid; openDetail(it); } else closeDetail();
  }

  function restack() { state.picked = null; renderStack(); }

  /* ---------- events ---------- */
  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    var tab = b.getAttribute('data-tab');
    if (tab !== state.tab || state.openUid) location.hash = '#' + tab;
  });

  var searchTimer = null;
  $('#search').addEventListener('input', function (e) {
    var v = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.q = v; restack(); }, 250);
  });

  $('#rateChips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    state.minR = +c.getAttribute('data-min');
    setChipState($('#rateChips'), 'data-min', state.minR);
    restack();
  });

  yearChipsEl.addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    state.year = c.getAttribute('data-year');
    setChipState(yearChipsEl, 'data-year', state.year);
    restack();
  });

  $('#sort').addEventListener('change', function (e) { state.sort = e.target.value; restack(); });

  stackEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="clear"]')) {
      state.q = ''; state.minR = 0; state.year = 'all';
      $('#search').value = '';
      setChipState($('#rateChips'), 'data-min', 0);
      setChipState(yearChipsEl, 'data-year', 'all');
      restack();
      return;
    }
    var btn = e.target.closest('.item');
    if (!btn) return;
    var uid = btn.getAttribute('data-uid');
    if (canHover.matches || state.picked === uid) {
      state.lastUid = uid;
      location.hash = '#' + uid;
    } else {
      stackEl.querySelectorAll('.item.picked').forEach(function (x) { x.classList.remove('picked'); });
      btn.classList.add('picked');
      state.picked = uid;
    }
  });

  detailEl.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.getAttribute('data-act');
    if (act === 'close') location.hash = '#' + state.tab;
    if (act === 'prev') step(-1);
    if (act === 'next') step(1);
  });

  document.addEventListener('keydown', function (e) {
    if (detailEl.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); location.hash = '#' + state.tab; }
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  var raf = null, mx = 0.5, my = 0.5;
  document.addEventListener('mousemove', function (e) {
    mx = e.clientX / (window.innerWidth || 1);
    my = e.clientY / (window.innerHeight || 1);
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      var root = document.documentElement.style;
      root.setProperty('--mx', (mx * 100).toFixed(1) + '%');
      root.setProperty('--my', (my * 100).toFixed(1) + '%');
      var tilt = document.getElementById('tilt');
      if (tilt) tilt.style.transform = 'rotateY(' + ((mx * 2 - 1) * 18).toFixed(2) + 'deg) rotateX(' + ((my * 2 - 1) * -10).toFixed(2) + 'deg)';
    });
  });

  window.addEventListener('hashchange', route);

  /* ---------- start ---------- */
  var site = CFG.site || {};
  if (site.title) { document.title = site.title; $('#siteTitle').textContent = site.title; }
  if (site.background) $('#bg').style.backgroundImage = 'url("' + safeUrl(site.background).replace(/"/g, '%22') + '")';
  if (site.backgroundDim != null) document.documentElement.style.setProperty('--bg-dim', Math.max(0, Math.min(1, +site.backgroundDim)));
  var total = ORDER.reduce(function (s, t) { return s + ITEMS[t].length; }, 0);
  $('#meta').textContent = total + ' ' + (site.tagline || 'things worth keeping');
  ORDER.forEach(function (t) {
    var el = document.querySelector('[data-count="' + t + '"]');
    if (el) el.textContent = String(ITEMS[t].length).padStart(2, '0');
  });

  route();
  loadPalettes();
})();
