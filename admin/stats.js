/*
 * ViRdtec – Admin › Statistik pengunjung
 * Mengambil ringkasan dari /api/stats (Cloudflare Pages Function + D1) memakai
 * token GitHub yang sama dengan login admin.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var NO_TRACK = 'virdtec_no_track';
  var TRACK_PREF = 'virdtec_track_pref';
  var days = 7;
  var loaded = false;
  var nf = new Intl.NumberFormat('id-ID');
  var nfc = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['id'], { type: 'region' }); } catch (e) { /* browser lama */ }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function num(v) { return Number(v) || 0; }
  function fmtDay(day, opts) {
    var d = new Date(day + 'T00:00:00+07:00');
    return d.toLocaleDateString('id-ID', Object.assign({ timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' }, opts || {}));
  }
  function country(code) {
    if (!code) return '';
    try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
  }
  function placeName(city, cc) {
    var c = country(cc);
    if (city && c) return city + ', ' + c;
    return city || c || 'Tidak diketahui';
  }

  // ------------------------------------------------------------ tabs
  function showTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('main[id^="tab-"]').forEach(function (m) { m.hidden = m.id !== 'tab-' + name; });
    // galeri punya bar simpan sendiri; sembunyikan saat tab lain dibuka
    var sb = $('savebar');
    if (sb) sb.style.display = name === 'gallery' ? '' : 'none';
    if (name === 'stats' && !loaded) load();
    document.dispatchEvent(new CustomEvent('admin:tab', { detail: name }));
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
  });

  // ------------------------------------------------------------ own-visit toggle
  function prefs() {
    try {
      // Saat admin pertama kali membuka statistik, kunjungan dari perangkat ini tidak dihitung
      if (localStorage.getItem(TRACK_PREF) === null) {
        localStorage.setItem(TRACK_PREF, 'set');
        localStorage.setItem(NO_TRACK, '1');
      }
      return { ok: true, noTrack: !!localStorage.getItem(NO_TRACK) };
    } catch (e) { return { ok: false }; }
  }
  function renderSelf() {
    var p = prefs();
    var box = $('st-self');
    box.hidden = !p.ok;
    if (!p.ok) return;
    $('st-self-text').textContent = p.noTrack
      ? 'Kunjungan dari perangkat ini tidak ikut dihitung.'
      : 'Kunjungan dari perangkat ini ikut dihitung.';
    $('st-self-btn').textContent = p.noTrack ? 'Hitung juga' : 'Jangan hitung';
  }
  $('st-self-btn').addEventListener('click', function () {
    try {
      if (localStorage.getItem(NO_TRACK)) localStorage.removeItem(NO_TRACK);
      else localStorage.setItem(NO_TRACK, '1');
    } catch (e) { /* abaikan */ }
    renderSelf();
  });

  // ------------------------------------------------------------ range
  document.querySelectorAll('#st-range .chip').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#st-range .chip').forEach(function (x) {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      days = Number(b.getAttribute('data-days'));
      load();
    });
  });
  $('st-refresh').addEventListener('click', load);

  // ------------------------------------------------------------ load
  function setState(state, msg) {
    $('st-loading').hidden = state !== 'loading';
    $('st-setup').hidden = state !== 'setup';
    $('st-error').hidden = state !== 'error';
    $('st-body').hidden = state !== 'ok';
    if (state === 'error') $('st-error-text').textContent = msg;
  }

  function load() {
    var token = window.virdtecAdmin && window.virdtecAdmin.token();
    if (!token) return;
    loaded = true;
    renderSelf();
    setState('loading');
    fetch('../api/stats?days=' + days, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      .then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (type.indexOf('application/json') < 0) return { status: 'missing' };
        return res.json().then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (r) {
        if (r.status === 'missing' || (r.data && r.data.error === 'no_db')) return setState('setup');
        if (r.status === 401) return setState('error', 'Akses ditolak. Statistik hanya bisa dibuka dengan token milik akun GitHub admin.');
        if (r.status !== 200) return setState('error', 'Gagal memuat statistik (' + r.status + '). Coba lagi beberapa saat lagi.');
        render(r.data);
        setState('ok');
      })
      .catch(function () { setState('error', 'Koneksi gagal. Periksa internet Anda lalu coba lagi.'); });
  }

  // ------------------------------------------------------------ render
  function fillDays(data) {
    var map = {};
    (data.daily || []).forEach(function (d) { map[d.day] = d; });
    var out = [];
    var t = new Date(data.start + 'T12:00:00Z').getTime();
    for (var i = 0; i < data.days; i++) {
      var day = new Date(t + i * 86400e3).toISOString().slice(0, 10);
      var d = map[day] || {};
      out.push({ day: day, visitors: num(d.visitors), views: num(d.views), wa: num(d.wa) });
    }
    return out;
  }

  function render(data) {
    var series = fillDays(data);
    var t = data.totals || {};
    var visitors = num(t.visitors), views = num(t.views), wa = num(t.wa);
    var today = series[series.length - 1] || { visitors: 0, views: 0 };

    $('st-range-text').textContent = fmtDay(data.start, { year: 'numeric' }) + ' – ' + fmtDay(data.today, { year: 'numeric' });

    var kpis = $('st-kpis');
    kpis.textContent = '';
    [
      ['Pengunjung', visitors, 'rata-rata ' + nf.format(Math.round(visitors / data.days * 10) / 10) + ' per hari'],
      ['Halaman dilihat', views, visitors ? nf.format(Math.round(views / visitors * 10) / 10) + ' halaman per pengunjung' : '–'],
      ['Klik WhatsApp', wa, visitors ? nf.format(Math.round(wa / visitors * 1000) / 10) + '% dari pengunjung' : '–'],
      ['Hari ini', today.visitors, nf.format(today.views) + ' halaman dilihat']
    ].forEach(function (k) {
      var tile = el('div', 'kpi');
      tile.appendChild(el('span', 'kpi-label', k[0]));
      tile.appendChild(el('strong', 'kpi-value', k[1] >= 10000 ? nfc.format(k[1]) : nf.format(k[1])));
      tile.appendChild(el('span', 'kpi-sub', k[2]));
      kpis.appendChild(tile);
    });

    renderChart(series);
    renderTable(series);

    var top = data.top || {};
    renderList('st-sources', top.sources, 'pengunjung');
    renderList('st-locations', (top.locations || []).map(function (r) {
      var parts = String(r.k || '').split('|');
      return { k: placeName(parts[0], parts[1]), n: r.n };
    }), 'pengunjung');
    renderList('st-devices', top.devices, 'pengunjung');
    renderList('st-browsers', top.browsers, 'pengunjung');
    renderList('st-os', top.os, 'pengunjung');
    renderList('st-pages', (top.pages || []).map(function (r) {
      return { k: r.k === '/' || r.k === '/index.html' ? 'Beranda (/)' : r.k, n: r.n };
    }), 'kali');
    renderList('st-wa', top.waSources, 'klik');
    renderList('st-gallery', (top.galleryViews || []).map(function (r) {
      return { k: String(r.k || '').replace(/^\/galeri → /, ''), n: r.n };
    }), 'kali dibuka');
    renderList('st-links', (top.linkClicks || []).map(function (r) {
      return { k: String(r.k || '').replace(/^\/link → /, ''), n: r.n };
    }), 'klik');
    renderRecent(data.recent || []);
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }

  function renderChart(series) {
    var box = $('st-chart');
    box.textContent = '';
    var max = niceMax(Math.max.apply(null, series.map(function (d) { return d.visitors; })));

    var grid = el('div', 'cc-grid');
    [1, 0.5, 0].forEach(function (f) {
      var line = el('div', 'cc-line');
      line.style.bottom = (f * 100) + '%';
      line.appendChild(el('span', 'cc-tick', nf.format(Math.round(max * f))));
      grid.appendChild(line);
    });
    box.appendChild(grid);

    var cols = el('div', 'cc-cols');
    series.forEach(function (d) {
      var col = el('div', 'cc-col');
      var bar = el('div', 'cc-bar');
      bar.style.height = (d.visitors / max * 100) + '%';
      col.appendChild(bar);
      cols.appendChild(col);
    });
    box.appendChild(cols);

    var xl = el('div', 'cc-x');
    var idx = series.length > 2 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : series.map(function (_, i) { return i; });
    idx.forEach(function (i) {
      var s = el('span', null, fmtDay(series[i].day));
      s.style.left = ((i + 0.5) / series.length * 100) + '%';
      xl.appendChild(s);
    });
    box.appendChild(xl);

    var tip = el('div', 'cc-tip');
    tip.hidden = true;
    box.appendChild(tip);

    var active = -1;
    function highlight(i) {
      if (i === active) return;
      if (active >= 0 && cols.children[active]) cols.children[active].classList.remove('is-hover');
      active = i;
      if (i < 0) { tip.hidden = true; return; }
      cols.children[i].classList.add('is-hover');
      var d = series[i];
      tip.textContent = '';
      tip.appendChild(el('div', 'cc-tip-day', fmtDay(d.day, { weekday: 'long', year: 'numeric' })));
      [[d.visitors, 'pengunjung'], [d.views, 'halaman dilihat'], [d.wa, 'klik WhatsApp']].forEach(function (r) {
        var row = el('div', 'cc-tip-row');
        row.appendChild(el('strong', null, nf.format(r[0])));
        row.appendChild(document.createTextNode(' ' + r[1]));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var colRect = cols.children[i].getBoundingClientRect();
      var boxRect = box.getBoundingClientRect();
      var x = colRect.left - boxRect.left + colRect.width / 2;
      var w = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(boxRect.width - w, x - w / 2)) + 'px';
    }
    function indexAt(clientX) {
      var r = cols.getBoundingClientRect();
      var i = Math.floor((clientX - r.left) / r.width * series.length);
      return Math.max(0, Math.min(series.length - 1, i));
    }
    cols.addEventListener('pointermove', function (e) { highlight(indexAt(e.clientX)); });
    cols.addEventListener('pointerdown', function (e) { highlight(indexAt(e.clientX)); });
    box.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') highlight(-1); });
    box.onkeydown = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var start = active < 0 ? series.length - 1 : active + (e.key === 'ArrowRight' ? 1 : -1);
        highlight(Math.max(0, Math.min(series.length - 1, start)));
      } else if (e.key === 'Escape') highlight(-1);
    };
    box.onblur = function () { highlight(-1); };
  }

  function renderTable(series) {
    var tb = $('st-table-body');
    tb.textContent = '';
    series.slice().reverse().forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(el('td', null, fmtDay(d.day, { weekday: 'short' })));
      [d.visitors, d.views, d.wa].forEach(function (v) { tr.appendChild(el('td', 'n', nf.format(v))); });
      tb.appendChild(tr);
    });
  }

  function renderList(id, rows, unit) {
    var box = $(id);
    box.textContent = '';
    rows = (rows || []).filter(function (r) { return num(r.n) > 0; });
    if (!rows.length) { box.appendChild(el('p', 'muted small', 'Belum ada data.')); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return num(r.n); }));
    rows.forEach(function (r) {
      var row = el('div', 'hb-row');
      row.title = (r.k || 'Tidak diketahui') + ': ' + nf.format(num(r.n)) + ' ' + unit;
      var head = el('div', 'hb-head');
      head.appendChild(el('span', 'hb-label', r.k || 'Tidak diketahui'));
      head.appendChild(el('span', 'hb-value', nf.format(num(r.n))));
      row.appendChild(head);
      var bar = el('div', 'hb-bar');
      bar.style.width = Math.max(2, num(r.n) / max * 100) + '%';
      row.appendChild(bar);
      box.appendChild(row);
    });
  }

  // Several events from one person (same daily visitor id, close together) form one visit
  var VISIT_GAP = 30 * 60e3, MAX_VISITS = 25;
  function groupVisits(rows) {
    var visits = [], open = {};
    rows.forEach(function (r) { // rows arrive newest first
      var key = (r.visitor || '') + '|' + [r.device, r.os, r.browser, r.city].join('|');
      var v = r.visitor && open[key];
      if (v && v.first - r.ts <= VISIT_GAP) { v.events.push(r); v.first = r.ts; return; }
      v = { last: r.ts, first: r.ts, events: [r], head: r };
      visits.push(v);
      if (r.visitor) open[key] = v;
    });
    visits.forEach(function (v) { v.events.reverse(); }); // oldest first inside a visit
    return visits.slice(0, MAX_VISITS);
  }
  function afterArrow(path) {
    var i = String(path || '').indexOf('→');
    return i >= 0 ? String(path).slice(i + 1).trim() : '';
  }
  function pageName(path) {
    var p = String(path || '/');
    if (p === '/' || p === '/index.html') return 'Beranda';
    if (/^\/link/.test(p)) return 'Halaman Link Bio';
    if (/^\/privasi/.test(p)) return 'Kebijakan privasi';
    return p;
  }
  function eventLabel(r) {
    if (r.type === 'wa') return 'Klik WhatsApp';
    if (r.type === 'link') return 'Klik link bio: ' + (afterArrow(r.path) || '-');
    if (r.type === 'gallery') return 'Buka galeri: ' + (afterArrow(r.path) || '-');
    return 'Melihat ' + pageName(r.path);
  }
  function fmtTime(ts, withDay) {
    return new Date(ts).toLocaleString('id-ID', withDay
      ? { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  }

  function renderRecent(rows) {
    var ul = $('st-recent');
    ul.textContent = '';
    if (!rows.length) { ul.appendChild(el('li', 'muted small', 'Belum ada kunjungan tercatat.')); return; }
    groupVisits(rows).forEach(function (v) {
      var li = el('li', 'rc');
      var hasWa = v.events.some(function (e) { return e.type === 'wa'; });
      var when = fmtTime(v.first, true) + (v.last - v.first >= 60e3 ? '–' + fmtTime(v.last, false) : '') + ' WIB';
      var top = el('div', 'rc-top');
      top.appendChild(el('span', 'rc-time', when));
      top.appendChild(el('span', 'rc-badge' + (hasWa ? ' is-wa' : ''),
        hasWa ? 'Klik WhatsApp' : v.events.length > 1 ? v.events.length + ' aktivitas' : eventLabel(v.head).split(':')[0]));
      li.appendChild(top);
      var h = v.head;
      li.appendChild(el('div', 'rc-main', placeName(h.city, h.country)));
      li.appendChild(el('div', 'rc-sub', [h.device, h.os, h.browser].filter(Boolean).join(' · ') + ' · dari ' + (v.events[0].source || 'Langsung')));
      if (v.events.length > 1) {
        var ol = el('ol', 'rc-steps');
        v.events.forEach(function (e, i) {
          // A WhatsApp button on the link page records "link bio" and "WhatsApp" for one tap: show it once
          var prev = v.events[i - 1];
          if (e.type === 'wa' && prev && prev.type === 'link' && e.ts - prev.ts < 5e3) return;
          var item = el('li', e.type === 'wa' || (e.type === 'link' && /whatsapp/i.test(e.path)) ? 'is-wa' : '', eventLabel(e));
          ol.appendChild(item);
        });
        li.appendChild(ol);
      }
      ul.appendChild(li);
    });
  }

  window.virdtecStats = { show: showTab };
})();
