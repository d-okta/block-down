# BlockDown: Desain Visual dan Interaksi

Dokumen ini bagian dari PRD BlockDown, bersama SPEC.md, ARCHITECTURE.md, dan ROADMAP.md. Isinya arah visual, layar, dan motion. Aturan permainan ada di SPEC.md.

Status: PRD final, sudah dicocokkan dengan ekspor Google Stitch di `design/stitch/` (zip asli dan hasil ekstraknya per layar). Setiap perubahan dari brief dan dari Stitch dicatat di bagian 9.

---

## 1. Design Read dan dial

> Membaca ini sebagai: game puzzle blok jatuh untuk pemain mobile yang main dalam sesi fokus, dengan bahasa visual minimal premium yang tenang saat bermain dan meledak hanya di momen reward, dial DESIGN_VARIANCE 4 / MOTION_INTENSITY 7 / VISUAL_DENSITY 3, ENERGY rendah-sedang / RHYTHM teratur / MOTION fungsional plus momen reward.

| Dial | Nilai | Artinya di BlockDown |
|---|---|---|
| DESIGN_VARIANCE (taste-skill) | 4 | Tata letak simetri dan bisa ditebak. Playfield selalu di tengah. Variasi datang dari motion, bukan dari komposisi. |
| MOTION_INTENSITY (taste-skill) | 7 | Rendah saat bermain biasa, tinggi di momen reward. Angka 7 berlaku untuk puncaknya. |
| VISUAL_DENSITY (taste-skill) | 3 | Sedikit elemen di layar. HUD hanya berisi yang dipakai pemain saat itu. |
| ENERGY (antislop) | rendah-sedang | Layar menyapa dengan tenang. Energi dihemat untuk Quad, T-Spin, dan Bersih Total. |
| RHYTHM (antislop) | teratur | Grid 8px, satu sistem radius, posisi HUD tetap di semua mode. |
| MOTION (antislop) | fungsional plus momen reward | Setiap gerak memberi informasi (kunci, kick, clear, naik level). Momen reward adalah koreografi dengan durasi tetap. |

Kualitas yang dituju setara game berbayar di katalog premium seperti Apple Arcade. Itu standar kerapian, bukan gaya yang ditiru (R-30).

Prioritas platform: mobile portrait dulu, tetap nyaman di desktop dengan keyboard.

---

## 2. Prinsip

1. **Tenang saat bermain.** Selama tidak ada clear, layar hampir diam: hanya piece, ghost, dan pita ambient yang bergerak sangat pelan.
2. **Spektakuler hanya saat layak.** Momen reward punya storyboard tetap dan tidak pernah menutupi area tempat piece berikutnya muncul.
3. **Animasi tidak pernah memblokir input.** Logika sudah selesai sebelum efek mulai. Efek hanya lapisan visual di atasnya.
4. **Tidak bergantung pada warna saja.** Setiap jenis blok bisa diberi pola, dan setiap callout selalu berupa teks.

Yang tidak dipakai: glow neon di semua elemen, glassmorphism sebagai karakter UI, emoji, gradien dekoratif, ikon bintang atau kilau.

---

## 3. Tipografi

Font di-self-host lewat Vite: file woff2 subset Latin disimpan di dalam repo dan dimuat dengan `@font-face` serta `font-display: swap`. Kedua font berlisensi OFL.

| Peran | Font | Bobot | Alasan |
|---|---|---|---|
| Judul, logo, callout | Sora | 600, 700 | Bentuknya berbasis geometri dengan sudut tegas, sejalan dengan blok. |
| UI, label, isi | Sora | 400, 500 | Satu keluarga untuk seluruh UI, sehingga hierarki dibangun dari bobot dan ukuran, bukan dari campuran font. |
| Angka (skor, level, baris, waktu) | JetBrains Mono | 500 | Angka tabular (`font-variant-numeric: tabular-nums`) membuat skor tidak bergoyang saat bergulir. Font ini masuk daftar default AI (R-06). Alasannya tertulis di sini: fungsi tabular, bukan estetika terminal. |

Skala ukuran (px CSS, dibulatkan ke kelipatan grid jika memungkinkan):

| Token | Mobile | Desktop | Dipakai untuk |
|---|---|---|---|
| `display` | 40 | 56 | Logo di Menu |
| `callout` | 32 | 44 | Callout reward di playfield |
| `title` | 24 | 28 | Judul layar dan panel |
| `body` | 16 | 16 | Teks UI, baris mode |
| `label` | 14 | 14 | Label HUD, deskripsi mode |
| `num-lg` | 28 | 32 | Skor utama, skor akhir |
| `num` | 16 | 18 | Level, baris, waktu |

Teks tidak memakai ukuran tetap yang mengunci zoom. Ukuran memakai `rem` agar mengikuti pengaturan teks sistem, dan layout diuji pada zoom 200%.

Label HUD ("Simpan", "Antrean", "Level", "Rekor") memakai huruf biasa, Sora 500, 14px, warna `text-dim`. Tidak ada label kapital dengan tracking lebar dan tidak ada teks di bawah 12px. Kapital hanya dipakai untuk callout reward, yang berupa kata pendek.

---

## 4. Warna

Satu tema gelap, tanpa toggle. Alasannya: warna blok paling terbaca di atas latar gelap, dan momen reward berupa cahaya butuh latar gelap agar terasa. Tidak ada section yang berbalik terang (taste-skill 4.11).

### 4.1 Token

| Token | Hex | Peran |
|---|---|---|
| `bg` | #0F1217 | Latar halaman dan latar di belakang playfield |
| `surface-1` | #161B22 | Playfield, panel HUD |
| `surface-2` | #1E2530 | Panel overlay (Pause, Game Over), baris mode, kontrol Pengaturan |
| `text` | #E6E9EF | Teks utama |
| `text-dim` | #8A93A3 | Teks sekunder, deskripsi mode, "Belum ada" |
| `accent` | #5B7CFA | Tombol utama, cincin fokus, bingkai saat naik level, sapuan cahaya callout |
| `on-accent` | #0F1217 | Teks di atas aksen |
| `line-control` | #8A93A3 | Tepi kontrol interaktif (track switch, slider, segmented) |
| `line-deco` | #262F3D | Tepi dekoratif panel HUD dan bingkai playfield. Tidak membawa informasi. Nilai dari Stitch. |

Aksen hanya satu. Warna blok adalah konten permainan, bukan aksen. Warna emas pada callout Bersih Total memakai warna blok O dan hanya muncul di momen itu.

### 4.2 Warna blok

