# BlockDown: Roadmap

Dokumen ini bagian dari PRD BlockDown, bersama DESIGN.md, SPEC.md, dan ARCHITECTURE.md.

Aturan umum:
- Satu fase dianggap selesai hanya jika semua kriteria selesainya bisa dicek dan sudah dicek. Bukti dicatat di catatan rilis atau deskripsi PR fase itu.
- `npm run check` (`tsc` dan `node --test`) lulus di akhir setiap fase.
- Tidak ada tombol atau teks yang menyebut fitur dari fase yang belum selesai (R-24, R-26).

Urutan kerja sebelum Fase 1:
1. PRD ini (4 file) disetujui pemilik.
2. Desain dari Google Stitch dibandingkan dengan DESIGN.md. Setiap perbedaan dicatat di DESIGN.md bagian 9.1. (Selesai.)
3. Keputusan terbuka dijawab pemilik ("pakai usulan"). (Selesai, kecuali perangkat acuan dan konsep ikon aplikasi.)
4. Dari PRD dan desain final, disusun dokumen EDD di `docs/edd/` (rancangan teknis rinci). EDD menjadi acuan langsung untuk menulis kode. (Selesai.)

---

## Fase 1: Core logic dan tes

Lingkup: `src/core/` lengkap sesuai SPEC.md bagian 1 sampai 8 dan 10, `src/i18n/` (kamus awal), serta `tests/core.test.ts`.

Kriteria selesai:
- [x] `node --test` lulus untuk semua kelompok di ARCHITECTURE.md bagian 11. Bukti: `npm run check`, 28 tes lulus, 0 gagal.
- [x] Tabel kick di tes dibaca langsung dari SPEC.md bagian 3 (tes 1 mem-parse tabel markdown), bukan dari kode. Bukti: mengubah satu angka di `srs.ts` membuat tes 1 gagal.
- [x] Grep `src/core/` tidak menemukan `window`, `document`, `performance`, `Math.random`, atau `Date`.
- [x] Permainan dengan seed dan daftar aksi yang sama menghasilkan skor dan board akhir yang sama di dua kali jalan (tes 24).
- [x] Clear tidak menunda spawn (tes 21).

Uji mutasi tambahan (setiap perubahan dikembalikan setelah dicek): menghapus aturan kick tes ke-5 untuk T-Spin, mengubah batas reset ke 16, menghapus pengali B2B, dan menghapus reset hitungan saat piece turun lebih rendah. Masing-masing membuat minimal satu tes gagal.

## Fase 2: Renderer, keyboard, Maraton bisa dimainkan

Lingkup: `loop.ts`, `render/` (tanpa efek reward), `input/keyboard.ts`, `input/repeat.ts`, HUD dasar, Menu dengan satu mode Maraton, Pause, Game Over, dan penyimpanan rekor Maraton.

Kriteria selesai:
- [x] Maraton 150 dan Maraton tanpa batas bisa dimainkan dari Menu sampai Game Over hanya dengan keyboard. Bukti: click-through otomatis di Chrome (catatan di bawah).
- [x] Ghost, Hold (1 kali per piece, redup saat terkunci), dan Next 5 tampil benar. Bukti: screenshot dan label aria Hold "Simpan: S, Terkunci" setelah C kedua.
- [x] DAS 167 ms dan ARR 33 ms: tes otomatis `tests/client.test.ts` (pengulangan pertama di 167 ms, lalu tiap 33 ms; ARR 0 menghasilkan 10 geser dalam satu tick). Rasa di tangan tetap perlu dicoba pemilik.
- [x] Lock delay: tes core 18 sampai 20.
- [x] Gambar tajam di DPR 1, 2, dan 3. Emulasi Chrome: DPR 1 (sel 22 px, canvas di posisi piksel bulat), DPR 2 (44 px), dan DPR 3 (66 px), screenshot tajam. Layar fisik Galaxy A13: tajam (screenshot pemilik).
- [x] Tanpa `createLinearGradient`, `createPattern`, `Path2D`, atau `ctx.font` selama bermain. Bukti: penghitung API selama 20 detik bermain = 0. Heap setelah GC naik 180 KB dalam 20 detik (lihat catatan alokasi).
- [x] Rekor tersimpan setelah reload. JSON rusak di localStorage tidak membuat aplikasi crash dan data lama tidak ditimpa.
- [x] Pause otomatis saat tab disembunyikan.

Click-through Fase 2 (Chrome headless, 390x844, DPR 2), kontrol lalu hasil:
- Menu dibuka: fokus di Maraton, `lang=id`, rekor "Belum ada".
- Enter di Maraton: varian terbuka, fokus ke "150 baris". Panah bawah: fokus ke "Tanpa batas".
- Klik EN: `lang=en`, "Marathon", "No record". Klik ID: kembali.
- Klik "150 baris": layar Game, canvas 440x880 px perangkat (sel 22 px CSS).
- Space: hard drop, skor naik. C: hold. C kedua: diabaikan, label "Terkunci".
- Tahan kiri 600 ms, panah atas, Z, tahan bawah: geser berulang, putar, soft drop.
- Esc: Pause terbuka, fokus "Lanjutkan", waktu sesi tampil, skor tidak berubah selama 800 ms. Tab: fokus ke "Ulangi". Esc: Pause tertutup.
- Tombol jeda: Pause terbuka. Lanjutkan: tertutup.
- P lalu Ulangi: konfirmasi terbuka, fokus "Batal". Esc: kembali ke Pause. Ulangi lalu OK: permainan baru, skor 0.
- Tab browser disembunyikan: Pause terbuka otomatis.
- Tumpuk sampai penuh: Game Over "Permainan Selesai", tag "Rekor baru", fokus "Main Lagi". Esc: dialog tetap terbuka.
- Ke Menu: rekor tampil. Reload: rekor tetap. Main Lagi: permainan baru.
- localStorage diisi `{rusak`: Menu tampil, rekor "Belum ada", data lama tidak ditimpa.
- Browser `en-US`: bahasa awal en. Browser `fr-FR`: bahasa awal id.
- Overflow 0 px di Menu (320, 390, 600, 1024) dan Game (320x568, 390x844, 844x390, 1024x768, 1440x900).
- Error konsol, halaman, dan jaringan: tidak ada.

