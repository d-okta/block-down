# BlockDown: Rancangan Tema yang Terbuka lewat Prestasi (Fase 6)

Status: **dibangun** (bagian 11). Varian dipilih pemilik lewat pratinjau: Malam B, Neon garis B, Fajar B, Monokrom A.

Dokumen ini menggantikan kandidat "koin, item, toko" di ROADMAP Fase 6. Alasannya ada di bagian 2.

---

## 1. Tujuan

Memberi alasan untuk terus bermain dan rasa bangga atas pencapaian, tanpa mengubah cara bermain dan tanpa merusak arah desain "tenang saat bermain".

Ukuran keberhasilan (dinilai pemilik setelah mencoba):
- Pemain tahu ada hadiah dan tahu cara mendapatkannya, tanpa harus membaca penjelasan panjang.
- Saat bermain, layar tetap setenang sekarang. Pemberitahuan hadiah hanya muncul di layar Game Over.
- Tema baru benar-benar terasa berbeda, bukan hanya ganti satu warna.

## 2. Kenapa bukan koin dan toko

| Koin dan toko | Tema lewat prestasi |
|---|---|
| Perlu mata uang, harga, dan keseimbangan ekonomi | Satu syarat per tema, ya atau tidak |
| Butuh layar toko dan alur beli | Cukup satu baris pilihan di Pengaturan |
| Menambah angka yang harus diperhatikan | Tidak ada angka baru di layar |
| Mudah diubah di browser, jadi koin tidak bermakna | Tetap bisa diubah, tapi yang dirugikan hanya pemain itu sendiri, dan tidak ada yang bisa "dibeli" |
| Mendorong main demi koin | Mendorong main lebih baik |

## 3. Yang terbuka: tema

Satu tema mengubah **tampilan saja**, tidak pernah mengubah aturan, kecepatan, atau ukuran papan. Isi satu tema:
- Tujuh warna blok.
- Gaya blok (cara blok digambar di atlas, misalnya solid, kaca, atau garis).
- Warna latar papan dan garis grid.
- Warna aksen (tombol utama, fokus, cahaya callout).

Tidak termasuk: musik dan suara (tetap satu set, keputusan Fase 4), tata letak, dan font.

Aturan tetap untuk setiap tema:
- Kontras teks dan tombol tetap lolos AA (DESIGN 4.3); diperiksa dengan contrast-check sebelum tema dirilis.
- Ketujuh warna blok bisa dibedakan, dan mode aman buta warna tetap bekerja (pola di atas warna).
- Tetap satu tema gelap per tampilan (taste-skill 4.11). Tema terang hanya jika pemilik memintanya.
- Palet tidak memakai keluarga krem, kuningan, terakota, atau cokelat tua (aturan palet pemilik).

## 4. Daftar tema dan syaratnya (usulan)

Lima tema: satu bawaan dan empat yang terbuka. Syarat diambil dari data yang **sudah dicatat** game sekarang (skor, baris, waktu Sprint, 4 Baris, T-Spin, Combo terpanjang), jadi tidak perlu statistik baru.

| Tema | Kesan | Syarat terbuka | Alasan syarat |
|---|---|---|---|
| **Klasik** | Tampilan sekarang | Bawaan | Titik awal. |
| **Malam** | Biru tua dan ungu redup, blok sedikit transparan seperti kaca | Selesaikan Maraton 150 baris | Prestasi paling umum, didapat dengan bermain tekun. |
| **Neon garis** | Blok hanya garis tepi menyala tipis di latar hitam | Sprint 40 selesai di bawah 3 menit | Hadiah untuk kecepatan. |
| **Fajar** | Hijau laut dan toska lembut, aksen hijau | Satu permainan dengan 4 Baris sebanyak 10 kali | Hadiah untuk bermain rapi (menumpuk untuk 4 Baris). |
| **Monokrom** | Abu-abu bertingkat, hanya piece aktif berwarna | Satu Bersih Total di mode apa pun | Prestasi langka, hadiah paling unik. |

Angka syarat sudah diputuskan pemilik (Sprint diubah dari 2 menjadi 3 menit). Nama dan isi tema juga usulan; desain akhir tiap tema dibuat dan dipilih pemilik lewat halaman pratinjau, seperti saat memilih ikon dan suara.

Kenapa tidak ada syarat "main 100 kali" atau "login tiap hari": syarat seperti itu mengukur waktu, bukan kemampuan, dan mendorong main karena kewajiban.

## 5. Alur pemain

