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
