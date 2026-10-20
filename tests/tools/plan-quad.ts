// Alat uji (bukan bagian aplikasi): cari urutan tombol yang menghasilkan 4 Baris dari seed tertentu,
// Dengan argumen kedua "pc": hanya berhasil jika 4 Baris itu juga Bersih Total (papan kosong), untuk menguji tema Monokrom.
// untuk memutar ulang momen Quad di browser saat menguji efek. Jalankan: node tests/tools/plan-quad.ts [seed]
// Strategi: isi kolom 1..9 dengan piece apa pun (rata dari kiri), sisakan kolom 0, lalu I tegak di kolom 0.
import { createGame } from "../../src/core/game.ts";
import { ACT, COLS, PIECE, type PieceType, type Rot } from "../../src/core/constants.ts";
import { fits } from "../../src/core/board.ts";
import { SHAPES, shapeOffset } from "../../src/core/piece.ts";

const seed = Number(process.argv[2] ?? 7);
const needPc = process.argv[3] === "pc";

/** Ketinggian kolom (jumlah sel terisi dari bawah sampai sel teratas). */
function heights(b: Uint8Array): number[] {
  const h: number[] = [];
  for (let x = 0; x < COLS; x++) {
    let top = 0;
    for (let y = 0; y < 22; y++) if (b[y * COLS + x]) top = y + 1;
    h.push(top);
  }
  return h;
}

/** Simulasikan hard drop piece di (rot, x) pada board, kembalikan board baru atau null. */
function drop(b: Uint8Array, type: PieceType, rot: Rot, x: number): Uint8Array | null {
  let y = 18;
  if (!fits(b, type, rot, x, y)) return null;
  while (fits(b, type, rot, x, y - 1)) y--;
  const nb = b.slice();
  const o = shapeOffset(type, rot);
  for (let i = 0; i < 8; i += 2) nb[(y + SHAPES[o + i + 1]!) * COLS + x + SHAPES[o + i]!] = type;
  return nb;
}

/** Nilai board: kolom 0 kosong, kolom 1..9 rata, tanpa lubang. Lebih kecil lebih baik. */
function cost(b: Uint8Array): number {
  const h = heights(b);
  if (h[0]! > 0) return 1e9;
  let holes = 0;
  for (let x = 1; x < COLS; x++) for (let y = 0; y < h[x]!; y++) if (!b[y * COLS + x]) holes++;
  let bump = 0;
  for (let x = 1; x < COLS - 1; x++) bump += Math.abs(h[x]! - h[x + 1]!);
  return holes * 100 + bump * 3 + Math.max(...h.slice(1)) * 2;
}

const g = createGame("zen", seed, { softDropFactor: 20 });
const keys: string[] = [];
const buf = new Uint8Array(16);
const step = (acts: number[]) => {
  buf.set(acts);
  g.step(buf, acts.length);
};

for (let piece = 0; piece < 40; piece++) {
  const s = g.state;
  const h = heights(s.board);
  const full = h.slice(1).every((v) => v >= 4);
  if (s.type === PIECE.I && full) {
    // I tegak: rot 1 (R), sel di kolom x+2. Kolom 0 butuh x = -2.
    keys.push("KeyX");
    step([ACT.ROT_CW]);
    while (g.state.x + 2 > 0) {
      keys.push("ArrowLeft");
      const before = g.state.x;
      step([ACT.LEFT]);
      if (g.state.x === before) break;
    }
    keys.push("Space");
    step([ACT.HARD]);
    const ok = g.state.lines >= 4 && (!needPc || g.state.perfects > 0);
    if (ok) console.log(JSON.stringify({ seed, keys, lines: g.state.lines }));
    process.exit(ok ? 0 : 1);
  }
  // Cari penempatan terbaik untuk piece ini (atau simpan I untuk nanti jika board belum siap).
  let best: { rot: Rot; x: number; c: number } | null = null;
  for (let rot = 0 as Rot; rot < 4; rot = (rot + 1) as Rot) {
    for (let x = -2; x < COLS; x++) {
      const nb = drop(s.board, s.type, rot, x);
      if (!nb) continue;
      const c = cost(nb);
      if (!best || c < best.c) best = { rot, x, c };
    }
  }
  if (s.type === PIECE.I && !full && !s.holdUsed && s.hold === 0) {
    keys.push("ArrowUp");
    step([ACT.HOLD]);
    piece--;
    continue;
  }
  if (!best || best.c >= 1e9) {
    console.error(`seed ${seed}: buntu di piece ${piece}`);
    process.exit(1);
  }
  const rots: number[] = [];
  for (let r = 0; r < best.rot; r++) rots.push(ACT.ROT_CW);
  for (const a of rots) {
    keys.push("KeyX");
    step([a]);
  }
  while (g.state.x !== best.x) {
    const dir = g.state.x < best.x ? 1 : -1;
    keys.push(dir > 0 ? "ArrowRight" : "ArrowLeft");
    const before = g.state.x;
    step([dir > 0 ? ACT.RIGHT : ACT.LEFT]);
    if (g.state.x === before) break;
  }
  keys.push("Space");
  step([ACT.HARD]);
  if (g.state.lines > 0) {
    console.error(`seed ${seed}: baris terhapus sebelum Quad`);
    process.exit(1);
  }
  // Simpanan I dipakai kembali begitu board siap.
  const h2 = heights(g.state.board);
  if (g.state.hold === PIECE.I && h2.slice(1).every((v) => v >= 4) && !g.state.holdUsed) {
    keys.push("ArrowUp");
    step([ACT.HOLD]);
  }
}
console.error(`seed ${seed}: tidak tercapai`);
process.exit(1);