| Blok | Hex | Pola mode aman buta warna |
|---|---|---|
| I | #5CC8D6 | Garis horizontal |
| O | #E3C35A | Titik di tengah |
| T | #A57BD8 | Segitiga kecil |
| S | #6CC489 | Garis diagonal naik |
| Z | #E06C75 | Garis diagonal turun |
| J | #3F63C9 | Garis vertikal |
| L | #E39A55 | Kotak kecil berongga |

Pola digambar dengan #0F1217 pada opasitas 35% di atas warna blok, lalu di-cache bersama sprite blok. Pola juga muncul di Hold dan Next.

### 4.3 Rasio kontras (dihitung dengan contrast-check.py, rumus WCAG 2.x)

Teks:

| Pasangan | Rasio | Teks normal 4.5 | Teks besar 3.0 | Aturan pakai |
|---|---|---|---|---|
| `text` di atas `bg` | 15.43 | Lolos | Lolos | |
| `text` di atas `surface-1` | 14.22 | Lolos | Lolos | |
| `text` di atas `surface-2` | 12.67 | Lolos | Lolos | |
| `text-dim` di atas `bg` | 6.06 | Lolos | Lolos | |
| `text-dim` di atas `surface-1` | 5.59 | Lolos | Lolos | |
| `text-dim` di atas `surface-2` | 4.98 | Lolos | Lolos | |
| `on-accent` di atas `accent` | 5.10 | Lolos | Lolos | Teks tombol utama |
| #FFFFFF di atas `accent` | 3.68 | Gagal | Lolos | Tidak dipakai |
| `text` di atas `accent` | 3.02 | Gagal | Lolos | Tidak dipakai |
| `accent` di atas `bg` | 5.10 | Lolos | Lolos | Teks beraksen boleh |
| `accent` di atas `surface-1` | 4.70 | Lolos | Lolos | Teks beraksen boleh |
| `accent` di atas `surface-2` | 4.19 | Gagal | Lolos | Hanya teks besar atau elemen non-teks |
| O #E3C35A di atas `surface-1` | 10.07 | Lolos | Lolos | Callout Bersih Total |
| T #A57BD8 di atas `surface-1` | 5.29 | Lolos | Lolos | Callout T-Spin |

Non-teks (WCAG 1.4.11, minimal 3:1):

| Pasangan | Rasio | Hasil |
|---|---|---|
| I di atas `surface-1` / `bg` | 8.80 / 9.55 | Lolos |
| O di atas `surface-1` / `bg` | 10.07 / 10.92 | Lolos |
| T di atas `surface-1` / `bg` | 5.29 / 5.74 | Lolos |
| S di atas `surface-1` / `bg` | 8.15 / 8.84 | Lolos |
| Z di atas `surface-1` / `bg` | 5.41 / 5.87 | Lolos |
| J #3F63C9 di atas `surface-1` / `bg` | 3.16 / 3.43 | Lolos, paling tipis |
| L di atas `surface-1` / `bg` | 7.43 / 8.06 | Lolos |
| `accent` (cincin fokus) di atas `bg` / `surface-1` / `surface-2` | 5.10 / 4.70 / 4.19 | Lolos |
| `line-control` di atas `surface-2` / `bg` | 4.98 / 6.06 | Lolos |
| `surface-1` di atas `bg` | 1.08 | Gagal, jadi permukaan tidak boleh menjadi satu-satunya penanda kontrol |
| `surface-2` di atas `bg` | 1.22 | Gagal, aturan sama |
| `line-deco` di atas `bg` / `surface-1` | 1.39 / 1.28 | Gagal, hanya untuk dekorasi |
| `on-accent` di atas #4B6DEB (warna tekan dari Stitch) | 4.19 | Gagal, jadi warna tekan itu tidak dipakai |
| J lama #4F6FD9 di atas `accent` | 1.24 | Alasan J digeser |
| J baru #3F63C9 di atas `accent` | 1.49 | Lebih terpisah dari aksen |

Konsekuensi:
- Kontrol interaktif (switch, slider, segmented, tombol sekunder) wajib memakai tepi `line-control` atau label teks, tidak cukup dengan beda warna permukaan.
- Tag "Rekor baru" memakai teks `text` dengan tepi `accent`. Teks beraksen di atas `surface-2` hanya lolos untuk teks besar.
- Ghost piece digambar sebagai outline 2px dengan warna penuh bloknya, agar J tetap di atas 3:1.

---

## 5. Bentuk dan ruang

| Elemen | Aturan | Alasan |
|---|---|---|
| Grid jarak | 8px (4px untuk jarak di dalam komponen kecil) | Ritme teratur sesuai dial RHYTHM. |
| Radius blok | 4px | Blok tetap terbaca sebagai blok, tidak menjadi kapsul. |
| Radius panel | 12px | Panel lebih lembut dari blok, jadi hierarkinya terlihat. |
| Radius tombol dan kontrol | 8px | Di antara blok dan panel. Tidak ada elemen berbentuk pil. |
| Blok | Warna solid, bevel atas 1px putih 28%, garis dalam bawah 1px hitam 35% (nilai dari Stitch) | Memberi volume tanpa glow. |
| Panel HUD | `surface-1`, radius 12px, tepi 1px `line-deco`. Isi pratinjau (Simpan, Antrean) di sumur `surface-2` radius 8px. | Memisahkan HUD dari latar tanpa bayangan. |
| Bayangan | Hanya untuk panel overlay (Pause, Game Over): `0 16px 32px` hitam 70% | Penanda elevasi satu tingkat (R-12). |
| Tombol utama | Isi `accent`, teks `on-accent` Sora 600, tinggi minimal 48px. Saat ditekan: skala 0.98, warna tetap. | Warna tekan #4B6DEB dari Stitch gagal kontras (4.19:1). |
| Tombol sekunder | Isi `surface-2`, teks `text` Sora 500, tepi 1px `line-control` | Tepi memberi batas kontrol 3:1. |
| Segmented control | Track `bg` dengan tepi 1px `line-control`. Pilihan aktif: isi `surface-2`, teks `text`, tepi `accent`. Pilihan lain: teks `text-dim`. | Pilihan aktif dibedakan oleh tepi dan warna teks, tidak oleh warna permukaan saja. |
| Grid playfield | Garis 1px, `text` pada opasitas 4%, bisa dimatikan | Membantu membaca kolom saat menaruh piece. Fungsinya posisi, bukan dekorasi (R-07). |
| Bingkai playfield | 1px `line-deco`; berubah menjadi `accent` saat naik level | Bingkai menjadi penanda level up. |

Rumus ukuran sel: `cell = floor(min(tinggiTersedia / 20, lebarTersedia / lebarKolomTotal))` dalam piksel perangkat, lalu dibagi DPR untuk CSS. Ukuran sel selalu bilangan bulat piksel perangkat supaya tepi blok tajam.

---

## 6. Logo

