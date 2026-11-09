/*
 * ViRdtec – Admin › Link Bio
 * Mengatur tombol di halaman virdtec.com/link (data/links.json) dan menyimpannya
 * ke GitHub dengan token admin yang sama.
 */
(function () {
  'use strict';

  var A = function () { return window.virdtecAdmin; };
  var $ = function (id) { return document.getElementById(id); };
  var PATH = 'data/links.json';
  var BIO_URL = 'https://www.virdtec.com/link?utm_source=instagram';
  var WA_NUMBER = '6289501816060';
  var ICONS = function () { return window.VIRDTEC_LINK_ICONS || {}; };
  var safeUrl = function (u) { return window.VIRDTEC_SAFE_URL(u); };

  var L = { title: '', subtitle: '', links: [], sha: null, original: '', loaded: false };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }

  // ---------------------------------------------------------------- WhatsApp helpers
  function parseWa(url) {
    var m = String(url || '').match(/^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\/?(\d*)\??(.*)$/i);
    if (!m) return null;
    var num = m[1], text = '';
    var q = new URLSearchParams(m[2] || '');
    if (!num) num = (q.get('phone') || '').replace(/\D/g, '');
    text = q.get('text') || '';
    return { num: num || WA_NUMBER, msg: text };
  }
  function buildWa(num, msg) {
    num = String(num || '').replace(/\D/g, '').replace(/^0/, '62');
    return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  var PRESETS = {
    whatsapp: { label: 'Chat WhatsApp', sub: '', icon: 'whatsapp', style: 'primary',
      url: buildWa(WA_NUMBER, 'Halo ViRdtec, saya lihat dari Instagram dan ingin bertanya.') },
    instagram: { label: 'Instagram ViRdtec', sub: '', icon: 'instagram', url: 'https://www.instagram.com/virdtec' },
    facebook: { label: 'Facebook ViRdtec', sub: '', icon: 'facebook', url: 'https://www.facebook.com/profile.php?id=61590403853435' },
    youtube: { label: 'YouTube ViRdtec', sub: '', icon: 'youtube', url: 'https://www.youtube.com/@' },
    tiktok: { label: 'TikTok ViRdtec', sub: '', icon: 'tiktok', url: 'https://www.tiktok.com/@' },
    maps: { label: 'Lokasi di Google Maps', sub: '', icon: 'maps', url: 'https://maps.app.goo.gl/' },
    review: { label: 'Beri ulasan di Google', sub: 'Terima kasih atas dukungan Anda', icon: 'star', url: 'https://g.page/r/' },
    page: { label: 'Halaman website', sub: '', icon: 'globe', url: '/?utm_source=instagram&utm_medium=bio' },
    custom: { label: 'Link baru', sub: '', icon: 'link', url: 'https://' }
  };

  // ---------------------------------------------------------------- state
  function serialize() {
    return {
      title: L.title,
      subtitle: L.subtitle,
      links: L.links.map(function (l) {
        return { id: l.id, label: l.label, sub: l.sub || '', url: l.url, icon: l.icon || 'link',
          style: l.style === 'primary' ? 'primary' : 'normal', show: l.show !== false };
      })
    };
  }
  function isDirty() { return L.loaded && JSON.stringify(serialize()) !== L.original; }
  function updateBar() { $('lb-savebar').hidden = !isDirty(); }

  function problems(l) {
    if (l.show === false) return '';
    if (!String(l.label || '').trim()) return 'Judul tombol belum diisi.';
    if (!safeUrl(l.url)) return 'Link harus diawali https:// (atau / untuk halaman di website ini).';
    if (/(\/@|\/r\/|goo\.gl\/|^https?:\/\/)$/i.test(l.url)) return 'Link belum lengkap — lengkapi alamatnya.';
    return '';
  }

  // ---------------------------------------------------------------- preview
  function renderPreview() {
    var box = $('lb-preview');
    box.textContent = '';
    var logo = el('img', 'lbp-logo');
    logo.src = '../images/web/logo-bulat-256.png';
    logo.alt = 'Logo ViRdtec';
    box.appendChild(logo);
    box.appendChild(el('p', 'lbp-title', L.title));
    var sub = el('p', 'lbp-sub');
    String(L.subtitle || '').split('\n').forEach(function (line, i) {
      if (i) sub.appendChild(document.createElement('br'));
      sub.appendChild(document.createTextNode(line));
    });
    box.appendChild(sub);
    L.links.forEach(function (l) {
      if (l.show === false || !l.label) return;
      var b = el('div', 'lbp-btn' + (l.style === 'primary' ? ' is-primary' : ''));
      var ic = el('span', 'lbp-ic');
      ic.innerHTML = (ICONS()[l.icon] || ICONS().link || { svg: '' }).svg; // ikon dari daftar tetap, bukan input pengguna
      b.appendChild(ic);
      var t = el('span', 'lbp-text', l.label);
      if (l.sub) t.appendChild(el('small', null, l.sub));
      b.appendChild(t);
      box.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- editor
  function field(labelText, input) {
    var lab = el('label', null, labelText);
    lab.appendChild(input);
    return lab;
  }

  function renderList() {
    var list = $('lb-list');
    list.textContent = '';
    if (!L.links.length) list.appendChild(el('p', 'muted small', 'Belum ada tombol. Tambahkan lewat tombol di bawah.'));
    var icons = ICONS();

    L.links.forEach(function (l, i) {
      var card = el('article', 'lb-item' + (l.show === false ? ' is-off' : ''));

      var top = el('div', 'lb-item-top');
      var chip = el('span', 'lb-chip' + (l.style === 'primary' ? ' is-primary' : ''));
      chip.innerHTML = (icons[l.icon] || icons.link || { svg: '' }).svg;
      top.appendChild(chip);
      top.appendChild(el('strong', 'lb-item-name', l.label || '(tanpa judul)'));
      var showLab = el('label', 'lb-show');
      var show = document.createElement('input');
      show.type = 'checkbox';
      show.checked = l.show !== false;
      show.addEventListener('change', function () { l.show = show.checked; card.classList.toggle('is-off', !show.checked); changed(); });
      showLab.appendChild(show);
      showLab.appendChild(document.createTextNode(' Tampilkan'));
      top.appendChild(showLab);
      card.appendChild(top);

      var grid = el('div', 'lb-fields');
      var label = document.createElement('input');
      label.type = 'text'; label.maxLength = 60; label.value = l.label || '';
      label.addEventListener('input', function () { l.label = label.value; top.querySelector('.lb-item-name').textContent = l.label || '(tanpa judul)'; changed(card, l); });
      grid.appendChild(field('Judul tombol', label));

      var sub = document.createElement('input');
      sub.type = 'text'; sub.maxLength = 80; sub.value = l.sub || ''; sub.placeholder = 'opsional';
      sub.addEventListener('input', function () { l.sub = sub.value; changed(); });
      grid.appendChild(field('Keterangan kecil', sub));

      var icon = document.createElement('select');
      Object.keys(icons).forEach(function (k) {
        var o = el('option', null, icons[k].name);
        o.value = k;
        icon.appendChild(o);
      });
      icon.value = icons[l.icon] ? l.icon : 'link';
      icon.addEventListener('change', function () {
        var wasWa = l.icon === 'whatsapp';
        l.icon = icon.value;
        if (l.icon === 'whatsapp' && !parseWa(l.url)) l.url = buildWa(WA_NUMBER, '');
        if (wasWa !== (l.icon === 'whatsapp')) { renderList(); changed(); return; }
        chip.innerHTML = (icons[l.icon] || icons.link).svg;
        changed();
      });
      grid.appendChild(field('Ikon', icon));

      var style = document.createElement('select');
      [['normal', 'Biasa (putih)'], ['primary', 'Utama (hijau)']].forEach(function (o) {
        var opt = el('option', null, o[1]); opt.value = o[0]; style.appendChild(opt);
      });
      style.value = l.style === 'primary' ? 'primary' : 'normal';
      style.addEventListener('change', function () { l.style = style.value; chip.classList.toggle('is-primary', l.style === 'primary'); changed(); });
      grid.appendChild(field('Warna tombol', style));
      card.appendChild(grid);

      var wa = l.icon === 'whatsapp' ? parseWa(l.url) : null;
      if (wa) {
        var waGrid = el('div', 'lb-fields');
        var num = document.createElement('input');
        num.type = 'tel'; num.value = wa.num;
        var msg = document.createElement('textarea');
        msg.rows = 2; msg.value = wa.msg; msg.placeholder = 'Pesan yang otomatis terisi saat pelanggan membuka WhatsApp';
        var sync = function () { l.url = buildWa(num.value, msg.value); changed(card, l); };
        num.addEventListener('input', sync);
        msg.addEventListener('input', sync);
        waGrid.appendChild(field('Nomor WhatsApp', num));
        waGrid.appendChild(field('Pesan otomatis', msg));
        waGrid.classList.add('lb-wa');
        card.appendChild(waGrid);
      } else {
        var url = document.createElement('input');
        url.type = 'url'; url.value = l.url || ''; url.placeholder = 'https://…';
        url.addEventListener('input', function () { l.url = url.value.trim(); changed(card, l); });
        var f = field('Link (alamat tujuan)', url);
        f.classList.add('lb-url');
        card.appendChild(f);
      }

      card.appendChild(el('p', 'lb-err', problems(l)));

      var act = el('div', 'item-actions');
      [['↑', 'Pindah ke atas', -1], ['↓', 'Pindah ke bawah', 1]].forEach(function (b) {
        var btn = el('button', 'icon-btn', b[0]);
        btn.type = 'button'; btn.title = b[1]; btn.setAttribute('aria-label', b[1]);
        var j = i + b[2];
        btn.disabled = j < 0 || j >= L.links.length;
        btn.addEventListener('click', function () {
          var t = L.links[i]; L.links[i] = L.links[j]; L.links[j] = t;
          renderList(); changed();
        });
        act.appendChild(btn);
      });
      var del = el('button', 'icon-btn danger', 'Hapus');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!confirm('Hapus tombol "' + (l.label || 'ini') + '"?')) return;
        L.links.splice(i, 1);
        renderList(); changed();
      });
      act.appendChild(del);
      card.appendChild(act);
      list.appendChild(card);
    });
  }

  function changed(card, l) {
    if (card && l) card.querySelector('.lb-err').textContent = problems(l);
    renderPreview();
    updateBar();
  }

  // ---------------------------------------------------------------- load / save
  function apply(data) {
    L.title = data.title || '';
    L.subtitle = data.subtitle || '';
    L.links = (data.links || []).map(function (l) { return Object.assign({ id: uid() }, l); });
    L.original = JSON.stringify(serialize());
    L.loaded = true;
    $('lb-title').value = L.title;
    $('lb-sub').value = L.subtitle;
    renderList();
    renderPreview();
    updateBar();
    $('lb-loading').hidden = true;
    $('lb-body').hidden = false;
  }

  function load() {
    var a = A();
    if (!a || !a.token()) return;
    $('lb-loading').hidden = false;
    $('lb-loading').textContent = 'Memuat…';
    $('lb-body').hidden = true;
    a.gh(a.repo + '/contents/' + PATH + '?ref=' + encodeURIComponent(a.cfg.branch))
      .then(function (f) {
        L.sha = f.sha;
        apply(JSON.parse(a.b64ToUtf8(f.content)));
      }, function (err) {
        if (err.status !== 404) throw err;
        // belum ada file: ambil isi bawaan dari website
        return fetch('../data/links.json', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : { links: [] }; })
          .then(function (d) { L.sha = null; apply(d); });
      })
      .catch(function (err) { $('lb-loading').textContent = 'Gagal memuat link bio. ' + a.explain(err); });
  }

  function save() {
    var a = A();
    var bad = L.links.map(problems).filter(Boolean);
    if (bad.length) {
      alert('Ada ' + bad.length + ' tombol yang perlu dilengkapi (lihat tulisan merah).');
      return;
    }
    var data = serialize();
    data.updated = new Date().toISOString();
    var json = JSON.stringify({ updated: data.updated, title: data.title, subtitle: data.subtitle, links: data.links }, null, 2) + '\n';
    var body = { message: 'Admin: update link bio', content: utf8ToB64(json), branch: a.cfg.branch };
    if (L.sha) body.sha = L.sha;
    $('lb-save').disabled = true;
    a.busy('Menyimpan link bio…');
    a.gh(a.repo + '/contents/' + PATH, 'PUT', body)
      .then(function (res) {
        L.sha = res && res.content ? res.content.sha : L.sha;
        L.original = JSON.stringify(serialize());
        updateBar();
        a.busy(false);
        a.toast('Tersimpan! Halaman link bio ter-update dalam ±1–3 menit.', 'ok', 6000);
      })
      .catch(function (err) {
        a.busy(false);
        if (err.status === 409 || err.status === 422) {
          alert('Link bio telah diubah dari tempat lain sejak halaman ini dibuka. Klik "Batalkan" untuk memuat ulang, lalu ulangi perubahan Anda.');
        } else {
          alert('Gagal menyimpan. ' + a.explain(err));
        }
      })
      .then(function () { $('lb-save').disabled = false; });
  }

  // ---------------------------------------------------------------- events
  $('lb-title').addEventListener('input', function () { L.title = this.value; changed(); });
  $('lb-sub').addEventListener('input', function () { L.subtitle = this.value; changed(); });
  $('lb-add').addEventListener('click', function () {
    var p = PRESETS[$('lb-preset').value] || PRESETS.custom;
    L.links.push(Object.assign({ id: uid(), style: 'normal', show: true }, p));
    renderList(); changed();
    var cards = document.querySelectorAll('#lb-list .lb-item');
    var last = cards[cards.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); last.querySelector('input').focus(); }
  });
  $('lb-save').addEventListener('click', save);
  $('lb-discard').addEventListener('click', function () {
    if (confirm('Batalkan semua perubahan link bio yang belum disimpan?')) load();
  });
  $('lb-copy').addEventListener('click', function () {
    var done = function () { A().toast('Link disalin: ' + BIO_URL, 'ok'); };
    if (navigator.clipboard) navigator.clipboard.writeText(BIO_URL).then(done, function () { prompt('Salin link ini:', BIO_URL); });
    else prompt('Salin link ini:', BIO_URL);
  });
  document.addEventListener('admin:tab', function (e) {
    if (e.detail === 'links' && !isDirty()) load();
  });
  window.addEventListener('beforeunload', function (e) {
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
})();