Ukuran 20 detik bermain (Chrome desktop, DPR 3, bukan perangkat acuan): frame median 6,9 ms, p99 7,2 ms, maks 7,6 ms.

Alokasi saat permainan berjalan tanpa input (sampling heap V8, 10 detik, sekitar 1440 frame): sekitar 15 byte per frame, sama di DPR 1 dan DPR 3. Pelacakan dengan mematikan bagian kode satu per satu: tidak berasal dari core, input, atau HUD, melainkan dari jalur pemanggilan `drawImage` di renderer, padahal `drawImage` di halaman kosong mengalokasikan 0 byte. Penyebab pastinya belum ditemukan. Besarnya (sekitar 21 KB per 10 detik) jauh di bawah ambang yang memicu jeda GC yang terasa, jadi tidak menghalangi Fase 3. Diukur ulang di HP acuan.

**Fase 2 ditutup** setelah pengukuran ulang di Galaxy A13 (hasil di bawah).

Cara mengukur: buka `https://block-down.vercel.app/?perf` di HP, mainkan sekitar 2 menit, lalu baca panel kecil di kiri bawah. Panel ini hanya muncul dengan `?perf` (kode di `src/debug/perf.ts`). Isinya:
- `fps`: frame per detik dari jarak antar frame median. Target 60 (atau sesuai refresh layar).
- `lambat`: jumlah dan persen frame yang jaraknya lebih dari 1,5 kali median (patah-patah yang terasa).
- `kerja`: waktu yang dihabiskan kode game per frame (p50, p99, maks). Harus jauh di bawah 16,7 ms.
- `heap`: memori JavaScript yang terpakai (hanya di Chrome). Harus stabil, tidak terus naik.

Uji di Chrome desktop (HP emulasi 390x844, DPR 3): panel tidak tampil tanpa `?perf`; dengan `?perf`, kerja p99 0,6 ms, 0 frame lambat, dan jeda tidak dihitung sebagai frame lambat.

Pengukuran pertama di Galaxy A13 (pemilik, Maraton, 132 detik, 7.769 frame):
- fps 60: tercapai.
- Lambat 92 frame (1,2%), maks 184 ms.
- Kerja per frame p50 3,2 ms, p99 14,3 ms, maks 36,5 ms. p99 dekat batas 16,7 ms.
- Heap 9,5 MB (satu angka, belum bisa dinilai naik atau stabil).

Temuan dan perbaikan dari pengukuran itu:
1. Renderer menggambar ulang seluruh tumpukan setiap frame. Dengan tumpukan tinggi itu sekitar 64 `drawImage` per frame. Tumpukan dipindah ke canvas sendiri (`cv-stack`) yang hanya digambar ulang saat isi board berubah. Hasil: 64,5 menjadi 7,7 `drawImage` per frame dengan tumpukan yang sama. Diuji: tumpukan tetap cocok dengan board setelah lock, mode buta warna, resize, mulai ulang, dan Main Lagi.
2. Panel ukur sendiri mengurutkan sekitar 8.000 angka empat kali per detik, yang bisa ikut membuat frame tersendat di HP. Diganti histogram tanpa pengurutan, diperbarui tiap 2 detik. "Lambat" diganti "tersendat" dengan batas tetap 25 ms (1,5 kali satu frame 60 Hz), heap kini menampilkan nilai awal untuk melihat apakah memori naik terus, dan frame pertama setelah lanjut dari jeda tidak dihitung.

Di Chrome desktop dengan CPU diperlambat 6 kali (perkiraan kasar HP kelas bawah), frame tersendat tidak terkait pembaruan panel maupun penghapusan baris; sisa tersendat kemungkinan dari browser (pengumpulan sampah atau komposit), bukan dari kode game. Pengukuran ulang di Galaxy A13 setelah perbaikan (pemilik, Maraton, 122 detik, 7.277 frame, tumpukan tinggi):

| Angka | Sebelum | Sesudah | Target |
|---|---|---|---|
| fps | 60 | 60 | 60 |
| Tersendat | 1,2% (batas lama) | 0,4% (27 frame di atas 25 ms) | di bawah 1% |
| Kerja p50 | 3,2 ms | 2,5 ms | |
| Kerja p99 | 14,3 ms | 9,3 ms | jauh di bawah 16,7 ms |
| Kerja maks | 36,5 ms | 25,7 ms | |
| Heap | 9,5 MB | 9,5 MB (awal 9,5) | stabil |

Semua target tercapai. Heap tidak naik selama 2 menit, jadi alokasi kecil per frame yang tercatat di desktop (sekitar 15 byte) tidak menumpuk di perangkat. Jeda maks 167 ms terjadi sekali-sekali dan tidak terkait kerja kode game (kerja maks 25,7 ms); kemungkinan dari browser atau sistem. Sisa anggaran di p99 sekitar 7 ms untuk efek Fase 4.

