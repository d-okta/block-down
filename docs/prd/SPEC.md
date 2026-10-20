# BlockDown: Spesifikasi Permainan

Dokumen ini bagian dari PRD BlockDown, bersama DESIGN.md, ARCHITECTURE.md, dan ROADMAP.md. Isinya aturan permainan yang harus diimplementasikan persis di `src/core/`. Setiap angka di sini adalah parameter desain, bukan klaim.

Istilah: "piece" adalah satu tetromino yang sedang dikendalikan. "Sel" adalah satu kotak di board. Clear 4 baris disebut "4 Baris" (ID) dan "Quad" (EN). Nama merek dagang permainan blok jatuh tidak dipakai di mana pun, termasuk di kode, aset, dan listing.

---

## 1. Board

- 10 kolom x 20 baris terlihat, ditambah 2 baris tersembunyi di atasnya untuk spawn. Total 10 x 22.
- Koordinat di core: `x` 0 sampai 9 dari kiri, `y` 0 sampai 21 dari bawah (y ke atas). Baris 20 dan 21 tersembunyi.
- Renderer membalik `y` saat menggambar. Core tidak pernah tahu arah layar.
- Sel berisi `0` (kosong) atau `1` sampai `7` (jenis blok I, O, T, S, Z, J, L), disimpan dalam satu `Uint8Array` berukuran 220.

## 2. Piece

Tujuh jenis: I, O, T, S, Z, J, L. Orientasi: `0` (spawn), `R` (putar kanan sekali), `2`, `L`.

Bentuk dalam orientasi spawn (x ke kanan, baris atas ditulis lebih dulu), mengikuti standar SRS:

```
I: ....    O: .OO.   T: .T.   S: .SS   Z: ZZ.   J: J..   L: ..L
   IIII       .OO.      TTT      SS.      .ZZ      JJJ      LLL
   ....                 ...      ...      ...      ...      ...
   ....
```

Posisi spawn: kotak pembatas piece diletakkan sehingga baris bawah bentuknya berada di baris 20 (baris tersembunyi pertama). JLSTZ di kolom 3 sampai 5, I di kolom 3 sampai 6, O di kolom 4 sampai 5. Setelah spawn, piece langsung turun satu baris jika ruangnya kosong, sehingga muncul di tepi atas area terlihat.

Ghost piece: posisi terendah yang bisa dicapai piece saat ini dengan hard drop. Dihitung ulang hanya saat piece bergerak, berputar, atau board berubah.

## 3. Rotasi: SRS penuh

Putaran mencoba lima offset secara berurutan. Offset pertama yang tidak bertabrakan dipakai. Jika semuanya gagal, putaran dibatalkan.

Offset ditulis sebagai `(dx, dy)` dengan y ke atas, sesuai koordinat core.

### 3.1 J, L, S, T, Z

| Putaran | Tes 1 | Tes 2 | Tes 3 | Tes 4 | Tes 5 |
|---|---|---|---|---|---|
| 0 ke R | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
| R ke 0 | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
| R ke 2 | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
| 2 ke R | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
| 2 ke L | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |
| L ke 2 | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
| L ke 0 | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
| 0 ke L | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |

### 3.2 I

| Putaran | Tes 1 | Tes 2 | Tes 3 | Tes 4 | Tes 5 |
|---|---|---|---|---|---|
| 0 ke R | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
| R ke 0 | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
| R ke 2 | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |
| 2 ke R | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
| 2 ke L | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
| L ke 2 | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
| L ke 0 | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
| 0 ke L | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |

### 3.3 O

O tidak memakai kick. Putaran O selalu berhasil dan tidak mengubah posisi sel.

### 3.4 Data yang dicatat setiap putaran berhasil

- `lastAction = "rotate"`
- `kickIndex` (0 sampai 4), dipakai untuk deteksi T-Spin dan efek kemiringan.
- Event `rotate { kicked: kickIndex > 0 }` untuk audio dan renderer.

Putaran 180 derajat tidak ada di fase 1.

## 4. Randomizer: 7-bag murni