1. **Menu** tidak berubah. Tidak ada tombol "Hadiah" baru.
2. **Saat bermain** tidak ada pemberitahuan apa pun, meskipun syarat tercapai di tengah permainan.
3. **Game Over:** jika permainan itu membuka tema, satu baris muncul di bawah hasil: "Tema Malam terbuka" dengan tombol kecil "Pakai sekarang". Hanya satu baris, sama gaya dengan tag "Rekor baru". Diumumkan juga lewat `aria-live`.
4. **Layar Tema sendiri** (revisi, permintaan pemilik: pemain tidak menyangka ada tema di Pengaturan): dibuka dari ikon palet di baris atas Menu. Satu kartu per tema dengan contoh mini-papan dalam warna dan gaya blok tema itu, nama, dan status ("Sedang dipakai", "Ketuk untuk memakai", atau syaratnya). Tema terkunci bertepi putus-putus, berlabel "Terkunci", dan tidak bisa dipilih. Di atas daftar: "2 dari 5 tema terbuka".

Tema terkunci tetap terlihat beserta syaratnya, supaya pemain tahu apa yang bisa dikejar. Tidak ada progres batang atau persentase (DESIGN melarang bar skor dekoratif).

## 6. Data dan penyimpanan

Disimpan di localStorage yang sama (SPEC 13). Skema naik dari 1 ke 2:

```ts
interface SaveData {
  schema: 2;
  settings: Settings & { theme: ThemeId };   // tema yang dipakai, bawaan "classic"
  records: Records;
  unlocks: { [id in ThemeId]?: string };     // tanggal terbuka (ISO), tidak ada = terkunci
}
```

- Migrasi dari skema 1: `unlocks` kosong, `theme` = `"classic"`. Rekor lama tetap.
- **Rekor lama dihitung:** saat migrasi, tema yang syaratnya sudah terpenuhi oleh rekor tersimpan langsung terbuka. Contoh: rekor Sprint 40 di bawah 3 menit membuka Neon garis. Syarat yang tidak tercatat di rekor (10 kali 4 Baris dalam satu permainan, Bersih Total) baru bisa didapat mulai sekarang.
- Syarat dicek sekali saat permainan berakhir, dari state core yang sudah ada. Permainan yang ditinggalkan lewat "Ke Menu" tidak dihitung, sama seperti rekor.
- Tidak ada server. Pemain bisa membuka semua tema dengan mengubah localStorage; ini diterima karena tidak ada yang dipertaruhkan selain kesenangan pemain itu sendiri.

## 7. Teknis (ringkas)

- `src/render/themes.ts`: definisi kelima tema (warna, gaya blok, latar, aksen). Satu objek per tema, tanpa kode khusus per tema kecuali fungsi gambar blok.
- `sprites.ts`: `buildAtlas` menerima tema. Atlas tetap dibuat sekali, jadi tidak ada beban per frame.
- Warna CSS (aksen, latar papan) lewat variabel CSS di `:root`, diganti saat tema berubah.
- `src/core/unlocks.ts`: fungsi murni `checkUnlocks(result, records, unlocks)` yang mengembalikan tema baru. Diuji dengan `node:test`, termasuk migrasi skema 1 ke 2.
- Tidak ada dependensi baru.

## 8. Yang tidak dikerjakan

- Koin, toko, item, pembelian, iklan.
- Quest harian, daily reward, notifikasi (mendorong main karena kewajiban).
- Leaderboard online dan akun (butuh server dan anti-curang; dirancang terpisah jika suatu saat diinginkan).
- Tema yang mengubah aturan atau memberi keuntungan permainan.

## 9. Keputusan pemilik

1. Tema lewat prestasi menggantikan koin dan toko: setuju.
2. Jumlah tema: lima.
3. Syarat: sesuai bagian 4, dengan Sprint 40 di bawah 3 menit (bukan 2).
4. Rekor lama: dihitung, tema yang syaratnya sudah terpenuhi langsung terbuka.
5. Tampilan tema: dibuat pratinjau untuk dipilih pemilik.

## 10. Kriteria selesai

- [x] Setiap tema lolos kontras AA (teks 14,5 sampai 17,9:1, teks redup 5,6 sampai 7,3:1, tombol aksen 7,1 sampai 17,2:1) dan mode buta warna tetap terbedakan (pola per jenis; di Neon pola digambar dengan warna blok supaya terlihat di isi yang gelap).
- [x] Syarat terbuka diuji dengan tes, termasuk migrasi skema 1 ke 2, rekor lama, tanggal dari rekor, tema terpilih yang belum terbuka, dan data unlocks rusak (4 tes baru, total 63).
- [x] Pemberitahuan hanya di Game Over; tidak ada apa pun saat bermain.
- [x] Ganti tema tidak menambah kerja per frame: atlas blok dibuat sekali per tema dan ukuran. Pengukuran `?perf` di Galaxy A13 menunggu pemilik.
- [x] Desain akhir tiap tema dipilih pemilik lewat pratinjau.