## Fase 3: Sentuh, semua mode, Pengaturan, i18n

Lingkup: `input/touch.ts` (Tombol dan Gestur), `input/gamepad.ts`, mode Sprint 40, Ultra, dan Zen, layar Pengaturan lengkap, pemetaan ulang tombol, serta i18n ID/EN di semua layar.

Kriteria selesai:
- [x] Keempat mode (dengan dua varian Maraton) bisa dimulai dari Menu dan berakhir sesuai SPEC.md bagian 10. Setiap mode di `modes.ts` punya baris di Menu.
- [x] Sprint mencatat waktu dalam ms, dan top out tidak dicatat sebagai rekor (pesan "Waktu tidak dicatat" tampil).
- [x] Ultra berhenti tepat di tick 7200 (120.000 ms), dan Pause menghentikan timer (tes core 22b, loop berhenti saat Pause).
- [x] Zen mengosongkan board saat top out, dan skor tetap (tes 22c). Zen diakhiri dari Pause lewat "Akhiri sesi" (tes 22e).
- [x] Satu permainan bisa dimainkan hanya dengan gestur di HP Android (Galaxy A13, Chrome): dinyatakan pas oleh pemilik setelah tiga revisi gestur. iPhone: belum diuji (belum ada perangkat), dicoba begitu tersedia.
- [x] Semua target sentuh minimal 44px. Setelah tombol sentuh dihapus, target sentuh saat bermain hanya tombol jeda (44 px); sisanya gestur di seluruh layar.
- [x] Tidak ada overflow horizontal di 320, 360, 390, 412, 430 px (HP tegak), 600, 768, 1024, 1280, 1440 px (jendela lebar).
- [x] Gamepad standar bisa memainkan permainan dan menavigasi menu (emulasi Gamepad API; gamepad fisik belum dicoba).
- [x] Setiap pengaturan berlaku langsung dan bertahan setelah reload.
- [x] Mengganti bahasa di Menu dan di Pengaturan mengubah semua teks dan `<html lang>`. Bahasa awal mengikuti `navigator.language`, dengan cadangan `id`.
- [x] Pencarian tidak menemukan string untuk pemain di luar `src/i18n/` (hanya logo merek dan angka awal HUD). Tes key identik lulus.
- [x] Semua layar dan dialog bisa dipakai dengan Tab, Enter, Space, dan Esc, dengan cincin fokus terlihat.

Click-through Fase 3 (Chrome, desktop 1280x800, HP emulasi 390x844 DPR 3 dengan sentuh, gamepad emulasi), kontrol lalu hasil:
- Menu: empat mode tampil (Maraton, Sprint 40, Ultra, Zen), semua rekor "Belum ada". Tombol sentuh tidak tampil di desktop. Daftar kontrol keyboard mengikuti pemetaan. Urutan Tab: ID, EN, Pengaturan, Maraton, Sprint 40, Ultra, Zen.
- Sprint: waktu naik di HUD. Pause tanpa "Akhiri sesi". Top out: "Permainan Selesai", catatan "Waktu tidak dicatat karena 40 baris belum tercapai", tanpa tag rekor.
- Ultra: waktu mundur dari 1:59. Top out: rekor skor tersimpan dan tampil di Menu.
- Zen: tanpa waktu, 40 hard drop tidak mengakhiri permainan. Pause menampilkan "Akhiri sesi". Akhiri sesi: "Selesai", hasil utama Baris, skor tampil di statistik.
- Pengaturan dari Menu: fokus ke tombol kembali. DAS panah kiri x10: 157 ms dan `aria-valuetext` ikut. Jatuh pelan End: Instan, kiri: 40x. Ghost, buta warna, mode Gestur (bantuan gestur tampil) berpindah.
- Atur tombol: Jatuh cepat jadi W, fokus kembali ke tombol yang sama. X untuk Simpan ditolak ("sudah dipakai untuk Putar kanan"). P ditolak ("dipakai untuk jeda"). Esc saat mendengarkan hanya membatalkan. Menghapus tombol terakhir ditolak.
- Bahasa English di Pengaturan: `lang=en`, judul "Settings", nama aksi "Move left".
- Esc di Pengaturan: kembali ke Menu, fokus ke tombol Pengaturan. Daftar kontrol Menu menampilkan W. W benar-benar menjatuhkan piece.
- Pause, Pengaturan, kembali: Pause terbuka lagi dengan fokus di "Pengaturan".
- Kembalikan bawaan: DAS 167 ms, jatuh cepat Space, toast tampil. Reload: pengaturan tampilan bertahan.
- Gamepad: toast "Gamepad terhubung". D-pad memindahkan fokus Menu, A memilih mode, D-pad atas menjatuhkan piece, Start membuka Pause, B menutupnya, D-pad kanan mengubah slider di Pengaturan, B kembali ke Pause.
- (Versi awal, sebelum revisi) HP: tombol sentuh dan mode Gestur bekerja; tombol dipindah ke samping saat landscape. Bagian ini diganti oleh Revisi di bawah.
- Click-through Fase 2 dijalankan ulang: semua lulus.
- Error konsol, halaman, dan jaringan: tidak ada.

Ditemukan dan diperbaiki saat uji: tombol Start gamepad membuka Pause lalu langsung terbaca sebagai "kembali" di frame berikutnya, sehingga Pause tertutup sendiri. Perbaikan: saat berpindah konteks, tombol yang masih ditekan dicatat sebagai sudah ditekan.