- Satu bag berisi ketujuh jenis piece tepat satu kali, diacak dengan Fisher-Yates.
- Bag berikutnya dibuat saat queue butuh isi. Tidak ada aturan tambahan: tidak ada larangan S/Z sebagai piece pertama, dan tidak ada larangan piece kembar di batas bag.
- Generator acak memakai seed (PRNG deterministik), sehingga permainan yang sama bisa diulang di tes.
- Next queue menampilkan 5 piece.

## 5. Hold

- Hold dipakai 1 kali per piece. Setelah piece itu terkunci, Hold bisa dipakai lagi.
- Hold pertama dalam satu permainan: piece saat ini disimpan, lalu piece berikutnya diambil dari queue.
- Hold berikutnya: piece saat ini ditukar dengan piece yang disimpan.
- Piece yang keluar dari Hold muncul di posisi dan orientasi spawn, dengan lock delay dan hitungan reset baru.
- Hold yang tidak tersedia tidak melakukan apa-apa dan tidak memancarkan event suara.

## 6. Gravitasi, lock delay, dan game over

### 6.1 Gravitasi Marathon

Waktu per baris (detik) = `(0.8 - (L - 1) * 0.007) ^ (L - 1)`, dengan L adalah level.

- Level naik setiap 10 baris. Level awal 1.
- Core berjalan di 60 tick per detik. Gravitasi diubah menjadi baris per tick: `G = (1/60) / waktuPerBaris`. Sisa pecahan disimpan di akumulator.
- Batas atas 20 baris per tick, sehingga piece langsung jatuh ke dasar dalam satu tick.

### 6.2 Lock delay

- Piece yang menyentuh dasar (tidak bisa turun satu baris) mulai menghitung lock delay 400 ms (diturunkan dari 500 ms atas permintaan pemilik setelah uji main).
- Geser atau putar yang berhasil saat menyentuh dasar mereset timer ke 400 ms dan menambah hitungan reset.
- Maksimal 15 reset per piece. Setelah reset ke-15, piece langsung terkunci begitu menyentuh dasar.
- Hitungan reset kembali ke 0 jika piece mencapai baris yang lebih rendah dari baris terendah yang pernah dicapainya. Ini mencegah piece terkunci terlalu cepat setelah jatuh ke celah.
- Jika piece terangkat dari dasar (misalnya setelah kick ke atas), timer berhenti dan dilanjutkan saat menyentuh dasar lagi.
- Hard drop mengunci langsung tanpa lock delay.

### 6.3 Tanpa jeda setelah clear

- Baris yang penuh dihapus di tick yang sama dengan lock.
- Piece berikutnya muncul di tick yang sama dengan lock dan bisa digerakkan mulai tick berikutnya. Jeda line clear di logika 0 ms. Semua efek clear hanya visual (DESIGN.md bagian 8).

### 6.4 Game over

- Block out: piece baru muncul bertabrakan dengan sel yang sudah terisi.
- Lock out: piece terkunci seluruhnya di baris tersembunyi (y 20 ke atas).
- Di mode Zen, kedua kondisi ini mengosongkan board alih-alih mengakhiri permainan (lihat bagian 10).

## 7. Input

### 7.1 Aksi abstrak

`moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotateCW`, `rotateCCW`, `hold`, `pause`. Core hanya menerima aksi ini, tidak menerima kode tombol.

### 7.2 DAS dan ARR

| Parameter | Bawaan | Rentang | Langkah |
|---|---|---|---|
| DAS (delay sebelum geser berulang) | 167 ms | 50 sampai 300 ms | 1 ms |
| ARR (jeda antar geser berulang) | 33 ms | 0 sampai 100 ms | 1 ms |
| Soft drop | 20x gravitasi | 5x sampai 40x, ditambah "Instan" | 5x |

- Tekan pertama langsung menggeser satu sel.
- Setelah tombol ditahan selama DAS, piece bergeser satu sel setiap ARR.
- ARR 0: piece langsung pindah sampai mentok ke dinding dalam tick yang sama.
- Jika kiri dan kanan ditahan bersamaan, arah yang ditekan terakhir menang. Saat arah itu dilepas, arah yang masih ditahan berlanjut dengan DAS dihitung ulang.
- Muatan DAS tetap tersimpan saat piece berganti, jadi geser cepat langsung berlaku untuk piece baru.
- Soft drop: selama ditahan, gravitasi dikali faktor soft drop. Kecepatan minimum soft drop satu baris per tick tidak dijamin, kecuali jika hasil kalinya memang setinggi itu.

