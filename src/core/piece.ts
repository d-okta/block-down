import type { PieceType, Rot } from "./constants.ts";

// Sel relatif ke sudut kiri bawah kotak pembatas, y ke atas (EDD-1 bagian 4).
// Urutan: [x0, y0, x1, y1, x2, y2, x3, y3] untuk rot 0, R, 2, L.
const RAW: Record<PieceType, number[][]> = {
  1: [
    [0, 2, 1, 2, 2, 2, 3, 2],
    [2, 3, 2, 2, 2, 1, 2, 0],
    [0, 1, 1, 1, 2, 1, 3, 1],
    [1, 3, 1, 2, 1, 1, 1, 0],
  ],
  2: [
    [1, 1, 2, 1, 1, 0, 2, 0],
    [1, 1, 2, 1, 1, 0, 2, 0],
    [1, 1, 2, 1, 1, 0, 2, 0],
    [1, 1, 2, 1, 1, 0, 2, 0],
  ],
  3: [
    [1, 2, 0, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 2, 1, 1, 0],
    [0, 1, 1, 1, 2, 1, 1, 0],
    [1, 2, 0, 1, 1, 1, 1, 0],
  ],
  4: [
    [1, 2, 2, 2, 0, 1, 1, 1],
    [1, 2, 1, 1, 2, 1, 2, 0],
    [1, 1, 2, 1, 0, 0, 1, 0],
    [0, 2, 0, 1, 1, 1, 1, 0],
  ],
  5: [
    [0, 2, 1, 2, 1, 1, 2, 1],
    [2, 2, 1, 1, 2, 1, 1, 0],
    [0, 1, 1, 1, 1, 0, 2, 0],
    [1, 2, 0, 1, 1, 1, 0, 0],
  ],
  6: [
    [0, 2, 0, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 1, 1, 1, 0],
    [0, 1, 1, 1, 2, 1, 2, 0],
    [1, 2, 1, 1, 0, 0, 1, 0],
  ],
  7: [
    [2, 2, 0, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 1, 0, 2, 0],
    [0, 1, 1, 1, 2, 1, 0, 0],
    [0, 2, 1, 2, 1, 1, 1, 0],
  ],
  // Blok Pengisi: satu sel di tengah kotak 3 lebar. Keempat entri sama, jadi kode yang membaca 4 sel
  // (fits, lock, gambar) tetap bekerja tanpa cabang khusus. Tidak berubah saat diputar.
  8: [
    [1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
  ],
};

/** SHAPES[(type * 4 + rot) * 8 + i] */
export const SHAPES = new Int8Array(9 * 4 * 8);
for (let t = 1 as PieceType; t <= 8; t++) {
  for (let r = 0; r < 4; r++) SHAPES.set(RAW[t][r]!, (t * 4 + r) * 8);
}

export function shapeOffset(type: PieceType, rot: Rot): number {
  return (type * 4 + rot) * 8;
}

export const SPAWN_X = 3;
/** Baris bawah bentuk berada di y = 20 (EDD-1 bagian 4). Indeks = jenis. */
export const SPAWN_Y = Int8Array.of(0, 18, 20, 19, 19, 19, 19, 19, 20);