Uji pertama di Galaxy A13 (pemilik, lewat block-down.vercel.app): permainan lancar, tampilan rapi. Keputusan pemilik dari uji itu:
1. Tombol sentuh dihapus; HP hanya memakai gestur.
2. Seret ke bawah langsung jatuh cepat; tidak ada jatuh pelan lewat gestur.
3. HP hanya tegak.
4. Tata letak disesuaikan karena tombol dihapus.

Revisi setelah uji (Chrome, HP emulasi DPR 3 dengan sentuh), kontrol lalu hasil:
- Elemen tombol sentuh tidak ada lagi. Pengaturan di HP menampilkan penjelasan gestur; pilihan Tombol/Gestur tidak ada. Di desktop penjelasan gestur tidak tampil.
- HP 390x844: statistik satu baris, Simpan + Antrean mendatar di atas papan, sel 32 px, papan 323x647, tanpa overflow.
- HP 320x568: sel 19 px. 360x740: 27 px. 412x915: 36 px. 430x932: 37 px. Antrean tidak keluar layar, tanpa overflow.
- Seret pelan ke bawah 60 px dalam 2 detik: jatuh cepat (skor naik 2 per sel). Sapu cepat ke bawah: jatuh cepat. Seret ke atas: simpan. Gestur di area antrean juga bekerja. Ketuk tidak memicu zoom. Tombol jeda tetap bisa diketuk.
- HP diputar mendatar: pesan "Putar HP ke posisi tegak", permainan tersembunyi dan dijeda. Kembali tegak: pesan hilang, Pause tetap terbuka.
- Desktop 1280x800: Simpan di kiri, Antrean tegak di kanan, papan 340x680. Jendela 1024x600: pesan putar tidak tampil.
- Click-through Fase 2 dan Fase 3 (tanpa bagian tombol sentuh) dijalankan ulang: lulus. Error: tidak ada.

Revisi gestur kedua dan ketiga (dari uji pemilik di Galaxy A13):
- Bantingan keras kadang tidak terbaca: titik lepas dan sentuhan yang dibatalkan browser kini ikut dihitung.
- Seret ke samping kadang salah jadi jatuh cepat: arah tegak hanya jika lebih curam dari sekitar 52 derajat.
- Gerak kecil ke bawah langsung jatuh cepat: jatuh cepat kini butuh bantingan 1,5 sel (minimal 20 sel per detik) atau seret 2,5 sel.
- Geser lalu banting tanpa mengangkat jari: kini didukung.
- Keyboard bawaan menjadi satu tombol per aksi, dengan panah atas untuk simpan.
Rincian dan hasil uji emulasi ada di EDD-2 bagian 14 dan 15.

**Fase 3 ditutup** (keputusan pemilik setelah uji akhir di Galaxy A13: gestur sudah pas). Yang dicatat belum diuji: iPhone dan gamepad fisik (belum ada perangkat). Pengukuran 60 fps dan alokasi di Galaxy A13 dijalankan sebelum Fase 4, lewat mode ukur `?perf` (lihat Fase 2).

## Fase 4: Motion, suara, haptics, aksesibilitas

Lingkup: tiga lapis motion (DESIGN.md bagian 8), `audio/` (file suara CC0 pilihan pemilik, revisi tahap 2), `platform/haptics.ts`, mode aman buta warna, intensitas efek, kurangi animasi, dan audit aksesibilitas.

Kriteria selesai:
- [x] Storyboard 4 Baris berjalan sesuai urutan waktu di DESIGN.md. Direkam di Chrome (catatan tahap 1 di bawah).
- [x] Selama efek reward berjalan, piece berikutnya bisa langsung dimainkan: hard drop 30 ms setelah Quad langsung menambah skor.
- [x] Partikel tidak pernah melebihi 300 (tes pool di `tests/client.test.ts`). Heap selama satu menit dengan efek Penuh: diukur di Galaxy A13 lewat `?perf` (menunggu pemilik).
- [x] Shake hanya dipicu oleh 4 Baris, T-Spin dengan baris, dan Bersih Total (`effects.ts`), simpangan maksimal 4 px (tes `effectiveFx`). Terukur 2,3 px di puncak dorongan Quad.
- [x] Dengan `prefers-reduced-motion: reduce` di sistem: tanpa shake, tanpa partikel, callout hanya pudar, dan pita ambient diam.
- [x] Setiap kejadian di tabel suara SPEC.md bagian 14 berbunyi (diuji di Chrome, lihat tahap 2). Tidak ada suara dan tidak ada unduhan file sebelum gestur pertama, dan tidak ada error di konsol. Kriteria `tidak ada file mp3` dicabut: pemilik memilih file CC0.
- [x] Combo panjang menghasilkan melodi pentatonik yang naik (tes `comboRate` di `tests/client.test.ts`).
- [x] Getar bekerja di Android, dan kontrol Getar nonaktif dengan alasan di perangkat yang tidak mendukung. Dikonfirmasi pemilik di Galaxy A13 (getar sudah terasa).
- [x] Mode aman buta warna: ketujuh jenis blok bisa dibedakan dalam screenshot grayscale (lihat audit akhir).
- [x] Callout dan hasil Game Over diumumkan lewat region `aria-live` (uji otomatis di Chrome, lihat audit akhir). Uji TalkBack dan NVDA di perangkat dilewati atas keputusan pemilik; belum diuji dengan pembaca layar sungguhan.
- [x] Teks bisa diperbesar ke 200% tanpa terpotong di Menu dan Pengaturan (320 dan 390 px, setelah perbaikan).
- [x] Delivery Gate antislop (DESIGN.md bagian 11) dijalankan ulang dengan bukti nyata dan click-through per kontrol. Semua item lolos setelah perbaikan.
- [x] Pre-Flight taste-skill (DESIGN.md bagian 12) dijalankan ulang.
- [x] Target performa ARCHITECTURE.md bagian 12 terpenuhi di perangkat acuan, dengan catatan (lihat `Pengukuran akhir Fase 4`).