### 7.3 Waktu

- Input dicatat dengan timestamp `performance.now()` dan diproses di tick berikutnya, sesuai urutan masuknya.
- DAS dan ARR dihitung dalam milidetik dari akumulasi tick (16.667 ms per tick), tidak dari frame render.

## 8. Skor

### 8.1 Tabel dasar (dikali level saat aksi terjadi)

| Aksi | Poin |
|---|---|
| Single | 100 |
| Double | 300 |
| Triple | 500 |
| 4 Baris (Quad) | 800 |
| T-Spin Mini tanpa baris | 100 |
| T-Spin Mini Single | 200 |
| T-Spin Mini Double | 400 (tambahan di luar brief, disetujui pemilik) |
| T-Spin tanpa baris | 400 |
| T-Spin Single | 800 |
| T-Spin Double | 1200 |
| T-Spin Triple | 1600 |

Level yang dipakai adalah level sebelum baris dari aksi itu dihitung, supaya naik level tidak menaikkan nilai aksi yang menyebabkannya.

### 8.2 Back-to-Back (B2B)

- Aksi "sulit": 4 Baris, dan T-Spin apa pun (termasuk Mini) yang menghapus minimal satu baris.
- Jika aksi sulit terjadi saat B2B aktif, poin aksinya dikali 1.5.
- Aksi sulit menyalakan B2B.
- Single, Double, atau Triple biasa mematikan B2B.
- T-Spin tanpa baris dan lock tanpa clear tidak mengubah B2B.

### 8.3 Combo

- Hitungan combo dimulai dari -1.
- Setiap lock yang menghapus baris menambah combo 1. Lock tanpa clear mengembalikannya ke -1.
- Bonus combo = `50 x combo x level`, diberikan jika combo minimal 1 (clear kedua berturut-turut).

### 8.4 Bersih Total (Perfect Clear)

Bonus jika board kosong setelah clear. Bonus ditambahkan di atas poin aksi dan dikali level.

| Baris dihapus | Bonus |
|---|---|
| 1 | 800 |
| 2 | 1200 |
| 3 | 1800 |
| 4 | 2000 |
| 4 Baris saat B2B aktif | 3200 |

Pengali B2B 1.5 tidak dikenakan ke bonus Bersih Total. Bonus 3200 sudah memperhitungkannya.

### 8.5 Drop

- Soft drop: +1 per sel yang turun karena soft drop.
- Hard drop: +2 per sel yang ditempuh.
- Poin drop tidak dikali level.

### 8.6 Urutan hitung per lock

1. Tentukan jenis T-Spin (bagian 8.7).
2. Hapus baris dan hitung jumlahnya.
3. Poin aksi = tabel x level, lalu x1.5 jika B2B berlaku.
4. Perbarui status B2B.
5. Perbarui combo dan tambahkan bonus combo.
6. Jika board kosong, tambahkan bonus Bersih Total.
7. Tambah baris, lalu perbarui level.
8. Pancarkan event `clear` berisi semua komponen skor, sehingga angka melayang di layar sama persis dengan yang dihitung core.

Semua skor disimpan sebagai bilangan bulat. Hasil x1.5 dibulatkan ke bawah.

### 8.7 Deteksi T-Spin: aturan 3 sudut

Syarat awal: piece adalah T, dan aksi terakhir yang berhasil sebelum lock adalah putaran.

- `lastAction` di-set `"rotate"` saat putaran berhasil, dan `"move"` saat geser kiri atau kanan berhasil.
- Gravitasi, soft drop, dan hard drop tidak mengubah `lastAction`, jadi putar lalu hard drop tetap bisa menjadi T-Spin.

Lalu periksa empat sel diagonal di sekitar pusat T. Sel di luar board (dinding dan lantai) dihitung terisi.

- Sudut depan: dua sudut di sisi tempat T menunjuk.
- Sudut belakang: dua sudut di sisi sebaliknya.

