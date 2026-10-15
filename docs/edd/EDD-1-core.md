# EDD 1: Core

Rancangan teknis rinci untuk `src/core/` dan `tests/core.test.ts`. Sumber aturan: `docs/prd/SPEC.md`. Jika EDD dan SPEC berbeda, SPEC yang benar dan EDD diperbaiki.

Bagian EDD lain: `EDD-2-klien.md` (loop, render, input, audio, UI, i18n, penyimpanan), `EDD-3-build.md` (proyek, build, rilis, verifikasi).

---

## 1. Prinsip kode core

- Murni dan deterministik. Input: seed, konfigurasi, dan daftar aksi per tick. Output: state dan event.
- Tidak memakai `window`, `document`, `performance`, `Date`, `Math.random`, atau timer.
- Nol alokasi di dalam `step()`. Semua array dibuat sekali di `createGame()`.
- Hanya sintaks TypeScript yang bisa dihapus tanpa transformasi (lihat EDD-3 bagian 2): tidak ada `enum`, `namespace`, atau parameter property. Konstanta memakai objek `as const`.
- Import antar file memakai ekstensi `.ts`.
- Semua angka internal bilangan bulat. Gravitasi memakai fixed-point 16 bit (1 baris = 65536 unit).

## 2. Konstanta (`core/constants.ts`)

```ts
export const COLS = 10;
export const ROWS = 22;          // 20 terlihat + 2 tersembunyi
export const VISIBLE_ROWS = 20;
export const TICK_HZ = 60;
export const LOCK_TICKS = 24;    // 400 ms
export const MAX_RESETS = 15;
export const NEXT_COUNT = 5;
export const FP = 65536;         // 1 baris dalam unit gravitasi
export const MAX_G = 20 * FP;    // 20 baris per tick
```

Jenis piece:

```ts
export const PIECE = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 } as const;
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Rot = 0 | 1 | 2 | 3;   // 0, R, 2, L
```

Nilai sel di board sama dengan `PieceType`. Renderer memetakan nilai ini ke warna dan pola.

## 3. Board (`core/board.ts`)

- `Uint8Array(COLS * ROWS)`, indeks `y * COLS + x`, `y = 0` adalah baris paling bawah.
- `cellAt(b, x, y)`: mengembalikan 8 (padat) jika di luar board di sisi mana pun, termasuk di atas `ROWS`. Nilai 8 hanya dipakai untuk pengecekan tabrakan dan sudut T-Spin, tidak pernah ditulis ke board.
- `collides(b, type, rot, x, y)`: periksa 4 sel piece.
- `clearLines(b, outRows, outShift, outColors)`:
  1. Pindai `y = 0` sampai `ROWS - 1`. Baris penuh dicatat di `outRows` (maks 4) dan warnanya disalin ke `outColors` (`Uint8Array(40)`), urut dari baris terbawah.
  2. Padatkan di tempat: tulis baris tidak penuh ke indeks tulis yang naik, lalu isi sisa atas dengan 0.
  3. `outShift[j]` (`Uint8Array(22)`) berisi berapa baris baris hasil ke-`j` turun. Nilainya sama dengan jumlah baris terhapus yang berada di bawah baris aslinya. Renderer memakai ini untuk animasi stack turun.
  4. Mengembalikan jumlah baris yang dihapus.
- `isEmpty(b)`: dipakai untuk Bersih Total.

## 4. Bentuk piece (`core/piece.ts`)

Setiap piece punya kotak pembatas. Koordinat sel relatif ke sudut kiri bawah kotak, `y` ke atas. Tabel dibuat sekali sebagai `Int8Array` datar: `SHAPES[type][rot]` = 8 angka (x0, y0, x1, y1, ...).

Kotak 3x3 (J, L, S, T, Z), pusat putar di (1, 1):