- Wordmark "BlockDown", satu kata, Sora 700, warna `text`.
- Huruf "o" pada "Down" diganti satu blok persegi seukuran tinggi huruf kecil x. Posisinya turun sekitar 8% dari tinggi x di bawah garis dasar, seolah baru jatuh.
- Warna blok pengganti: `accent`, sesuai hasil Stitch. Logo adalah satu-satunya tempat aksen muncul di Menu selain cincin fokus.
- Versi ikon aplikasi Android dan PWA: belum ada arahan. Sampai diputuskan, ikon adalah slot placeholder `[IKON APLIKASI 512x512]` (R-23).
- Di Menu, logo diberi `aria-label="BlockDown"` supaya blok pengganti tidak dibaca sebagai huruf terpisah.

---

## 7. Layar

Aturan umum untuk semua layar:
- Target sentuh minimal 44x44px, dengan jarak antar target minimal 8px.
- Safe-area: `viewport-fit=cover`, padding memakai `env(safe-area-inset-*)` di keempat sisi. Tidak ada kontrol di bawah area gestur sistem.
- Tinggi layar memakai `100dvh`, tidak memakai `100vh`.
- Fokus terlihat: `:focus-visible` dengan cincin 2px `accent` dan offset 2px, supaya cincin tetap terlihat di atas tombol beraksen. `outline: none` tidak dipakai tanpa pengganti.
- Semua teks diambil dari kamus i18n (SPEC.md bagian 9).

Rentang lebar:
| Rentang | Tata letak |
|---|---|
| Ponsel (hanya tegak) | Satu kolom: mode/skor/jeda, statistik satu baris, Simpan dan Antrean mendatar, lalu papan selebar layar. Tanpa tombol sentuh. |
| Ponsel diputar mendatar | Diganti pesan "Putar HP ke posisi tegak"; permainan dijeda. |
| Jendela lebar (lebar 600 px ke atas dan lebih lebar dari 0,9 kali tinggi) | Papan setinggi layar di tengah, Simpan di kiri, Antrean tegak di kanan. Untuk desktop dan tablet dengan mouse. |

### 7.1 Menu

Isi, dari atas ke bawah:
1. Baris atas: switch bahasa `ID | EN` (segmented, 2 tombol) di kanan, lalu tombol "Pengaturan".
2. Logo di sepertiga atas. Logo adalah titik fokus layar ini.
3. Daftar mode, satu baris per mode: nama, deskripsi satu baris (`text-dim`), dan rekor pribadi di kanan (JetBrains Mono).
   - Maraton: baris ini bisa dibuka (`aria-expanded`) dan menampilkan dua tombol, "150 baris" dan "Tanpa batas". Masing-masing punya rekor sendiri.
   - Sprint 40, Ultra, Zen: langsung mulai saat ditekan.

State:
| State | Tampilan |
|---|---|
| Pertama kali, tanpa rekor | Setiap rekor menampilkan "Belum ada" / "No record" dengan `text-dim`. |
| Ada rekor | Maraton dan Ultra menampilkan skor, Sprint menampilkan waktu `m:ss.mmm`, Zen menampilkan baris terbanyak dalam satu sesi. |
| Font belum termuat | Fallback font sistem (`font-display: swap`). Tata letak tidak bergeser karena ukuran baris tetap. |
| Penyimpanan tidak tersedia atau rusak | Satu baris pemberitahuan di bawah daftar mode: "Rekor tidak bisa disimpan di perangkat ini." Permainan tetap bisa dimainkan. |
| Gamepad terhubung | Pemberitahuan singkat lewat `aria-live="polite"`, misalnya "Gamepad terhubung". |

Acuan visual: `design/stitch/01-menu/`. Layar `design/stitch/01-menu-ditolak/` tidak dipakai karena berisi statistik karangan, navigasi bawah ke layar yang tidak ada (Skor, Statistik, Profil), ikon profil, label versi "EDISI PREMIUM v1.0.4", dan tagline (R-17, R-24, R-38). Teks "EDISI MINIMALIS" di bawah logo pada menu 2 juga tidak dipakai. Titik di samping nama mode yang terpilih juga dibuang karena tidak menandai state apa pun selain fokus, yang sudah ditandai cincin.

Fokus keyboard: urutan Tab mengikuti urutan visual: switch ID, switch EN, Pengaturan, Maraton, (150 baris, Tanpa batas jika terbuka), Sprint 40, Ultra, Zen. Panah atas dan bawah memindahkan fokus di daftar mode. Enter atau Space memilih. Saat Menu pertama dibuka, fokus ada di baris Maraton.

### 7.2 Game

Isi:
- Playfield 10x20 di atas `surface-1`, grid samar (bisa dimatikan), bingkai `line-deco`.
- Ghost piece: outline 2px warna bloknya, tanpa isi. Bisa dimatikan.
- Hold: satu kotak berlabel "Simpan" / "Hold". Saat hold sudah dipakai untuk piece ini, isi kotak diredupkan ke opasitas 40% dan diberi label teks "Terkunci" untuk pembaca layar.
- Next: 5 piece berlabel "Antrean" / "Next". Di ponsel berjajar mendatar di atas papan, di jendela lebar tegak di kanan papan. Kelima piece berukuran sama.
- Baris atas: nama mode di kiri, skor `num-lg` di tengah, tombol jeda di kanan.
- Baris statistik di bawah skor: Level, Baris, Waktu (Sprint dan Ultra), dan Combo. Combo hanya muncul saat combo berjalan (1 atau lebih). Semua angka memakai JetBrains Mono tabular. Statistik lain (persentase 4 Baris, piece per detik) tidak ditampilkan agar layar tetap tenang.
- Satu tombol jeda, di kanan atas. Tidak ada panah kembali di layar Game, karena "Ke Menu" ada di Pause.
- Tidak ada tombol sentuh. Kontrol sentuh lewat gestur di seluruh layar Game (SPEC 11.2), jadi jari tidak harus menutupi papan.
- Pita ambient di belakang playfield (lihat Motion).

Tata letak ponsel (hanya tegak):
```
[Maraton]          [ 1.234.567 ]           [Jeda]
        Level 3   Baris 24   Waktu 1:02.40
[Simpan] [ Antrean: 5 piece mendatar          ]
[                                             ]
[            playfield 10x20                  ]
[            (selebar layar)                  ]
```
Ukuran sel pada lebar 390 px: sekitar 32 px, papan sekitar 323x647 px. Pada 320 px: 19 px. Sebelumnya, dengan kolom samping dan tombol sentuh, 22 px dan 15 px.

