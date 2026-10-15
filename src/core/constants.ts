export const COLS = 10;
export const ROWS = 22; // 20 terlihat + 2 tersembunyi
export const VISIBLE_ROWS = 20;
export const TICK_HZ = 60;
export const LOCK_TICKS = 24; // 400 ms
export const MAX_RESETS = 15;
export const NEXT_COUNT = 5;
export const FP = 65536; // 1 baris dalam unit gravitasi
export const MAX_G = 20 * FP;

export const PIECE = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 } as const;
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Rot = 0 | 1 | 2 | 3; // 0, R, 2, L

export const ACT = {
  LEFT: 1,
  RIGHT: 2,
  ROT_CW: 3,
  ROT_CCW: 4,
  HARD: 5,
  HOLD: 6,
  SOFT_ON: 7,
  SOFT_OFF: 8,
} as const;

export function ticksToMs(ticks: number): number {
  return Math.floor((ticks * 1000) / TICK_HZ);
}
