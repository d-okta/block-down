# BlockDown: Arsitektur Teknis

Dokumen ini bagian dari PRD BlockDown, bersama DESIGN.md, SPEC.md, dan ROADMAP.md. Isinya cara aplikasi disusun. Aturan permainan ada di SPEC.md.

---

## 1. Identitas

| Hal | Nilai |
|---|---|
| Nama | BlockDown |
| Folder | `block-down` |
| appId Android | `com.nusavisionmedia.blockdown` |
| Web | PWA, deploy ke Vercel |

## 2. Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Build | Vite | Dev server cepat, build statis, dan aset font bisa di-self-host. |
| Bahasa | TypeScript `strict: true`, ditambah `noUncheckedIndexedAccess` | Akses ke array board dan tabel kick harus selalu diperiksa. |
| Gambar playfield | HTML5 Canvas 2D | Cukup untuk 220 sel dan 300 partikel. Game engine tidak dibutuhkan. |
| HUD, menu, overlay | DOM dan CSS | Fokus, `aria-live`, zoom teks, dan pembaca layar bekerja tanpa usaha tambahan. |
| Android | Capacitor | Satu basis kode web dipaketkan sebagai APK atau AAB. |
| Web | PWA (manifest dan service worker) | Bisa dipasang dan dimainkan offline. |
| Tes | `node:test` bawaan Node | Tanpa framework tes. |

Dependensi runtime, dan hanya ini:
- `@capacitor/core`
- `@capacitor/android`
- `@capacitor/haptics`
- `@capacitor-community/keep-awake`, hanya jika uji di perangkat menunjukkan layar mati saat bermain dengan kontrol gamepad (bagian 14)

Dependensi dev: `vite`, `typescript`, `@capacitor/cli`. Tes `.ts` dijalankan dengan `node --test --experimental-strip-types` (Node 22.6 atau lebih baru), jadi tidak butuh `tsx`.

Service worker ditulis tangan, sekitar satu file kecil yang melakukan cache-first untuk aset hasil build. Tidak memakai plugin PWA. Alasannya: aset yang perlu di-cache hanya sedikit dan berupa file statis.

## 3. Struktur folder

Dokumen dan aset desain sudah ada di repo. Kode ditambahkan di sampingnya mulai Fase 1, tanpa memindahkan `docs/` dan `design/`.

```
block-down/
  README.md           peta folder dan urutan baca
  docs/
    prd/              DESIGN, SPEC, ARCHITECTURE, ROADMAP (dokumen ini)
    edd/              rancangan teknis rinci, ditulis setelah PRD
  design/
    stitch/           ekspor Google Stitch: zip asli dan ekstrak per layar
  index.html
  vite.config.ts
  tsconfig.json
  capacitor.config.ts
  public/
    manifest.webmanifest
    sw.js
    icons/            placeholder sampai ikon diputuskan
  src/
    main.ts           menyambungkan modul, memulai loop
    loop.ts           requestAnimationFrame dan akumulator fixed timestep
    core/             logika murni, tanpa DOM
      board.ts
      piece.ts        bentuk dan orientasi
      srs.ts          tabel kick JLSTZ dan I sebagai data
      bag.ts          7-bag dengan PRNG ber-seed
      rng.ts
      lock.ts         lock delay dan batas reset
      tspin.ts        aturan 3 sudut
      score.ts        tabel skor, B2B, combo, Bersih Total
      modes.ts        Maraton, Sprint, Ultra, Zen
      game.ts         state permainan dan step(tick, aksi)
      events.ts       tipe event dan antrean
    render/
      canvas.ts       ukuran, DPR, resize
      sprites.ts      sprite blok dan pola di-cache ke offscreen canvas
      board.ts        menggambar board, piece, ghost
      particles.ts    pool partikel
      effects.ts      callout, shockwave, riak, shake, pita ambient
    input/
      actions.ts      tipe aksi abstrak
      keyboard.ts
      touch.ts        mode Tombol dan Gestur
      gamepad.ts
      repeat.ts       DAS dan ARR, dipakai semua sumber input
    audio/
      synth.ts        resep suara, dirender ke AudioBuffer saat load
      mixer.ts        gain efek, gain musik, master, low-pass
      music.ts
    i18n/
      id.ts
      en.ts
      index.ts        t(key, vars), pilih locale, set <html lang>
    ui/
      menu.ts
      hud.ts
      pause.ts
      gameover.ts
      settings.ts
      focus.ts        jebakan fokus dialog, kembalikan fokus
    store/
      storage.ts      baca, validasi, migrasi, tulis
    platform/
      haptics.ts      Capacitor Haptics atau navigator.vibrate
  tests/
    core.test.ts
  fonts/              woff2 Sora dan JetBrains Mono (OFL), diimpor dari CSS
  icons/              SVG Material Symbols (Apache 2.0), hanya ikon yang dipakai
```