| Kondisi | Hasil |
|---|---|
| Kurang dari 3 sudut terisi | Bukan T-Spin |
| 3 atau 4 sudut terisi, kedua sudut depan terisi | T-Spin |
| 3 sudut terisi, hanya 1 sudut depan terisi, putaran memakai tes 5 (`kickIndex = 4`) | T-Spin (kasus TST dan fin) |
| 3 sudut terisi, hanya 1 sudut depan terisi, tes lain | T-Spin Mini |

## 9. Bahasa

- Dua bahasa: Indonesia (`id`) dan Inggris (`en`).
- Kamus di `src/i18n/id.ts` dan `src/i18n/en.ts`. Key harus sama di keduanya. Ini diperiksa oleh tipe TypeScript dan oleh tes.
- Bahasa awal: `navigator.language` yang diawali `en` memakai `en`, yang diawali `id` memakai `id`, dan selain itu memakai `id`.
- Bahasa bisa diganti di Menu dan di Pengaturan. Pilihan disimpan di localStorage, dan `<html lang>` ikut diperbarui.
- Tidak ada teks yang ditulis langsung di kode, termasuk callout, label aria, pesan error, dan teks listing.
- Interpolasi memakai placeholder bernama, misalnya `{n}` atau `{action}`.
- Angka diformat dengan `Intl.NumberFormat` sesuai bahasa: `1.200` di `id`, `1,200` di `en`.
- Callout seperti "T-SPIN" dan "COMBO" tetap punya key di kedua kamus, walaupun isinya sama.

Kelompok key minimum: `menu.*`, `mode.*` (nama dan deskripsi), `hud.*`, `callout.*`, `pause.*`, `gameover.*`, `settings.*`, `controls.*` (nama aksi), `a11y.*` (label pembaca layar), `notice.*` (pemberitahuan penyimpanan, suara, gamepad).

## 10. Mode

| Mode | ID | EN | Akhir permainan | Rekor |
|---|---|---|---|---|
| Maraton 150 | Maraton - Naik level sampai kamu menyerah | Marathon - Level up until you give in | 150 baris tercapai, atau top out | Skor tertinggi |
| Maraton tanpa batas | (varian Maraton) | (Marathon variant) | Top out | Skor tertinggi |
| Sprint 40 | Sprint 40 - Hapus 40 baris secepat mungkin | Sprint 40 - Clear 40 lines as fast as you can | 40 baris tercapai (selesai), atau top out (gagal) | Waktu tercepat dalam ms, hanya jika selesai |
| Ultra | Ultra - Skor tertinggi dalam 2 menit | Ultra - Highest score in 2 minutes | 120.000 ms habis, atau top out | Skor tertinggi |
| Zen | Zen - Tanpa kalah, tanpa waktu | Zen - No losing, no clock | Hanya saat pemain keluar | Baris terbanyak dalam satu sesi |

Teks deskripsi di atas memakai tanda hubung biasa sebagai pemisah nama dan deskripsi di dokumen ini. Di UI, nama dan deskripsi adalah dua elemen terpisah.

Detail per mode:
- Maraton: gravitasi mengikuti rumus bagian 6.1.
- Sprint 40: gravitasi level 1 tetap. Timer mulai saat piece pertama muncul dan berhenti di tick saat baris ke-40 terhapus. Waktu ditampilkan `m:ss.mmm`.
- Sprint 40 langsung mulai, tanpa hitung mundur.
- Ultra: level naik setiap 10 baris dan gravitasi mengikuti rumus Maraton, sehingga pengali skor bermakna. Waktu tersisa ditampilkan `m:ss`.
- Zen: gravitasi tetap level 1, dan level tidak naik. Saat block out atau lock out, board dikosongkan, skor dan baris tetap, lalu permainan berlanjut. Tidak ada timer.
- Timer semua mode dihitung dari tick core, bukan dari jam dinding, jadi Pause menghentikan timer.

Setiap mode adalah objek dengan fungsi `checkEnd(state)` dan `onTopOut(state)`, sehingga menambah mode tidak menyentuh logika inti.

## 11. Kontrol

### 11.1 Keyboard (bawaan, semuanya bisa diubah)

| Aksi | Tombol |
|---|---|
| Geser kiri / kanan | Panah kiri / Panah kanan |
| Soft drop | Panah bawah |
| Hard drop | Space |
| Putar kiri | Z |
| Putar kanan | X |
| Hold | Panah atas |
| Pause | Esc, P |

