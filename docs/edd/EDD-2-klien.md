# EDD 2: Klien

Rancangan teknis rinci untuk semua yang ada di luar `src/core/`: loop, input, render, efek, audio, UI, i18n, penyimpanan, dan platform. Sumber: `docs/prd/DESIGN.md`, `SPEC.md`, `ARCHITECTURE.md`. Acuan visual: `design/stitch/`.

---

## 1. Loop (`src/loop.ts`)

```ts
const STEP = 1000 / 60;
let acc = 0, last = 0, running = false;

function frame(now: number) {
  if (!running) return;
  acc += Math.min(now - last, 250);
  last = now;
  input.pollGamepad(now);
  while (acc >= STEP) {
    input.fill(simTime, actBuf);          // aksi yang jatuh tempo di tick ini
    game.step(actBuf.data, actBuf.count);
    simTime += STEP;
    acc -= STEP;
  }
  dispatch(game.events);                  // render, audio, ui, haptics
  game.events.clear();
  renderer.draw(game.state, acc / STEP, now);
  requestAnimationFrame(frame);
}
```

- `simTime` adalah waktu simulasi (ms) yang dipakai input untuk DAS dan ARR, sehingga perilaku geser identik di layar 60 Hz dan 120 Hz.
- `actBuf` adalah `Uint8Array(16)` dengan penghitung, dibuat sekali.
- `pause()`: `running = false`, renderer menggambar satu frame terakhir, lalu pemanggil mengambil snapshot blur (bagian 6.4). `resume()`: `last = performance.now()`, `acc = 0`, `running = true`.
- `document.visibilitychange` ke `hidden` dan `App.pause` di Capacitor memanggil Pause.
- Saat Game Over, loop tetap berjalan sampai animasi runtuh selesai, tanpa memanggil `step()`.

## 2. Input

### 2.1 Bentuk umum (`src/input/actions.ts`)

Setiap sumber memanggil `press(btn, time)` dan `release(btn, time)` dengan `btn` dari:

```ts
export const BTN = { LEFT: 0, RIGHT: 1, SOFT: 2, HARD: 3, CW: 4, CCW: 5, HOLD: 6, PAUSE: 7 } as const;
```

`time` berasal dari `event.timeStamp` (keyboard dan pointer) atau `performance.now()` (gamepad). Event masuk ke antrean berkapasitas 64 (`Float64Array` waktu dan `Uint8Array` jenis), bukan langsung ke core.

### 2.2 Pengubah ke aksi core (`src/input/repeat.ts`)

`fill(simTime, out)` dipanggil sekali per tick:

1. Ambil event antrean yang `time <= simTime` (waktu event dipetakan ke waktu simulasi dengan selisih tetap yang dicatat saat permainan mulai dan saat resume).
2. Tekan sekali: `CW`, `CCW`, `HARD`, `HOLD` langsung menjadi satu aksi. `SOFT` tekan dan lepas menjadi `SOFT_ON` dan `SOFT_OFF`. `PAUSE` memanggil `ui.pause()`.
3. Geser:
   - Tekan `LEFT` atau `RIGHT`: tambah aksi geser satu kali, set `dir`, `dasStart = time`, `nextRepeat = time + das`.
   - Arah yang ditekan terakhir menang. Melepas arah aktif saat arah lain masih ditahan: `dir` pindah ke arah itu dan `dasStart` dihitung ulang dari waktu lepas.
   - Selama ditahan: jika `simTime >= nextRepeat`:
     - `arr == 0`: tambah 10 aksi geser (cukup untuk mentok dinding; aksi yang gagal tidak berbuat apa-apa).
     - selain itu: tambah satu aksi per `arr` ms yang sudah lewat, maksimal 10 per tick, lalu `nextRepeat += arr * jumlah`.
   - Muatan DAS tidak direset saat piece berganti (SPEC 7.2).
4. `window` `blur` dan Pause melepas semua tombol.

### 2.3 Keyboard (`src/input/keyboard.ts`)

- Listener `keydown` dan `keyup` di `window`, hanya aktif saat layar Game.
- `keymap: Record<Btn, string[]>` dari pengaturan, dicari lewat `Map<string, Btn>` yang dibuat ulang hanya saat keymap berubah.
- `event.repeat` diabaikan. Tombol yang dipetakan memanggil `preventDefault()`.
- Esc selalu `PAUSE`, tidak masuk keymap.

### 2.4 Sentuh: tombol di layar (dihapus)

Dibuat di Fase 3 lalu dihapus setelah uji di Galaxy A13 (keputusan pemilik, DESIGN 9.2). HP hanya memakai gestur.

### 2.5 Sentuh: gestur (`src/input/gesture.ts`, `src/input/touch.ts`)

Area: seluruh layar Game kecuali tombol (jeda), supaya jari tidak menutupi papan. Satuan `u` = ukuran sel dalam piksel CSS.

| Konstanta | Nilai | Arti |
|---|---|---|
| `TAP_MAX_MS` | 220 | Durasi maksimum ketuk |
| `TAP_MAX_MOVE` | 0.5u | Gerak maksimum ketuk |
| `LOCK_DIST` | 0.6u | Gerak di atas ini menentukan arah segmen |
| `VERTICAL_BIAS` | 1.3 | Tegak hanya jika `|dy| > 1.3 * |dx|` (sekitar 52 derajat); selain itu mendatar |
| `VERTICAL_DIST` | 2.5u | Seret tegak pelan sejauh ini memicu jatuh cepat atau simpan |
| `FLICK_MIN` | 1.5u | Jarak minimum bantingan |
| `FLICK_SPEED` | 20u per detik | Kecepatan puncak tegak segmen untuk dianggap bantingan |