Aturan import:
- `core/` tidak boleh mengimpor apa pun di luar `core/`, dan tidak boleh memakai `window`, `document`, `performance`, atau `Math.random`.
- `render/`, `audio/`, dan `ui/` boleh membaca state core, tetapi tidak boleh mengubahnya.
- `input/` menghasilkan aksi abstrak dan tidak tahu apa pun tentang board.
- Tidak ada modul yang menyimpan teks untuk pemain selain `i18n/`.

Jumlah file di atas adalah batas atas. File digabung jika isinya terlalu kecil untuk berdiri sendiri.

## 4. Loop dan aliran data

```
input (keyboard / touch / gamepad)
   |  aksi abstrak + timestamp
   v
antrean aksi ----> core.step() x N tick (60 Hz, akumulator)
                      |
                      +--> state (dibaca saja oleh yang lain)
                      +--> antrean event (lock, clear, rotate, levelUp, ...)
                               |
             +-----------------+-----------------+
             v                 v                 v
          render            audio            ui / haptics
   (interpolasi alpha)
```

Loop:
1. `requestAnimationFrame` memanggil `frame(now)`.
2. `acc += min(now - last, 250)`. Batas 250 ms mencegah spiral setelah tab kembali aktif.
3. Selama `acc >= 16.667`: ambil aksi yang timestamp-nya sudah lewat, jalankan `core.step()`, lalu `acc -= 16.667`.
4. `alpha = acc / 16.667`. Renderer menginterpolasi posisi visual piece antara tick sebelumnya dan sekarang.
5. Kuras antrean event ke render, audio, ui, dan haptics.
6. Gambar.

Satu thread. Semua perubahan state terjadi di dalam `core.step()`, yang berjalan sinkron di thread utama. Masalah dua thread pada proyek referensi tidak mungkin terjadi di sini.

Saat Pause atau tab tersembunyi: loop berhenti memanggil `step()`. Renderer menggambar sekali, lalu berhenti sampai permainan dilanjutkan.

Input lag di bawah satu frame: aksi masuk ke antrean sejak event DOM, lalu diproses di tick pertama yang berjalan pada frame berikutnya. Hasilnya digambar di frame yang sama.

## 5. Core

### 5.1 State

```ts
interface GameState {
  board: Uint8Array;          // 10 x 22
  active: ActivePiece;        // jenis, orientasi, x, y
  ghostY: number;
  hold: PieceType | 0;
  holdUsed: boolean;
  queue: Uint8Array;          // ring buffer piece berikutnya
  lock: { msLeft: number; resets: number; lowestY: number; grounded: boolean };
  lastAction: "move" | "rotate" | "none";
  kickIndex: number;
  score: number; lines: number; level: number;
  combo: number; b2b: boolean;
  stats: { quads: number; tspins: number; maxCombo: number };
  tick: number;
  over: boolean;
}
```

Semua angka adalah `number` bilangan bulat. Timer dihitung dalam tick atau milidetik integer.

### 5.2 API

```ts
createGame(mode: Mode, seed: number, config: CoreConfig): Game
game.step(actions: readonly Action[]): void
game.state: Readonly<GameState>
game.events: EventQueue
```

