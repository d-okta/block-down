import { ROWS } from "./constants.ts";

export const EV = {
  MOVE: 1,
  ROTATE: 2,
  SOFT: 3,
  HARD: 4,
  LOCK: 5,
  CLEAR: 6,
  HOLD: 7,
  LEVEL_UP: 8,
  SPAWN: 9,
  ZEN_RESET: 10,
  GAME_OVER: 11,
  FINISH: 12,
  TIME_UP: 13,
  /** Blok Pengisi masuk antrean (PRD-6 bagian 14). a = sisa sel di papan. */
  FILLER: 14,
} as const;

/**
 * Arti a, b, c per jenis ada di EDD-1 bagian 11.
 * score: action, b2b (0/1), combo, pc, total. Semua sudah dikali level.
 */
export interface GameEvent {
  type: number;
  a: number;
  b: number;
  c: number;
  cells: Int8Array;
  rows: Int8Array;
  shift: Uint8Array;
  colors: Uint8Array;
  score: Int32Array;
}

const CAP = 64;

export class EventQueue {
  readonly slots: GameEvent[] = [];
  count = 0;

  constructor() {
    for (let i = 0; i < CAP; i++) {
      this.slots.push({
        type: 0,
        a: 0,
        b: 0,
        c: 0,
        cells: new Int8Array(8),
        rows: new Int8Array(4),
        shift: new Uint8Array(ROWS),
        colors: new Uint8Array(40),
        score: new Int32Array(5),
      });
    }
  }

  /** Ambil slot kosong. Jika penuh, MOVE dan SOFT dikorbankan lebih dulu. */
  push(type: number, a = 0, b = 0, c = 0): GameEvent | null {
    let e: GameEvent | undefined;
    if (this.count < CAP) {
      e = this.slots[this.count++];
    } else {
      if (type === EV.MOVE || type === EV.SOFT) return null;
      e = this.slots.find((s) => s.type === EV.MOVE || s.type === EV.SOFT);
      if (!e) return null;
    }
    e = e!;
    e.type = type;
    e.a = a;
    e.b = b;
    e.c = c;
    return e;
  }

  at(i: number): GameEvent {
    return this.slots[i]!;
  }

  clear(): void {
    this.count = 0;
  }
}