Bawaan satu tombol per aksi, dengan panah atas untuk Hold supaya sama dengan gestur seret ke atas (keputusan pemilik setelah uji Fase 3; sebelumnya Z/Ctrl, X/panah atas, C/Shift). Keymap yang sudah tersimpan tidak diubah; "Kembalikan bawaan" memberi susunan ini.

- Pemetaan memakai `KeyboardEvent.code` supaya tidak bergantung pada tata letak keyboard.
- Satu aksi bisa punya dua tombol (diatur di Pengaturan). Satu tombol hanya untuk satu aksi.
- Esc selalu berfungsi sebagai pause dan kembali, dan tidak bisa dipetakan ke aksi lain.
- Pengulangan dari sistem operasi (`event.repeat`) diabaikan. DAS dan ARR ditangani sendiri.

### 11.2 Sentuh

Hanya gestur. Tidak ada tombol di layar dan tidak ada pilihan mode sentuh (keputusan pemilik setelah uji di Galaxy A13: gestur adalah kebiasaan genre ini di HP).

Gestur (satuan jarak memakai lebar satu sel di layar):
| Gestur | Aksi |
|---|---|
| Ketuk | Putar kanan |
| Ketuk dua jari | Putar kiri |
| Seret mendatar | Geser satu kolom setiap jarak satu sel yang ditempuh |
| Banting ke bawah (cepat, minimal 1,5 sel) atau seret ke bawah (minimal 2,5 sel) | Hard drop, langsung saat syarat tercapai, sekali per sentuhan |
| Banting atau seret ke atas, syarat yang sama | Hold |
| Geser lalu banting ke bawah tanpa mengangkat jari | Geser, lalu hard drop |

Soft drop tidak punya gestur (keputusan pemilik). Soft drop tetap ada di keyboard dan gamepad.

Arah ditentukan pada gerak pertama di atas 0,6 sel. Arah dianggap tegak hanya jika gerak tegaknya lebih dari 1,3 kali gerak mendatar (sekitar 52 derajat); selain itu dianggap geser. Ini mencegah seret ke samping yang sedikit menurun terbaca sebagai jatuh cepat.

Bantingan: kecepatan puncak ke bawah minimal 20 sel per detik. Gerak kecil ke bawah (di bawah 1,5 sel) tidak pernah memicu apa pun, secepat apa pun.

Satu sentuhan bisa terdiri dari geser lalu banting: setelah geser, gerak tegak minimal 0,6 sel sejak geser terakhir memulai bagian tegak baru, yang dinilai dengan syarat yang sama.

Browser kadang hanya mengirim titik sentuh dan titik lepas, atau membatalkan sentuhan di tengah bantingan. Karena itu titik lepas juga dihitung sebagai gerak, dan sentuhan yang dibatalkan tetap memakai gerak yang sudah diterima.

Konstanta ada di `src/input/gesture.ts`. Nilai di atas hasil revisi ketiga setelah uji di Galaxy A13:
1. Revisi kedua: seret ke bawah kadang tidak terbaca saat dibanting keras; seret ke samping kadang salah arah.
2. Revisi ketiga: gerak kecil ke bawah langsung jatuh cepat (terlalu sensitif); pemain ingin bisa geser lalu banting tanpa mengangkat jari.

Area sentuh adalah seluruh layar Game kecuali tombol jeda, jadi jari tidak perlu menutupi papan.

Orientasi: di layar sentuh, permainan hanya tegak. Saat HP diputar mendatar, layar diganti pesan "Putar HP ke posisi tegak" dan permainan dijeda.

### 11.3 Gamepad

Lewat Gamepad API dengan mapping standar. Dibaca dengan polling sekali per tick.

| Aksi | Tombol |
|---|---|
| Geser | D-pad kiri / kanan, stik kiri |
| Soft drop | D-pad bawah |
| Hard drop | D-pad atas |
| Putar kanan | A (tombol 0) |
| Putar kiri | B (tombol 1) |
| Hold | LB atau RB (tombol 4 dan 5) |
| Pause | Start (tombol 9) |

Pemetaan ulang gamepad tidak ada di fase 1. Menu juga bisa dinavigasi dengan D-pad, A untuk memilih, dan B untuk kembali.

