import { PIECE, type PieceType, type Rot } from "./constants.ts";
import { cellAt } from "./board.ts";

export const SPIN_NONE = 0;
export const SPIN_MINI = 1;
export const SPIN_FULL = 2;

// Sudut di sekitar pusat T: A kiri atas, B kanan atas, C kiri bawah, D kanan bawah.
const CORNER_DX = Int8Array.of(-1, 1, -1, 1);
const CORNER_DY = Int8Array.of(1, 1, -1, -1);
// Dua sudut depan per orientasi (indeks sudut): 0: A,B  R: B,D  2: C,D  L: A,C.
const FRONT = Int8Array.of(0, 1, 1, 3, 2, 3, 0, 2);

/** Aturan 3 sudut (SPEC 8.7). lastAction 2 = putaran. */
export function detectTSpin(
  b: Uint8Array,
  type: PieceType,
  rot: Rot,
  x: number,
  y: number,
  lastAction: number,
  kickIndex: number,
): number {
  if (type !== PIECE.T || lastAction !== 2) return SPIN_NONE;
  const cx = x + 1;
  const cy = y + 1;
  let filled = 0;
  for (let i = 0; i < 4; i++) if (cellAt(b, cx + CORNER_DX[i]!, cy + CORNER_DY[i]!) !== 0) filled++;
  if (filled < 3) return SPIN_NONE;
  const f0 = FRONT[rot * 2]!;
  const f1 = FRONT[rot * 2 + 1]!;
  const front0 = cellAt(b, cx + CORNER_DX[f0]!, cy + CORNER_DY[f0]!) !== 0;
  const front1 = cellAt(b, cx + CORNER_DX[f1]!, cy + CORNER_DY[f1]!) !== 0;
  if (front0 && front1) return SPIN_FULL;
  if (kickIndex === 4) return SPIN_FULL;
  return SPIN_MINI;
}

const BASE = Int32Array.of(0, 100, 300, 500, 800);
const TSPIN = Int32Array.of(400, 800, 1200, 1600);
const MINI = Int32Array.of(100, 200, 400);
const PC = Int32Array.of(0, 800, 1200, 1800, 2000);
const PC_B2B_QUAD = 3200;

/** Indeks hasil di `out` (Int32Array panjang 7). */
export const SC = { ACTION: 0, B2B_APPLIED: 1, COMBO: 2, PC: 3, TOTAL: 4, NEW_B2B: 5, NEW_COMBO: 6 } as const;

/**
 * Skor satu lock (SPEC 8.1 sampai 8.4, 8.6). Semua komponen sudah dikali level.
 * Tidak termasuk poin drop.
 */
export function scoreLock(
  n: number,
  spin: number,
  level: number,
  b2b: boolean,
  combo: number,
  perfect: boolean,
  out: Int32Array,
): void {
  let action = spin === SPIN_FULL ? TSPIN[n]! : spin === SPIN_MINI ? (MINI[n] ?? 0) : BASE[n]!;
  const hard = n > 0 && (n === 4 || spin !== SPIN_NONE);
  const applied = hard && b2b;
  if (applied) action = Math.floor((action * 3) / 2);
  let newB2b = b2b;
  let newCombo = -1;
  let comboBonus = 0;
  let pcBonus = 0;
  if (n > 0) {
    newB2b = hard;
    newCombo = combo + 1;
    if (newCombo >= 1) comboBonus = 50 * newCombo * level;
    if (perfect) pcBonus = (n === 4 && b2b ? PC_B2B_QUAD : PC[n]!) * level;
  }
  out[SC.ACTION] = action * level;
  out[SC.B2B_APPLIED] = applied ? 1 : 0;
  out[SC.COMBO] = comboBonus;
  out[SC.PC] = pcBonus;
  out[SC.TOTAL] = action * level + comboBonus + pcBonus;
  out[SC.NEW_B2B] = newB2b ? 1 : 0;
  out[SC.NEW_COMBO] = newCombo;
}