State:
| State | Tampilan |
|---|---|
| Bermain | Hanya piece, ghost, dan pita ambient yang bergerak. |
| Momen reward | Lihat Motion lapis 3. Input tetap berjalan. |
| Mode Zen, board penuh | Board dikosongkan dengan fade 300ms, callout "Mulai lagi" / "Fresh start". Skor dan baris tetap. |
| Hold tidak tersedia | Redup 40% dan label "Terkunci". |
| Tab browser disembunyikan atau aplikasi ke latar belakang | Otomatis masuk Pause. |
| Audio belum aktif | Tidak ada tampilan khusus. Audio aktif sejak gestur pertama di Menu. |

Fokus keyboard: saat bermain, tombol permainan ditangkap di level dokumen dan `preventDefault` untuk tombol yang dipetakan. Satu-satunya elemen yang bisa difokus dengan Tab adalah tombol jeda. Canvas diberi `role="img"` dengan `aria-label` berisi mode dan level saat ini. Skor tidak diumumkan setiap berubah. Callout reward diumumkan lewat `aria-live="polite"` (misalnya "4 Baris, +1.200"), dan pengumuman dibatasi agar tidak menumpuk.

Batas yang jujur: permainannya sendiri membutuhkan penglihatan. Aksesibilitas di sini mencakup kontras, mode buta warna, kurangi animasi, pemetaan ulang tombol, dan menu yang bisa dipakai penuh dengan keyboard dan pembaca layar.

### 7.3 Pause

- Overlay `bg` dengan opasitas 60% dan blur. Playfield dibekukan saat pause, jadi blur hanya dihitung sekali. Jika `backdrop-filter` tidak didukung atau terlalu berat, overlay gelap 60% tanpa blur. Ini satu-satunya elemen yang memakai blur (R-10).
- Panel `surface-2`, radius 12px, judul "Jeda" / "Paused".
- Tombol bertumpuk: "Lanjutkan" (utama, aksen), "Ulangi", "Pengaturan", "Ke Menu". Setiap tombol diberi ikon kecil di kiri label (main, ulangi, pengaturan, beranda).
- Baris bawah panel: "Waktu sesi" dengan durasi permainan berjalan dalam format `mm:ss.cc`, dihitung dari tick core (berhenti selama Pause).

State: terbuka, kembali dari Pengaturan (fokus kembali ke tombol "Pengaturan"), dan konfirmasi saat memilih "Ulangi" atau "Ke Menu" jika permainan sudah berjalan lebih dari satu piece. Konfirmasi berupa `<dialog>` kecil dengan judul "Tinggalkan permainan ini?" dan dua tombol: "Batal" (fokus pertama) dan aksi yang dipilih. Progres permainan yang ditinggalkan tidak disimpan sebagai rekor.

Fokus keyboard: fokus pertama ke "Lanjutkan". Fokus terkunci di dalam panel. Esc atau P menutup Pause dan melanjutkan permainan. Tombol kembali Android juga membuka atau menutup Pause.

### 7.4 Game Over

- Stack runtuh: blok yang tersisa jatuh keluar playfield dengan stagger per baris (Penuh), atau fade (Minimal).
- Panel berisi judul sesuai penyebab: "Permainan Selesai" (top out), "Selesai" (Maraton 150 baris atau Sprint 40 tercapai), "Waktu habis" (Ultra).
- Hasil utama: skor untuk Maraton dan Ultra, waktu `m:ss.mmm` untuk Sprint, baris untuk Zen.
- Statistik: Level, Baris, Quad (4 Baris), T-Spin, Combo terpanjang.
- Tag "Rekor baru" di samping hasil utama, hanya jika hasil itu memang mengalahkan rekor yang tersimpan. Teks `text` dengan tepi `accent` 1px, radius 8px, tanpa glow.
- Tombol: "Main Lagi" (utama) dan "Ke Menu".

State: rekor baru, bukan rekor, Sprint gagal karena top out (waktu tidak dicatat sebagai rekor), dan rekor tidak tersimpan karena penyimpanan gagal (satu baris pemberitahuan).

Fokus keyboard: fokus pertama ke "Main Lagi". Hasil dan statistik diumumkan sekali lewat `aria-live="polite"`.

### 7.5 Pengaturan

Daftar bergulir dengan empat kelompok berjudul biasa:

| Kelompok | Kontrol |
|---|---|
| Kontrol | Penjelasan gestur (hanya di layar sentuh), DAS (slider, ms), ARR (slider, ms), kecepatan soft drop (slider, kelipatan gravitasi), Atur tombol keyboard, Kembalikan bawaan |
| Tampilan | Ghost piece, Grid, Mode aman buta warna, Intensitas efek (Penuh, Sedang, Minimal), Kurangi animasi |
| Suara | Musik (slider), Efek (slider), Getar |
| Bahasa | Indonesia, English |

Detail:
- Nilai slider ditampilkan di samping label dengan JetBrains Mono dan satuannya, misalnya "167 ms". Nilai bawaan dan rentang mengikuti SPEC.md bagian 7.2 dan 12, bukan angka contoh di Stitch.
- Setiap pengaturan punya satu baris deskripsi `text-dim` di bawah label, misalnya "Jeda sebelum geser berulang" untuk DAS. Teksnya ada di kamus i18n (`settings.*.desc`).
- Elemen dari Stitch yang tidak dipakai: kartu "Konfigurasi Game" dengan label "PRO 60FPS", label "AKTIF" di DAS, subjudul kelompok di kanan, dan footer versi serta "Engine ID". Semuanya klaim atau dekorasi tanpa fungsi.
- Atur tombol: setiap aksi punya tombol "Ubah". Saat ditekan, state mendengarkan "Tekan tombol baru". Jika tombol sudah dipakai: "Tombol ini sudah dipakai untuk {aksi}." Esc membatalkan dan tidak bisa dipetakan ke aksi lain.
- Setiap perubahan langsung disimpan dan langsung berlaku. Tidak ada tombol "Simpan".
- Kontrol yang tidak tersedia di perangkat (misalnya Getar di desktop) ditampilkan nonaktif dengan alasan satu baris, bukan disembunyikan diam-diam.

State: bawaan, nilai diubah, mendengarkan tombol, konflik tombol, penyimpanan gagal (pemberitahuan satu baris), suara tidak tersedia ("Suara tidak tersedia di perangkat ini").

Fokus keyboard: Tab berurutan dari atas ke bawah. Slider mengikuti pola ARIA slider (panah mengubah nilai). Esc kembali ke layar sebelumnya. Setiap kontrol minimal 44px tingginya, dan baris kontrol minimal 48px.

---

## 8. Motion

Tiga lapis. Semua durasi dalam milidetik. Semua animasi berjalan di renderer dan membaca event dari core. Tidak ada yang menunda logika atau input.

### 8.1 Lapis 1: Ambient

