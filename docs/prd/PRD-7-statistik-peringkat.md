# BlockDown: Statistik Pribadi dan Peringkat Online (Fase 7)

Status: dibangun. Keputusan pemilik: Upstash Redis lewat Vercel, nama panggilan tanpa login, skor diputar ulang di server, peringkat untuk Sprint 40, Ultra, dan Maraton 150, sepanjang masa saja.

## 1. Statistik pribadi

- Disimpan di perangkat (localStorage, skema 3). Dicatat sekali per permainan yang berakhir; permainan yang ditinggalkan lewat Ke Menu atau Ulangi tidak dihitung, sama seperti rekor.
- Isi: jumlah permainan, waktu bermain (dari tick core, Pause tidak dihitung), baris dihapus, piece dijatuhkan, 4 Baris, T-Spin, Bersih Total, combo terpanjang, dan rekor per mode.
- Migrasi skema 2 ke 3: statistik mulai dari nol, karena permainan sebelumnya tidak tercatat. Rekor dan tema yang sudah terbuka tetap.
- Layar: ikon peringkat di baris atas Menu, tab "Saya".

## 2. Peringkat online

### 2.1 Alur pemain

1. Selesaikan Sprint 40, Ultra, atau Maraton 150 (berakhir dengan skor di atas 0; Sprint harus mencapai 40 baris).
2. Game Over menampilkan tombol "Kirim ke Peringkat". Tidak otomatis: pemain yang memilih.
3. Pertama kali: isi nama panggilan (2 sampai 16 huruf, angka, spasi, titik, garis bawah, atau tanda hubung). Nama tampil untuk semua pemain.
4. Hasil: "Masuk peringkat: posisi N", atau "Terkirim. Skor terbaikmu tetap di posisi N" jika tidak lebih baik dari sebelumnya.
5. Tab "Peringkat": 50 teratas per mode; baris milik pemain ditandai.

Tidak tampil untuk Zen dan Maraton tanpa batas (panjangnya tidak tetap). Perubahan jatuh pelan di tengah permainan ikut terekam (PRD-8), jadi tetap bisa dikirim.

### 2.2 Pencegahan curang

- Perangkat mengirim rekaman permainan: seed, jumlah tick, pengaturan jatuh pelan, dan aksi per tick. Bukan skor.
- Server memutar ulang rekaman dengan core yang sama (``src/core/replay.ts``) dan menghitung skor sendiri. Skor yang diklaim perangkat diabaikan.
- Rekaman ditolak jika rusak, aksi di luar rentang, ada tick setelah permainan berakhir, permainan belum berakhir, atau melebihi 1 jam.
- Batas 10 kiriman per IP per menit.
- Batas yang jujur: rekaman yang dibuat program (bot) tetap bisa lolos, karena server hanya memastikan rekaman itu permainan yang sah, bukan dimainkan manusia.

### 2.3 Identitas

- Tanpa login dan tanpa email. Perangkat membuat kode rahasia acak (128 bit) saat pertama kali mengirim. Server menyimpan hash SHA-256 kode itu sebagai pemilik nama.
- Nama tidak membedakan huruf besar dan kecil. Nama milik perangkat lain ditolak ("Nama ini sudah dipakai pemain lain").
- Kode rahasia disimpan di localStorage. Jika data browser dihapus, nama lama tidak bisa dipakai lagi dari perangkat itu.

### 2.4 Data di server (Upstash Redis)

| Kunci | Isi |
|---|---|
| ``lb:{mode}`` | sorted set: nama, nilai terbaik (Sprint dalam ms, makin kecil makin baik) |
| ``lbat:{mode}`` | hash: nama, tanggal nilai terbaik |
| ``name:{nama kecil}`` | hash SHA-256 kode rahasia pemilik |
| ``rl:{ip}:{menit}`` | hitungan kiriman, kedaluwarsa 60 detik |

Yang dikirim ke server: nama panggilan, kode rahasia, dan rekaman permainan. Alamat IP hanya dipakai untuk batas kiriman dan kedaluwarsa dalam 60 detik. Tidak ada data lain.

