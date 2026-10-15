import { NEXT_COUNT, type PieceType } from "./constants.ts";

export interface Rng {
  v: number;
}

/** mulberry32: deterministik, state satu uint32. */
export function nextU32(s: Rng): number {
  let t = (s.v = (s.v + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

const CAP = 16;

export interface Bag {
  ring: Uint8Array;
  head: number;
  count: number;
  rng: Rng;
  scratch: Uint8Array;
}

export function createBag(seed: number): Bag {
  const bag: Bag = { ring: new Uint8Array(CAP), head: 0, count: 0, rng: { v: seed | 0 }, scratch: new Uint8Array(7) };
  refill(bag);
  return bag;
}

function refill(bag: Bag): void {
  while (bag.count < NEXT_COUNT + 1) {
    const s = bag.scratch;
    for (let i = 0; i < 7; i++) s[i] = i + 1;
    for (let i = 6; i > 0; i--) {
      const j = nextU32(bag.rng) % (i + 1);
      const t = s[i]!;
      s[i] = s[j]!;
      s[j] = t;
    }
    for (let i = 0; i < 7; i++) bag.ring[(bag.head + bag.count + i) % CAP] = s[i]!;
    bag.count += 7;
  }
}

export function take(bag: Bag): PieceType {
  const t = bag.ring[bag.head] as PieceType;
  bag.head = (bag.head + 1) % CAP;
  bag.count--;
  refill(bag);
  return t;
}

/** Piece ke-i di antrean (0 = berikutnya), tanpa mengambil. */
export function peek(bag: Bag, i: number): PieceType {
  return bag.ring[(bag.head + i) % CAP] as PieceType;
}
