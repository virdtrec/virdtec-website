/*
 * Pengaturan halaman admin galeri ViRdtec.
 * Ubah nilai di sini jika repo / branch berubah.
 */
window.VIRDTEC_ADMIN = {
  owner: 'virdtrec',            // pemilik repo GitHub
  repo: 'virdtec-website',      // nama repo
  branch: 'main',               // branch yang dipakai hosting website
  galleryPath: 'data/gallery.json',
  mediaDir: 'media',            // folder tempat foto/video hasil upload disimpan
  imageMaxSize: 1600,           // sisi terpanjang foto (px) setelah dikompres
  thumbSize: 640,               // ukuran thumbnail (px) untuk grid galeri
  imageQuality: 0.82,           // kualitas JPEG 0–1
  maxVideoMB: 25                // batas ukuran video upload (video lebih besar → pakai YouTube)
};