| Piece | 0 | R | 2 | L |
|---|---|---|---|---|
| T | (1,2) (0,1) (1,1) (2,1) | (1,2) (1,1) (2,1) (1,0) | (0,1) (1,1) (2,1) (1,0) | (1,2) (0,1) (1,1) (1,0) |
| J | (0,2) (0,1) (1,1) (2,1) | (1,2) (2,2) (1,1) (1,0) | (0,1) (1,1) (2,1) (2,0) | (1,2) (1,1) (0,0) (1,0) |
| L | (2,2) (0,1) (1,1) (2,1) | (1,2) (1,1) (1,0) (2,0) | (0,1) (1,1) (2,1) (0,0) | (0,2) (1,2) (1,1) (1,0) |
| S | (1,2) (2,2) (0,1) (1,1) | (1,2) (1,1) (2,1) (2,0) | (1,1) (2,1) (0,0) (1,0) | (0,2) (0,1) (1,1) (1,0) |
| Z | (0,2) (1,2) (1,1) (2,1) | (2,2) (1,1) (2,1) (1,0) | (0,1) (1,1) (1,0) (2,0) | (1,2) (0,1) (1,1) (0,0) |

Kotak 4x4 (I):

| 0 | R | 2 | L |
|---|---|---|---|
| (0,2) (1,2) (2,2) (3,2) | (2,3) (2,2) (2,1) (2,0) | (0,1) (1,1) (2,1) (3,1) | (1,3) (1,2) (1,1) (1,0) |

O: (1,1) (2,1) (1,0) (2,0) untuk keempat orientasi.

Spawn (posisi kiri bawah kotak):

| Piece | x | y | Alasan |
|---|---|---|---|
| J, L, S, T, Z | 3 | 19 | Baris bawah bentuk (baris kotak 1) di y = 20 |
| I | 3 | 18 | Baris bentuk (baris kotak 2) di y = 20 |
| O | 3 | 20 | Baris bawah bentuk di y = 20, sel di kolom 4 dan 5 |

Setelah spawn tanpa tabrakan, piece langsung turun satu baris jika bisa (SPEC 2).

## 5. SRS (`core/srs.ts`)

- `KICKS_JLSTZ` dan `KICKS_I`: `Int8Array` berisi 8 transisi x 5 tes x 2 angka. Indeks transisi: `from * 2 + (cw ? 0 : 1)`, dengan urutan transisi yang sama seperti tabel SPEC 3.1 dan 3.2 (0 ke R, R ke 0, R ke 2, 2 ke R, 2 ke L, L ke 2, L ke 0, 0 ke L) yang dipetakan lewat tabel kecil `TRANSITION[from][to]`.
- Angka disalin persis dari SPEC.md bagian 3. Offset `(dx, dy)` ditambahkan ke posisi kotak.
- `tryRotate(state, dir)`:
  1. O: ganti `rot`, `kickIndex = 0`, selesai.
  2. Untuk tes 0 sampai 4: jika tidak bertabrakan di posisi `x + dx, y + dy` dengan `rot` baru, terapkan, catat `kickIndex = tes`, kembalikan `true`.
  3. Semua gagal: kembalikan `false`, state tidak berubah.

## 6. Acak (`core/rng.ts`, `core/bag.ts`)

PRNG mulberry32, state satu `uint32`:

```ts
export function nextU32(s: { v: number }): number {
  let t = (s.v = (s.v + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
```

Bag:
- `Uint8Array(16)` sebagai ring buffer dengan kepala dan jumlah isi.
- Isi ulang saat jumlah isi kurang dari `NEXT_COUNT + 1`: salin `[1..7]`, acak dengan Fisher-Yates (`j = nextU32 % (i + 1)`), lalu tambahkan ke ring.
- `take()` mengambil dari kepala. `peek(i)` membaca isi ke-`i` untuk Next tanpa alokasi.
- Seed permainan normal: diberikan dari luar oleh `ui` (dari `crypto.getRandomValues`). Core tidak tahu asal seed.

## 7. Gravitasi (`core/gravity.ts`)

Tabel unit per tick untuk level 1 sampai 19, dihitung dari rumus SPEC 6.1 lalu dibulatkan, dan ditulis sebagai konstanta (bukan dihitung saat jalan) supaya hasil identik di semua mesin JavaScript:

| Level | Detik per baris | Unit per tick |
|---|---|---|
| 1 | 1.00000 | 1092 |
| 2 | 0.79300 | 1377 |
| 3 | 0.61780 | 1768 |
| 4 | 0.47273 | 2311 |
| 5 | 0.35520 | 3075 |
| 6 | 0.26200 | 4169 |
| 7 | 0.18968 | 5759 |
| 8 | 0.13473 | 8107 |
| 9 | 0.09388 | 11634 |
| 10 | 0.06415 | 17026 |
| 11 | 0.04298 | 25416 |
| 12 | 0.02822 | 38709 |
| 13 | 0.01815 | 60169 |
| 14 | 0.01144 | 95483 |
| 15 | 0.00706 | 154742 |
| 16 | 0.00426 | 256187 |
| 17 | 0.00252 | 433425 |
| 18 | 0.00146 | 749597 |
| 19 ke atas | | 1310720 (`MAX_G`, 20 baris per tick) |