### Tahap 1: animasi dan getar (selesai, menunggu uji pemilik)

Isi: kilat tepi baris, partikel (pool 300), shockwave, dorongan papan, callout dengan sapuan cahaya, angka skor, skor bergulir, tumpukan turun dengan pantulan, riak T-Spin, gelombang emas Bersih Total, bingkai naik level, pita ambient yang warnanya mengikuti level dan menghangat saat combo, squash dan garis jejak jatuh cepat, kemiringan saat kick, runtuh saat Game Over, getar, serta pengaturan Intensitas efek, Kurangi animasi, dan Getar.

Storyboard Quad di Chrome (HP emulasi 390x844, efek Penuh), diukur dari keadaan halaman:
- 40 ms: kilat baris dan partikel berjalan, skor mulai bergulir, callout belum tampil.
- 120 ms: papan terdorong 2,3 px ke bawah (dorongan dimulai di 80 ms), pita ambient menerang.
- 260 ms: callout "4 BARIS" +800 muncul (dimulai 200 ms), skor hampir mencapai nilai akhir.
- 520 ms: callout penuh, skor final, tumpukan sudah turun ke posisi akhir (turun dimulai 450 ms).
- 900 ms: pita ambient kembali ke 5%.

Uji lain:
- Hard drop 30 ms setelah Quad: langsung masuk, skor bertambah.
- Kurangi animasi dari sistem: tanpa shake, pita diam, callout pudar; Pengaturan menunjukkan Minimal terkunci dengan pesan; mematikan Kurangi animasi mengembalikan Penuh dan tersimpan.
- Intensitas Minimal: tanpa shake, skor tidak bergulir, callout pudar.
- Game Over: tumpukan runtuh (berubah selama animasi), dialog muncul sekitar 1,2 detik setelah permainan berakhir, fokus di "Main Lagi"; dengan Kurangi animasi tumpukan memudar tanpa jatuh.
- Lapisan tumpukan tetap cocok dengan board setelah lock, buta warna, resize, mulai ulang, dan Main Lagi.
- Click-through Fase 2 dan 3 serta uji gestur dijalankan ulang: lulus. Error: tidak ada.

Performa, CPU diperlambat 6 kali, 1 detik setelah Quad (3 putaran): kerja per frame p99 2,6 sampai 3,1 ms (sebelum efek: 1,9 sampai 2,8 ms). Satu frame di 17 sampai 24 ms pada 2 dari 6 putaran; profil menunjukkan sebagian besar waktu di luar kode game. Perlu diukur di Galaxy A13 dengan `?perf`.

Ditemukan dan diperbaiki saat uji: sapuan cahaya di callout awalnya memotong huruf terakhir (posisi gradien di luar teks); piece yang terkunci di tengah animasi tumpukan turun membuat tumpukan sesaat tampil di posisi lama.

### Revisi tahap 1 setelah uji di Galaxy A13

Masukan pemilik: efek kurang, tidak ada yang wah; getar kurang terasa. Pengukuran `?perf` di Galaxy A13 (131 detik, Maraton sampai 16 baris): fps 60, tersendat 1,1%, kerja p50 3,0 ms, p99 11,8 ms, maks 272 ms, heap 9,5 MB (awal 9,5).

Keputusan pemilik: efek bertingkat untuk setiap clear; guncangan maksimal 10 px. Rincian di DESIGN 8.3 dan 9.3.

Satu frame 272 ms: dugaan utama adalah kompilasi pertama jalur efek (clear pertama sejak halaman dimuat). Di Chrome dengan CPU diperlambat 6 kali, frame terberat setelah Quad pertama sekitar 14 ms, sedangkan Quad berikutnya 5 sampai 7 ms. Perbaikan: semua jalur efek dan callout dijalankan sekali tanpa terlihat saat permainan pertama dimulai (`BoardRenderer.warmUp`, `Callout.warmUp`). Hasil di Chrome tidak konsisten (10 sampai 15 ms di Quad pertama), jadi dampaknya harus dilihat di HP.

Panel `?perf` diperbaiki: waktu kerja kini diukur dari awal kode frame, bukan dari waktu vsync (versi lama ikut menghitung keterlambatan browser memanggil frame sebagai kerja game), dan frame terberat diberi label kejadiannya, misalnya `(clear4)` atau `(hard)`.

Uji setelah revisi (Chrome, HP emulasi):
- Storyboard Quad: 120 ms papan terdorong 4,2 px dan membesar 2%, pilar cahaya, tiga cincin, shockwave tebal; 260 ms callout masuk dengan hentakan; 520 ms selesai.
- CPU 6 kali, 1 detik setelah Quad: kerja p99 1,9 sampai 3,0 ms, maks 5,7 sampai 10,4 ms, tidak ada frame di atas 16,7 ms.
- Kurangi animasi, Minimal, Game Over, gestur, click-through Fase 2 dan 3, lapisan tumpukan: lulus. Error: tidak ada.

### Perbaikan patah-patah setelah efek bertingkat