### 11.4 Getar

- Lewat Capacitor Haptics di Android. Di web, memakai `navigator.vibrate` jika tersedia. Jika tidak tersedia, kontrol Getar dinonaktifkan dengan alasan.
- Hard drop: getaran sedang. 4 Baris, T-Spin dengan baris, dan Bersih Total: getaran kuat. Game over: getaran notifikasi.
- Geser, putar, dan lock tidak bergetar karena terlalu sering.

## 12. Pengaturan

| Kelompok | Pengaturan | Bawaan |
|---|---|---|
| Kontrol | DAS | 167 ms |
| | ARR | 33 ms |
| | Soft drop | 20x |
| | Tombol keyboard | Bagian 11.1 |
| Tampilan | Ghost piece | Aktif |
| | Grid | Aktif |
| | Mode aman buta warna | Mati |
| | Intensitas efek | Penuh, atau Minimal jika `prefers-reduced-motion` |
| | Kurangi animasi | Mengikuti `prefers-reduced-motion` |
| Suara | Musik | 0.6, disetel ulang setelah uji dengar di Fase 4 |
| | Efek | 0.8, disetel ulang setelah uji dengar di Fase 4 |
| | Getar | Aktif jika didukung |
| Bahasa | Bahasa | Bagian 9 |

Semua perubahan berlaku langsung, termasuk saat dibuka dari Pause.

## 13. Penyimpanan

- localStorage, satu key: `blockdown`.
- Bentuk data:

```ts
{
  schema: 2,
  settings: {
    locale: "id" | "en",
    dasMs: number,        // 50..300
    arrMs: number,        // 0..100
    softDropFactor: number | "instant",  // 5..40 langkah 5
    keymap: Record<Action, string[]>,
    ghost: boolean,
    grid: boolean,
    colorSafe: boolean,
    effects: "full" | "medium" | "minimal",
    reduceMotion: boolean | null,   // null = ikuti sistem
    musicVolume: number,  // 0..1
    sfxVolume: number,    // 0..1
    haptics: boolean,
    theme: "classic" | "night" | "neon" | "dawn" | "mono"   // PRD-6, selalu tema yang terbuka
  },
  records: {
    marathon150?: { score: number, lines: number, level: number, at: string },
    marathonEndless?: { score: number, lines: number, level: number, at: string },
    sprint40?: { timeMs: number, at: string },
    ultra?: { score: number, lines: number, at: string },
    zen?: { lines: number, at: string }
  },
  unlocks: { night?: string, neon?: string, dawn?: string, mono?: string }  // tanggal terbuka (PRD-6)
}
```

- `at` dan nilai `unlocks` adalah tanggal ISO 8601.
- Migrasi skema 1 ke 2 (PRD-6): `unlocks` kosong dan `theme` Klasik, lalu tema yang syaratnya terpenuhi oleh rekor tersimpan (Maraton 150 selesai, Sprint 40 di bawah 3 menit) langsung terbuka dengan tanggal rekornya.
- Validasi saat dibaca:
  - JSON rusak: pakai nilai bawaan, tampilkan pemberitahuan satu baris, dan jangan menimpa data lama sampai ada penyimpanan berikutnya yang berhasil.
  - `schema` lebih lama: jalankan migrasi berurutan.
  - `schema` lebih baru dari yang dikenal: baca hanya field yang dikenal dan jangan menulis ulang, supaya data dari versi lebih baru tidak hilang.
  - Setiap field diperiksa tipe dan rentangnya. Field yang tidak valid diganti nilai bawaan satu per satu, tidak seluruh objek.
  - Angka rekor harus bilangan bulat tidak negatif dan berhingga.
- Penulisan dibungkus `try/catch` (mode privat dan kuota penuh). Kegagalan menulis tidak menghentikan permainan.
- Rekor ditulis sekali saat permainan berakhir, bukan setiap frame.
- Data ini milik pemain dan bisa diubah sendiri. Rekor lokal tidak dianggap tepercaya, dan memang tidak dipakai untuk apa pun selain ditampilkan kembali.

## 14. Suara

