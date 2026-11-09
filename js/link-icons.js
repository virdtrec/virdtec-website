/* Ikon untuk halaman /link — dipakai link.html dan admin (tab Link Bio). */
(function () {
  'use strict';
  var s = function (d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" d="' + d + '"/></svg>';
  };
  window.VIRDTEC_LINK_ICONS = {
    whatsapp: { name: 'WhatsApp', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01Zm-7.01 15.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>' },
    gallery: { name: 'Galeri / foto', svg: s('M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4 M15 9h.01') },
    bolt: { name: 'Petir / produk', svg: s('M13 2 4 14h7l-1 8 9-12h-7l1-8Z') },
    faq: { name: 'Tanya jawab', svg: s('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01') },
    globe: { name: 'Website', svg: s('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20') },
    facebook: { name: 'Facebook', svg: s('M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z') },
    instagram: { name: 'Instagram', svg: s('M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z M17.5 6.5h.01') },
    youtube: { name: 'YouTube', svg: s('M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49 49 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49 49 0 0 1-16.2 0A2 2 0 0 1 2.5 17Z M10 15l5-3-5-3z') },
    tiktok: { name: 'TikTok', svg: s('M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5') },
    maps: { name: 'Lokasi / Maps', svg: s('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z') },
    star: { name: 'Ulasan / bintang', svg: s('M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z') },
    cart: { name: 'Belanja / katalog', svg: s('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0') },
    phone: { name: 'Telepon', svg: s('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z') },
    link: { name: 'Link umum', svg: s('M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7') }
  };

  // Hanya izinkan https://, http://, mailto:, tel: atau link di dalam website (/...)
  window.VIRDTEC_SAFE_URL = function (u) {
    u = String(u || '').trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
    if (/^\/(?!\/)/.test(u)) return u;
    return '';
  };
})();
