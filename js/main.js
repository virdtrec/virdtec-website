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

  function render() {
    if (!items.length) {
      grid.innerHTML = '<p class="gallery-empty">Belum ada foto atau video.</p>';
      return;
    }
    grid.innerHTML = items.map(function (it, i) {
      var t = thumbOf(it);
      var media = t
        ? '<img src="' + esc(t) + '" alt="' + esc(it.title || 'Galeri ViRdtec') + '" loading="lazy" decoding="async">'
        : '<video src="' + esc(it.src) + '#t=0.5" muted playsinline preload="metadata"></video>';
      var cap = (it.title || it.location)
        ? '<figcaption>' + (it.title ? '<strong>' + esc(it.title) + '</strong>' : '') + (it.location ? '<span>' + esc(it.location) + '</span>' : '') + '</figcaption>'
        : '';
      return '<figure class="g-item" role="button" tabindex="0" data-index="' + i + '" data-category="' + esc(it.category || '') + '" data-kind="' + (isVideo(it) ? 'video' : 'image') + '">' +
        media +
        (isVideo(it) ? '<span class="g-play" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg></span><span class="g-badge">Video</span>' : '') +
        cap + '</figure>';
    }).join('');
    applyFilter(document.querySelector('.filters .chip.is-active').getAttribute('data-filter'));
  }

  function applyFilter(f) {
    visible = [];
    grid.querySelectorAll('.g-item').forEach(function (el) {
      var show = f === 'all' ||
        (f === 'video' ? el.getAttribute('data-kind') === 'video' : el.getAttribute('data-category') === f);
      el.hidden = !show;
      if (show) visible.push(Number(el.getAttribute('data-index')));
    });
    var empty = grid.querySelector('.gallery-filter-empty');
    if (empty) empty.remove();
    if (!visible.length) grid.insertAdjacentHTML('beforeend', '<p class="gallery-empty gallery-filter-empty">Belum ada konten di kategori ini.</p>');
  }

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
  var lastFocus = null;

  function show(pos) {
    current = (pos + visible.length) % visible.length;
    var it = items[visible[current]];
    if (it.type === 'youtube') {
      lbMedia.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(it.youtubeId) + '?autoplay=1&rel=0" title="' + esc(it.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    } else if (it.type === 'video') {
      lbMedia.innerHTML = '<video src="' + esc(it.src) + '"' + (it.poster ? ' poster="' + esc(it.poster) + '"' : '') + ' controls autoplay playsinline></video>';
    } else {
      lbMedia.innerHTML = '<img src="' + esc(it.src) + '" alt="' + esc(it.title || '') + '">';
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
    if (lastFocus) lastFocus.focus();
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
})();