Tes memeriksa beberapa baris tabel ini terhadap rumus dengan toleransi 1 unit, supaya kesalahan ketik tertangkap.

Per tick:
```
g = mode.gravityLevel(state) -> G_TABLE
if softDrop held: g = min(g * softDropFactor, MAX_G)
acc += g
while acc >= FP and piece bisa turun: y -= 1; acc -= FP; jika softDrop: score += 1
if piece tidak bisa turun: acc = 0
```

Soft drop "Instan": piece dipindah ke `ghostY` dalam tick itu, skor +1 per sel, tanpa mengunci.

## 8. State (`core/game.ts`)

```ts
export interface GameState {
  board: Uint8Array;           // 220
  type: PieceType; rot: Rot; x: number; y: number;
  ghostY: number;
  hold: PieceType | 0; holdUsed: boolean;
  gravAcc: number;
  lockTicks: number;           // sisa tick lock delay, aktif jika grounded
  resets: number; lowestY: number; grounded: boolean; forceLock: boolean;
  softHeld: boolean;
  lastAction: 0 | 1 | 2;       // 0 none, 1 move, 2 rotate
  kickIndex: number;
  score: number; lines: number; level: number;
  combo: number;               // mulai -1
  b2b: boolean;
  quads: number; tspins: number; maxCombo: number;
  tick: number;                // tick sejak permainan mulai
  status: 0 | 1 | 2 | 3;       // 0 main, 1 game over, 2 selesai (target), 3 waktu habis
}
```

`createGame(mode, seed, cfg)` membuat state, bag, dan antrean event sekali. Objek `game` memaparkan `state` (dibaca saja di luar core), `events`, `peekNext(i)`, dan `step(actions)`.

`CoreConfig`: `{ softDropFactor: number | "instant" }`. DAS dan ARR ada di lapisan input, bukan di core.

## 9. Aksi dan urutan `step()`

Aksi (`ACT` di `core/constants.ts`):

```ts
export const ACT = {
  LEFT: 1, RIGHT: 2, ROT_CW: 3, ROT_CCW: 4, HARD: 5, HOLD: 6,
  SOFT_ON: 7, SOFT_OFF: 8,
} as const;
```

Geser berulang (DAS/ARR) sudah diubah input menjadi beberapa `LEFT`/`RIGHT` di tick yang tepat. Pause tidak masuk core.

`step(actions: ArrayLike<number>, count: number)`, satu tick:

1. Jika `status != 0`, keluar.
2. Untuk setiap aksi sesuai urutan:
   - `LEFT`/`RIGHT`: geser jika tidak bertabrakan. Jika berhasil: `lastAction = 1`, panggil `onMoved()`, event `move`.
   - `ROT_CW`/`ROT_CCW`: `tryRotate`. Jika berhasil: `lastAction = 2`, `onMoved()`, event `rotate`.
   - `HOLD`: jika `!holdUsed`, tukar atau simpan, spawn piece baru, `holdUsed = true`, event `hold`.
   - `SOFT_ON`/`SOFT_OFF`: ubah bendera soft drop.
   - `HARD`: hitung jarak ke `ghostY`, `score += 2 * jarak`, pindahkan, event `hardDrop`, lalu `lockPiece()` dan lanjut ke langkah 6.
3. Gravitasi (bagian 7).
4. Hitung ulang `grounded` dan `ghostY` jika posisi berubah. Jika `y < lowestY`: `lowestY = y`, `resets = 0`.
5. Lock delay: jika `grounded`: jika `forceLock` atau `lockTicks == 0`, `lockPiece()`. Jika tidak, `lockTicks -= 1`. Jika `lockTicks` menjadi 0, `lockPiece()`.
6. `mode.checkEnd(state)` mengisi `status` jika target tercapai.
7. `tick += 1`.