Masukan pemilik: efek sudah cukup wah, getar sudah lumayan, tapi animasi patah-patah. Pengukuran `?perf` di Galaxy A13 (156 detik): fps 60, tersendat 0,9%, maks 200 ms, kerja p50 0,5 ms, p99 2,0 ms, maks 10,0 ms (clear2), heap stabil 9,5 MB. Kode game ringan; frame 272 ms sudah tidak muncul. Patah-patah berasal dari kerja browser di luar kode game.

Tracing Chrome selama 1 detik setelah Quad menemukan tiga sumber:
1. Callout menganimasikan variabel CSS `--glow` dan `background-position` teks bergradien. Keduanya memaksa cat ulang setiap frame. Diganti elemen cahaya dan pita sapuan terpisah yang hanya digerakkan dengan `transform` dan `opacity`; judul memakai warna solid.
2. Skor bergulir mengganti teks setiap frame, dan karena lebarnya berubah, seluruh dokumen ikut dicat ulang. Ditambah transisi warna. Diperbaiki: lebar skor tetap, `contain`, lapisan sendiri, teks diganti paling sering setiap 33 ms, transisi warna dihapus.
3. Kilat papan dan pilar cahaya mengisi hampir seluruh canvas setiap frame dengan mode penjumlahan. Dipindah ke dua lapisan CSS (`.fx-flash`, `.fx-pillar`) yang hanya dipudarkan dan diregangkan.

Hasil, 1 detik setelah Quad (Chrome, HP emulasi 412x915, DPR 2,625):

| | Sebelum | Sesudah |
|---|---|---|
| Cat ulang (Paint) | 262 kali, 22,7 ms | 23 kali, 1,5 ms |
| Raster | 1.008 kali, 16,8 ms | 53 kali, 2,2 ms |
| Tata letak (Layout) | 42 kali | 9 kali |
| Style | 144 kali, 32,5 ms | 112 kali, 15,8 ms |
| Luas canvas yang diisi cahaya per frame | 0,97 kali luas papan | 0,11 kali |

Tampilan efek tetap sama (screenshot storyboard Quad dicek). CPU 6 kali: kerja p99 2,6 sampai 3,6 ms, tidak ada frame di atas 16,7 ms. Gestur, click-through Fase 2 dan 3, Kurangi animasi, Game Over, lapisan tumpukan: lulus. Perlu dikonfirmasi pemilik di Galaxy A13.

## Fase 5: PWA, Vercel, GitHub

