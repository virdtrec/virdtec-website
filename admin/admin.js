/*
 * ViRdtec – Admin Galeri
 *
 * Halaman statis: tidak butuh server. Perubahan disimpan langsung ke repo GitHub
 * (data/gallery.json + file di folder media/) lewat GitHub API memakai
 * fine-grained Personal Access Token milik admin. Hosting yang terhubung ke repo
 * akan otomatis mem-publish ulang website setelah commit.
 */
(function () {
  'use strict';

  var cfg = window.VIRDTEC_ADMIN;
  var API = 'https://api.github.com';
  var TOKEN_KEY = 'virdtec_admin_token';
  var REPO = '/repos/' + cfg.owner + '/' + cfg.repo;

  var S = {
    token: null,
    items: [],          // item galeri + field internal (_new, _uploads, _preview)
    original: '[]',     // JSON item saat terakhir dimuat / disimpan
    gallerySha: null,   // sha blob gallery.json saat dimuat (deteksi bentrok)
    deletes: []         // path file media yang akan dihapus dari repo
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------------------------------------------------------------- utils
  function toast(msg, kind, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, ms || 4000);
  }
  function busy(text) {
    if (text === false) { $('busy').hidden = true; return; }
    $('busy-text').textContent = text;
    $('busy').hidden = false;
  }
  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'media';
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function siteUrl(path) { return /^https?:\/\//.test(path) ? path : '../' + path.replace(/^\/+/, ''); }
  function rawUrl(path) { return 'https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch + '/' + path.replace(/^\/+/, ''); }
  function b64ToUtf8(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function youtubeId(url) {
    var m = String(url).trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ---------------------------------------------------------------- GitHub API
  function gh(path, method, body) {
    return fetch(API + path, {
      method: method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + S.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* ignore */ }
        if (!res.ok) {
          var err = new Error((data && data.message) || res.statusText);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }
  function explain(err) {
    if (!err || !err.status) return 'Koneksi gagal. Periksa internet Anda lalu coba lagi.';
    if (err.status === 401) return 'Token tidak valid atau sudah kedaluwarsa.';
    if (err.status === 403) return 'Token tidak punya izin. Pastikan permission "Contents" = Read and write. (' + err.message + ')';
    if (err.status === 404) return 'Repo ' + cfg.owner + '/' + cfg.repo + ' tidak ditemukan atau token tidak diberi akses ke repo ini.';
    if (err.status === 413 || /too large/i.test(err.message)) return 'File terlalu besar untuk diunggah.';
    return 'Gagal (' + err.status + '): ' + err.message;
  }

  // ---------------------------------------------------------------- state
  function serialize() {
    return S.items.map(function (it) {
      var o = { id: it.id, type: it.type };
      if (it.type === 'youtube') o.youtubeId = it.youtubeId; else o.src = it.src;
      if (it.thumb) o.thumb = it.thumb;
      if (it.poster) o.poster = it.poster;
      o.title = it.title || '';
      o.location = it.location || '';
      o.category = it.category || 'proyek';
      return o;
    });
  }
  function isDirty() { return S.deletes.length > 0 || JSON.stringify(serialize()) !== S.original; }
  function updateSavebar() {
    var dirty = isDirty();
    $('savebar').hidden = !dirty;
    if (dirty) {
      var n = S.items.filter(function (i) { return i._new; }).length;
      var parts = [];
      if (n) parts.push(n + ' item baru');
      if (S.deletes.length) parts.push(S.deletes.length + ' file dihapus');
      $('savebar-text').textContent = 'Perubahan belum disimpan' + (parts.length ? ' · ' + parts.join(', ') : '');
    }
    $('count').textContent = S.items.length;
  }

  // ---------------------------------------------------------------- rendering
  function mediaEl(it) {
    var el;
    var src = it._preview || null;
    if (it.type === 'youtube') {
      el = document.createElement('img');
      el.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(it.youtubeId) + '/hqdefault.jpg';
    } else if (it.type === 'video' && !it._posterPreview && !it.poster) {
      el = document.createElement('video');
      el.muted = true; el.preload = 'metadata'; el.playsInline = true;
      el.src = src || siteUrl(it.src);
    } else {
      el = document.createElement('img');
      var path = it.type === 'video' ? it.poster : (it.thumb || it.src);
      el.src = it._posterPreview || src || siteUrl(path);
      // File yang baru di-commit mungkin belum ter-deploy → coba ambil dari GitHub
      el.onerror = function () { el.onerror = null; if (path && !/^https?:/.test(path)) el.src = rawUrl(path); };
    }
    el.loading = 'lazy';
    el.alt = it.title || '';
    return el;
  }

  function render() {
    var box = $('items');
    box.innerHTML = '';
    if (!S.items.length) {
      box.innerHTML = '<p class="items-empty">Galeri masih kosong. Klik “Upload foto / video” untuk menambahkan.</p>';
      updateSavebar();
      return;
    }
    var tpl = $('tpl-item');
    S.items.forEach(function (it, i) {
      var node = tpl.content.firstElementChild.cloneNode(true);
      node.classList.toggle('is-new', !!it._new);
      var media = node.querySelector('.item-media');
      media.appendChild(mediaEl(it));
      var badges = node.querySelector('.item-badges');
      var label = it.type === 'youtube' ? ['YouTube', 'badge-yt'] : it.type === 'video' ? ['Video', ''] : ['Foto', ''];
      badges.insertAdjacentHTML('beforeend', '<span class="badge ' + label[1] + '">' + label[0] + '</span>');
      if (it._new) badges.insertAdjacentHTML('beforeend', '<span class="badge badge-new">Baru</span>');

      var title = node.querySelector('.f-title');
      var loc = node.querySelector('.f-location');
      var cat = node.querySelector('.f-category');
      title.value = it.title || '';
      loc.value = it.location || '';
      cat.value = it.category || 'proyek';
      title.addEventListener('input', function () { it.title = title.value.trim(); updateSavebar(); });
      loc.addEventListener('input', function () { it.location = loc.value.trim(); updateSavebar(); });
      cat.addEventListener('change', function () { it.category = cat.value; updateSavebar(); });

      var up = node.querySelector('.a-up');
      var down = node.querySelector('.a-down');
      up.disabled = i === 0;
      down.disabled = i === S.items.length - 1;
      up.addEventListener('click', function () { move(i, -1); });
      down.addEventListener('click', function () { move(i, 1); });
      node.querySelector('.a-del').addEventListener('click', function () { remove(i); });
      box.appendChild(node);
    });
    updateSavebar();
  }

  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= S.items.length) return;
    var t = S.items[i]; S.items[i] = S.items[j]; S.items[j] = t;
    render();
  }

  function remove(i) {
    var it = S.items[i];
    if (!confirm('Hapus "' + (it.title || 'item ini') + '" dari galeri?')) return;
    S.items.splice(i, 1);
    if (it._preview) URL.revokeObjectURL(it._preview);
    if (it._posterPreview) URL.revokeObjectURL(it._posterPreview);
    if (!it._new) {
      // Hanya file hasil upload admin (folder media/) yang ikut dihapus dari repo
      [it.src, it.thumb, it.poster].forEach(function (p) {
        if (p && p.indexOf(cfg.mediaDir + '/') === 0 && S.deletes.indexOf(p) < 0) S.deletes.push(p);
      });
    }
    render();
  }

  // ---------------------------------------------------------------- file processing
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Format gambar tidak didukung browser ini (' + (file.type || file.name) + '). Ubah ke JPG/PNG terlebih dahulu.')); };
      img.src = url;
    });
  }
  function drawToJpeg(source, w, h, scale) {
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cw, ch);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gagal memproses gambar.')); }, 'image/jpeg', cfg.imageQuality);
    });
  }
  function basePath(file) {
    var d = new Date();
    var dir = cfg.mediaDir + '/' + d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/';
    return dir + slug(file.name) + '-' + uid();
  }

  function processImage(file) {
    var base = basePath(file);
    if (file.type === 'image/gif') {
      // GIF disimpan apa adanya agar animasi tidak hilang
      var p = base + '.gif';
      return Promise.resolve({
        id: uid(), type: 'image', src: p, _uploads: [{ path: p, blob: file }], _preview: URL.createObjectURL(file)
      });
    }
    return loadImage(file).then(function (r) {
      var w = r.img.naturalWidth, h = r.img.naturalHeight;
      var mainScale = Math.min(1, cfg.imageMaxSize / Math.max(w, h));
      var thumbScale = Math.min(1, cfg.thumbSize / Math.min(w, h));
      return Promise.all([drawToJpeg(r.img, w, h, mainScale), drawToJpeg(r.img, w, h, thumbScale)]).then(function (out) {
        URL.revokeObjectURL(r.url);
        var main = base + '.jpg', thumb = base + '-thumb.jpg';
        var uploads = [{ path: main, blob: out[0] }];
        var item = { id: uid(), type: 'image', src: main, _uploads: uploads, _preview: URL.createObjectURL(out[1]) };
        if (thumbScale < mainScale * 0.75) { uploads.push({ path: thumb, blob: out[1] }); item.thumb = thumb; }
        return item;
      });
    });
  }

  function videoPoster(url) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      var done = false;
      function finish(b) { if (!done) { done = true; resolve(b); } }
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadedmetadata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
      v.onseeked = function () {
        var w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return finish(null);
        drawToJpeg(v, w, h, Math.min(1, 1280 / Math.max(w, h))).then(finish, function () { finish(null); });
      };
      v.onerror = function () { finish(null); };
      setTimeout(function () { finish(null); }, 8000);
      v.src = url;
    });
  }

  function processVideo(file) {
    var mb = file.size / 1048576;
    if (mb > cfg.maxVideoMB) {
      return Promise.reject(new Error('"' + file.name + '" berukuran ' + mb.toFixed(1) + ' MB (maks. ' + cfg.maxVideoMB + ' MB). Upload video ini ke YouTube lalu gunakan tombol "Tambah video YouTube".'));
    }
    var ext = (file.name.match(/\.(mp4|webm|mov|m4v)$/i) || [, file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4'])[1].toLowerCase();
    var base = basePath(file);
    var src = base + '.' + ext;
    var url = URL.createObjectURL(file);
    return videoPoster(url).then(function (poster) {
      var item = { id: uid(), type: 'video', src: src, _uploads: [{ path: src, blob: file }], _preview: url };
      if (poster) {
        item.poster = base + '-poster.jpg';
        item._uploads.push({ path: item.poster, blob: poster });
        item._posterPreview = URL.createObjectURL(poster);
      }
      return item;
    });
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var added = [], errors = [];
    var chain = Promise.resolve();
    files.forEach(function (f, idx) {
      chain = chain.then(function () {
        busy('Memproses ' + (idx + 1) + '/' + files.length + ': ' + f.name);
        var p = /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name) ? processVideo(f)
          : /^image\//.test(f.type) && f.type !== 'image/svg+xml' ? processImage(f)
          : Promise.reject(new Error('"' + f.name + '" bukan foto/video yang didukung.'));
        return p.then(function (it) {
          it._new = true;
          it.title = '';
          it.location = '';
          it.category = 'proyek';
          added.push(it);
        }, function (e) { errors.push(e.message); });
      });
    });
    chain.then(function () {
      busy(false);
      S.items = added.concat(S.items);
      render();
      if (added.length) toast(added.length + ' item ditambahkan. Isi judul & lokasi, lalu klik "Simpan & Publikasikan".', 'ok', 6000);
      if (errors.length) alert(errors.join('\n\n'));
    });
  }

  // ---------------------------------------------------------------- load / save
  function loadGallery() {
    busy('Memuat galeri…');
    return gh(REPO + '/contents/' + cfg.galleryPath + '?ref=' + encodeURIComponent(cfg.branch))
      .then(function (f) {
        var data = JSON.parse(b64ToUtf8(f.content));
        S.gallerySha = f.sha;
        return (data && data.items) || [];
      }, function (err) {
        if (err.status === 404) {
          // Repo bisa diakses tapi file belum ada → mulai dari kosong
          return gh(REPO).then(function () { S.gallerySha = null; return []; });
        }
        throw err;
      })
      .then(function (items) {
        S.items = items;
        S.deletes = [];
        S.original = JSON.stringify(serialize());
        render();
        busy(false);
      });
  }

  function save() {
    if (!isDirty()) return;
    var missing = S.items.filter(function (i) { return !i.title; }).length;
    if (missing && !confirm(missing + ' item belum punya judul. Tetap simpan?')) return;

    var uploads = [];
    S.items.forEach(function (it) { (it._uploads || []).forEach(function (u) { uploads.push(u); }); });
    var blobs = [];
    var n = 0;

    $('btn-save').disabled = true;
    var chain = Promise.resolve();
    uploads.forEach(function (u) {
      chain = chain.then(function () {
        n++;
        busy('Mengunggah file ' + n + '/' + uploads.length + ' (' + (u.blob.size / 1048576).toFixed(1) + ' MB)…');
        return blobToBase64(u.blob).then(function (b64) {
          return gh(REPO + '/git/blobs', 'POST', { content: b64, encoding: 'base64' });
        }).then(function (res) {
          blobs.push({ path: u.path, mode: '100644', type: 'blob', sha: res.sha });
        });
      });
    });

    var json = JSON.stringify({ updated: new Date().toISOString(), items: serialize() }, null, 2) + '\n';
    var added = S.items.filter(function (i) { return i._new; }).length;
    var message = 'Admin: update galeri' +
      (added ? ' (+' + added + ' baru)' : '') +
      (S.deletes.length ? ' (-' + S.deletes.length + ' file)' : '');

    function commit(attempt) {
      busy('Menyimpan perubahan…');
      var headSha, newTreeSha;
      return gh(REPO + '/git/ref/heads/' + cfg.branch)
        .then(function (ref) {
          headSha = ref.object.sha;
          return gh(REPO + '/contents/' + cfg.galleryPath + '?ref=' + headSha).then(
            function (f) { return f.sha; },
            function (e) { if (e.status === 404) return null; throw e; });
        })
        .then(function (remoteSha) {
          if (remoteSha !== S.gallerySha) {
            var e = new Error('Galeri telah diubah dari perangkat/tempat lain sejak halaman ini dibuka. Muat ulang halaman (perubahan Anda yang belum tersimpan akan hilang) lalu ulangi.');
            e.conflict = true;
            throw e;
          }
          return gh(REPO + '/git/commits/' + headSha);
        })
        .then(function (c) {
          if (!S.deletes.length) return [c, []];
          // Hanya hapus file yang memang ada (menghapus path yang tidak ada membuat API error)
          return gh(REPO + '/git/trees/' + c.tree.sha + '?recursive=1').then(function (t) {
            var existing = {};
            (t.tree || []).forEach(function (e) { existing[e.path] = true; });
            return [c, S.deletes.filter(function (p) { return existing[p]; })];
          });
        })
        .then(function (r) {
          var tree = blobs.concat([{ path: cfg.galleryPath, mode: '100644', type: 'blob', content: json }]);
          r[1].forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
          return gh(REPO + '/git/trees', 'POST', { base_tree: r[0].tree.sha, tree: tree });
        })
        .then(function (t) {
          newTreeSha = t.sha;
          var g = (t.tree || []).filter(function (e) { return e.path === cfg.galleryPath; })[0];
          S._newGallerySha = g ? g.sha : null;
          return gh(REPO + '/git/commits', 'POST', { message: message, tree: newTreeSha, parents: [headSha] });
        })
        .then(function (c) {
          return gh(REPO + '/git/refs/heads/' + cfg.branch, 'PATCH', { sha: c.sha, force: false });
        })
        .catch(function (e) {
          // Branch bergerak di tengah proses (commit lain masuk) → ulangi dengan head terbaru
          if (!e.conflict && (e.status === 422 || e.status === 409) && attempt < 3) return commit(attempt + 1);
          throw e;
        });
    }

    chain.then(function () { return commit(1); })
      .then(function () {
        S.gallerySha = S._newGallerySha;
        S.items.forEach(function (it) { delete it._new; delete it._uploads; });
        S.deletes = [];
        S.original = JSON.stringify(serialize());
        render();
        busy(false);
        toast('Tersimpan! Website akan ter-update otomatis dalam ±1–3 menit.', 'ok', 7000);
      })
      .catch(function (e) {
        busy(false);
        alert(e.conflict ? e.message : 'Gagal menyimpan. ' + explain(e));
      })
      .then(function () { $('btn-save').disabled = false; });
  }

  // ---------------------------------------------------------------- auth / views
  function showLogin(msg) {
    $('view-app').hidden = true;
    $('view-login').hidden = false;
    $('login-error').textContent = msg || '';
    $('token').focus();
  }
  function startApp() {
    return loadGallery().then(function () {
      $('view-login').hidden = true;
      $('view-app').hidden = false;
    });
  }
  function storedToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function storeToken(t, remember) {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
    } catch (e) { /* storage tidak tersedia */ }
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    S.token = $('token').value.trim();
    if (!S.token) return;
    $('login-error').textContent = '';
    startApp().then(function () {
      storeToken(S.token, $('remember').checked);
      $('token').value = '';
    }, function (err) {
      busy(false);
      S.token = null;
      $('login-error').textContent = explain(err);
    });
  });

  $('btn-logout').addEventListener('click', function () {
    if (isDirty() && !confirm('Ada perubahan yang belum disimpan. Tetap keluar?')) return;
    storeToken(null);
    S.token = null;
    S.items = []; S.deletes = []; S.original = '[]';
    showLogin();
  });

  $('btn-save').addEventListener('click', save);
  $('btn-discard').addEventListener('click', function () {
    if (!confirm('Batalkan semua perubahan yang belum disimpan?')) return;
    loadGallery().catch(function (e) { busy(false); alert(explain(e)); });
  });

  $('file-input').addEventListener('change', function (e) {
    addFiles(e.target.files);
    e.target.value = '';
  });

  // Drag & drop
  var dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
      e.preventDefault();
      dz.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    window.addEventListener(ev, function () { dz.classList.remove('is-over'); });
  });
  window.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    if (!$('view-app').hidden) addFiles(e.dataTransfer.files);
  });

  // YouTube
  var dlg = $('dlg-youtube');
  $('btn-youtube').addEventListener('click', function () {
    $('yt-url').value = '';
    $('yt-error').textContent = '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    $('yt-url').focus();
  });
  $('yt-cancel').addEventListener('click', function () { dlg.close(); });
  $('yt-form').addEventListener('submit', function (e) {
    var id = youtubeId($('yt-url').value);
    if (!id) {
      e.preventDefault();
      $('yt-error').textContent = 'Link YouTube tidak dikenali. Contoh: https://youtu.be/abc123XYZ_0';
      return;
    }
    S.items.unshift({ id: uid(), type: 'youtube', youtubeId: id, title: '', location: '', category: 'proyek', _new: true });
    render();
    toast('Video ditambahkan. Isi judul lalu klik "Simpan & Publikasikan".', 'ok');
  });

  window.addEventListener('beforeunload', function (e) {
    if (S.token && isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- init
  $('max-video').textContent = cfg.maxVideoMB;
  $('help-repo').textContent = cfg.repo;
  S.token = storedToken();
  if (S.token) {
    startApp().catch(function (err) {
      busy(false);
      if (err.status === 401) storeToken(null);
      S.token = null;
      showLogin(explain(err));
    });
  } else {
    showLogin();
  }
})();