Aturan reset:
- Saat piece berubah dari tidak `grounded` menjadi `grounded`: `lockTicks = LOCK_TICKS`. Jika `resets >= MAX_RESETS`, `forceLock = true`.
- `onMoved()` (geser atau putar berhasil saat piece `grounded` sebelum aksi): jika `resets < MAX_RESETS`, `resets += 1` dan `lockTicks = LOCK_TICKS`. Jika tidak, `forceLock = true`.
- Hasilnya: 15 aksi pertama di dasar memperpanjang lock. Aksi ke-16 di dasar, atau menyentuh dasar lagi setelah 15 reset, langsung mengunci (SPEC 6.2).
- `forceLock` di-set `false` saat spawn dan saat `resets` kembali ke 0.

## 10. Lock dan skor (`core/lock.ts`, `core/score.ts`, `core/tspin.ts`)

`lockPiece()`:
1. Jika semua sel piece di `y >= VISIBLE_ROWS`: lock out, ke langkah 9.
2. Tulis sel ke board. Event `lock`.
3. `spin = detectTSpin()` (sebelum baris dihapus).
4. `n = clearLines(...)`.
5. Hitung skor per SPEC 8.6 (di bawah).
6. `lines += n`, `level` diperbarui sesuai mode.
7. Jika `n > 0`, event `clear`. Jika level naik, event `levelUp`.
8. Spawn piece berikutnya: `holdUsed = false`, `resets = 0`, `lastAction = 0`, `kickIndex = 0`, `gravAcc = 0`, `lowestY = y spawn`. Jika spawn bertabrakan: block out.
9. Top out (lock out atau block out): `mode.onTopOut()`. `"gameOver"`: `status = 1`, event `gameOver`. `"reset"` (Zen): board dikosongkan, event `zenReset`, lalu spawn ulang.

`detectTSpin()` mengembalikan 0 (bukan), 1 (Mini), atau 2 (penuh):

```
if type != T or lastAction != 2: return 0
cx = x + 1, cy = y + 1
corners A=(cx-1,cy+1) B=(cx+1,cy+1) C=(cx-1,cy-1) D=(cx+1,cy-1)   // sel di luar board dihitung terisi
filled = jumlah sudut terisi
if filled < 3: return 0
front = FRONT[rot]      // 0: A,B  R: B,D  2: C,D  L: A,C
if kedua sudut depan terisi: return 2
if kickIndex == 4: return 2
return 1
```

Skor (bilangan bulat, level = level sebelum baris aksi ini ditambahkan):

```
BASE      = [0, 100, 300, 500, 800]
TSPIN     = [400, 800, 1200, 1600]
MINI      = [100, 200, 400]
PC        = [0, 800, 1200, 1800, 2000]
PC_B2B_Q  = 3200

action = spin==2 ? TSPIN[n] : spin==1 ? MINI[n] : BASE[n]
hard   = n > 0 and (n == 4 or spin > 0)
if hard and b2b: action = floor(action * 3 / 2)
points = action * level
if n > 0:
  if hard: b2b = true
  else if spin == 0: b2b = false
  combo += 1
  if combo >= 1: points += 50 * combo * level
  if isEmpty(board): points += (n == 4 and b2bSebelumnya ? PC_B2B_Q : PC[n]) * level
else:
  combo = -1
score += points
```

`b2bSebelumnya` adalah nilai `b2b` sebelum aksi ini. Statistik: `quads` bertambah untuk n = 4, `tspins` bertambah untuk setiap spin dengan atau tanpa baris, `maxCombo = max(maxCombo, combo)`.

Event `clear` membawa rincian: `action`, `b2bApplied`, `comboBonus`, `pcBonus`, `total`, `n`, `spin`, `combo`, `perfect`, `rows`, `shift`, `colors`. Angka melayang di layar diambil dari `total`.

## 11. Event (`core/events.ts`)

Antrean berkapasitas 64. Setiap slot adalah objek yang dibuat sekali dengan semua field:

```ts
export interface GameEvent {
  type: number;                 // EV.*
  a: number; b: number; c: number;   // field umum, arti per jenis
  cells: Int8Array;             // 8: posisi sel piece (lock, hardDrop)
  rows: Int8Array;              // 4: baris terhapus, -1 jika kosong
  shift: Uint8Array;            // 22: pergeseran baris (clear)
  colors: Uint8Array;           // 40: warna baris terhapus (clear)
  score: Int32Array;            // 5: action, b2b, combo, pc, total (clear)
}
export const EV = {
  MOVE: 1, ROTATE: 2, SOFT: 3, HARD: 4, LOCK: 5, CLEAR: 6, HOLD: 7,
  LEVEL_UP: 8, SPAWN: 9, ZEN_RESET: 10, GAME_OVER: 11, FINISH: 12, TIME_UP: 13,
} as const;
```