Aturan per `pointerId` (satu sentuhan bisa terdiri dari beberapa segmen):
- Segmen pertama ditentukan oleh gerak pertama yang melebihi 0,6u: tegak atau mendatar menurut `VERTICAL_BIAS`.
- Segmen mendatar: setiap 1u yang ditempuh sejak titik acuan menghasilkan `press`+`release` geser. DAS dan ARR tidak dipakai. Posisi saat geser terakhir dicatat.
- Dari segmen mendatar, gerak tegak minimal 0,6u sejak geser terakhir (dan tegak menurut `VERTICAL_BIAS`) memulai segmen tegak baru dari titik itu. Ini yang memungkinkan geser lalu banting tanpa mengangkat jari.
- Segmen tegak: `HARD` jika turun minimal 2,5u, atau turun minimal 1,5u dengan kecepatan puncak minimal 20u per detik. Ke atas dengan syarat yang sama: `HOLD`. Sekali per sentuhan; sisa gerak diabaikan.
- Kecepatan sesaat dihitung dengan selang waktu minimal 8 ms, supaya dua titik yang tiba berdempetan tidak menghasilkan kecepatan palsu.
- Titik lepas (`pointerup`) ikut diproses sebagai gerak. `pointercancel` memakai gerak yang sudah diterima.
- Tidak ada jatuh pelan lewat gestur (keputusan pemilik).
- Ketuk satu jari: `CW`. Ketuk saat ada dua pointer aktif: `CCW`, sekali saat jari terakhir diangkat.

### 2.6a Orientasi

Di layar sentuh (`hover: none` dan `pointer: coarse`) dengan posisi mendatar dan tinggi di bawah 600 px, CSS menyembunyikan `#app` dan menampilkan `#rotate-notice`; `main.ts` menjeda permainan lewat `matchMedia` yang sama. Jendela desktop yang lebar tidak terpengaruh.

### 2.6 Gamepad (`src/input/gamepad.ts`)

- `pollGamepad(now)` membaca `navigator.getGamepads()` sekali per frame, membandingkan dengan status tombol frame sebelumnya (`Uint8Array(17)`), lalu memanggil `press()`/`release()` untuk yang berubah.
- Stik kiri: `|x| > 0.5` dianggap kiri atau kanan.
- Mapping sesuai SPEC 11.3. Hanya gamepad dengan `mapping === "standard"` yang dipakai.
- Di Menu, D-pad dan A/B memindahkan fokus DOM dan memicu `click()`.

## 3. Render

### 3.1 Lapisan

Di dalam `.playfield-wrap` (posisi `relative`), urutan dari belakang:

| Lapisan | Elemen | Digambar ulang |
|---|---|---|
| Pita ambient | `<canvas>` | Setiap frame, kecuali Minimal (hanya saat warna berganti) |
| Latar playfield | `<canvas>` | Saat ukuran, grid, atau tema bingkai berubah |
| Board dan piece | `<canvas>` utama | Setiap frame |
| Partikel dan efek | Sama dengan canvas utama, digambar terakhir | Setiap frame |
| Callout | `<div>` DOM | Lewat event |

Hold dan Antrean memakai `<canvas>` kecil masing-masing, digambar ulang hanya saat isinya berubah (event `HOLD`, `SPAWN`).

### 3.2 Ukuran dan DPR (`src/render/canvas.ts`)

```
dpr = window.devicePixelRatio
cellDev = floor(min(availH / 20, availW / 10) * dpr)   // piksel perangkat, bilangan bulat
cellCss = cellDev / dpr
canvas.width = cellDev * 10; canvas.height = cellDev * 20
canvas.style.width = cellCss * 10 + "px"
```

`availW` dan `availH` dibaca dari `ResizeObserver` pada `.playfield-wrap`. DPR dipantau dengan `matchMedia("(resolution: Xdppx)")` yang didaftarkan ulang setiap berubah. Perubahan ukuran memanggil `rebuildSprites()` dan menggambar ulang latar.

Contoh hitungan 390x844 CSS dengan safe-area atas 47 dan bawah 34 (tinggi tersedia 763):
- Lebar: 390 - 24 (margin 12 x 2) - 64 (kolom kiri) - 64 (kolom kanan) - 16 (dua jarak 8) = 222, jadi 22.2 per sel.
- Tinggi: 763 - 56 (baris atas) - 8 - 120 (dua baris tombol sentuh 56 + 8 + 56) - 16 (jarak) = 563, jadi 28.1 per sel.
- Sel 22px, playfield 220x440 CSS. Tanpa tombol sentuh (mode Gestur), batasnya tetap lebar, sel 22px.

Batas bawah: jika sel di bawah 14px CSS (lebar 320 dengan tombol sentuh), kolom kiri dan kanan menyempit ke 56px dan margin menjadi 8px. Ini diuji di lebar 320 (ROADMAP Fase 3).

### 3.3 Sprite (`src/render/sprites.ts`)

`rebuildSprites(cellDev, colorSafe)` membuat satu atlas `OffscreenCanvas` (cadangan: `document.createElement("canvas")` yang tidak dipasang) berukuran `cellDev * 7` x `cellDev * 3`:

| Baris atlas | Isi |
|---|---|
| 0 | Blok normal per jenis: isi warna, radius 4px (skala DPR), inset atas 1px putih 28%, inset bawah 1px hitam 35%. Jika `colorSafe`, pola SPEC/DESIGN 4.2 digambar di atasnya dengan `#0F1217` 35%. |
| 1 | Ghost per jenis: outline 2px warna penuh, tanpa isi, radius 4px. |
| 2 | Kilat lock: blok normal yang dicampur putih 30%. |

Sprite mini untuk Hold dan Antrean dibuat dengan cara yang sama di atlas terpisah dengan ukuran sel mini. Radius dan inset diskalakan, minimal 1 piksel perangkat.

Satu-satunya pemanggilan gambar saat bermain: `drawImage(atlas, sx, sy, s, s, dx, dy, s, s)`, `fillRect` untuk partikel, dan `globalAlpha`/`setTransform` untuk efek. Tidak ada `createLinearGradient`, `createPattern`, `new Path2D`, atau perubahan `ctx.font` di loop gambar. Gradien pita ambient dibuat sekali per perubahan warna.

