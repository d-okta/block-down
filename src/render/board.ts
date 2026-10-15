import { COLS, VISIBLE_ROWS, type PieceType, type Rot } from "../core/constants.ts";
import { SHAPES, shapeOffset } from "../core/piece.ts";
import type { GameState } from "../core/game.ts";
import { buildAtlas, ROW_BLOCK, ROW_FLASH, ROW_GHOST, type Atlas } from "./sprites.ts";

const GRID_COLOR = "rgba(230, 233, 239, 0.04)";
const LOCK_FLASH_MS = 90;

/**
 * Menggambar board, ghost, dan piece aktif. Hanya membaca state core.
 * Lapisan latar (grid) digambar ke canvas terpisah, hanya saat ukuran atau pengaturan berubah.
 */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private bgCtx: CanvasRenderingContext2D;
  private atlas: Atlas | null = null;
  private cell = 0; // piksel perangkat
  private dpr = 1;
  ghost = true;
  grid = true;
  colorSafe = false;
  // Kilat lock (feedback lapis 2, Fase 2 hanya versi sederhana).
  private flashCells = new Int8Array(8);
  private flashType = 0;
  private flashStart = -1;
  private main: HTMLCanvasElement;
  private bg: HTMLCanvasElement;

  constructor(main: HTMLCanvasElement, bg: HTMLCanvasElement) {
    this.main = main;
    this.bg = bg;
    this.ctx = main.getContext("2d", { alpha: true })!;
    this.bgCtx = bg.getContext("2d")!;
  }

  /** availW/availH dalam piksel CSS. Mengembalikan ukuran sel CSS. */
  resize(availW: number, availH: number, dpr: number): number {
    this.dpr = dpr;
    const cell = Math.max(1, Math.floor(Math.min(availH / VISIBLE_ROWS, availW / COLS) * dpr));
    if (cell === this.cell && this.atlas) return cell / dpr;
    this.cell = cell;
    for (const c of [this.main, this.bg]) {
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
    this.atlas = buildAtlas(this.cell, this.dpr, this.colorSafe);
    const g = this.bgCtx;
    g.clearRect(0, 0, this.bg.width, this.bg.height);
    if (!this.grid) return;
    g.fillStyle = GRID_COLOR;
    const lw = Math.max(1, Math.round(this.dpr));
    for (let x = 1; x < COLS; x++) g.fillRect(x * this.cell, 0, lw, this.bg.height);
    for (let y = 1; y < VISIBLE_ROWS; y++) g.fillRect(0, y * this.cell, this.bg.width, lw);
  }

  lockFlash(cells: Int8Array, type: number, now: number): void {
    this.flashCells.set(cells);
    this.flashType = type;
    this.flashStart = now;
  }

  /**
   * fallFrom: y piece sebelum tick terakhir, atau NaN. Jika piece turun tepat satu baris
   * karena gravitasi, posisinya diinterpolasi supaya jatuh terlihat halus (EDD-2 bagian 3.4).
   */
  draw(s: Readonly<GameState>, fallFrom: number, alpha: number, now: number, showPiece: boolean): void {
    const atlas = this.atlas;
    if (!atlas) return;
    const ctx = this.ctx;
    const c = this.cell;
    ctx.clearRect(0, 0, this.main.width, this.main.height);

    const b = s.board;
    for (let y = 0; y < VISIBLE_ROWS; y++) {
      const dy = (VISIBLE_ROWS - 1 - y) * c;
      for (let x = 0; x < COLS; x++) {
        const v = b[y * COLS + x]!;
        if (v !== 0) ctx.drawImage(atlas.canvas, v * c, ROW_BLOCK * c, c, c, x * c, dy, c, c);
      }
    }

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

    if (!showPiece) return;

    if (this.ghost && s.ghostY !== s.y) this.drawPiece(s.type, s.rot, s.x, s.ghostY, ROW_GHOST, 0);

    const smooth = fallFrom - s.y === 1 ? (1 - alpha) * c : 0;
    this.drawPiece(s.type, s.rot, s.x, s.y, ROW_BLOCK, -smooth);
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
  private last = new Int8Array(6).fill(-1); // isi slot + redup, untuk melewati gambar ulang

  private canvas: HTMLCanvasElement;
  private slots: number;

  constructor(canvas: HTMLCanvasElement, slots: number) {
    this.canvas = canvas;
    this.slots = slots;
    this.ctx = canvas.getContext("2d")!;
  }

  /** cssCell: ukuran sel mini dalam piksel CSS. */
  resize(cssCell: number, dpr: number, colorSafe: boolean): void {
    const cell = Math.max(1, Math.round(cssCell * dpr));
    if (cell === this.cell && dpr === this.dpr && colorSafe === this.colorSafe) return;
    this.cell = cell;
    this.dpr = dpr;
    this.colorSafe = colorSafe;
    this.atlas = buildAtlas(cell, dpr, colorSafe);
    const slotH = cell * 3;
    this.canvas.width = cell * 4;
    this.canvas.height = slotH * this.slots;
    this.canvas.style.width = `${(cell * 4) / dpr}px`;
    this.canvas.style.height = `${(slotH * this.slots) / dpr}px`;
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
      const ox = ((4 - w) * c) / 2;
      const oy = slot * c * 3 + ((3 - h) * c) / 2;
      for (let i = 0; i < 8; i += 2) {
        const x = SHAPES[o + i]! - minX;
        const y = maxY - SHAPES[o + i + 1]!;
        ctx.drawImage(this.atlas.canvas, type * c, ROW_BLOCK * c, c, c, Math.round(ox + x * c), Math.round(oy + y * c), c, c);
      }
    }
    ctx.globalAlpha = 1;
  }
}
