import { PIECE, type PieceType, type Rot } from "./constants.ts";
import { fits } from "./board.ts";

// Salinan persis SPEC.md bagian 3. Baris: 0>R, R>0, R>2, 2>R, 2>L, L>2, L>0, 0>L.
// Setiap baris: 5 tes x (dx, dy), y ke atas.
// prettier-ignore
export const KICKS_JLSTZ = Int8Array.of(
  0, 0, -1, 0, -1, 1, 0, -2, -1, -2,
  0, 0, 1, 0, 1, -1, 0, 2, 1, 2,
  0, 0, 1, 0, 1, -1, 0, 2, 1, 2,
  0, 0, -1, 0, -1, 1, 0, -2, -1, -2,
  0, 0, 1, 0, 1, 1, 0, -2, 1, -2,
  0, 0, -1, 0, -1, -1, 0, 2, -1, 2,
  0, 0, -1, 0, -1, -1, 0, 2, -1, 2,
  0, 0, 1, 0, 1, 1, 0, -2, 1, -2,
);
// prettier-ignore
export const KICKS_I = Int8Array.of(
  0, 0, -2, 0, 1, 0, -2, -1, 1, 2,
  0, 0, 2, 0, -1, 0, 2, 1, -1, -2,
  0, 0, -1, 0, 2, 0, -1, 2, 2, -1,
  0, 0, 1, 0, -2, 0, 1, -2, -2, 1,
  0, 0, 2, 0, -1, 0, 2, 1, -1, -2,
  0, 0, -2, 0, 1, 0, -2, -1, 1, 2,
  0, 0, 1, 0, -2, 0, 1, -2, -2, 1,
  0, 0, -1, 0, 2, 0, -1, 2, 2, -1,
);

/** TRANSITION[from * 4 + to] = baris tabel, -1 jika bukan putaran 90 derajat. */
// prettier-ignore
const TRANSITION = Int8Array.of(
  -1, 0, -1, 7,
  1, -1, 2, -1,
  -1, 3, -1, 4,
  6, -1, 5, -1,
);

export function transitionRow(from: Rot, to: Rot): number {
  return TRANSITION[from * 4 + to]!;
}

/** Offset tes ke-i: axis 0 = dx, 1 = dy. */
export function kick(type: PieceType, from: Rot, to: Rot, i: number, axis: 0 | 1): number {
  if (type === PIECE.O || type === PIECE.F) return 0;
  const table = type === PIECE.I ? KICKS_I : KICKS_JLSTZ;
  return table[transitionRow(from, to) * 10 + i * 2 + axis]!;
}

/** Indeks tes pertama yang muat (0..4), atau -1 jika putaran gagal. */
export function findKick(
  b: Uint8Array,
  type: PieceType,
  from: Rot,
  to: Rot,
  x: number,
  y: number,
): number {
  const tests = type === PIECE.O || type === PIECE.F ? 1 : 5;
  for (let i = 0; i < tests; i++) {
    if (fits(b, type, to, x + kick(type, from, to, i, 0), y + kick(type, from, to, i, 1))) return i;
  }
  return -1;
}