Revisi Fase 4 tahap 2 (keputusan pemilik): suara memakai file berlisensi CC0, bukan sintesis. Pemilik memilih sendiri setiap suara dari kandidat di halaman uji dengar. Daftar file dan sumbernya ada di `public/sfx/LISENSI.txt`. Total 17 file, sekitar 660 KB (efek sekitar 135 KB, musik 522 KB).

| Kejadian | File | Sumber |
|---|---|---|
| Geser | `click_003` (volume 60%, pitch diacak +-3%) | Kenney Interface Sounds |
| Putar | `select_001` (nada naik sedikit jika memakai kick) | Kenney Interface Sounds |
| Soft drop | `tick_004` (volume 40%) | Kenney Interface Sounds |
| Hard drop | `impactPlate_heavy_001`, ditambah getar | Kenney Impact Sounds |
| Lock tanpa hard drop | `drop_004` | Kenney Interface Sounds |
| Hold | `select_006` | Kenney Interface Sounds |
| 1, 2, 3 Baris | `confirmation_001`, `_002`, `_003` | Kenney Interface Sounds |
| 4 Baris | `powerUp5` | Kenney Digital Audio |
| T-Spin | `phaserUp4` | Kenney Digital Audio |
| Combo | `pluck_002`, nadanya naik di tangga nada pentatonik per combo | Kenney Interface Sounds |
| Bersih Total | `jingles_STEEL00` | Kenney Music Jingles |
| Naik level | `jingles_STEEL16` | Kenney Music Jingles |
| Game over | `zapThreeToneDown` | Kenney Digital Audio |
| Tombol menu dan dialog | `switch_002` | Kenney Interface Sounds |
| Musik latar | Crystal Cave (cynicmusic), diulang terus | OpenGameArt |

Detail:
- Satu suara utama per clear, yang paling besar: Bersih Total, lalu T-Spin, lalu 4 Baris, lalu 1 sampai 3 Baris. Nada combo ditambahkan di atasnya.
- Combo: `playbackRate = 2^(nada/12)` dengan nada pentatonik mayor 0, 2, 4, 7, 9, 12, 14, 16, 19, 21. Combo 10 ke atas tetap di nada tertinggi.
- Geser dan soft drop maksimal 4 bunyi bersamaan; selebihnya dilewati.
- Musik mulai dari awal setiap permainan baru, turun ke 30% saat Pause, berhenti di menu dan saat permainan berakhir. Tempo dan kunci musik tidak berubah per level (batas file audio; naik level ditandai jingle).
- Rantai audio: efek dan musik punya `GainNode` masing-masing ke `destination`. Volume slider dikuadratkan supaya terasa rata di telinga.
- Audio baru dibuat dan file baru diunduh setelah gestur pertama pemain (`pointerdown` atau `keydown`). Sebelum itu tidak ada suara, tidak ada unduhan, dan tidak ada error. File yang gagal dimuat dilewati; suara itu saja yang diam.
- Saat tab disembunyikan atau aplikasi ke latar belakang, `AudioContext` di-suspend.
- Jika Web Audio tidak tersedia, permainan tetap berjalan tanpa suara, dan Pengaturan Suara menampilkan alasannya dengan slider nonaktif.

## 15. Di luar cakupan fase 1

Masuk fase 2 (ROADMAP Fase 6): koin, item, toko, quest, rank, daily reward, notifikasi, dan leaderboard online.

Juga tidak ada di fase 1: putaran 180 derajat, IRS dan IHS (putar atau hold saat spawn), pemilihan level awal Maraton, garbage dan mode lawan, serta pemetaan ulang gamepad.

Tidak ada tombol, menu, atau teks listing yang menyebut fitur-fitur ini sampai fiturnya benar-benar ada.

## 16. Keputusan (aturan)

Semua sudah diputuskan pemilik ("pakai usulan"):

1. T-Spin Mini Double: 400 poin, sesuai tabel standar.
2. Soft drop: 5x sampai 40x dengan langkah 5, ditambah opsi "Instan" (piece langsung turun ke dasar tanpa mengunci; poin soft drop tetap +1 per sel). Bawaan 20x.
3. Ultra: level naik seperti Maraton.
4. Zen: gravitasi tetap level 1. Rekor: baris terbanyak.
5. Sprint 40: langsung mulai.
6. Musik latar: sintesis Web Audio.
