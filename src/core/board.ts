import { COLS, ROWS, type PieceType, type Rot } from "./constants.ts";
import { SHAPES, shapeOffset } from "./piece.ts";

export function createBoard(): Uint8Array {
  return new Uint8Array(COLS * ROWS);
}

/** Isi sel. Di luar board (termasuk di atas ROWS) dianggap padat (8). */
export function cellAt(b: Uint8Array, x: number, y: number): number {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return 8;
  return b[y * COLS + x]!;
}

export function fits(b: Uint8Array, type: PieceType, rot: Rot, x: number, y: number): boolean {
  const o = shapeOffset(type, rot);
  for (let i = 0; i < 8; i += 2) {
    if (cellAt(b, x + SHAPES[o + i]!, y + SHAPES[o + i + 1]!) !== 0) return false;
  }
  return true;
}

/**
 * Hapus baris penuh di tempat.
 * outRows: indeks baris terhapus dari bawah, -1 untuk slot kosong (panjang 4).
 * outShift[j]: berapa baris baris hasil j turun (panjang ROWS).
 * outColors: isi baris terhapus, 10 per baris, urut dari bawah (panjang 40).
 */
export function clearLines(
  b: Uint8Array,
  outRows: Int8Array,
  outShift: Uint8Array,
  outColors: Uint8Array,
): number {
  outRows.fill(-1);
  outShift.fill(0);
  let n = 0;
  let w = 0;
  for (let r = 0; r < ROWS; r++) {
    let full = true;
    for (let x = 0; x < COLS; x++) {
      if (b[r * COLS + x] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      outRows[n] = r;
      outColors.set(b.subarray(r * COLS, r * COLS + COLS), n * COLS);
      n++;
      continue;
    }
    if (w !== r) b.copyWithin(w * COLS, r * COLS, r * COLS + COLS);
    outShift[w] = r - w;
    w++;
  }
  if (n > 0) b.fill(0, w * COLS);
  return n;
}

export function isEmpty(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) if (b[i] !== 0) return false;
  return true;
}