### 3.4 Gambar per frame (`src/render/board.ts`)

1. `clearRect` seluruh canvas utama.
2. `ctx.setTransform` dengan offset shake dan kemiringan dari state efek.
3. Sel board terlihat (y 0 sampai 19), dibalik: `dy = (19 - y) * cell`. Selama animasi stack turun, baris hasil `j` digambar dengan offset `shift[j] * cell * (1 - easeSpring(t))` ke atas.
4. Ghost di `ghostY` jika aktif.
5. Piece aktif. Posisi visual `y` diinterpolasi antara posisi tick sebelumnya dan sekarang dengan `alpha`, hanya jika selisihnya satu baris karena gravitasi. Geser, putar, dan hard drop tidak diinterpolasi supaya terasa instan.
6. Sel piece aktif di baris tersembunyi (y 20 dan 21) digambar terpotong di tepi atas.
7. Partikel dan efek (bagian 4).

Renderer menyimpan posisi tick sebelumnya sendiri (`prevY`, `prevTick`). Renderer tidak pernah menulis ke `game.state`.

## 4. Efek (`src/render/effects.ts`, `src/render/particles.ts`)

### 4.1 State efek

Satu objek yang dibuat sekali:

```ts
const fx = {
  shakeAmp: 0, shakeT: 0,
  tilt: 0, tiltT: 0,
  squashT: -1, squashCells: new Int8Array(8),
  lockFlashT: -1, lockCells: new Int8Array(8),
  rowFlashT: -1, rowFlash: new Int8Array(4),
  shockT: -1, shockY: 0,
  ringT: -1, ringX: 0, ringY: 0,
  waveT: -1,
  dropT: -1, shift: new Uint8Array(22),
  frameT: -1,
  ambientHue: 0, ambientTarget: 0, ambientBoost: 0, ambientWarm: 0,
};
```

Setiap `...T` adalah waktu mulai (ms, dari `now`) atau -1 jika tidak aktif. Progres dihitung `(now - T) / durasi`.

### 4.2 Pemetaan event ke efek

| Event | Efek | Intensitas |
|---|---|---|
| HARD | `squashT`, garis jejak setinggi jarak | Penuh, Sedang |
| LOCK | `lockFlashT` | Semua (Minimal: fade saja) |
| ROTATE dengan kick | `tilt = 1.5 * arah`, 90 ms | Penuh, Sedang |
| CLEAR n 1 | `rowFlashT` | Semua |
| CLEAR n 2, 3 | `rowFlashT`, partikel 8 per sel, callout | Partikel: Penuh, Sedang |
| CLEAR n 4 | Storyboard DESIGN 8.3, partikel 12 per sel, shockwave, shake 4px | Lihat DESIGN 8.5 |
| CLEAR spin 1, 2 | `ringT` di pusat T, warna T; shake jika n > 0 | Lihat DESIGN 8.5 |
| CLEAR pc | `waveT`, callout emas, shake | Lihat DESIGN 8.5 |
| CLEAR combo >= 1 | `ambientWarm = min(combo / 8, 1)`, baris combo di callout | Semua |
| LEVEL_UP | `frameT` (bingkai aksen 400 ms), `ambientTarget` berganti | Semua |
| ZEN_RESET | Fade board 300 ms, callout "Mulai lagi" | Semua |
| GAME_OVER | Runtuh per baris (stagger 30 ms, 600 ms total), lalu layar Game Over | Minimal: fade |

Skala intensitas: `particleScale` (1, 0.5, 0), `shakeScale` (1, 0.5, 0), `fxOpacity` (1, 0.5, 0). Shake 4px dikalikan DPR untuk canvas.

Shake: `offset = shakeAmp * (1 - p) * sin(p * 30)` di sumbu y untuk Quad (dorongan ke bawah), dan sumbu x untuk T-Spin. Durasi 200 ms.

Pegas penurunan stack: `easeSpring(t) = 1 - (1 - t)^3 * cos(t * 6)` untuk Penuh, `1 - (1 - t)^3` untuk Sedang, langsung 1 untuk Minimal. Durasi 150 ms, mulai di 450 ms storyboard Quad, dan di 120 ms untuk Double/Triple.

### 4.3 Pool partikel

```ts
const N = 300;
const px = new Float32Array(N), py = new Float32Array(N);
const vx = new Float32Array(N), vy = new Float32Array(N);
const life = new Float32Array(N), size = new Float32Array(N);
const color = new Uint8Array(N);
let cursor = 0;
```

- `emit(x, y, c)`: tulis di `cursor`, `cursor = (cursor + 1) % N`. Partikel tertua tertimpa (DESIGN 8.4).
- Update per frame dengan `dt` (detik, dibatasi 0.05): gravitasi 900 px/s2, gesekan 0.98, `life -= dt`.
- Gambar: dikelompokkan per warna (7 lintasan kecil) supaya `fillStyle` hanya berganti 7 kali per frame. String warna disimpan sekali dalam array konstanta.
- Batas jumlah: `min(perSel * jumlahSel * particleScale, N)`.

### 4.4 Callout (`src/ui/callout.ts`)

- Satu `<div class="callout">` di sepertiga atas playfield, berisi tiga baris: angka skor ("+1.200"), judul ("4 BARIS"), dan baris kecil (B2B, combo).
- Animasi memakai Web Animations API (`el.animate`) dengan `transform` dan `opacity`. Animasi lama dibatalkan dengan `.cancel()` sebelum yang baru (DESIGN 8.4 butir 4).
- Sapuan cahaya: pseudo-elemen dengan gradien aksen yang digeser satu kali dengan `transform: translateX`, 300 ms. Tidak ada `animate-pulse`.
- Teks dari `t()`. Angka diformat `Intl.NumberFormat(locale)`.
- Wilayah `aria-live` (bagian 7.4) menerima teks yang sama tanpa animasi.

