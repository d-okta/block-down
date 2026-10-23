// Rekaman permainan untuk leaderboard (PRD-7). Server memutar ulang rekaman ini dengan core yang sama
// dan menghitung skor sendiri, jadi skor yang dikirim dari perangkat tidak dipercaya begitu saja.
//
// Format ringkas (Uint8Array, lalu base64): untuk setiap tick yang punya aksi:
//   [jeda tick sejak catatan sebelumnya sebagai varint] [jumlah aksi] [aksi...]
// Tick tanpa aksi tidak dicatat; panjang total permainan dikirim terpisah sebagai `ticks`.
// softDropFactor awal ikut dikirim karena memengaruhi gravitasi saat tombol bawah ditahan. Perubahan
// di tengah permainan (Pause > Pengaturan) dicatat sebagai kode SOFT_CODE di antara aksi tick itu,
// dan diterapkan sebelum tick dijalankan. Rekaman yang sama dipakai untuk menyimpan permainan yang
// sedang berjalan (PRD-8): lanjut = putar ulang sampai tick terakhir.
import { STATUS, createGame, type Game } from "./game.ts";
import type { ModeId } from "./modes.ts";

/** Kode konfigurasi di rekaman: SOFT_CODE + i, i = 0..7 untuk 5x..40x, 8 untuk instan. */
const SOFT_CODE = 9;
const SOFT_STEPS = [5, 10, 15, 20, 25, 30, 35, 40] as const;
export function softCode(soft: number | "instant"): number {
  return SOFT_CODE + (soft === "instant" ? 8 : Math.max(0, SOFT_STEPS.indexOf(soft as (typeof SOFT_STEPS)[number])));
}
function softOf(code: number): number | "instant" {
  return code === SOFT_CODE + 8 ? "instant" : SOFT_STEPS[code - SOFT_CODE]!;
}

export interface Replay {
  mode: ModeId;
  seed: number;
  ticks: number;
  soft: number | "instant";
  /** Base64 dari format di atas. */
  data: string;
}

export interface ReplayResult {
  score: number;
  lines: number;
  level: number;
  /** Waktu Sprint dalam ms jika selesai (40 baris), selain itu null. */
  sprintMs: number | null;
  status: number;
}

/** Batas supaya rekaman rusak atau berbahaya tidak membuat server bekerja tanpa akhir. */
export const MAX_TICKS = 60 * 60 * 60; // 1 jam permainan
export const MAX_BYTES = 400_000;
const MAX_ACTIONS_PER_TICK = 32;

export class ReplayRecorder {
  private buf = new Uint8Array(4096);
  private len = 0;
  private lastTick = 0;
  private hasEntry = false;
  /** Kode konfigurasi yang menunggu dicatat bersama aksi tick berikutnya. */
  private pendingCfg = -1;
  ticks = 0;

  /** Lanjutkan rekaman yang sudah ada (permainan tersimpan). */
  static from(bytes: Uint8Array, ticks: number, lastTick: number): ReplayRecorder {
    const r = new ReplayRecorder();
    r.ensure(bytes.length + 64);
    r.buf.set(bytes);
    r.len = bytes.length;
    r.ticks = ticks;
    r.lastTick = lastTick;
    r.hasEntry = bytes.length > 0;
    return r;
  }

  /** Jatuh pelan diubah: dicatat di tick berikutnya, sebelum aksinya. */
  setSoft(soft: number | "instant"): void {
    this.pendingCfg = softCode(soft);
  }

  /** Dipanggil setiap tick, sebelum game.step, dengan aksi tick itu. */
  record(tick: number, actions: ArrayLike<number>, count: number): void {
    this.ticks = tick + 1;
    const cfg = this.pendingCfg >= 0 ? 1 : 0;
    if (count === 0 && !cfg) return;
    const n = Math.min(count, MAX_ACTIONS_PER_TICK - cfg);
    this.ensure(8 + n + cfg);
    this.varint(this.hasEntry ? tick - this.lastTick : tick);
    this.hasEntry = true;
    this.lastTick = tick;
    this.buf[this.len++] = n + cfg;
    if (cfg) {
      this.buf[this.len++] = this.pendingCfg;
      this.pendingCfg = -1;
    }
    for (let i = 0; i < n; i++) this.buf[this.len++] = actions[i]!;
  }