- Pita cahaya horizontal di belakang playfield, opasitas 5%, bergerak vertikal sangat pelan.
- Fungsi: membawa informasi keadaan, bukan hiasan. Warnanya berganti setiap naik level (memakai urutan warna blok I, T, S, L, Z, O, J lalu berulang), menjadi lebih terang saat Quad, dan bergeser ke warna hangat saat combo makin panjang.
- Saat Kurangi animasi aktif: pita diam. Perubahan warna tetap ada lewat fade 300ms.

### 8.2 Lapis 2: Feedback (di bawah 100 ms)

| Kejadian | Efek | Durasi |
|---|---|---|
| Hard drop | Squash piece: skala vertikal 0.9 lalu kembali, ditambah garis jejak tipis setinggi jarak jatuh | sekitar 80 |
| Lock | Kilat terang di sel piece (putih 30% lalu hilang) | 60 sampai 90 |
| Putar dengan kick | Kemiringan kecil sekitar 1.5 derajat ke arah kick, lalu kembali | 90 |
| Putar tanpa kick | Tidak ada efek visual tambahan | |
| Hold | Isi kotak Hold berganti dengan fade cepat | 80 |

### 8.3 Lapis 3: Reward (200 sampai 600 ms)

Callout selalu di sepertiga atas playfield, sehingga area spawn dan stack tetap terlihat.

Storyboard Quad:
| Waktu | Kejadian |
|---|---|
| 0 | Tepi baris yang dihapus menyala putih. |
| 80 | Blok pecah menjadi partikel persegi berwarna sesuai bloknya. Garis shockwave horizontal melintasi playfield. Playfield terdorong 4px lalu kembali. |
| 200 | Callout "4 BARIS" / "QUAD" disapu cahaya aksen. Skor bergulir ke nilai baru. Angka skor yang didapat melayang naik. Pita ambient lebih terang. |
| 450 | Stack di atasnya turun ke posisi akhir dengan pantulan elastis kecil. |
| 600 | Semua efek selesai. |

Dari Stitch (`design/stitch/03-quad/`), yang dipakai: posisi callout di sepertiga atas, angka skor di atas callout, partikel persegi, dan garis shockwave. Yang tidak dipakai: ikon petir di kiri dan kanan callout (R-04), sapuan cahaya yang berdenyut tanpa henti (`animate-pulse`, R-19; sapuannya cukup sekali), dan akhiran "PTS" pada angka (angka cukup diawali "+").

Angka yang melayang selalu hasil hitungan nyata dari core. Contoh "+1.200" di brief adalah nilai Quad B2B di level 1 (800 x 1.5).

Catatan penting: stack sudah turun di logika sejak frame lock. Penurunan di 450 ms hanya offset visual yang meluruh, jadi piece berikutnya sudah bisa dimainkan sejak awal storyboard.

Momen signature lain:
| Momen | Efek | Callout ID / EN |
|---|---|---|
| Double, Triple | Tepi baris menyala, partikel lebih sedikit, tanpa shake | "2 BARIS" / "DOUBLE", "3 BARIS" / "TRIPLE" |
| Single | Kilat baris, partikel, callout kecil dan singkat, getar ringan (revisi Fase 4) | "1 BARIS" / "SINGLE" |
| T-Spin | Riak cincin ungu (warna T) dari pusat piece | "T-SPIN", "T-SPIN MINI", "T-SPIN 1 BARIS" / "T-SPIN SINGLE", dan seterusnya |
| B2B | Label kecil di bawah callout | "BERUNTUN" / "BACK-TO-BACK" |
| Combo | Penghitung bertanda centang di bawah callout. Makin panjang combo, pita latar makin hangat. | "COMBO {n}" |
| Bersih Total | Gelombang cahaya dari bawah ke atas, callout warna emas (warna O) | "BERSIH TOTAL" / "ALL CLEAR" |
| Naik level | Bingkai playfield tergambar ulang dengan aksen mengelilingi playfield, lalu kembali ke `line-deco`. Warna ambient berganti. | "NAIK LEVEL" / "LEVEL UP" |

Revisi setelah uji Fase 4 tahap 1 (keputusan pemilik): efek terasa kurang, jadi setiap clear diberi efek yang jelas dan bertingkat. Ini mengubah arah awal "tenang saat bermain biasa": permainan kini lebih hidup di setiap clear, sementara jeda antar clear tetap tenang.

| Kekuatan | Momen | Efek |
|---|---|---|
| 1 | Single, Mini Single | Kilat baris, partikel sedikit, callout kecil 450 ms, getar 45 ms |
| 2 | Double, T-Spin tanpa baris, Single dengan combo 3+ | Ditambah shockwave, callout sedang, getar 60 ms |
| 3 | Triple, Double dengan combo 3+ | Ditambah pilar cahaya putih, kilat papan, guncangan 4 px, callout besar dengan cahaya di belakang, getar bertingkat |
| 4 | 4 Baris, T-Spin dengan baris | Pilar cahaya aksen, tiga cincin melebar, papan menghentak (skala 1,035), guncangan 10 px, partikel paling banyak, callout terbesar, getar panjang |
| 5 | Bersih Total | Seperti 4, ditambah gelombang dan hujan partikel emas |

Fungsi tingkat ada di `src/render/fx.ts` (`clearPower`), dan dites.

### 8.4 Aturan wajib

1. Animasi tidak pernah memblokir input atau logika.
2. Partikel memakai pool tetap berisi 300. Tidak ada alokasi per frame. Jika pool penuh, partikel tertua dipakai ulang.
3. Shake maksimal 10 px (revisi Fase 4, keputusan pemilik; sebelumnya 4 px), penuh hanya untuk 4 Baris, T-Spin dengan baris, dan Bersih Total. Triple 4 px, Double 2 px, Single tanpa shake.
4. Callout baru menggantikan callout lama. Tidak ada tumpukan callout.
5. Easing: `ease-out` untuk masuk, `ease-in` untuk keluar, dan pegas dengan overshoot kecil hanya untuk penurunan stack.

### 8.5 Intensitas efek

| | Penuh | Sedang | Minimal |
|---|---|---|---|
| Partikel | Hingga 300 | Hingga 150 | Tidak ada |
| Shake | Hingga 10 px | Hingga 3 px | Tidak ada |
| Shockwave, riak, gelombang | Ya | Ya, opasitas setengah | Tidak ada |
| Callout | Sapuan cahaya | Sapuan cahaya | Fade saja |
| Penurunan stack | Pantulan elastis | Tanpa pantulan | Langsung |
| Feedback lapis 2 | Ya | Ya | Hanya kilat lock berupa fade |
| Pita ambient | Bergerak | Bergerak | Diam, warna tetap berganti |

`prefers-reduced-motion: reduce` membuat Kurangi animasi aktif sejak awal dan mengunci Intensitas efek di Minimal. Pemain tetap bisa mematikan Kurangi animasi secara manual.

