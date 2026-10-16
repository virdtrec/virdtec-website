# Website ViRdtec (virdtec.com)

Website statis (HTML/CSS/JS tanpa build). Struktur utama:

| Path | Isi |
|---|---|
| `index.html` | Halaman utama |
| `css/style.css`, `js/main.js` | Tampilan & interaksi (menu, galeri, lightbox) |
| `data/gallery.json` | Daftar foto/video galeri — diatur lewat halaman admin |
| `media/` | Foto/video yang di-upload lewat admin |
| `images/web/` | Gambar website yang sudah dikompres |
| `admin/` | Halaman admin galeri (`/admin`) |

## Admin galeri (`https://www.virdtec.com/admin/`)

Untuk menambah / mengubah / menghapus / mengurutkan foto & video di galeri.

1. Buat token sekali saja: GitHub → Settings → Developer settings →
   **Fine-grained personal access tokens** → *Generate new token*
   - Repository access: *Only select repositories* → `virdtec-website`
   - Permissions → Repository permissions → **Contents: Read and write**
2. Buka `/admin`, tempel token, klik **Masuk**.
3. Klik **Upload foto / video** (atau seret file), isi judul/lokasi/kategori,
   lalu klik **Simpan & Publikasikan**.

Setiap simpan = 1 commit ke branch `main`. Hosting yang terhubung ke repo akan
mem-publish ulang otomatis (biasanya 1–3 menit).

Catatan:
- Foto otomatis dikecilkan (maks. 1600 px) + dibuat thumbnail.
- Video upload maks. 25 MB. Video lebih panjang → upload ke YouTube lalu
  gunakan **Tambah video YouTube**.
- Pengaturan (repo, branch, batas ukuran) ada di `admin/config.js`.

## Statistik pengunjung (`/admin` → tab **Statistik**)

Website mencatat kunjungan halaman dan klik tombol WhatsApp lewat
Cloudflare Pages Functions (`functions/api/hit.js`) ke database
**Cloudflare D1**. Ringkasannya dibaca admin lewat `functions/api/stats.js`
(hanya untuk token GitHub milik akun di `ADMIN_GITHUB_USERS`, default `virdtrec`).

Aktifkan sekali di dash.cloudflare.com:
1. Storage & Databases → D1 SQL Database → Create → nama `virdtec-stats`.
2. Workers & Pages → `virdtec-website` → Settings → Bindings → Add → D1 database,
   Variable name `DB`, pilih `virdtec-stats` → Save.
3. Deployments → Retry deployment.

Tabel dibuat otomatis. Tanpa cookie; IP tidak disimpan (pengunjung dikenali
dengan hash harian). Data lebih dari ±13 bulan dihapus otomatis.