## 11. Yang dibangun

| Bagian | File |
|---|---|
| Syarat dan pencatatan (murni, dites) | `src/core/unlocks.ts` |
| Hitungan Bersih Total per permainan | `src/core/game.ts` (`perfects`) |
| Lima tema: warna blok, gaya blok, grid, variabel CSS | `src/render/themes.ts` |
| Gaya blok kaca, neon, dan lembut; baris atlas piece aktif (Monokrom) | `src/render/sprites.ts` |
| Skema 2, migrasi, rekor lama membuka tema | `src/store/storage.ts` |
| Pilihan tema di Pengaturan | `src/ui/settings.ts`, `index.html`, `styles.css` |
| Pemberitahuan dan Pakai sekarang di Game Over | `src/main.ts`, `index.html` |

Uji di Chrome dengan permainan sungguhan: seed 23 menghasilkan 4 Baris yang juga Bersih Total (dicari dengan `node tests/tools/plan-quad.ts 23 pc`). Zen diakhiri, Game Over menampilkan `Tema Monokrom terbuka` dan mengumumkannya lewat `aria-live`; `Pakai sekarang` mengganti tema, menyimpan, dan mengumumkan; Bersih Total kedua tidak memunculkan pemberitahuan lagi. Data lama dengan Maraton 150 selesai dan Sprint 2:50 langsung membuka Malam dan Neon. Tema terkunci tidak bisa dipilih. Pilihan tema bertahan setelah muat ulang, dan warna bilah browser (`theme-color`) ikut berganti.

## 12. Mencoba semua tema (`?coba-tema`)

Atas permintaan pemilik: https://block-down.vercel.app/?coba-tema membuka kelima tema selama alamat itu dipakai, supaya tampilannya bisa dicoba tanpa memenuhi syarat. Kemajuan asli (`unlocks`) tidak diubah. Saat game dibuka lagi tanpa `?coba-tema`, tema yang belum benar-benar terbuka kembali ke Klasik dan datanya ikut disimpan bersih. Judul tab menjadi `BlockDown (coba tema)` sebagai penanda.

## 13. Revisi tata letak Menu (permintaan pemilik)

- Tombol Pengaturan di Menu menjadi ikon roda gigi saja, tanpa tulisan. Namanya tetap dibacakan pembaca layar (`aria-label`) dan muncul sebagai tooltip.
- Tema dipindah dari Pengaturan ke layar sendiri, dibuka dari ikon palet di samping ikon roda gigi (pilihan pemilik dari tiga usulan).
- Uji Chrome di 320, 390, dan 1280 px: kedua ikon 44x44 px, layar Tema tanpa gulir mendatar (juga pada teks 200%), pilih tema dengan klik, panah, dan Enter, Esc kembali ke Menu dengan fokus di ikon palet, tema terkunci tidak bisa dipilih, Pengaturan tidak lagi berisi Tema, `?coba-tema` tetap membuka semua tema.

## 14. Blok Pengisi dan Antrean 3 (masukan pemilik)

Masukan pemilik: Monokrom (satu Bersih Total) terlalu sulit, karena urutan blok acak dan papan sulit dikosongkan. Pemilik meminta pola yang membantu mengisi ruang kosong, dengan pemicu tertentu, serta Antrean dikurangi menjadi 3.

Keputusan: syarat Monokrom tetap satu Bersih Total. Ditambah **Blok Pengisi**, blok 1x1 yang masuk Antrean saat papan tinggal sedikit (1 sampai 12 sel) setelah baris terhapus (pemicu dipilih pemilik dari tiga usulan). Aturan lengkap di SPEC bagian 4.1.

Uji:
- Tes core (5 baru, total 68): antrean 3; pemicu dengan sisa 2 sel; tidak muncul tanpa baris terhapus, saat sisa 18 sel, atau saat papan sudah kosong; Blok Pengisi menambal lubang terakhir dan menghasilkan Bersih Total dengan bonusnya; geser sampai dinding, putar tanpa perubahan, tidak berulang, dan urutan 7-bag sesudahnya sama dengan permainan tanpa Blok Pengisi.
- Browser: 4 Baris di seed 1 menyisakan 8 sel; callout menulis "Blok Pengisi di antrean" dan pembaca layar mengumumkannya; Antrean menjadi "Blok Pengisi, L, S"; Blok Pengisi muncul di papan setelah piece yang sudah tampil. Dicek di Klasik, Monokrom, dan Neon, di HP dan desktop. Regresi lengkap lulus, 0 error.