---

## 9. Catatan perubahan dari brief

| Elemen | Nilai brief | Nilai di dokumen | Alasan dan sumber keputusan |
|---|---|---|---|
| Warna blok J | #4F6FD9 | #3F63C9 | Kontras J terhadap aksen hanya 1.24:1, sehingga aksen tidak lagi terasa istimewa dan efek naik level bisa terbaca sebagai blok J (antislop Part 3, R-29). Pemilik memilih menggeser J. |
| Referensi motion | Nama game referensi | "Tenang saat bermain, spektakuler di momen reward" | Larangan memakai merek dagang. Pemilik memilih menulis tanpa nama. |
| Blur Pause | Blur | Blur statis, dengan fallback tanpa blur | Performa di HP kelas menengah. Pemilik menyetujui. |
| Teks beraksen di `surface-2` | Tidak diatur | Hanya teks besar | `accent` di atas `surface-2` 4.19:1, gagal untuk teks normal. |

### 9.1 Dari ekspor Google Stitch

Font Stitch sama dengan brief (Sora dan JetBrains Mono), jadi tidak ada perubahan font. Stitch memuat font dan ikon dari Google Fonts. Di BlockDown, keduanya di-self-host.

| Elemen | Nilai sebelumnya | Hasil Stitch | Keputusan |
|---|---|---|---|
| Palet | Token brief | Menu 2 memakai token brief. Lima layar lain memakai palet Material buatan Stitch: aksen #B7C4FF, latar #111319, teks #E1E2E9. | Tetap token brief dan aksen #5B7CFA (pemilik). |
| Tepi panel | #2A3340 | #262F3D | Pakai #262F3D sebagai `line-deco`. Keduanya dekoratif dan di bawah 3:1. |
| Bevel blok | Putih 25%, bayangan dalam 2px | Inset atas putih 28%, inset bawah hitam 35%, masing-masing 1px | Pakai nilai Stitch. |
| Warna tombol utama saat ditekan | Tidak diatur | #4B6DEB | Tidak dipakai, kontrasnya 4.19:1. Diganti skala 0.98. |
| Bayangan overlay | Senada `bg` | `0 16px 32px` hitam 70% | Pakai nilai Stitch. |
| Label HUD | Huruf biasa | Kapital 8 sampai 10px dengan tracking lebar | Huruf biasa 14px (pemilik, R-06). |
| Tata letak Game portrait | HUD di atas, Next di kanan | Kolom kiri dan kanan mengapit playfield | Ikut Stitch (pemilik). Skor dipindah ke baris atas karena tidak muat di kolom kiri (pemilik). Label kanan "Antrean". |
| Statistik saat bermain | Skor, Level, Baris | Ditambah persentase 4 Baris, piece per detik, dan combo | Skor, Level, Baris, ditambah Combo saat aktif (pemilik). |
| Tombol sentuh | Satu set berbobot sama | Dua baris, hard drop lebar beraksen, jeda ganda, panah kembali | Ikut Stitch, dengan satu jeda dan tanpa panah kembali. "Tukar" diganti "Simpan" (pemilik). |
| Ikon | Digambar sendiri | Material Symbols dari Google Fonts | Material Symbols, subset yang dipakai di-self-host sebagai SVG (pemilik). |
| DAS dan ARR di Pengaturan | 167 ms dan 33 ms | 133 ms dan 16 ms, dengan rentang lain | Tetap SPEC.md (pemilik). |
| Waktu sesi di Pause | Tidak ada | Ada | Dipakai (pemilik). |
| Deskripsi per pengaturan | Tidak ada | Ada | Dipakai, teks ditulis ulang (pemilik). |
| Mode dan level di Pause | Tidak ada | Ada | Tidak dipakai (pemilik). |
| Blur Pause | Blur statis | Dokumen Stitch menyebut "tanpa blur berat" | Tetap blur statis dengan fallback. |
| Radius panel modal | 12px | 16px di dokumen Stitch, 12px di layar | Tetap 12px, sesuai layar Stitch. |
| Menu 1 | | Statistik karangan, navigasi bawah, profil, label versi | Tidak dipakai (R-17, R-24, R-38). |
| Header Game | | "GAME ARENA", ikon profil, label "STANDAR 150" | Tidak dipakai. Baris atas berisi nama mode, level, dan jeda. |
| Pengaturan | | Kartu "PRO 60FPS", label "AKTIF", footer versi dan "Engine ID" | Tidak dipakai (R-36, dekorasi tanpa fungsi). |
| Momen Quad | | Ikon petir, denyut tanpa henti, "PTS" | Tidak dipakai (R-04, R-19). |

### 9.2 Dari uji di Galaxy A13 (Fase 3)

| Elemen | Sebelumnya | Sekarang | Alasan |
|---|---|---|---|
| Tombol sentuh | Dua baris tombol, jatuh cepat beraksen | Dihapus | Pemilik: game sejenis di HP memakai gestur. |
| Pilihan mode sentuh di Pengaturan | Tombol atau Gestur | Dihapus; diganti penjelasan gestur (hanya di layar sentuh) | Hanya satu cara kontrol sentuh. |
| Gestur seret ke bawah | Pelan: jatuh pelan, sapu cepat: jatuh cepat | Seret 1,5 sel ke bawah: jatuh cepat, langsung | Pemilik. |
| Orientasi HP | Landscape dengan tombol di samping | Hanya tegak; landscape menampilkan pesan dan menjeda | Pemilik. |
| Tata letak HP | Kolom Simpan/statistik di kiri, Antrean di kanan | Statistik satu baris, Simpan + Antrean mendatar di atas papan | Ruang bekas tombol dipakai papan: sel 22 px jadi 32 px di lebar 390 (pemilik). Menyimpang dari tata letak Stitch. |
| Aksen saat bermain | Tombol jatuh cepat | Tidak ada | Aksen hanya di tombol utama dialog, fokus, logo, dan (Fase 4) momen reward. |

### 9.3 Dari uji di Galaxy A13 (Fase 4 tahap 1)

| Elemen | Sebelumnya | Sekarang | Alasan |
|---|---|---|---|
| Efek per clear | Single tanpa callout; efek besar hanya 4 Baris, T-Spin, Bersih Total | Bertingkat untuk setiap clear (bagian 8.3) | Pemilik: efek kurang terasa, "tidak ada yang wah". |
| Guncangan | Maksimal 4 px | Maksimal 10 px, bertingkat | Keputusan pemilik. |
| Efek baru | | Pilar cahaya, kilat papan, cincin melebar, papan menghentak, debu jatuh cepat, cahaya di belakang callout | Kesan wah dari cahaya dan gerak, tanpa glow permanen. Cahaya hanya muncul sesaat di momen clear (R-13: glow sebagai aksen fokus). |
| Getar | 12 ms jatuh cepat, satu pola untuk momen besar | 35 ms jatuh cepat, pola bertingkat 45 ms sampai pola panjang untuk Bersih Total | Pemilik: getar kurang terasa. Motor getar HP kelas bawah butuh sekitar 30 ms. |