`step()` tidak menerima waktu dari luar. Setiap panggilan bernilai satu tick. Dengan begitu tes bisa memutar ulang permainan secara deterministik dari seed dan daftar aksi.

### 5.3 Event

Antrean event berupa array dengan kapasitas tetap yang diisi ulang tiap tick. Objek event diambil dari pool, bukan dibuat baru.

| Event | Isi |
|---|---|
| `move` | arah |
| `rotate` | arah, `kicked`, `kickIndex` |
| `softDrop` | jumlah sel |
| `hardDrop` | jarak, sel piece |
| `lock` | sel piece |
| `clear` | baris yang dihapus, jenis (single sampai quad, tspin, mini), b2b, combo, bersihTotal, rincian skor |
| `hold` | |
| `levelUp` | level baru |
| `spawn` | jenis |
| `zenReset` | |
| `gameOver` | penyebab |
| `finish` | mode selesai dengan target tercapai |

Konsumen hanya membaca. Antrean dikosongkan setelah semua konsumen membacanya di frame itu.

### 5.4 Mode

```ts
interface Mode {
  id: "marathon150" | "marathonEndless" | "sprint40" | "ultra" | "zen";
  gravityLevel(state): number;
  checkEnd(state): "none" | "finish" | "timeUp";
  onTopOut(state): "gameOver" | "reset";
}
```

Satu objek per mode di `modes.ts`. Tidak ada kelas turunan.

## 6. Render

- Ukuran canvas: `canvas.width = cssWidth * devicePixelRatio`, dan ukuran sel dibulatkan ke piksel perangkat (DESIGN.md bagian 5). Dihitung ulang hanya saat `resize` atau DPR berubah (`matchMedia` resolusi).
- Sprite blok: untuk setiap jenis blok dan setiap varian (normal, pola buta warna, kilat lock), satu `OffscreenCanvas` dibuat sekali saat ukuran sel ditentukan. Jika `OffscreenCanvas` tidak tersedia, pakai canvas biasa yang tidak dipasang ke DOM. Saat bermain, renderer hanya memanggil `drawImage`.
- Gradien dan pola: dibuat sekali bersama sprite, bukan setiap frame. Tidak ada `createLinearGradient`, `createPattern`, `new Path2D`, atau perubahan `font` di dalam loop gambar.
- Grid dan bingkai playfield digambar sekali ke canvas latar terpisah, lalu digambar ulang hanya saat ukuran berubah atau grid dimatikan.
- Pool partikel: `Float32Array` dengan kapasitas 300 untuk x, y, vx, vy, umur, ukuran, dan indeks warna. Partikel mati ditandai lewat umur. Tidak ada array yang tumbuh dan tidak ada objek per partikel.
- Efek (shake, kemiringan, offset penurunan stack, pita ambient) adalah angka di satu objek state efek yang diperbarui setiap frame. Tidak dibuat ulang.
- Callout ditampilkan sebagai elemen DOM di atas canvas (teks bisa diperbesar dan dibaca pembaca layar). Animasinya memakai `transform` dan `opacity` saja.
- Intensitas efek dibaca dari pengaturan saat event diproses. Minimal berarti emitter partikel dan shake tidak dipanggil sama sekali.

## 7. Input

- Setiap sumber input menghasilkan `{ action, pressed, time }`.
- `repeat.ts` mengelola DAS dan ARR untuk geser, berdasarkan waktu tick, sehingga keyboard, tombol sentuh, dan gamepad berperilaku sama.
- Keyboard: listener `keydown` dan `keyup` di `window`, memakai `event.code`. Tombol yang dipetakan memanggil `preventDefault` hanya saat layar Game aktif, supaya Tab dan Space tetap normal di menu.
- Sentuh: Pointer Events dengan `touch-action: none` di area playfield dan tombol sentuh. Mode Gestur memakai `setPointerCapture`.
- Gamepad: polling `navigator.getGamepads()` sekali per frame sebelum tick dijalankan. Event `gamepadconnected` dan `gamepaddisconnected` memicu pemberitahuan.
- Saat jendela kehilangan fokus (`blur`), semua tombol yang ditahan dilepas, supaya piece tidak terus bergeser.