Arti `a`, `b`, `c`:

| Event | a | b | c |
|---|---|---|---|
| MOVE | arah (-1, 1) | | |
| ROTATE | arah (1 CW, -1 CCW) | kickIndex | jenis piece |
| SOFT | sel turun | | |
| HARD | jarak | jenis piece | |
| LOCK | jenis piece | | |
| CLEAR | n | spin (0, 1, 2) | combo |
| LEVEL_UP | level baru | | |
| SPAWN | jenis piece | | |
| GAME_OVER | 0 block out, 1 lock out | | |

Bendera B2B dan Bersih Total dibawa di `score[1] > 0` dan `score[3] > 0`.

API: `events.count`, `events.at(i)`, `events.clear()`. Penulis yang menemukan antrean penuh membuang event `MOVE` dan `SOFT` lebih dulu, karena keduanya hanya untuk suara.

## 12. Mode (`core/modes.ts`)

```ts
export interface Mode {
  id: "marathon150" | "marathonEndless" | "sprint40" | "ultra" | "zen";
  levelFor(lines: number): number;
  checkEnd(s: GameState): 0 | 2 | 3;
  onTopOut(s: GameState): "gameOver" | "reset";
}
```

| Mode | `levelFor` | `checkEnd` | `onTopOut` |
|---|---|---|---|
| marathon150 | `1 + floor(lines / 10)` | `lines >= 150` jadi 2 | gameOver |
| marathonEndless | sama | 0 | gameOver |
| sprint40 | selalu 1 | `lines >= 40` jadi 2 | gameOver |
| ultra | `1 + floor(lines / 10)` | `tick >= 7200` jadi 3 | gameOver |
| zen | selalu 1 | 0 | reset |

Waktu tampil: `ms = floor(tick * 1000 / 60)`. Sprint mencatat `ms` di tick `status` menjadi 2. Ultra menampilkan `120000 - ms`.

## 13. Tes (`tests/core.test.ts`)

Dijalankan dengan `npm test` (EDD-3). Memakai `node:test` dan `node:assert/strict`. Helper kecil di file yang sama:
- `boardFrom(rows: string[])`: membangun board dari baris teks (baris pertama paling atas, `#` terisi, `.` kosong).
- `place(game, type, rot, x, y)`: menaruh piece aktif langsung (hanya untuk tes, lewat fungsi `debugSetActive` yang diekspor dari `game.ts`).
- `run(game, ticks, actions?)`.