  /** Tick catatan terakhir (untuk melanjutkan rekaman). */
  get last(): number {
    return this.lastTick;
  }

  bytes(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }

  private varint(v: number): void {
    while (v >= 0x80) {
      this.buf[this.len++] = (v & 0x7f) | 0x80;
      v >>>= 7;
    }
    this.buf[this.len++] = v;
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + extra));
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
}

export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array | null {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Putar ulang rekaman dari awal. Mengembalikan null jika rekaman tidak sah (format rusak, aksi di luar
 * rentang, melebihi batas, atau masih ada aksi setelah permainan berakhir).
 */
export function replay(r: Replay): ReplayResult | null {
  const game = replayGame(r);
  if (!game) return null;
  const s = game.state;
  return {
    score: s.score,
    lines: s.lines,
    level: s.level,
    sprintMs: r.mode === "sprint40" && s.status === STATUS.FINISHED ? Math.floor((s.tick * 1000) / 60) : null,
    status: s.status,
  };
}

/**
 * Putar ulang dan kembalikan game-nya (untuk melanjutkan permainan tersimpan, PRD-8), beserta tick
 * catatan terakhir supaya rekaman bisa dilanjutkan. null jika rekaman tidak sah.
 */
export function replayGame(r: Replay): (Game & { lastEntry: number; soft: number | "instant" }) | null {
  if (!Number.isSafeInteger(r.seed) || !Number.isSafeInteger(r.ticks) || r.ticks < 1 || r.ticks > MAX_TICKS) return null;
  if (!(r.soft === "instant" || (Number.isSafeInteger(r.soft) && r.soft >= 5 && r.soft <= 40 && r.soft % 5 === 0))) return null;
  const bytes = fromBase64(r.data);
  if (!bytes || bytes.length > MAX_BYTES) return null;

  // Urai seluruh rekaman dulu: daftar (tick, posisi aksi, jumlah aksi). Rekaman rusak ditolak di sini.
  const entryTick: number[] = [];
  const entryPos: number[] = [];
  let pos = 0;
  let tick = 0;
  while (pos < bytes.length) {
    let gap = 0;
    let shift = 0;
    for (;;) {
      if (pos >= bytes.length || shift > 28) return null;
      const b = bytes[pos++]!;
      gap |= (b & 0x7f) << shift;
      if (b < 0x80) break;
      shift += 7;
    }
    tick += gap >>> 0;
    if (entryTick.length > 0 && gap === 0) return null; // dua catatan di tick yang sama
    if (pos >= bytes.length) return null;
    const n = bytes[pos++]!;
    if (n < 1 || n > MAX_ACTIONS_PER_TICK || pos + n > bytes.length) return null;
    for (let i = 0; i < n; i++) {
      const a = bytes[pos + i]!;
      // 1..8 aksi core; 9..17 perubahan jatuh pelan, hanya boleh di urutan pertama tick itu.
      if (a < 1 || a > SOFT_CODE + 8 || (a >= SOFT_CODE && i !== 0)) return null;
    }
    entryTick.push(tick);
    entryPos.push(pos - 1);
    pos += n;
  }
  if (entryTick.length > 0 && entryTick[entryTick.length - 1]! >= r.ticks) return null;

  let soft = r.soft;
  const game: Game = createGame(r.mode, r.seed, { softDropFactor: soft });
  let e = 0;
  for (let t = 0; t < r.ticks; t++) {
    // Tick setelah permainan berakhir tidak sah: perangkat berhenti merekam saat permainan berakhir.
    if (game.state.status !== STATUS.PLAYING) return null;
    game.events.clear();
    if (e < entryTick.length && entryTick[e] === t) {
      const p = entryPos[e]!;
      let from = p + 1;
      let n = bytes[p]!;
      if (bytes[from]! >= SOFT_CODE) {
        soft = softOf(bytes[from]!);
        game.setConfig({ softDropFactor: soft });
        from++;
        n--;
      }
      game.step(bytes.subarray(from, from + n), n);
      e++;
    } else {
      game.step(bytes.subarray(0, 0), 0);
    }
  }
  return Object.assign(game, { lastEntry: entryTick.length > 0 ? entryTick[entryTick.length - 1]! : 0, soft });
}