---

## 10. Keputusan (desain)

Semua sudah diputuskan pemilik ("pakai usulan"):

1. Warna blok di logo: aksen (dari Stitch).
2. Konsep ikon aplikasi: tetap placeholder `[IKON APLIKASI 512x512]` sampai pemilik memberi arahan. Wajib selesai sebelum Fase 5 (ROADMAP.md).
3. Rekor Zen: baris terbanyak dalam satu sesi.
4. Konfirmasi Ulangi dan Ke Menu: hanya jika permainan sudah berjalan lebih dari satu piece (bagian 7.3).
5. Kurangi animasi dan Intensitas efek tetap dua kontrol terpisah. Kurangi animasi aktif berarti Intensitas efek dikunci ke Minimal dan kontrol Intensitas dinonaktifkan dengan alasan "Dikunci oleh Kurangi animasi". Saat Kurangi animasi dimatikan, Intensitas kembali ke nilai terakhir yang dipilih.

---

## 11. Delivery Gate antislop (checklist)

Dokumen ini belum berupa UI yang berjalan, jadi kolom "Cara memenuhi" menjelaskan cara memenuhinya. Checklist ini dijalankan ulang dengan bukti nyata di Fase 4 dan Fase 5 (ROADMAP.md).

### Blok 1: Hard Gate (semua jawaban harus "tidak")

- [ ] Ada em dash di teks? (R-02). Cara memenuhi: grep karakter U+2014 (em dash) dan U+2013 (en dash) di repo dan kamus i18n sebelum rilis.
- [ ] Ada overflow horizontal atau layout rusak di mobile? (R-03). Cara memenuhi: diuji di lebar 320, 390, 600, 1024 px, portrait dan landscape.
- [ ] Ada statistik tanpa sumber? (R-17). Cara memenuhi: semua angka di layar berasal dari state permainan atau penyimpanan lokal.
- [ ] Ada testimoni fiktif? (R-18). Cara memenuhi: tidak ada bagian testimoni.
- [ ] Ada aset dibuat tanpa instruksi? (R-23). Cara memenuhi: logo mengikuti instruksi pemilik, ikon aplikasi masih placeholder.
- [ ] Ada navigasi ke layar yang tidak ada? (R-24). Cara memenuhi: Menu hanya berisi mode yang bisa dimainkan dan Pengaturan. Fitur fase 2 tidak tampil.
- [ ] Ada teks di bawah AA? (R-25). Cara memenuhi: tabel kontras bagian 4.3.
- [ ] Ada kontrol yang tidak berbuat apa-apa? (R-26). Cara memenuhi: setiap tombol di bagian 7 punya aksi tertulis.
- [ ] Ada layar tanpa state kosong, memuat, atau gagal? (R-27). Cara memenuhi: tabel state per layar di bagian 7.
- [ ] Ada FAQ generik? (R-28). Cara memenuhi: tidak ada FAQ.
- [ ] UI tidak bisa dipakai dengan keyboard atau fokus tidak terlihat? (R-32). Cara memenuhi: urutan fokus per layar dan cincin fokus aksen.
- [ ] Ada fitur yang ditambal dengan skrip? (R-33). Cara memenuhi: tidak ada skrip patch. Semua ditulis di source.
- [ ] Ada tema yang rusak? (R-34). Cara memenuhi: hanya satu tema.
- [ ] Dikirim tanpa dijalankan dan tanpa click-through? (R-35). Status: belum bisa dijalankan karena ini dokumen. Click-through dicatat di Fase 4 dan 5.
- [ ] Ada klaim keamanan, performa, atau pelanggan yang dikarang? (R-36). Cara memenuhi: listing toko hanya menyebut fitur yang ada (ROADMAP Fase 5).
- [ ] Didesain tanpa arah? (R-37). Cara memenuhi: arah ditulis pemilik di brief dan dicatat di dokumen ini.
- [ ] Ada konten realistis yang dikarang? (R-38). Cara memenuhi: angka di storyboard berasal dari tabel skor SPEC.md.

### Blok 2: Purpose-Gate (gagal jika teknik tidak punya alasan tertulis)

- [ ] Gradien atau glow tanpa tujuan? (R-01, R-13). Cara memenuhi: tidak ada gradien dekoratif. Cahaya hanya muncul di momen reward dan alasannya tertulis di bagian 8.
- [ ] Ikon generik? (R-04). Cara memenuhi: ikon Material Symbols hanya untuk aksi (panah, putar, jatuh, simpan, jeda, pengaturan, ulangi, beranda). Ikon petir dari Stitch dibuang. Setiap tombol ikon punya label teks untuk pembaca layar.
- [ ] Font tanpa alasan? (R-06). Cara memenuhi: bagian 3.
- [ ] Grid latar tanpa tujuan? (R-07). Cara memenuhi: grid hanya di playfield untuk membaca kolom, dan bisa dimatikan.
- [ ] Panah dekoratif di tombol? (R-08). Cara memenuhi: tidak ada.
- [ ] Badge tanpa fungsi? (R-09). Cara memenuhi: hanya tag "Rekor baru" yang menandai kondisi nyata.
- [ ] Glassmorphism di lebih dari 1 sampai 2 elemen? (R-10). Cara memenuhi: blur hanya di overlay Pause.
- [ ] Bayangan di semua komponen? (R-12). Cara memenuhi: bayangan hanya di panel overlay.
- [ ] Kartu identik tanpa alasan? (R-14). Cara memenuhi: baris mode berupa daftar, bukan kartu fitur.
- [ ] Animasi template atau tidak sesuai dial MOTION? (R-19). Cara memenuhi: bagian 8. Setiap efek punya kejadian pemicu.
- [ ] Ilustrasi generik? (R-22). Cara memenuhi: tidak ada ilustrasi.

### Blok 3: Liveliness (semua jawaban harus "ya")

- [ ] Dial dinyatakan? Ya, bagian 1.
- [ ] Hasil konsisten dengan dial? Dicek di Fase 4: saat bermain tenang, momen reward ramai.
- [ ] Satu titik fokus per layar? Menu: logo. Game: playfield. Pause: Lanjutkan. Game Over: hasil utama. Pengaturan: kelompok yang sedang dibuka.
- [ ] Ruang kosong sebagai struktur? Grid 8px dan ruang di sekitar playfield.
- [ ] Satu aksen yang disengaja? `accent` hanya untuk tombol utama, fokus, level up, dan sapuan callout.
- [ ] Motif identitas? Blok yang "baru jatuh" di logo, diulang di gerak squash hard drop dan penurunan stack.
- [ ] Design Read dinyatakan sebelum desain? Ya, bagian 1.