| No | Kelompok | Kasus dan hasil yang diharapkan |
|---|---|---|
| 1 | Kick SRS | Tabel di tes disalin dari SPEC 3.1 dan 3.2. Setiap angka sama dengan `KICKS_JLSTZ` dan `KICKS_I`. |
| 2 | Kick SRS | Putar T dari R ke 2 di board kosong: `kickIndex = 0`. |
| 3 | Kick SRS | I tegak menempel dinding kanan, putar ke 0: berhasil dengan `kickIndex > 0`, semua sel di dalam board. |
| 4 | Kick SRS | O diputar: sel tidak berubah, `kickIndex = 0`. |
| 5 | 7-bag | Untuk seed 1, 2, dan 3: setiap 7 piece pertama, kedua, sampai kesepuluh (70 piece) berisi ketujuh jenis tepat sekali. |
| 6 | 7-bag | Seed sama, urutan 70 piece sama. Seed berbeda, urutan berbeda. |
| 7 | Gravitasi | Baris tabel level 1, 10, dan 18 cocok dengan rumus dengan toleransi 1. |
| 8 | Skor | Single, Double, Triple, Quad di level 1 dari board yang disiapkan: 100, 300, 500, 800. |
| 9 | Skor | Quad lalu Quad berturut-turut di level 1: kedua bernilai 1200 + 50 (combo 1) = 1250. |
| 10 | Skor | Quad, Single, Quad (masing-masing clear berturut-turut): Single mematikan B2B, jadi Quad kedua 800 + combo 2 (100) = 900. |
| 11 | Skor | Lock tanpa clear mengembalikan combo ke -1. |
| 12 | Skor | Quad yang mengosongkan board dari kondisi B2B aktif: pc = 3200. Single yang mengosongkan board: 100 + 800. |
| 13 | Skor | Hard drop 10 sel: +20, tidak dikali level (level diset 5). |
| 14 | T-Spin | Board TSD di bawah, T di posisi R kotak (3, 0), putar CW, hard drop: spin 2, n 2, skor 1200. |
| 15 | T-Spin | Sama tetapi geser kiri lalu kanan setelah putar: `lastAction = 1`, spin 0. |
| 16 | T-Spin | Kasus Mini: hanya satu sudut depan terisi, `kickIndex < 4`: spin 1. |
| 17 | T-Spin | Kasus sama dengan `kickIndex = 4`: spin 2. |
| 18 | Lock delay | Piece menyentuh dasar tanpa input: belum terkunci di tick ke-23, terkunci di tick ke-24. |
| 19 | Lock delay | 15 geser bolak-balik di dasar memperpanjang lock. Geser ke-16 tidak mereset dan piece terkunci di tick itu. |
| 20 | Lock delay | Setelah 15 reset, piece jatuh ke baris lebih rendah: `resets = 0`. |
| 21 | Tanpa jeda | Clear di tick t, event SPAWN piece baru di tick t yang sama, dan piece bisa digeser di tick t + 1. |
| 22 | Mode | Sprint selesai di baris 40 dengan `status = 2`. Ultra `status = 3` di tick 7200. Zen top out mengosongkan board dan skor tetap. |
| 23 | Hold | Hold kedua dalam satu piece tidak berpengaruh. Setelah lock, hold bisa lagi. |
| 24 | Replay | Seed dan daftar aksi acak yang sama dijalankan dua kali: board dan skor akhir identik. |
| 25 | i18n | `Object.keys(id)` dan `Object.keys(en)` identik setelah diurutkan, dan tidak ada nilai string kosong. |

Board TSD untuk kasus 14 (baris atas ke bawah, kolom 0 sampai 9):

```
y=2  ...#......
y=1  ###...####
y=0  ####.#####
```

T posisi R di kotak (3, 0) menempati (4,2) (4,1) (5,1) (4,0). Putar CW ke posisi 2 tanpa kick menempati (3,1) (4,1) (5,1) (4,0). Sudut di sekitar pusat (4,1): (3,0), (5,0), dan (3,2) terisi. Sudut depan posisi 2 adalah (3,0) dan (5,0), jadi T-Spin penuh dan dua baris terhapus.

Kasus 15 sampai 17 memakai board berikut (y ke atas): `y=0 .#........`, dan `y=5 ........##` hanya untuk mencegah Bersih Total. T posisi 0 di kotak (0, 0) diputar CW: tes 1 dan 2 gagal karena lantai, jadi memakai kick ke posisi R di kotak (-1, 0). Pusat (0, 1). Sudut A (-1, 2) dan C (-1, 0) adalah dinding, D (1, 0) terisi, dan B (1, 2) kosong. Sudut depan R adalah B dan D, hanya satu yang terisi, jadi hasilnya Mini. Kasus 17 memanggil `detectTSpin` langsung dengan `kickIndex` 1 dan 4 di posisi yang sama.

## 14. Catatan implementasi Fase 1

Perbedaan kecil antara rancangan di atas dan kode yang sudah lulus tes. Kode adalah acuan untuk hal-hal ini.

- `GameState` ditambah `pieces` (jumlah piece yang sudah muncul). Dipakai untuk konfirmasi Pause (DESIGN 7.3) dan tes lock.
- `lastAction` dan `status` bertipe `number` dengan konstanta `STATUS` dan nilai 0, 1, 2 di `game.ts`.
- Skor dihitung oleh `scoreLock()` di `score.ts` yang mengisi `Int32Array` hasil, supaya bisa dites tanpa board.
- Event `CLEAR` juga dipancarkan untuk T-Spin tanpa baris (`a = 0`), karena momen itu punya callout dan suara sendiri.
- `cellAt` menganggap sel di atas `ROWS` padat. Piece tidak pernah mencapai baris itu karena spawn di y 20.
- Tes ditulis sebagai 28 kasus: kasus 22 dipecah menjadi 22a sampai 22d.