## 8. Audio

- Satu `AudioContext`, dibuat saat gestur pertama.
- Saat load (setelah unlock), setiap resep di `synth.ts` dirender dengan `OfflineAudioContext` menjadi `AudioBuffer`. Pemutaran memakai `AudioBufferSourceNode` baru per suara. Node ini memang dibuat sekali pakai menurut desain Web Audio, dan bukan bagian dari alokasi per frame di loop gambar.
- Batas polifoni per jenis suara (misalnya soft drop), supaya suara tidak menumpuk.
- Musik: loop dengan `loop = true`. Perubahan tempo dan filter per level dijalankan dengan `setTargetAtTime`.

## 9. UI dan i18n

- Setiap layar adalah satu fungsi yang membuat elemen DOM sekali dan menyimpan referensinya. Pindah layar hanya menyembunyikan dan menampilkan, tidak membangun ulang.
- HUD memperbarui `textContent` hanya jika nilainya berubah.
- `aria-live="polite"` dipasang di satu wilayah pengumuman untuk callout, hasil Game Over, dan pemberitahuan.
- Dialog (Pause, Game Over, konfirmasi) memakai elemen `<dialog>` dengan `showModal()`, sehingga jebakan fokus dan Esc ditangani oleh platform.
- `t(key, vars)` mengambil teks dari kamus aktif. Tipe key berasal dari `id.ts`, dan `en.ts` harus memenuhi tipe yang sama: `const en: Record<keyof typeof id, string>`.
- Mengganti bahasa memperbarui semua teks yang terlihat dan `<html lang>`, lalu menyimpan pilihannya.

## 10. Penyimpanan

`store/storage.ts` adalah satu-satunya modul yang menyentuh localStorage. Fungsinya `load(): SaveData` dan `save(data): boolean`. Validasi dan migrasi mengikuti SPEC.md bagian 13. Modul ini tidak melempar error ke pemanggil.

## 11. Tes

Satu file `tests/core.test.ts`, dijalankan dengan `node --test`. Tidak memakai framework.

| Kelompok | Yang dicek |
|---|---|
| Kick SRS | Setiap baris tabel JLSTZ dan I dari SPEC.md bagian 3 cocok dengan data di `srs.ts`. Ada skenario putar di dekat dinding yang memakai tes 2 sampai 5. O tidak bergeser. |
| 7-bag | Untuk beberapa seed, setiap kelompok 7 piece berturut-turut dari awal berisi ketujuh jenis tepat sekali. Seed yang sama menghasilkan urutan yang sama. |
| Skor | Setiap baris tabel skor dikali level. B2B x1.5 untuk 4 Baris dan T-Spin. Single mematikan B2B. Bonus combo. Bonus Bersih Total, termasuk 3200. Poin drop tidak dikali level. |
| T-Spin | Kasus T-Spin penuh, Mini, putar lalu geser (bukan T-Spin), dan tes kick 5 yang naik menjadi T-Spin penuh. |
| Lock delay | Piece terkunci setelah 400 ms. Reset ke-15 diterima dan setelahnya tidak. Hitungan reset kembali ke 0 saat piece mencapai baris lebih rendah. |
| Clear tanpa jeda | Piece berikutnya muncul di tick clear dan bisa digeser di tick berikutnya. |
| i18n | Key di `id` dan `en` identik, dan tidak ada nilai kosong. |

Tes ini masuk ke kriteria selesai di setiap fase (ROADMAP.md).

## 12. Target performa

| Target | Cara mengukur |
|---|---|
| 60 fps di HP Android kelas menengah, termasuk saat 4 Baris dengan intensitas Penuh | Chrome DevTools Performance lewat remote debugging di perangkat uji. Tidak ada frame di atas 16.7 ms selama satu menit bermain. Perangkat uji disebut di bagian 14. |
| Input lag di bawah 1 frame | Dari timestamp event input sampai tick yang memprosesnya kurang dari 16.7 ms, dicatat di build debug. |
| Nol alokasi per frame saat bermain | Allocation timeline di DevTools: tidak ada pertumbuhan heap dan tidak ada GC minor yang disebabkan loop selama satu menit bermain dengan efek Penuh. |
| Muat awal web | Ukuran JS hasil build dan waktu muat dicatat di Fase 5. Angka target ditetapkan setelah pengukuran pertama, bukan ditebak sekarang. |