### Blok 4: Craftsmanship dan Quality Locks (semua jawaban harus "tidak")

- [ ] C-1: ada keputusan yang alasannya hanya "default AI"?
- [ ] C-2: ada kontrol tanpa fungsi?
- [ ] C-3: ada layar yang hanya mengisi template? (Fitur fase 2 sengaja tidak tampil.)
- [ ] C-4: UI rusak di salah satu state, ukuran layar, atau tanpa mouse?
- [ ] C-5: ada klaim yang dikarang?
- [ ] R-05: tata letak mengikuti template AI?
- [ ] R-11: semua elemen berbentuk pil?
- [ ] R-15: CTA generik? Label tombol berupa aksi spesifik: "Main Lagi", "Lanjutkan", "Ke Menu".
- [ ] R-16: ada buzzword?
- [ ] R-20: desain terasa generik jika logo ditukar?
- [ ] R-21: tema gelap tanpa alasan? Alasan di bagian 4.
- [ ] R-29: palet melebihi batas? Netral, satu aksen, dan tujuh warna blok sebagai konten permainan.
- [ ] R-30: meniru produk populer?
- [ ] R-31: ada keputusan visual tanpa alasan satu baris?

---

## 12. Pre-Flight Check taste-skill (checklist)

Taste-skill ditujukan untuk halaman marketing. BlockDown adalah UI game, jadi item khusus landing page ditandai N/A beserta alasannya.

- [ ] Brief inference dinyatakan: bagian 1.
- [ ] Dial eksplisit dan beralasan: bagian 1.
- [ ] Design system dari bagian 2 taste-skill: N/A. Estetika ditulis sendiri sebagai minimal premium.
- [ ] Mode redesign dan audit: N/A, proyek baru.
- [ ] Nol em dash di seluruh teks.
- [ ] Page Theme Lock: satu tema gelap.
- [ ] Color Consistency Lock: satu aksen di semua layar.
- [ ] Shape Consistency Lock: blok 4px, kontrol 8px, panel 12px, berlaku di semua layar.
- [ ] Kontras tombol: `on-accent` di atas `accent` 5.10:1.
- [ ] CTA tidak terbungkus dua baris di desktop.
- [ ] Kontras form: kontrol Pengaturan memakai tepi `line-control` 4.98:1.
- [ ] Disiplin serif: N/A, tidak memakai serif.
- [ ] Palet premium-consumer: N/A untuk jenis produk. Palet tidak memakai keluarga krem dan kuningan.
- [ ] Ruang descender italic: N/A, tidak memakai italic display.
- [ ] Hero muat di viewport: N/A, tidak ada hero. Padanannya: logo dan daftar mode muat tanpa gulir di 390x844.
- [ ] Padding atas hero: N/A.
- [ ] Disiplin isi hero: N/A.
- [ ] Hitungan eyebrow: nol eyebrow.
- [ ] Split-header: N/A, tidak ada section marketing.
- [ ] Zigzag: N/A.
- [ ] CTA dengan maksud sama: tidak ada dua tombol dengan maksud sama di satu layar.
- [ ] Logo wall: N/A, tidak ada.
- [ ] Variasi latar bento: N/A, tidak ada bento.
- [ ] Logo "Used by": N/A, dihilangkan sesuai aturan.
- [ ] Copy self-audit: semua teks di kamus i18n dibaca ulang dalam ID dan EN.
- [ ] Motion beralasan: bagian 8.
- [ ] Maksimal satu marquee: N/A, tidak ada.
- [ ] Navigasi satu baris: baris atas Menu satu baris.
- [ ] Pengulangan layout section: N/A.
- [ ] Jumlah sel bento: N/A.
- [ ] Komponen daftar panjang: daftar mode hanya 4 baris.
- [ ] Gambar asli: N/A, tidak ada foto. Ikon aplikasi berupa placeholder berlabel.
- [ ] Tidak ada pil di atas gambar: N/A.
- [ ] Tidak ada caption foto dekoratif: N/A.
- [ ] Tidak ada footer versi: versi aplikasi hanya di Pengaturan jika diperlukan, bukan dekorasi.
- [ ] Tidak ada kalimat meta di bawah eyebrow: tidak ada eyebrow.
- [ ] Tidak ada strip teks dekoratif: tidak ada.
- [ ] Tidak ada sub-teks melayang di kanan atas heading: tidak ada.
- [ ] Tidak ada bar skor dengan track terisi: tidak ada.
- [ ] Tidak ada strip kota, waktu, atau cuaca: tidak ada.
- [ ] Tidak ada petunjuk gulir: tidak ada.
- [ ] Tidak ada label versi di hero: tidak ada.
- [ ] Tidak ada eyebrow bernomor: tidak ada.
- [ ] Titik dekoratif: nol.
- [ ] Garis atas dan bawah di setiap baris daftar: tidak. Baris mode dipisah dengan jarak.
- [ ] Kepadatan isi: deskripsi mode satu baris.
- [ ] Kutipan: N/A.
- [ ] Motion yang diklaim benar-benar ada: dicek di Fase 4.
- [ ] GSAP sticky-stack atau horizontal-pan: N/A, tidak memakai GSAP.
- [ ] Tanpa listener scroll: permainan tidak memakai scroll. Pengaturan memakai scroll bawaan.
- [ ] Reduced motion untuk MOTION_INTENSITY di atas 3: bagian 8.5.
- [ ] Token dark mode diuji di kedua mode: N/A, satu tema sesuai AGENTS.md.
- [ ] Mobile collapse eksplisit: bagian 7, tabel rentang lebar.
- [ ] Stabilitas viewport: `100dvh`.
- [ ] Cleanup `useEffect`: N/A, tanpa React. Padanannya: listener dilepas saat layar ditutup (ARCHITECTURE.md).
- [ ] State kosong, memuat, dan gagal: bagian 7.
- [ ] Kartu dihindari jika cukup dengan jarak: ya.
- [ ] Ikon dari library yang diizinkan: menyimpang, dan disetujui pemilik. Ikon memakai Material Symbols (bukan daftar taste-skill) agar sesuai hasil Stitch. Hanya ikon yang dipakai yang disimpan sebagai file SVG self-host, tanpa memuat font ikon.
- [ ] Motion di komponen klien: N/A, tanpa framework.
- [ ] Tidak ada AI tells bagian 9 taste-skill.
- [ ] Core Web Vitals: target di ARCHITECTURE.md.
- [ ] Satu design system: ya, token di dokumen ini.
