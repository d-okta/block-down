import { COLS, VISIBLE_ROWS, type PieceType, type Rot } from "../core/constants.ts";
import { SHAPES, shapeOffset } from "../core/piece.ts";
import type { GameState } from "../core/game.ts";
import { buildAtlas, ROW_ACTIVE, ROW_BLOCK, ROW_FLASH, ROW_GHOST, type Atlas } from "./sprites.ts";
import { THEMES, type Theme } from "./themes.ts";
import { Effects } from "./effects.ts";
import { easeIn, easeOut, easeSpring } from "./fx.ts";

const LOCK_FLASH_MS = 90;
/** Tumpukan turun ke posisi akhir (DESIGN 8.3: Quad mulai 450 ms, lainnya lebih cepat). */
const DROP_MS = 160;
/** Runtuh saat Game Over (DESIGN 7.4). */
const COLLAPSE_MS = 700;
const COLLAPSE_STAGGER = 25;

/**
 * Menggambar board, ghost, piece aktif, dan efek. Hanya membaca state core.
 * Tiga lapisan canvas:
 * - latar (grid): digambar ulang hanya saat ukuran atau pengaturan berubah;
 * - tumpukan (blok yang sudah terkunci): digambar ulang hanya saat isi board berubah,
 *   atau setiap frame selama animasi tumpukan turun dan runtuh;
 * - utama: piece aktif, ghost, kilat lock, dan efek, setiap frame.
 * Tumpukan dipisah setelah uji di Galaxy A13: menggambar ulang sekitar 200 blok setiap frame
 * membuat waktu kerja p99 sekitar 14 ms dari anggaran 16,7 ms.
 */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private bgCtx: CanvasRenderingContext2D;
  private stackCtx: CanvasRenderingContext2D;
  private atlas: Atlas | null = null;
  private cell = 0; // piksel perangkat
  private dpr = 1;
  ghost = true;
  grid = true;
  colorSafe = false;
  theme: Theme = THEMES.classic;
  readonly fx: Effects;
  // Kilat lock.
  private flashCells = new Int8Array(8);
  private flashType = 0;
  private flashStart = -1;
  private main: HTMLCanvasElement;
  private bg: HTMLCanvasElement;
  private stack: HTMLCanvasElement;
  /** Salinan isi board terakhir yang digambar di lapisan tumpukan. */
  private drawn = new Uint8Array(COLS * VISIBLE_ROWS);
  private stackValid = false;
  // Tumpukan turun setelah baris dihapus: shift[j] = berapa baris baris hasil j turun.
  private shift = new Uint8Array(VISIBLE_ROWS);
  private dropT = -1;
  private dropDelay = 0;
  /** Board baru setelah clear belum digambar. Perubahan board lain selama animasi membatalkan animasi. */
  private dropFresh = false;
  private dropProgress = -1;
  // Runtuh saat Game Over.
  private collapseT = -1;
  private readonly shakeOut = new Float32Array(3);
  /** Elemen pembungkus papan yang digeser saat shake. */
  wrap: HTMLElement | null = null;
  private lastNow = 0;

  constructor(main: HTMLCanvasElement, stack: HTMLCanvasElement, bg: HTMLCanvasElement, fx: Effects) {
    this.main = main;
    this.stack = stack;
    this.bg = bg;
    this.fx = fx;
    this.ctx = main.getContext("2d", { alpha: true })!;
    this.stackCtx = stack.getContext("2d", { alpha: true })!;
    this.bgCtx = bg.getContext("2d")!;
  }

  /** availW/availH dalam piksel CSS. Mengembalikan ukuran sel CSS. */
  resize(availW: number, availH: number, dpr: number): number {
    this.dpr = dpr;
    const cell = Math.max(1, Math.floor(Math.min(availH / VISIBLE_ROWS, availW / COLS) * dpr));
    if (cell === this.cell && this.atlas) return cell / dpr;
    this.cell = cell;
    this.fx.cell = cell;
    this.fx.dpr = dpr;
    for (const c of [this.main, this.stack, this.bg]) {
      c.width = cell * COLS;
      c.height = cell * VISIBLE_ROWS;
      c.style.width = `${(cell * COLS) / dpr}px`;
      c.style.height = `${(cell * VISIBLE_ROWS) / dpr}px`;
    }
    this.rebuild();
    return cell / dpr;
  }

  /** Bangun ulang sprite dan latar (ukuran, buta warna, atau grid berubah). */
  rebuild(): void {
    if (this.cell === 0) return;
    this.atlas = buildAtlas(this.cell, this.dpr, this.colorSafe, this.theme);
    this.stackValid = false;
    const g = this.bgCtx;
    g.clearRect(0, 0, this.bg.width, this.bg.height);
    if (!this.grid) return;
    g.fillStyle = this.theme.grid;
    const lw = Math.max(1, Math.round(this.dpr));
    for (let x = 1; x < COLS; x++) g.fillRect(x * this.cell, 0, lw, this.bg.height);
    for (let y = 1; y < VISIBLE_ROWS; y++) g.fillRect(0, y * this.cell, this.bg.width, lw);
  }

  /**
   * Jalankan semua jalur efek sekali di luar layar sebelum permainan, supaya mesin JavaScript sudah
   * mengompilasinya. Tanpa ini, clear pertama sejak halaman dimuat sekitar 3 kali lebih berat
   * (diukur di Chrome dengan CPU diperlambat), dan di Galaxy A13 tercatat satu frame 272 ms.
   */
  warmUp(now: number): void {
    if (this.cell === 0 || !this.atlas) return;
    const fx = this.fx;
    const rows = Int8Array.of(0, 1, 2, 3);
    const colors = new Uint8Array(40).fill(3);
    const cells = Int8Array.of(4, 0, 5, 0, 4, 1, 5, 1);
    const shift = new Uint8Array(VISIBLE_ROWS);
    fx.lineClear(now, 4, rows, colors, 4);
    fx.tspin(now, 4, 2, true);
    fx.perfectClear(now);
    fx.levelUp(now);
    fx.hardDrop(now, cells, 8, 3);
    fx.kick(now, 1);
    this.stackDrop(shift, now, 4);
    const out = this.shakeOut;
    const ctx = this.ctx;
    // Beberapa titik waktu, supaya semua cabang (awal, tengah, akhir) dijalankan.
    const lights = new Float32Array(6);
    for (const dt of [0, 90, 200, 400]) {
      fx.boardTransform(now + dt, out);
      fx.lightLayers(now + dt, lights);
      fx.squash(now + dt);
      fx.tilt(now + dt);
      fx.draw(ctx, now + dt, 0.016, this.main.width, this.main.height);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.main.width, this.main.height);
    this.reset();
  }

  /** Permainan baru: hentikan semua animasi. */
  reset(): void {
    this.dropT = -1;
    this.collapseT = -1;
    this.flashStart = -1;
    this.stackValid = false;
    this.fx.reset();
  }

  lockFlash(cells: Int8Array, type: number, now: number): void {
    this.flashCells.set(cells);
    this.flashType = type;
    this.flashStart = now;
  }

  /**
   * Baris dihapus: tumpukan di atasnya turun dengan animasi. Logika core sudah selesai;
   * ini hanya offset visual yang meluruh (DESIGN 8.3, catatan penting).
   */
  stackDrop(shift: Uint8Array, now: number, power: number): void {
    if (this.fx.fx.level === "minimal") return;
    this.shift.set(shift.subarray(0, VISIBLE_ROWS));
    this.dropT = now;
    // Momen besar menahan tumpukan lebih lama supaya ledakan terlihat dulu (storyboard 4 Baris: 450 ms).
    this.dropDelay = power >= 4 ? 450 : power === 3 ? 260 : 140;
    this.dropFresh = true;
    this.dropProgress = -1;
  }

  collapse(now: number): void {
    this.collapseT = now;
    this.dropT = -1;
  }

  /** true selama animasi runtuh Game Over berjalan. */
  collapsing(now: number): boolean {
    const total = this.fx.fx.level === "minimal" ? COLLAPSE_MS : COLLAPSE_MS + COLLAPSE_STAGGER * VISIBLE_ROWS;
    return this.collapseT >= 0 && now - this.collapseT < total;
  }

  /**
   * fallFrom: y piece sebelum tick terakhir, atau NaN. Jika piece turun tepat satu baris
   * karena gravitasi, posisinya diinterpolasi supaya jatuh terlihat halus (EDD-2 bagian 3.4).
   */
  draw(s: Readonly<GameState>, fallFrom: number, alpha: number, now: number, showPiece: boolean): void {
    const atlas = this.atlas;
    if (!atlas) return;
    const dt = this.lastNow > 0 ? Math.min(0.05, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    const ctx = this.ctx;
    const c = this.cell;
    const w = this.main.width;
    const h = this.main.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Shake dan hentak: seluruh papan (grid, tumpukan, piece, bingkai, callout) bergerak bersama lewat transform CSS.
    const shaking = this.fx.boardTransform(now, this.shakeOut);
    if (this.wrap && (shaking || this.wasShaking)) {
      const o = this.shakeOut;
      this.wrap.style.transform = shaking ? `translate(${o[0]!.toFixed(2)}px, ${o[1]!.toFixed(2)}px) scale(${o[2]!.toFixed(4)})` : "";
      this.wasShaking = shaking;
    }

    this.drawStack(s.board, now);

    if (this.flashStart >= 0) {
      const p = (now - this.flashStart) / LOCK_FLASH_MS;
      if (p >= 1) this.flashStart = -1;
      else {
        ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 8; i += 2) {
          const y = this.flashCells[i + 1]!;
          if (y >= VISIBLE_ROWS) continue;
          const dy = (VISIBLE_ROWS - 1 - y) * c;
          ctx.drawImage(atlas.canvas, this.flashType * c, ROW_FLASH * c, c, c, this.flashCells[i]! * c, dy, c, c);
        }
        ctx.globalAlpha = 1;
      }
    }

    if (showPiece) {
      if (this.ghost && s.ghostY !== s.y) this.drawPiece(s.type, s.rot, s.x, s.ghostY, ROW_GHOST, 0);
      const smooth = fallFrom - s.y === 1 ? (1 - alpha) * c : 0;
      const tilt = this.fx.tilt(now);
      const squash = this.fx.squash(now);
      if (tilt !== 0 || squash !== 1) {
        // Putar atau pipihkan di sekitar pusat kotak piece, lalu kembali.
        const o = shapeOffset(s.type, s.rot);
        let minX = 9, maxX = -9, minY = 99, maxY = -99;
        for (let i = 0; i < 8; i += 2) {
          const x = s.x + SHAPES[o + i]!;
          const y = s.y + SHAPES[o + i + 1]!;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const px = ((minX + maxX + 1) / 2) * c;
        const bottom = (VISIBLE_ROWS - minY) * c - smooth;
        const py = squash !== 1 ? bottom : ((VISIBLE_ROWS - 1 - (minY + maxY) / 2) + 0.5) * c - smooth;
        ctx.translate(px, py);
        if (tilt !== 0) ctx.rotate(tilt);
        if (squash !== 1) ctx.scale(1 + (1 - squash) * 0.5, squash);
        ctx.translate(-px, -py);
        this.drawPiece(s.type, s.rot, s.x, s.y, ROW_ACTIVE, -smooth);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        this.drawPiece(s.type, s.rot, s.x, s.y, ROW_ACTIVE, -smooth);
      }
    }

    this.fx.draw(ctx, now, dt, w, h);
  }

  private wasShaking = false;

  /**
   * Lapisan tumpukan: dari cache jika tidak berubah; digambar ulang saat isi board berubah,
   * dan setiap frame selama animasi turun atau runtuh.
   */
  private drawStack(b: Uint8Array, now: number): void {
    const n = COLS * VISIBLE_ROWS;
    const c = this.cell;
    const g = this.stackCtx;
    const atlas = this.atlas!;

    if (this.collapseT >= 0) {
      // Runtuh: setiap baris jatuh keluar papan dan memudar, baris bawah lebih dulu.
      g.clearRect(0, 0, this.stack.width, this.stack.height);
      const t = now - this.collapseT;
      const minimal = this.fx.fx.level === "minimal";
      for (let y = 0; y < VISIBLE_ROWS; y++) {
        const p = minimal ? Math.min(1, t / COLLAPSE_MS) : Math.max(0, Math.min(1, (t - y * COLLAPSE_STAGGER) / COLLAPSE_MS));
        if (p >= 1) continue;
        g.globalAlpha = minimal ? 1 - p : 1 - easeIn(p) * 0.85;
        const off = minimal ? 0 : easeIn(p) * this.stack.height * 0.9;
        const dy = (VISIBLE_ROWS - 1 - y) * c + off;
        for (let x = 0; x < COLS; x++) {
          const v = b[y * COLS + x]!;
          if (v !== 0) g.drawImage(atlas.canvas, v * c, ROW_BLOCK * c, c, c, x * c, dy, c, c);
        }
      }
      g.globalAlpha = 1;
      this.stackValid = false;
      return;
    }

    let same = this.stackValid || this.dropT >= 0;
    if (same) {
      for (let i = 0; i < n; i++) {
        if (b[i] !== this.drawn[i]) {
          same = false;
          break;
        }
      }
    }

    let progress = 1;
    if (this.dropT >= 0) {
      if (!same && !this.dropFresh) {
        // Piece lain terkunci di tengah animasi: offset lama tidak berlaku lagi, langsung ke posisi akhir.
        this.dropT = -1;
      } else {
        this.dropFresh = false;
        const t = now - this.dropT - this.dropDelay;
        progress = t <= 0 ? 0 : Math.min(1, t / DROP_MS);
        if (progress >= 1) {
          this.dropT = -1;
          same = false; // gambar sekali lagi di posisi akhir tanpa offset
        }
      }
    }
    const animating = this.dropT >= 0;

    if (animating) {
      // Selama jeda sebelum turun, gambarnya tetap: cukup digambar sekali.
      if (same && progress === this.dropProgress) return;
      this.dropProgress = progress;
    } else if (same && this.stackValid) {
      return;
    }
    this.drawn.set(b.subarray(0, n));
    this.stackValid = !animating;
    g.clearRect(0, 0, this.stack.width, this.stack.height);
    const ease = this.fx.fx.bounce ? easeSpring(progress) : easeOut(progress);
    for (let y = 0; y < VISIBLE_ROWS; y++) {
      // Selama animasi, baris hasil j masih tampil `shift[j]` baris lebih tinggi, lalu turun.
      const lift = animating ? this.shift[y]! * c * (1 - ease) : 0;
      const dy = (VISIBLE_ROWS - 1 - y) * c - lift;
      for (let x = 0; x < COLS; x++) {
        const v = b[y * COLS + x]!;
        if (v !== 0) g.drawImage(atlas.canvas, v * c, ROW_BLOCK * c, c, c, x * c, dy, c, c);
      }
    }
  }

  private drawPiece(type: PieceType, rot: Rot, px: number, py: number, row: number, offsetY: number): void {
    const atlas = this.atlas!;
    const c = this.cell;
    const o = shapeOffset(type, rot);
    for (let i = 0; i < 8; i += 2) {
      const x = px + SHAPES[o + i]!;
      const y = py + SHAPES[o + i + 1]!;
      const dy = (VISIBLE_ROWS - 1 - y) * c + offsetY;
      if (dy + c <= 0) continue; // baris tersembunyi
      this.ctx.drawImage(atlas.canvas, type * c, row * c, c, c, x * c, dy, c, c);
    }
  }
}

