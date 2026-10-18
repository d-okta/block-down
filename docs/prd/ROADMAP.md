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

Lingkup: tiga lapis motion (DESIGN.md bagian 8), `audio/` (sintesis efek dan musik), `platform/haptics.ts`, mode aman buta warna, intensitas efek, kurangi animasi, dan audit aksesibilitas.

Kriteria selesai:
- [ ] Storyboard 4 Baris berjalan sesuai urutan waktu di DESIGN.md (direkam dan dicek per frame).
- [ ] Selama efek reward berjalan, piece berikutnya bisa langsung digeser dan diputar (diuji dengan hard drop berturut-turut saat 4 Baris).
- [ ] Partikel tidak pernah melebihi 300, dan heap tidak tumbuh selama satu menit dengan efek Penuh.
- [ ] Shake hanya muncul di 4 Baris, T-Spin dengan baris, dan Bersih Total, dengan simpangan maksimal 4px.
- [ ] Dengan `prefers-reduced-motion: reduce` di sistem: tanpa shake, tanpa partikel, hanya fade, dan pita ambient diam.
- [ ] Setiap kejadian di tabel suara SPEC.md bagian 14 berbunyi. Tidak ada file mp3 untuk efek. Tidak ada suara sebelum gestur pertama, dan tidak ada error di konsol.
- [ ] Combo panjang menghasilkan melodi pentatonik yang naik.
- [ ] Getar bekerja di Android, dan kontrol Getar nonaktif dengan alasan di perangkat yang tidak mendukung.
- [ ] Mode aman buta warna: ketujuh jenis blok bisa dibedakan dalam screenshot grayscale.
- [ ] Callout dan hasil Game Over diumumkan oleh TalkBack dan NVDA.
- [ ] Teks bisa diperbesar ke 200% tanpa terpotong di Menu dan Pengaturan.
- [ ] Delivery Gate antislop (DESIGN.md bagian 11) dijalankan ulang dengan bukti nyata dan click-through per kontrol. Semua item lolos.
- [ ] Pre-Flight taste-skill (DESIGN.md bagian 12) dijalankan ulang.
- [ ] Target performa ARCHITECTURE.md bagian 12 terpenuhi di perangkat acuan.

## Fase 5: Android, PWA, Vercel, listing toko

Lingkup: proyek Capacitor Android, manifest dan service worker PWA, deploy Vercel, ikon aplikasi, dan teks listing Play Store.

Kriteria selesai:
- [ ] `npx cap sync android` dan build release menghasilkan AAB dengan appId `com.nusavisionmedia.blockdown`.
- [ ] APK berjalan di perangkat acuan. Tombol kembali Android membuka dan menutup Pause, lalu keluar dari Menu.
- [ ] Safe-area benar di perangkat dengan notch dan navigasi gestur.
- [ ] PWA bisa dipasang, lalu dimainkan dalam mode pesawat setelah kunjungan pertama.
- [ ] Deploy Vercel dari branch utama, dengan URL produksi tercatat.
- [ ] Ikon aplikasi final sudah disetujui pemilik. Tidak ada placeholder yang tersisa.
- [ ] Listing toko (ID dan EN) ditulis dari daftar fitur yang lolos Fase 1 sampai 4. Setiap kalimat listing bisa ditunjuk ke fitur yang ada. Tidak ada angka, klaim, atau testimoni yang dikarang, dan tidak ada kata merek dagang permainan blok jatuh.
- [ ] Screenshot listing diambil dari build asli, bukan mockup.
- [ ] Kebijakan privasi tersedia jika diwajibkan toko. Isinya sesuai kenyataan: data hanya disimpan di perangkat.

## Fase 6: Sistem meta (fase 2 produk)

Lingkup kandidat: koin, item, toko, quest, rank, daily reward, notifikasi, dan leaderboard online.

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
| Konsep ikon aplikasi | Sebelum Fase 5 | DESIGN.md bagian 10 |
