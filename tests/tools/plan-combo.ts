// Alat uji (bukan bagian aplikasi): cari urutan tombol dari seed tertentu yang mencapai combo target.
// Pencarian beam: setiap piece dicoba semua penempatan (tanpa hold), simpan K papan terbaik.
import { createGame } from "../../src/core/game.ts";
import { ACT, COLS, type PieceType, type Rot } from "../../src/core/constants.ts";
import { fits } from "../../src/core/board.ts";
import { SHAPES, shapeOffset } from "../../src/core/piece.ts";
import { createBag, take } from "../../src/core/bag.ts";

const seed = Number(process.argv[2] ?? 1);
const target = Number(process.argv[3] ?? 3);
const BEAM = 60;

function place(b: Uint8Array, type: PieceType, rot: Rot, x: number): { nb: Uint8Array; lines: number } | null {
  let y = 19;
  if (!fits(b, type, rot, x, y)) return null;
  while (fits(b, type, rot, x, y - 1)) y--;
  const nb = b.slice();
  const o = shapeOffset(type, rot);
  for (let i = 0; i < 8; i += 2) nb[(y + SHAPES[o + i + 1]!) * COLS + x + SHAPES[o + i]!] = type;
  let lines = 0;
  const out = new Uint8Array(nb.length);
  let w = 0;
  for (let r = 0; r < 22; r++) {
    let full = true;
    for (let c = 0; c < COLS; c++) if (!nb[r * COLS + c]) full = false;
    if (full) { lines++; continue; }
    out.set(nb.subarray(r * COLS, r * COLS + COLS), w * COLS);
    w++;
  }
  return { nb: out, lines };
}
function score(b: Uint8Array, combo: number): number {
  const h: number[] = [];
  for (let x = 0; x < COLS; x++) { let t = 0; for (let y = 0; y < 22; y++) if (b[y * COLS + x]) t = y + 1; h.push(t); }
  let holes = 0;
  for (let x = 0; x < COLS; x++) for (let y = 0; y < h[x]!; y++) if (!b[y * COLS + x]) holes++;
  let bump = 0;
  for (let x = 0; x < COLS - 2; x++) bump += Math.abs(h[x]! - h[x + 1]!);
  return combo * 400 - holes * 60 - bump * 4 - Math.max(...h) * 3 - (h[9]! > 0 ? 30 : 0);
}
// Urutan piece dari bag dengan seed yang sama seperti game.
const bag = createBag(seed);
const seq: PieceType[] = [];
for (let i = 0; i < 80; i++) seq.push(take(bag));
type Node = { b: Uint8Array; combo: number; best: number; moves: [Rot, number][] };
let beam: Node[] = [{ b: new Uint8Array(22 * COLS), combo: -1, best: 0, moves: [] }];
let found: Node | null = null;
for (let i = 0; i < seq.length && !found; i++) {
  const next: Node[] = [];
  for (const n of beam) {
    for (let rot = 0 as Rot; rot < 4; rot = (rot + 1) as Rot) {
      for (let x = -2; x < COLS; x++) {
        const r = place(n.b, seq[i]!, rot, x);
        if (!r) continue;
        const combo = r.lines > 0 ? n.combo + 1 : -1;
        const nn = { b: r.nb, combo, best: Math.max(n.best, combo), moves: [...n.moves, [rot, x] as [Rot, number]] };
        if (nn.best >= target) { found = nn; break; }
        next.push(nn);
      }
      if (found) break;
    }
    if (found) break;
  }
  next.sort((a, b) => score(b.b, b.combo) - score(a.b, a.combo));
  beam = next.slice(0, BEAM);
}
if (!found) process.exit(1);
// Mainkan ulang di game sungguhan untuk menghasilkan tombol dan memastikan combo.
const g = createGame("zen", seed, { softDropFactor: 20 });
const keys: string[] = [];
const buf = new Uint8Array(1);
const step = (a: number) => { buf[0] = a; g.step(buf, 1); };
for (const [rot, x] of found.moves) {
  for (let r = 0; r < rot; r++) { keys.push("KeyX"); step(ACT.ROT_CW); }
  while (g.state.x !== x) {
    const right = g.state.x < x;
    keys.push(right ? "ArrowRight" : "ArrowLeft");
    const before = g.state.x;
    step(right ? ACT.RIGHT : ACT.LEFT);
    if (g.state.x === before) break;
  }
  keys.push("Space");
  step(ACT.HARD);
}
if (g.state.maxCombo < target) process.exit(2);
console.log(JSON.stringify({ seed, keys, maxCombo: g.state.maxCombo }));