Keputusan pemilik (Fase 5): BlockDown tidak diterbitkan di Play Store. Distribusi hanya lewat GitHub (https://github.com/d-okta/block-down) dan deploy Vercel, dipasang sebagai PWA. Proyek Capacitor Android, AAB, listing toko, dan screenshot listing dikeluarkan dari lingkup.

Kriteria selesai:
- [x] PWA bisa dipasang, lalu dimainkan dalam mode pesawat setelah kunjungan pertama. Uji Chrome lulus (offline: menu, font, suara, permainan) dan dikonfirmasi pemilik di Galaxy A13.
- [x] Deploy Vercel dari branch utama, dengan URL produksi tercatat: https://block-down.vercel.app (auto-deploy dari `main`).
- [x] Ikon aplikasi final sudah disetujui pemilik (varian gelap). Tidak ada placeholder yang tersisa.
- [x] Safe-area benar di perangkat dengan navigasi gestur (PWA terpasang di Galaxy A13, dikonfirmasi pemilik). Perangkat dengan notch belum diuji.
- [x] README di GitHub menjelaskan cara main, cara memasang PWA, dan lisensi aset (suara CC0).

Dikeluarkan dari lingkup (keputusan pemilik): AAB dan `npx cap sync android`, APK di perangkat acuan dan tombol kembali Android native, listing toko ID dan EN, screenshot listing, kebijakan privasi toko. Jika suatu saat diterbitkan ke toko, kriteria ini dikembalikan.

## Fase 6: Sistem meta (fase 2 produk)

Lingkup kandidat: koin, item, toko, quest, rank, daily reward, notifikasi, dan leaderboard online.

**Diputuskan pemilik:** koin, item, dan toko diganti tema yang terbuka lewat prestasi. Rancangan, keputusan, dan kriteria di [PRD-6-tema.md](PRD-6-tema.md); sudah dibangun. Quest harian, daily reward, notifikasi, dan leaderboard online tidak dikerjakan.

Fase ini belum dirancang. Sebelum dimulai, dibutuhkan PRD terpisah yang menjawab:
- Fitur mana yang benar-benar dipakai, dan apakah fitur itu menjaga ketenangan arah desain.
- Backend dan akun untuk leaderboard, termasuk anti-curang. Rekor lokal fase 1 tidak tepercaya (SPEC.md bagian 13).
- Migrasi skema penyimpanan dari `schema: 1`.
- Dampak ke listing toko dan kebijakan privasi.

Kriteria selesai fase ini ditulis di PRD tersebut.

---

## Keputusan yang masih menunggu data pemilik

Keputusan lain sudah dicatat di bagian Keputusan masing-masing dokumen.

| Keputusan | Batas waktu | Asal |
|---|---|---|
| Uji performa di Samsung Galaxy A13 (perangkat acuan) | Bersama kriteria sentuh Fase 3 | ARCHITECTURE.md bagian 14 |
| Konsep ikon aplikasi | Selesai di Fase 5 (varian gelap) | DESIGN.md bagian 6 |

### Uji A13 kedua: tersendat naik ke 6,3%

Masukan pemilik setelah `f35bb13`: `?perf` 138 detik menunjukkan fps 60, tersendat 484 (6,3%), maks 185 ms, kerja p99 2,5 ms. Kode game tetap ringan; kerja GPU naik. Pita sapuan di judul tampil sebagai kotak terang terpotong.

Dugaan: lapisan baru selalu ada di papan dengan `mix-blend-mode: screen` dan `will-change` permanen, sehingga GPU A13 memadukan ulang papan setiap frame, termasuk saat tidak ada efek. Chrome laptop tanpa GPU tidak memperlihatkan perbedaan, jadi dugaan ini hanya bisa dipastikan di HP.

Perbaikan: `mix-blend-mode` dihapus; lapisan kilat dan pilar dilepas (`hidden`) saat tidak dipakai; callout disembunyikan di luar animasinya; semua `will-change` permanen dihapus kecuali di papan (untuk guncangan); pita sapuan judul dihapus. Efek lain tetap. Tes 58 lulus, gestur, landscape, Game Over, lapisan tumpukan lulus; CPU 6 kali tanpa frame di atas 16,7 ms. Perlu dikonfirmasi di A13.

### Tahap 2: suara dan musik (selesai, menunggu uji pemilik)

Keputusan pemilik: file suara CC0, bukan sintesis. Kandidat dari 4 paket Kenney (Interface Sounds, Impact Sounds, Digital Audio, Music Jingles) dan 3 musik OpenGameArt didengarkan pemilik di halaman uji sementara `/dengar/`, lalu dipilih satu per kejadian. Halaman uji dan file yang tidak terpilih sudah dihapus. Daftar akhir di SPEC bagian 14 dan `public/sfx/LISENSI.txt`. Musik: Crystal Cave (cynicmusic). Total 17 file, sekitar 660 KB, diunduh setelah sentuhan pertama.

Isi: `src/audio/sound.ts` (muat dan putar, batas 4 bunyi untuk geser dan soft drop, nada combo pentatonik, musik berulang), sambungan event game di `main.ts`, bunyi tombol menu dan dialog, slider Musik dan Efek di Pengaturan (tersimpan, nonaktif dengan alasan tanpa Web Audio).

Uji di Chrome (HP emulasi, autoplay hanya setelah gestur):
- Sebelum sentuhan pertama: 0 file diminta, tidak ada AudioContext. Setelah: 17 file, AudioContext berjalan, musik mulai.
- Bermain sampai 4 Baris: geser, putar, hold, hard drop, lalu `powerUp5` sekali. Hold lalu soft drop: `select_006`, `tick_004`.
- Pause: musik diredam, tidak dihentikan. Tombol Pengaturan berbunyi `switch_002`.
- Musik 25% dan Efek 0%: tersimpan 0,25 dan 0; dengan Efek 0% tombol tidak berbunyi.
- Tab disembunyikan: AudioContext suspended, kembali running.
- Ke menu: musik berhenti. Game Over: `zapThreeToneDown`, musik berhenti.
- Error: tidak ada. 59 tes lulus. Gestur, landscape, click-through Fase 2 dan 3, efek, lapisan tumpukan: lulus. CPU 6 kali: tidak ada frame di atas 16,7 ms.

Batas yang disengaja: tempo dan kunci musik tidak berubah per level (file audio); naik level ditandai jingle.

### Pengukuran akhir Fase 4 di Galaxy A13

Versi dengan efek bertingkat, perbaikan beban GPU (`ec6be7e`), dan suara (`d5501e2`). Pemilik, Maraton, 124 detik, 7.338 frame, tumpukan tinggi:

| Ukuran | Uji kedua (`f35bb13`) | Akhir | Target |
|---|---|---|---|
| fps | 60 | 60 | 60 |
| Tersendat | 6,3% | 0,8% (56 frame di atas 25 ms) | di bawah 1% |
| Jeda maks | 185 ms | 284 ms | tidak ada target |
| Kerja p99 | 2,5 ms | 2,3 ms | jauh di bawah 16,7 ms |
| Kerja maks | 10,8 ms (hard) | 11,9 ms (level) | di bawah 16,7 ms |
| Heap | 9,5 MB stabil | 9,5 MB stabil (awal 9,5) | tidak naik |

Dugaan beban GPU terbukti: setelah `mix-blend-mode` dan `will-change` permanen dihapus, tersendat turun dari 6,3% ke 0,8%, di bawah 1%. Pemilik menilai efek dan getar sudah bagus dan tidak perlu dikurangi.

Catatan: kriteria ARCHITECTURE bagian 12 menulis `tidak ada frame di atas 16,7 ms`. Di perangkat ini sekitar 0,8% frame lewat 25 ms dan satu jeda mencapai 284 ms, sementara kode game paling lama 11,9 ms per frame. Jeda itu berasal dari browser atau sistem, bukan kode game. HP acuan sudah dipakai hampir 5 tahun tanpa reset. Kriteria dinilai terpenuhi untuk kode game; jeda sistem dicatat dan tidak dikejar di Fase 4.

### Audit akhir Fase 4 (aksesibilitas, Delivery Gate, Pre-Flight)

Dijalankan di Chrome pada build lokal, 19 Oktober 2026.

**Pembaca layar** (pengganti TalkBack, region `#live`: `aria-live=polite`, `aria-atomic`, tersembunyi secara visual):
- 4 Baris di Maraton: `#live` berisi `4 BARIS, +800` (dalam bahasa Inggris `QUAD, +800`). Callout visual `aria-hidden`, jadi tidak dibaca dua kali.
- Game Over: `#live` berisi judul, skor akhir, dan `Rekor baru` jika ada. Dialog bernama dari judulnya, fokus awal di `Main Lagi`.

**Mode aman buta warna:** tujuh jenis terkunci di papan, dibaca dari canvas tumpukan. Dalam grayscale, kecerahan rata-rata per jenis 90 sampai 182, dan setiap jenis punya pola sendiri (garis mendatar, titik, segitiga, diagonal naik, diagonal turun, garis tegak, kotak berongga). Pasangan yang paling mirip kecerahannya (I dan S) tetap dibedakan oleh polanya; dicek pada screenshot grayscale papan.

**Teks 200%** (`font-size` akar 200%, setara pembesaran teks Android), lebar 320 dan 390 px. Sebelum perbaikan: logo dan tombol segmen keluar layar, halaman bergulir mendatar, baris Pengaturan menyempit jadi kolom sangat sempit. Perbaikan: ukuran logo dibatasi lebar layar, baris atas Menu, tombol segmen, baris Pengaturan, dan baris mode boleh turun ke baris berikutnya, kolom tombol keyboard melebar sesuai label. Sesudah: gulir mendatar 0, tidak ada elemen terpotong atau keluar layar.

**Delivery Gate** (lima lebar 320 sampai 1280 px, landscape 844x390): gulir mendatar 0 di Menu, Pengaturan, Game, Pause, Game Over. 0 tombol tanpa nama. Cincin fokus 2px aksen. Temuan dan perbaikan:
- Area sentuh sakelar terpotong di sisi bawah oleh baris berikutnya; kini 64x44 px penuh.
- Catatan Sprint di Game Over tertutup cincin fokus tombol `Main Lagi`; jarak bawah ditambah.
- Dokumen DESIGN masih menyebut sapuan cahaya callout dan blur Pause; keduanya tidak ada di build, dokumen disamakan.

Regresi: 59 tes lulus; gestur, landscape, click-through Fase 2 dan 3, efek, lapisan tumpukan, dan suara lulus, 0 error.

**Fase 4 selesai.** Yang dicatat belum diuji di perangkat: TalkBack dan NVDA (dilewati pemilik), iPhone, gamepad fisik.

### Tambahan setelah Fase 4: animasi antar layar dan blok baru

Permintaan pemilik: animasi antar layar dan blok yang lebih enak dilihat. Detail di DESIGN bagian 5 (blok) dan 8.6 (animasi).

- Blok: ubin bervolume dengan gradien cahaya, tepi miring, muka dalam, dan kilau kecil; ghost diberi isi tipis. Digambar sekali ke atlas.
- Animasi masuk: Menu (logo, blok logo jatuh dan memantul, mode berurutan), varian Maraton, Game, Pengaturan, dialog, dan tekan tombol. Kelas `.enter` dilepas 1,2 s setelah layar dibuka.

Uji di Chrome: animasi berjalan di setiap layar dan semuanya selesai (tidak tersisa selain pita ambient yang memang ada sejak Fase 4). Dengan `prefers-reduced-motion`, jumlah animasi 0 di semua layar. Hard drop 100 ms setelah masuk Game langsung menambah skor. Kembali dari Pengaturan ke Pause tidak menganimasikan papan. Ditemukan dan diperbaiki: animasi geser Pengaturan memunculkan gulir mendatar (`overflow-x: clip` pada layar). Mode buta warna tetap terbedakan dalam grayscale, teks 200% tetap tanpa gulir mendatar, 59 tes dan regresi lulus, 0 error. CPU 6 kali, 9 putaran 1 detik setelah Quad: kerja p99 3,1 sampai 10,0 ms; 2 putaran mencatat satu frame 17,9 dan 22,6 ms (sebelumnya 0). Perlu dicek di Galaxy A13 lewat `?perf`.

Revisi blok: pemilik menilai versi ubin (tepi miring dan kilau) berlebihan. Diganti warna solid dengan gradien tipis dan garis atas-bawah 2px (DESIGN bagian 5). Mode buta warna tetap terbedakan dalam grayscale; tes dan lapisan tumpukan lulus.

### Perataan tampilan (Fase 5, masukan pemilik)

Masukan pemilik: tampilan masih ada yang kurang sejajar. Diukur tepi kiri dan kanan setiap elemen:
- Layar Game (HP): baris atas, statistik, dan antrean selebar layar, sedangkan papan lebih sempit, jadi tepinya tidak segaris. Kini ketiganya selebar papan (`--board-w`). Ikon jeda digeser supaya tepi ikonnya, bukan tepi tombolnya, segaris dengan papan.
- Layar Game (desktop): Simpan dan Antrean jauh dari papan di kolom lebar, nama mode dan tombol jeda di tepi jendela. Kini tiga kolom selebar isinya, berdempetan 16 px, dan baris atas selebar ketiganya.
- Pengaturan: nilai slider (misalnya `167 ms`) berada di tengah deskripsi; kini sejajar dengan judul pengaturan.

Ditemukan saat perbaikan: tinggi antrean ikut menentukan tinggi papan dan papan menentukan ukuran antrean, sehingga di DPR 3 keduanya berganti setiap frame (tombol jeda tidak stabil). Tinggi sumur antrean kini dihitung dari lebar layar saja. Diuji di 320x568, 320x640, 360x740, 390x844, 412x915, 768x1024, 1280x800: tepi kiri dan kanan baris atas, antrean, dan papan sama persis, isi antrean muat, posisi stabil di DPR 3. 59 tes dan seluruh regresi (gestur, landscape, Game Over, efek, suara, animasi, teks 200%, PWA offline) lulus, 0 error.