## 13. Dari proyek referensi

Proyek referensi: game Android Kotlin milik pemilik di `D:\Code\opencode\diandra\` (folder proyek referensi). BlockDown tidak menyalin kodenya. Yang diambil adalah polanya.

Ditiru:
- Logika domain murni tanpa import platform, sehingga bisa dites tanpa perangkat.
- Engine berbicara ke platform lewat antarmuka event.
- Tabel kick SRS disimpan sebagai data.
- 7-bag ber-seed, tetapi tanpa aturan tambahan (referensi melarang S/Z sebagai piece pertama dan piece kembar di batas bag. BlockDown memakai 7-bag murni).
- Mode sebagai objek dengan `checkEnd()`. Zen mengosongkan board alih-alih kalah.
- Progres animasi clear dibawa di state, sehingga renderer tidak punya timer sendiri.
- Sprite sel di-cache sekali.
- Efek line clear bertingkat sesuai jumlah baris.

Kelemahan referensi dan penangkalnya:

| Kelemahan | Penangkal di BlockDown | Tempat |
|---|---|---|
| Tidak ada lock delay | 400 ms, maksimal 15 reset | SPEC 6.2, `core/lock.ts`, tes |
| Tidak ada DAS/ARR | DAS dan ARR yang bisa diatur, sama untuk semua input | SPEC 7.2, `input/repeat.ts` |
| Tidak ada T-Spin | Aturan 3 sudut dengan Mini | SPEC 8.7, `core/tspin.ts`, tes |
| Tidak ada B2B | B2B x1.5 | SPEC 8.2, `core/score.ts`, tes |
| Next queue hanya 1 | Next 5 | SPEC 4 |
| Hold bisa 3 kali | Hold 1 kali per piece | SPEC 5 |
| Berhenti 1 detik setiap clear | Jeda logika 0 ms, efek hanya visual | SPEC 6.3, tes |
| Board diubah dan dibaca dari dua thread | Satu thread, hanya `core.step()` yang menulis | Bagian 4 |
| Paint dan gradien dibuat setiap frame | Sprite, gradien, dan pola di-cache, pool partikel | Bagian 6 |
| Reduced-motion diabaikan | `prefers-reduced-motion` memilih Minimal | DESIGN 8.5 |
| Teks ditulis di kode, campur bahasa | Semua teks lewat kamus, key diperiksa tes | SPEC 9 |
| Mode ada di kode tetapi tidak bisa diakses | Setiap mode di `modes.ts` wajib muncul di Menu. Fase 3 menguji keempatnya dari Menu. | ROADMAP Fase 3 |
| Listing toko menjanjikan fitur yang tidak ada | Listing ditulis dari daftar fitur yang sudah lolos uji | ROADMAP Fase 5 |

## 14. Keputusan (teknis)

Diputuskan ("pakai usulan"):
- Plugin keep-awake: tidak dipasang di awal. Dipasang di Fase 5 hanya jika uji gamepad di perangkat menunjukkan layar mati saat bermain.
- Versi minimum Android: mengikuti `minSdkVersion` bawaan versi Capacitor yang dipakai saat Fase 5. Tidak diturunkan secara manual.
- Browser: dua versi terakhir Chrome, Edge, Firefox, dan Safari (termasuk Safari iOS). `OffscreenCanvas` dan `backdrop-filter` punya fallback (bagian 6 dan DESIGN.md 7.3).
- Domain: subdomain bawaan `*.vercel.app` sampai pemilik menyiapkan domain sendiri.

Masih butuh data dari pemilik (tidak ada usulan yang bisa dibuat tanpa data ini):
- Perangkat Android kelas menengah acuan untuk target 60 fps. Wajib ada sebelum Fase 2 selesai, karena kriteria performa diuji di perangkat itu.