### 2.5 Teknis

- ``api/leaderboard.ts``: satu fungsi Vercel. GET ``?mode=`` mengembalikan 50 teratas; POST mengirim skor. Penyimpanan lewat REST API Upstash dengan ``fetch``, tanpa dependensi baru. Variabel lingkungan dari integrasi Vercel: ``KV_REST_API_URL`` dan ``KV_REST_API_TOKEN`` (atau ``UPSTASH_REDIS_REST_*``). Tanpa variabel itu, peringkat melapor ``enabled: false`` dan game tetap berjalan.
- ``src/server/leaderboard.ts``: logika server tanpa ketergantungan pada Vercel atau Redis, dites dengan Redis tiruan di memori (``tests/server.test.ts``).
- Service worker (v3) tidak pernah menyimpan ``/api/`` di cache.
- ``tests/tools/dev-server.ts``: menyajikan ``dist/`` dan fungsi asli dengan Redis tiruan, untuk uji di browser tanpa Upstash.

## 3. Uji

- Tes: 3 tes putar ulang (skor, baris, dan status sama persis di Maraton 150, Ultra, Sprint 40; rekaman rusak, seed lain, aksi tidak sah, ticks di luar batas, dan tick setelah permainan berakhir ditolak) dan 5 tes server (skor sah dihitung ulang, hanya yang terbaik disimpan, urutan per mode, rekaman palsu ditolak, kepemilikan nama, nama tidak sah, batas per IP). Total 76 tes lulus.
- Browser dengan server uji: dua pemain di dua browser; nama terlalu pendek ditolak; pemain pertama posisi 1; nama ``andra`` milik perangkat lain ditolak; nama lain posisi 2; peringkat terurut dan baris sendiri ditandai; Statistik tercatat; Zen tanpa tombol kirim; 0 error.
- Koneksi ke Upstash di Vercel: PING dijawab PONG.

## 4. Simpan dan lanjutkan permainan (PRD-8, permintaan pemilik)

- Permainan yang sedang berjalan disimpan otomatis saat Pause, saat tab atau aplikasi disembunyikan, saat halaman ditutup (`pagehide`), dan saat Ke Menu dari Pause. Satu simpanan, kunci `blockdown-resume` terpisah dari data utama.
- Isi simpanan adalah rekaman yang sama dengan peringkat (seed, jatuh pelan awal, aksi per tick), bukan isi papan. Lanjutkan = putar ulang sampai tick terakhir, lalu masuk ke Pause. Karena itu permainan yang dilanjutkan identik dengan tanpa jeda, dan skornya tetap sah untuk peringkat.
- Perubahan jatuh pelan di tengah permainan kini dicatat di rekaman sebagai kode 9..17 (urutan pertama di catatan tick itu), jadi pembatasan sebelumnya dihapus.
- Menu: baris `Lanjutkan` di atas daftar mode berisi mode, baris, dan skor, dan mendapat fokus. Memulai mode lain menanyakan dulu (`Mulai permainan baru?`), karena simpanan akan dibuang. Ke Menu dari Pause tidak lagi meminta konfirmasi; Ulangi tetap meminta.
- Simpanan dihapus saat permainan berakhir (semua jalan ke Game Over), saat Ulangi, dan saat permainan baru dimulai. Simpanan rusak dibuang dengan pesan.
- Uji: 2 tes baru (lanjut dari tick 2500 identik dengan permainan tanpa jeda, termasuk rekaman byte demi byte; perubahan jatuh pelan terekam dan kode di posisi salah ditolak), total 78. Browser: main Ultra, tutup halaman, buka lagi, Lanjutkan, skor dan baris sama dan berada di Pause; Ke Menu tanpa konfirmasi; mulai Zen ditanya, Batal menyimpan, Mulai baru membuang; Akhiri menghapus simpanan; simpanan rusak dibuang dengan pesan; 0 error.