### 4.5 Pita ambient

- Canvas kecil (lebar playfield + 40%, tinggi 30% layar, skala 0.5 untuk hemat), di belakang playfield.
- Gradien linear vertikal: transparan, warna, transparan. Opasitas 5%, naik ke 9% selama 600 ms saat Quad (`ambientBoost`).
- Bergerak naik-turun 8px dengan periode 12 detik (Penuh, Sedang). Diam di Minimal.
- Warna: hue berinterpolasi dari `ambientHue` ke `ambientTarget` selama 1200 ms. Warna target urut sesuai DESIGN 8.1. `ambientWarm` mencampur ke warna L (#E39A55).
- Gradien dibuat ulang hanya saat warna berubah lebih dari 1 derajat hue, bukan setiap frame.

## 5. Audio

### 5.1 Unlock dan struktur (`src/audio/mixer.ts`)

- `AudioContext` dibuat saat `pointerdown` atau `keydown` pertama di dokumen (listener sekali pakai), lalu `resume()`.
- Graf: `sfxGain` dan `musicGain` ke `master` (GainNode), ke `masterLP` (BiquadFilter low-pass, 20 kHz), lalu ke `destination`.
- Volume dari pengaturan diterapkan dengan `setTargetAtTime(v, now, 0.02)`.
- Pause: `masterLP.frequency` ke 800 Hz dan musik turun ke 30%. Game over: `masterLP` turun ke 300 Hz selama 1.2 detik.
- `visibilitychange` hidden: `ctx.suspend()`. Visible: `ctx.resume()`.

### 5.2 Sintesis (`src/audio/synth.ts`)

Setiap resep adalah fungsi `(ctx: OfflineAudioContext) => void` yang membangun graf dan dijalankan sekali dengan `startRendering()` setelah unlock. Hasilnya disimpan di `Map<SoundId, AudioBuffer>`. Sample rate mengikuti `AudioContext.sampleRate`.

| Id | Resep | Durasi |
|---|---|---|
| `move` | Noise bandpass 2.2 kHz, Q 4, envelope 2 ms naik dan 18 ms turun | 20 ms |
| `rotate` | Sine 1.6 kHz, 30 ms | 30 ms |
| `rotateKick` | `rotate` ditambah sine 1.6 ke 2.4 kHz, 60 ms | 60 ms |
| `soft` | Noise highpass 4 kHz, 8 ms, gain rendah | 8 ms |
| `hard` | Sine 90 ke 45 Hz 180 ms ditambah noise lowpass 600 Hz 60 ms | 200 ms |
| `lock` | Triangle 320 Hz, 40 ms | 40 ms |
| `clear1` sampai `clear3` | Triad bertingkat dari kunci aktif: 1, 2, lalu 3 nada triangle bersamaan, 400 ms | 400 ms |
| `quad` | Arpeggio 4 nada (tiap 60 ms), lalu chord terbuka 5 nada 900 ms melalui `ConvolverNode` | 1.4 s |
| `combo0` sampai `combo9` | Sine plus harmonik ke-2, nada pentatonik mayor naik (2 oktaf, 10 nada), 180 ms | 180 ms |
| `tspin` | Noise bandpass yang disapu 400 ke 3000 Hz 150 ms, lalu triad 500 ms | 650 ms |
| `pc` | Glissando sine 1 oktaf 500 ms, lalu bel (sine 3 parsial non-harmonis) 1 s | 1.5 s |
| `gameover` | Triad turun dengan pitch bend minor, 1 s | 1 s |

- Reverb: impulse response 1.6 detik dari noise yang meluruh eksponensial, dibuat sekali.
- `move` dimainkan dengan `playbackRate = 1 + (random * 0.06 - 0.03)`. `Math.random` di sini tidak melanggar aturan core karena audio tidak memengaruhi permainan.
- Combo: indeks nada `min(combo - 1, 9)`.
- Polifoni: `soft` dan `move` maksimal 4 sumber aktif; suara baru melewati jika penuh.
- Naik level tidak punya buffer sendiri: musik berpindah kunci (bagian 5.3).

### 5.3 Musik (`src/audio/music.ts`)

- Tidak dirender ke buffer karena kunci dan tempo berubah. Dimainkan langsung dengan penjadwal lookahead: `setInterval` 25 ms menjadwalkan nada dalam 100 ms ke depan memakai `ctx.currentTime`.
- Isi: pad dua oscillator (sawtooth melalui lowpass, detune 7 cent) yang memainkan progresi 4 akor, ditambah pulsa bass sederhana. Satu putaran 4 bar.
- Tempo: `72 + 2 * (level - 1)` BPM, maksimal 96. Cutoff lowpass: `600 + 120 * (level - 1)` Hz, maksimal 3000.
- Naik level: kunci naik satu langkah dalam lingkaran kuint (naik 7 semitone, lalu dikurangi 12 jika lebih dari 6), mulai di akor berikutnya.
- Nada-nada efek (`clear`, `combo`, `quad`) di-render dalam C, lalu dimainkan dengan `playbackRate = 2^(kunci / 12)` supaya sama kuncinya dengan musik.
- Penjadwal berhenti saat Pause dan saat tab tersembunyi.

## 6. UI

### 6.1 Struktur DOM (`index.html`)

```html
<html lang="id">
<body>
  <main id="app">
    <section id="scr-menu" hidden>...</section>
    <section id="scr-game" hidden>...</section>
    <section id="scr-settings" hidden>...</section>
  </main>
  <dialog id="dlg-pause">...</dialog>
  <dialog id="dlg-confirm">...</dialog>
  <dialog id="dlg-over">...</dialog>
  <div id="live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
</body>
</html>
```

- Setiap layar dibuat sekali oleh fungsi `mountX()` yang mengembalikan referensi elemen. Pindah layar: atur `hidden` dan pindahkan fokus.
- Teks diisi oleh `applyI18n(root)`: semua elemen dengan `data-i18n="key"` mendapat `textContent = t(key)`, dan `data-i18n-aria="key"` mendapat `aria-label`. Dipanggil saat mount dan saat bahasa berganti.
- Ikon: `<svg aria-hidden="true"><use href="/icons.svg#play_arrow"/></svg>` dari satu sprite SVG (EDD-3 bagian 4).

### 6.2 Layar dan perpindahan

```
Menu --mulai mode--> Game
Game --Esc/P/jeda/latar--> dlg-pause
dlg-pause --Lanjutkan/Esc--> Game
dlg-pause --Ulangi/Ke Menu--> (dlg-confirm jika piece > 1) --> Game baru / Menu
dlg-pause --Pengaturan--> Settings --kembali--> dlg-pause
Menu --Pengaturan--> Settings --kembali--> Menu
Game --status 1,2,3--> animasi runtuh --> dlg-over
dlg-over --Main Lagi--> Game baru; --Ke Menu--> Menu
```

Pengaturan dari Pause: layar Settings tampil, `dlg-pause` ditutup sementara. Saat kembali, `dlg-pause` dibuka lagi dan fokus ke tombol "Pengaturan".

Tombol kembali Android (`App.addListener("backButton")`): Game memanggil Pause, dialog terbuka ditutup (sama seperti Esc), Settings kembali, Menu memanggil `App.exitApp()`.

### 6.3 Detail per layar

Menu (`ui/menu.ts`):
- Baris mode adalah `<button>` dengan nama, deskripsi, dan rekor. Maraton adalah `<button aria-expanded>` yang membuka dua `<button>` di bawahnya.
- Panah atas dan bawah memindahkan fokus di antara tombol mode (roving dengan `focus()`, tanpa mengubah `tabindex`).
- Switch bahasa: dua `<button aria-pressed>`.

Game (`ui/hud.ts`):
- Baris atas: nama mode, skor (`<output>`), tombol jeda.
- Kolom kiri: canvas Simpan, Level, Baris, Waktu, Combo. Combo memakai `hidden` saat `combo < 1`.
- HUD memperbarui `textContent` hanya jika nilai berubah, dengan membandingkan ke nilai terakhir yang disimpan.
- Waktu diperbarui maksimal 10 kali per detik (Sprint menampilkan sentidetik saat bermain dan milidetik di hasil).
- Skor bergulir: nilai tampil mengejar nilai asli selama 300 ms (Penuh, Sedang), langsung di Minimal.
- Tombol sentuh hanya dirender jika `touchMode == "buttons"` dan `matchMedia("(pointer: coarse)")` cocok.

Pause, Konfirmasi, Game Over:
- `<dialog>` dengan `showModal()`. Esc memicu event `cancel`: di Pause berarti Lanjutkan, di Konfirmasi berarti Batal, di Game Over dicegah (`preventDefault`) supaya pilihan tetap eksplisit.
- `::backdrop` untuk Pause: `background: rgb(15 18 23 / 0.6)`. Blur memakai snapshot (6.4), bukan `backdrop-filter` di atas canvas yang hidup.
- Fokus awal dengan atribut `autofocus` pada tombol utama (Konfirmasi: tombol "Batal").

Pengaturan (`ui/settings.ts`):
- Slider: `<input type="range">` dengan `<label>` dan `<output>`. `aria-valuetext` berisi nilai dan satuan dari `t()`.
- Toggle: `<button role="switch" aria-checked>`.
- Segmented: grup `<button aria-pressed>` di dalam `role="group"` dengan label.
- Atur tombol: daftar aksi, masing-masing tombol "Ubah". Saat mendengarkan, listener `keydown` sekali pakai di `window` dengan `capture: true`. Esc membatalkan. Konflik ditampilkan di `<p role="alert">`.
- Setiap perubahan memanggil `store.saveSettings()` dan menerapkan langsung (volume, keymap, efek, bahasa, sprite jika `colorSafe` berubah).

### 6.4 Blur Pause

1. Saat Pause, canvas utama, latar, dan ambient digabung ke satu canvas `snap` berukuran seperempat (skala 0.25).
2. `snap` digambar dengan `ctx.filter = "blur(4px)"` jika `ctx.filter` didukung. Jika tidak, tidak diblur.
3. `snap` ditampilkan di atas playfield dengan `transform: scale(4)` dan `image-rendering: auto`, sehingga pembesaran menambah kehalusan.
4. Dialog Pause dan backdrop 60% berada di atasnya.

Biaya blur hanya sekali per Pause. Tidak ada `backdrop-filter`.

## 7. Aksesibilitas

### 7.1 Fokus

```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-primary:focus-visible { outline-offset: 3px; }
```

Tidak ada `outline: none` tanpa pengganti.

### 7.2 Reduced motion

```ts
const mq = matchMedia("(prefers-reduced-motion: reduce)");
const reduce = settings.reduceMotion ?? mq.matches;
const effects = reduce ? "minimal" : settings.effects;
```

`mq.addEventListener("change", ...)` menerapkan ulang jika pengaturan masih `null` (ikuti sistem). CSS animasi UI juga dibungkus `@media (prefers-reduced-motion: no-preference)` dan kelas `.reduce` di `<html>`.

### 7.3 Canvas

- Canvas utama: `role="img"`, `aria-label` = `t("a11y.board", { mode, level })`, diperbarui saat level berubah saja.
- Canvas Hold dan Antrean: `role="img"` dengan label yang menyebut nama piece (`t("piece.T")`, dan seterusnya).

### 7.4 Pengumuman

- `announce(text)` menulis ke `#live`. Pengumuman diberi jeda minimal 1 detik. Pengumuman baru dalam jeda itu menggantikan yang lama, bukan menumpuk.
- Yang diumumkan: callout reward, naik level, Game Over dan hasilnya, Zen reset, pemberitahuan (gamepad, penyimpanan, suara), dan hasil pemetaan tombol.

## 8. i18n (`src/i18n/`)

```ts
// id.ts
export const id = {
  "menu.settings": "Pengaturan",
  "mode.marathon.name": "Maraton",
  "mode.marathon.desc": "Naik level sampai kamu menyerah",
  // ...
} as const;
export type Key = keyof typeof id;

// en.ts
import type { Key } from "./id.ts";
export const en: Record<Key, string> = { ... };
```

- `t(key, vars?)`: ambil string, ganti `{nama}` dengan `vars[nama]`. Angka di `vars` diformat dengan `Intl.NumberFormat(locale)` yang dibuat sekali per bahasa.
- `pickLocale()`: pengaturan tersimpan, lalu `navigator.language` (`en*` ke `en`, `id*` atau `in*` ke `id`), lalu `id`.
- `setLocale(l)`: simpan, set `document.documentElement.lang`, panggil `applyI18n(document)`, perbarui label dinamis.

Kelompok key (daftar lengkap ditulis saat Fase 1, dengan nilai dari PRD):

| Awalan | Isi |
|---|---|
| `menu.*` | Pengaturan, bahasa, Belum ada, pemberitahuan penyimpanan |
| `mode.*.name`, `mode.*.desc` | Empat mode dan dua varian Maraton |
| `hud.*` | Simpan, Antrean, Level, Baris, Waktu, Combo, Jeda, Terkunci |
| `callout.*` | Double, Triple, Quad, T-Spin dan variannya, B2B, Combo, Bersih Total, Naik Level, Mulai lagi |
| `pause.*`, `confirm.*` | Judul dan tombol, Waktu sesi |
| `over.*` | Judul per penyebab, statistik, Rekor baru, Main Lagi, Ke Menu |
| `settings.*` | Label, deskripsi, satuan, pilihan |
| `controls.*` | Nama aksi untuk pemetaan tombol dan label tombol sentuh |
| `piece.*` | Nama piece untuk pembaca layar |
| `a11y.*` | Label canvas, pengumuman |
| `notice.*` | Gamepad, suara, penyimpanan, getar |

## 9. Penyimpanan (`src/store/storage.ts`)

```ts
const KEY = "blockdown";
const SCHEMA = 1;

export function load(): { data: SaveData; status: "ok" | "empty" | "corrupt" | "newer" | "unavailable" }
export function save(data: SaveData): boolean
```

`load()`:
1. `try { raw = localStorage.getItem(KEY) } catch { return defaults, "unavailable" }`.
2. `raw === null`: bawaan, `"empty"`.
3. `JSON.parse` gagal: bawaan, `"corrupt"`, dan `readOnly = true` sampai `save()` berikutnya dipanggil oleh aksi pemain.
4. `schema > SCHEMA`: baca field yang dikenal, `"newer"`, `readOnly = true` permanen (data versi lebih baru tidak ditimpa).
5. `schema < SCHEMA`: jalankan `MIGRATIONS[schema]` berurutan.
6. Validasi per field dengan fungsi kecil: `num(v, min, max, def)`, `int(v, min, max, def)`, `bool(v, def)`, `oneOf(v, list, def)`. Rekor: `Number.isSafeInteger(v) && v >= 0`.
7. Keymap: setiap aksi berisi maksimal 2 string `code`. Kode duplikat antar aksi dibuang dari aksi yang belakangan. Aksi tanpa tombol kembali ke bawaan.

`save()`: `try { localStorage.setItem(KEY, JSON.stringify(data)); return true } catch { return false }`. Gagal menyimpan memunculkan pemberitahuan sekali per sesi.

Rekor: `submitResult(mode, result)` membandingkan dengan rekor tersimpan (skor dan baris lebih besar lebih baik, waktu Sprint lebih kecil lebih baik), lalu mengembalikan `isNewRecord`. Tag "Rekor baru" hanya tampil jika `isNewRecord` dan `save()` berhasil.

## 10. Platform (`src/platform/`)

- `haptics.ts`: jika `Capacitor.isNativePlatform()`, impor `@capacitor/haptics` secara dinamis. Hard drop `impact({ style: "MEDIUM" })`, reward `impact({ style: "HEAVY" })`, game over `notification({ type: "WARNING" })`. Di web: `navigator.vibrate?.(15 / 30 / [40, 60, 40])`. Tidak tersedia: `available = false`, Pengaturan menonaktifkan Getar.
- `app.ts`: tombol kembali dan `pause`/`resume` aplikasi lewat `@capacitor/app`. Ini dependensi tambahan yang tidak ada di ARCHITECTURE.md bagian 2, karena tombol kembali Android tidak bisa ditangani tanpa plugin ini. Dicatat sebagai perubahan di EDD-3 bagian 7.
- Status bar dan warna navigasi: diatur di `capacitor.config.ts` dan tema Android (`#0F1217`), tanpa plugin tambahan.

## 11. Catatan implementasi Fase 2

- Loop ada di `main.ts`, belum dipisah ke `loop.ts`. Dipisah saat Fase 3 menambah mode dan layar Pengaturan, jika `main.ts` sudah terlalu besar.
- Interpolasi jatuh: `main.ts` mencatat `y` sebelum tick terakhir dan meneruskannya ke renderer sebagai `fallFrom`. Renderer tidak menyimpan riwayat posisi.
- Menu Fase 2 hanya berisi Maraton dan switch bahasa. Tombol Pengaturan, Sprint, Ultra, dan Zen sengaja belum ditampilkan sampai fungsinya ada (R-24, R-26).
- Callout visual belum ada (Fase 4). Momen clear, B2B, Bersih Total, dan naik level sudah diumumkan lewat `aria-live`.
- Font diambil dari paket `@fontsource` (subset Latin, OFL), disalin ke `src/fonts/` bersama lisensinya, lalu paketnya dihapus. Tidak ada dependensi runtime.
- Ikon Fase 2: `pause`, `play_arrow`, `replay`, `home` di `public/icons.svg`.
- Favicon: `data:,` sampai ikon aplikasi diputuskan.
- Tes klien di `tests/client.test.ts`: DAS/ARR, validasi penyimpanan, rekor, dan i18n.

## 12. Catatan implementasi Fase 3

- Pengenal gestur dipisah ke `input/gesture.ts` tanpa DOM supaya bisa dites (6 tes di `tests/client.test.ts`). `input/touch.ts` hanya menyambungkan Pointer Events. Nilai konstanta gestur masih nilai awal: ketuk maks 220 ms dan 0,5 sel, sapuan 25 sel per detik dan minimal 1,5 sel.
- Ketuk dua jari menghasilkan satu putar kiri saat jari terakhir diangkat, tidak dua putar kanan.
- Gamepad: `reset()` mencatat tombol yang masih ditekan saat berpindah antara permainan dan menu, dan `poll()` berhenti di frame itu setelah konteks berubah. Tanpa ini, Start membuka Pause lalu langsung menutupnya.
- Gamepad di menu dibaca oleh loop kecil yang hanya berjalan saat permainan tidak berjalan.
- Stik kiri atas/bawah hanya untuk navigasi menu, tidak untuk jatuh cepat saat bermain, supaya tidak terpicu tanpa sengaja.
- Pengaturan di `ui/settings.ts`. Kelompok Suara dan pengaturan Intensitas efek serta Kurangi animasi belum ditampilkan sampai fiturnya ada di Fase 4 (R-26).
- Tombol yang dicadangkan: Esc, P (jeda), dan Tab (navigasi fokus). Pemetaan tidak bisa memakai ketiganya; validasi penyimpanan juga membuangnya.
- Backspace saat mendengarkan tombol menghapus slot itu. Aksi tidak boleh tanpa tombol.
- Zen diakhiri pemain lewat `Game.end()` dari Pause ("Akhiri sesi"). Hasil utamanya baris, dicatat sebagai rekor.
- Landscape HP (tinggi di bawah 500 px): tombol sentuh dipindah ke kiri dan kanan papan dengan CSS grid, sesuai DESIGN 7 rentang 600 sampai 1023 px.
- Toast kecil di bawah layar untuk pemberitahuan sesaat (gamepad, simpan gagal, kembalikan bawaan), selain `aria-live`.

## 13. Revisi Fase 3 setelah uji di Galaxy A13

- Tombol sentuh dihapus dari HTML, CSS, dan `main.ts`; `bindTouchButtons` dihapus. Pengaturan `touchMode` dihapus dari penyimpanan, Pengaturan, dan kamus. Data lama yang masih berisi `touchMode` dibaca tanpa error dan field itu dibuang (tes di `client.test.ts`).
- Gestur dipasang di `#scr-game`, bukan `#field`, dan mengabaikan sentuhan yang dimulai di tombol.
- Tata letak: statistik pindah ke satu baris di bawah skor; Simpan dan Antrean berjajar mendatar di atas papan. `PreviewRenderer.horizontal` menyusun 5 slot mendatar (5x3 sel mini per slot). Sel mini dihitung dari lebar baris antrean: `(lebar - 40) / 29`, dibatasi 7 sampai 14 px.
- Jendela lebar (lebar 600 px ke atas dan lebih dari 0,9 kali tinggi): `main.ts` memberi kelas `side-layout`, Simpan di kiri dan Antrean tegak di kanan papan.
- Ikon tombol sentuh dibuang dari `public/icons.svg`; ditambah `screen_rotation`.

## 14. Revisi kedua setelah uji di Galaxy A13

Masalah yang dilaporkan dan penyebab yang ditemukan:

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Seret ke bawah kadang tidak terbaca saat dibanting keras | `up()` tidak memproses titik lepas, `cancel()` membuang sentuhan. Bantingan cepat bisa tiba hanya sebagai titik sentuh dan titik lepas, atau dibatalkan browser. | Titik lepas diproses; batal diselesaikan dengan posisi terakhir; bantingan 0,8u dalam 250 ms dihitung. |
| Seret ke samping kadang salah arah | Arah dikunci dari gerak pertama dengan perbandingan `|dx| >= |dy|`. Jempol yang mulai menyeret dengan sedikit turun terkunci tegak, lalu memicu jatuh cepat. | Tegak hanya jika `|dy| > 1.3 * |dx|`; `LOCK_DIST` 0,5u menjadi 0,6u. |

Tes: 6 tes gestur baru di `tests/client.test.ts`. Empat di antaranya gagal pada kode sebelum revisi (bantingan tanpa titik gerak, bantingan pendek, batal di tengah, seret 50 derajat) dan lulus sesudahnya.

Keyboard bawaan menjadi satu tombol per aksi: Z, X, panah atas untuk simpan. Keymap yang sudah tersimpan tidak diubah.

## 15. Revisi ketiga setelah uji di Galaxy A13

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Geser sedikit ke bawah langsung jatuh cepat | Aturan bantingan pendek di revisi kedua: 0,8 sel dalam 250 ms sudah cukup, jadi gerak kecil yang tidak disengaja ikut memicu. | Aturan itu dihapus. Jatuh cepat butuh 2,5 sel, atau 1,5 sel dengan kecepatan puncak minimal 20 sel per detik. |
| Tidak bisa geser lalu banting tanpa mengangkat jari | Arah dikunci untuk seluruh sentuhan; setelah mendatar, gerak tegak diabaikan. | Sentuhan dibagi menjadi segmen; gerak tegak sesudah geser memulai segmen tegak baru. |

Tes gestur di `tests/client.test.ts` ditulis ulang menjadi 13 kasus. Tiga di antaranya gagal pada versi yang sedang tayang (gerak kecil, seret pelan 2,5 sel, geser lalu banting) dan lulus sesudahnya. Di browser HP emulasi, 10 percobaan per kasus: gerak kecil cepat 0,9 sel dan seret pelan 1,6 sel tidak memicu (versi tayang: 10 dari 10 memicu); geser lalu banting memicu 10 dari 10 (versi tayang: 0).

## 16. Lapisan tumpukan (setelah pengukuran di Galaxy A13)

- `BoardRenderer` memakai tiga canvas bertumpuk: `cv-bg` (grid), `cv-stack` (blok terkunci), `cv-main` (piece aktif, ghost, kilat lock).
- `cv-stack` digambar ulang hanya jika 200 sel terlihat berbeda dari salinan terakhir (perbandingan `Uint8Array`, tanpa alokasi), atau setelah `rebuild()` (ukuran, buta warna, grid).
- Dampak: dengan tumpukan tinggi, `drawImage` per frame turun dari sekitar 64 menjadi sekitar 8 (4 piece + 4 ghost).
- Fase 4 perlu memperhatikan ini: animasi baris terhapus dan stack turun menggambar di `cv-main` atau lapisan efek, sementara `cv-stack` diperbarui sekali saat animasi selesai atau dibuat transparan selama animasi.

## 17. Fase 4 tahap 1: efek dan getar

Berkas baru:
- `render/fx.ts`: tabel intensitas (Penuh, Sedang, Minimal), `effectiveFx()` (Kurangi animasi menang), kurva `easeOut`, `easeIn`, `easeSpring`. Murni, dites.
- `render/particles.ts`: pool 300 slot dengan `Float32Array`, partikel tertua ditimpa, digambar per warna. Dites.
- `render/effects.ts`: semua efek papan sebagai angka di satu objek (kilat baris, shockwave, riak, gelombang, shake, squash, jejak, kemiringan, bingkai).
- `ui/callout.ts`: callout DOM dengan Web Animations API, satu callout aktif.
- `platform/haptics.ts`: `navigator.vibrate` dengan pola `hard`, `big`, `over`.

Perubahan:
- `BoardRenderer` menerima `Effects`. Lapisan tumpukan digambar setiap frame hanya selama animasi turun atau runtuh. Jika board berubah lagi di tengah animasi turun (piece lain terkunci), animasi dihentikan dan tumpukan langsung ke posisi akhir.
- Shake memakai `transform` CSS pada `cv-stack` dan `cv-main`, bukan menggambar ulang.
- Papan dibungkus `.board` yang ukurannya mengikuti canvas, tempat callout dan bingkai level.
- Pita ambient: elemen `.ambient` di belakang papan; warna dari `--ambient-color`, terang dari `--ambient-opacity`, gerak lewat kelas `moving` (hanya jika intensitas mengizinkan).
- `?seed=N` di URL membuat urutan piece tetap. Dipakai `tests/tools/plan-quad.ts` untuk menyusun urutan tombol yang menghasilkan Quad, supaya momen reward bisa direkam ulang di browser.
- Game Over (top out) menunggu animasi runtuh selesai sebelum dialog. Target tercapai, waktu habis, dan Akhiri sesi langsung ke dialog.

## 18. Revisi efek bertingkat (setelah uji tahap 1 di Galaxy A13)

- `fx.ts`: `clearPower(n, spin, perfect, combo)` memberi kekuatan 1 sampai 5; `SHAKE_SHARE` membagi guncangan maksimum per kekuatan. Guncangan penuh 10 px, Sedang 3 px.
- `effects.ts`: efek baru (kilat papan, pilar cahaya tiga lapis, cincin melebar, hentak papan, debu saat jatuh cepat, hujan partikel emas Bersih Total). Cahaya digambar dengan `globalCompositeOperation = "lighter"` dan `fillRect` biasa, tanpa gradien per frame. `boardTransform()` menggantikan `shakeOffset()` dan memberi geser x, y serta skala.
- Guncangan dan hentak diterapkan ke `.board` (pembungkus papan), bukan ke canvas, sehingga grid, tumpukan, piece, bingkai, dan callout bergerak bersama. `.board` memakai `will-change: transform` supaya hanya dikomposit ulang.
- `callout.ts`: parameter `power`. Durasi tampil 450, 650, atau 950 ms. Masuk dengan hentakan skala (1,9 ke 0,9 ke 1 untuk kekuatan 4 ke atas). Cahaya di belakang tulisan lewat properti CSS `--glow` (`@property`) yang dianimasikan, hanya untuk kekuatan 3 ke atas.
- `haptics.ts`: pola per kekuatan, jatuh cepat 35 ms.
- `warmUp()`: `BoardRenderer` dan `Callout` menjalankan semua jalur sekali tanpa terlihat di permainan pertama, supaya clear pertama tidak membayar biaya kompilasi.
- `perf.ts`: `perfFrame(vsync, begin, end)` dan `perfTag()`.

## 19. Aturan render supaya tidak patah-patah (dari uji Galaxy A13)

1. Elemen DOM yang dianimasikan hanya boleh diubah `transform` dan `opacity`, dan diberi `will-change` supaya punya lapisan sendiri. Jangan menganimasikan variabel CSS, `background-position`, warna, atau ukuran.
2. Teks yang berganti saat bermain (skor) harus berlebar tetap dan memakai `contain`, supaya tidak memicu tata letak dan cat ulang dokumen. Penggantian teks dibatasi sekitar 30 kali per detik.
3. Cahaya yang menutupi area besar (kilat papan, pilar) dibuat sebagai lapisan CSS dengan `mix-blend-mode: screen`, bukan digambar di canvas setiap frame. Canvas hanya untuk elemen kecil (partikel, baris, garis, cincin).
4. Cara mengukur: `rendertrace`, tracing Chrome 1 detik setelah Quad, menghitung `Paint`, `RasterTask`, `Layout`, dan elemen yang dicat ulang. Target: cat ulang dokumen tidak setiap frame.
5. Jangan memakai `mix-blend-mode` atau `will-change` permanen pada lapisan di atas papan. Lapisan efek dilepas (`hidden` atau `visibility: hidden`) saat tidak dipakai. Di A13 lapisan paduan yang selalu ada menaikkan tersendat dari 0,9% ke 6,3%.
