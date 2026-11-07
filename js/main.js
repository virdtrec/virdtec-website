/* ViRdtec – site interactions + gallery (data from data/gallery.json, managed via /admin) */
(function () {
  'use strict';

  // ---------- Header / nav ----------
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function setNav(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    nav.classList.toggle('is-open', open);
  }
  toggle.addEventListener('click', function () {
    setNav(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setNav(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setNav(false);
  });

  var toTop = document.querySelector('.to-top');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    toTop.classList.toggle('is-visible', window.scrollY > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // ---------- Reveal on scroll ----------
  var revealTargets = document.querySelectorAll('.section-head, .card, .steps li, .split-media, .split-body, .cta');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -60px 0px' });
    revealTargets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  // ---------- Gallery ----------
  var grid = document.getElementById('gallery');
  var filters = document.querySelectorAll('.filters .chip');
  var items = [];
  var visible = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isVideo(it) { return it.type === 'video' || it.type === 'youtube'; }
  function thumbOf(it) {
    if (it.type === 'youtube') return 'https://i.ytimg.com/vi/' + encodeURIComponent(it.youtubeId) + '/hqdefault.jpg';
    if (it.type === 'video') return it.poster || '';
    return it.thumb || it.src;
  }

  // If an image fails to load (e.g. a stale/cached response from the host),
  // fall back to the full-size file, then to the copy in the GitHub repo.
  var RAW = 'https://raw.githubusercontent.com/virdtrec/virdtec-website/main/';
  function fallbacks(it, first) {
    var list = [];
    [first, it.src].forEach(function (u) {
      if (u && !/^https?:/.test(u)) {
        if (list.indexOf(u) < 0) list.push(u);
      }
    });
    list.slice().forEach(function (u) { list.push(RAW + u.replace(/^\/+/, '').replace(/\?.*$/, '')); });
    return list.slice(1);
  }
  function onImgError(e) {
    var img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallbacks) return;
    var rest = img.dataset.fallbacks.split('|').filter(Boolean);
    if (!rest.length) return;
    img.dataset.fallbacks = rest.slice(1).join('|');
    img.src = rest[0];
  }

  var PAGE_SIZE = 20;
  var page = 1;
  var pager = document.getElementById('gallery-pager');
  var activeFilter = 'all';

  function matches(it, f) {
    if (f === 'all') return true;
    if (f === 'video') return isVideo(it);
    return (it.category || '') === f;
  }

  function itemHtml(it, i) {
    var t = thumbOf(it);
    var media = t
      ? '<img src="' + esc(t) + '" data-fallbacks="' + esc(it.type === 'image' ? fallbacks(it, t).join('|') : '') + '" alt="' + esc(it.title || 'Galeri ViRdtec') + '" loading="lazy" decoding="async">'
      : '<video src="' + esc(it.src) + '#t=0.5" muted playsinline preload="metadata"></video>';
    var cap = (it.title || it.location)
      ? '<figcaption>' + (it.title ? '<strong>' + esc(it.title) + '</strong>' : '') + (it.location ? '<span>' + esc(it.location) + '</span>' : '') + '</figcaption>'
      : '';
    return '<figure class="g-item" role="button" tabindex="0" data-index="' + i + '">' +
      media +
      (isVideo(it) ? '<span class="g-play" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg></span><span class="g-badge">Video</span>' : '') +
      cap + '</figure>';
  }

  function pageCount() { return Math.max(1, Math.ceil(visible.length / PAGE_SIZE)); }

  // `visible` = all items matching the filter (the lightbox steps through all of them);
  // the grid shows only the current page of it.
  function render() {
    if (!items.length) {
      grid.innerHTML = '<p class="gallery-empty">Belum ada foto atau video.</p>';
      pager.hidden = true;
      return;
    }
    visible = [];
    items.forEach(function (it, i) { if (matches(it, activeFilter)) visible.push(i); });
    page = Math.min(Math.max(1, page), pageCount());
    if (!visible.length) {
      grid.innerHTML = '<p class="gallery-empty">Belum ada konten di kategori ini.</p>';
      pager.hidden = true;
      return;
    }
    var start = (page - 1) * PAGE_SIZE;
    grid.innerHTML = visible.slice(start, start + PAGE_SIZE).map(function (i) { return itemHtml(items[i], i); }).join('');
    renderPager(start);
  }

  function pageList(n, cur) {
    // 1 … 4 5 6 … 12
    var out = [];
    for (var p = 1; p <= n; p++) {
      if (p === 1 || p === n || Math.abs(p - cur) <= 1) out.push(p);
      else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
  }

  function renderPager(start) {
    var n = pageCount();
    if (n <= 1) { pager.hidden = true; pager.innerHTML = ''; return; }
    var end = Math.min(start + PAGE_SIZE, visible.length);
    var html = '<p class="pager-info">Menampilkan ' + (start + 1) + '–' + end + ' dari ' + visible.length + '</p><div class="pager-buttons">';
    html += '<button type="button" class="pager-btn pager-nav" data-page="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + ' aria-label="Halaman sebelumnya">‹ <span>Sebelumnya</span></button>';
    pageList(n, page).forEach(function (p) {
      html += p === '…'
        ? '<span class="pager-gap" aria-hidden="true">…</span>'
        : '<button type="button" class="pager-btn' + (p === page ? ' is-active' : '') + '" data-page="' + p + '"' +
          (p === page ? ' aria-current="page"' : '') + ' aria-label="Halaman ' + p + '">' + p + '</button>';
    });
    html += '<button type="button" class="pager-btn pager-nav" data-page="' + (page + 1) + '"' + (page === n ? ' disabled' : '') + ' aria-label="Halaman berikutnya"><span>Berikutnya</span> ›</button></div>';
    pager.innerHTML = html;
    pager.hidden = false;
  }

  function goToPage(p, scroll) {
    page = p;
    render();
    if (scroll) {
      document.getElementById('galeri').scrollIntoView({ block: 'start' });
      var first = grid.querySelector('.g-item');
      if (first) first.focus({ preventScroll: true });
    }
  }

  pager.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-page]');
    if (b && !b.disabled) goToPage(Number(b.getAttribute('data-page')), true);
  });

  function applyFilter(f) {
    activeFilter = f;
    page = 1;
    render();
  }

  grid.addEventListener('error', onImgError, true);

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active'); btn.setAttribute('aria-selected', 'true');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  fetch('data/gallery.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { items = (data && data.items) || []; render(); })
    .catch(function () { grid.innerHTML = '<p class="gallery-empty">Galeri belum dapat dimuat. Lihat karya kami di <a href="https://www.instagram.com/virdtec" target="_blank" rel="noopener">Instagram</a>.</p>'; });

  // ---------- Lightbox ----------
  var lb = document.getElementById('lightbox');
  var lbMedia = lb.querySelector('.lb-media');
  var lbCap = lb.querySelector('.lb-caption');
  var current = -1; // position within `visible`
  lbMedia.addEventListener('error', onImgError, true);
  var lastFocus = null;

  function show(pos) {
    current = (pos + visible.length) % visible.length;
    var it = items[visible[current]];
    if (it.type === 'youtube') {
      lbMedia.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(it.youtubeId) + '?autoplay=1&rel=0" title="' + esc(it.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    } else if (it.type === 'video') {
      lbMedia.innerHTML = '<video src="' + esc(it.src) + '"' + (it.poster ? ' poster="' + esc(it.poster) + '"' : '') + ' controls autoplay playsinline></video>';
    } else {
      lbMedia.innerHTML = '<img src="' + esc(it.src) + '" data-fallbacks="' + esc(fallbacks(it, it.src).join('|')) + '" alt="' + esc(it.title || '') + '">';
    }
    lbCap.innerHTML = (it.title ? esc(it.title) : '') + (it.location ? ' <span>· ' + esc(it.location) + '</span>' : '');
    var multi = visible.length > 1;
    lb.querySelector('.lb-prev').hidden = !multi;
    lb.querySelector('.lb-next').hidden = !multi;
  }
  function open(index) {
    var pos = visible.indexOf(index);
    if (pos < 0) return;
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show(pos);
    lb.querySelector('.lb-close').focus();
  }
  function close() {
    lb.hidden = true;
    lbMedia.innerHTML = '';
    document.body.style.overflow = '';
    var p = current >= 0 ? Math.floor(current / PAGE_SIZE) + 1 : page;
    if (p !== page) {
      // lightbox stepped onto another page: show that page and focus the item
      goToPage(p, false);
      var el = grid.querySelector('.g-item[data-index="' + visible[current] + '"]');
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
    } else if (lastFocus) {
      lastFocus.focus();
    }
  }

  grid.addEventListener('click', function (e) {
    var el = e.target.closest('.g-item');
    if (el) open(Number(el.getAttribute('data-index')));
  });
  grid.addEventListener('keydown', function (e) {
    var el = e.target.closest('.g-item');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(Number(el.getAttribute('data-index'))); }
  });
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', function () { show(current - 1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { show(current + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && visible.length > 1) show(current - 1);
    else if (e.key === 'ArrowRight' && visible.length > 1) show(current + 1);
  });

  // Swipe on touch devices
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null || visible.length < 2) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // ---------- Statistik pengunjung (dibaca di /admin → Statistik) ----------
  // Tanpa cookie. Admin bisa menonaktifkan pencatatan untuk perangkatnya sendiri.
  function track(type) {
    try { if (localStorage.getItem('virdtec_no_track')) return; } catch (e) { /* abaikan */ }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    var utm = '';
    try { utm = new URLSearchParams(location.search).get('utm_source') || ''; } catch (e) { /* abaikan */ }
    var data = JSON.stringify({ t: type, p: location.pathname, r: document.referrer, u: utm });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/hit', data)) return;
      fetch('/api/hit', { method: 'POST', body: data, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) { /* abaikan */ }
  }
  track('view');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (a) track('wa');
  });
})();