/** Pratinjau kecil untuk Simpan dan Antrean. Digambar ulang hanya saat isinya berubah. */
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D;
  private atlas: Atlas | null = null;
  private cell = 0;
  private dpr = 1;
  private colorSafe = false;
  private theme: Theme = THEMES.classic;
  private last = new Int8Array(6).fill(-1); // isi slot + redup, untuk melewati gambar ulang

  private canvas: HTMLCanvasElement;
  private slots: number;
  /** true: slot berjajar mendatar (antrean di atas papan). */
  horizontal = false;

  constructor(canvas: HTMLCanvasElement, slots: number) {
    this.canvas = canvas;
    this.slots = slots;
    this.ctx = canvas.getContext("2d")!;
  }

  /** cssCell: ukuran sel mini dalam piksel CSS. Setiap slot berukuran 4x3 sel (mendatar: 5x3). */
  resize(cssCell: number, dpr: number, colorSafe: boolean, theme: Theme = this.theme): void {
    const cell = Math.max(1, Math.round(cssCell * dpr));
    if (cell === this.cell && dpr === this.dpr && colorSafe === this.colorSafe && theme === this.theme) return;
    this.cell = cell;
    this.dpr = dpr;
    this.colorSafe = colorSafe;
    this.theme = theme;
    this.atlas = buildAtlas(cell, dpr, colorSafe, theme);
    const w = this.horizontal ? cell * 5 * this.slots : cell * 4;
    const h = this.horizontal ? cell * 3 : cell * 3 * this.slots;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w / dpr}px`;
    this.canvas.style.height = `${h / dpr}px`;
    this.last.fill(-1);
  }

  /** types: daftar jenis piece (0 = kosong). dim: redupkan (Simpan terkunci). */
  draw(types: ArrayLike<number>, dim: boolean): void {
    if (!this.atlas) return;
    let same = this.last[5] === (dim ? 1 : 0);
    for (let i = 0; i < types.length && same; i++) same = this.last[i] === types[i];
    if (same) return;
    for (let i = 0; i < types.length; i++) this.last[i] = types[i]!;
    this.last[5] = dim ? 1 : 0;
    const ctx = this.ctx;
    const c = this.cell;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = dim ? 0.4 : 1;
    for (let slot = 0; slot < types.length; slot++) {
      const type = types[slot]! as PieceType | 0;
      if (type === 0) continue;
      const o = shapeOffset(type, 0);
      // Pusatkan bentuk di slot 4x3 sel.
      let minX = 9, maxX = -9, minY = 9, maxY = -9;
      for (let i = 0; i < 8; i += 2) {
        minX = Math.min(minX, SHAPES[o + i]!);
        maxX = Math.max(maxX, SHAPES[o + i]!);
        minY = Math.min(minY, SHAPES[o + i + 1]!);
        maxY = Math.max(maxY, SHAPES[o + i + 1]!);
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const ox = this.horizontal ? slot * c * 5 + ((5 - w) * c) / 2 : ((4 - w) * c) / 2;
      const oy = this.horizontal ? ((3 - h) * c) / 2 : slot * c * 3 + ((3 - h) * c) / 2;
      for (let i = 0; i < 8; i += 2) {
        const x = SHAPES[o + i]! - minX;
        const y = maxY - SHAPES[o + i + 1]!;
        ctx.drawImage(this.atlas.canvas, type * c, ROW_BLOCK * c, c, c, Math.round(ox + x * c), Math.round(oy + y * c), c, c);
      }
    }
    ctx.globalAlpha = 1;
  }
}
