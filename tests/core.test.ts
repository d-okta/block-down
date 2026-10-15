import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ACT, COLS, FP, PIECE, type PieceType, type Rot } from "../src/core/constants.ts";
import { KICKS_I, KICKS_JLSTZ } from "../src/core/srs.ts";
import { createBag, take } from "../src/core/bag.ts";
import { gravityFor } from "../src/core/gravity.ts";
import { detectTSpin, SPIN_FULL, SPIN_MINI, SPIN_NONE } from "../src/core/score.ts";
import { EV } from "../src/core/events.ts";
import { createGame, debugSetActive, STATUS, type Game, type GameState } from "../src/core/game.ts";
import type { ModeId } from "../src/core/modes.ts";
import { id } from "../src/i18n/id.ts";
import { en } from "../src/i18n/en.ts";

// ---------- helper ----------

const CFG = { softDropFactor: 20 } as const;

function newGame(mode: ModeId = "marathonEndless", seed = 1): Game {
  return createGame(mode, seed, CFG);
}

function S(g: Game): GameState {
  return g.state as GameState;
}

/** Isi board. Kunci = y (0 paling bawah), nilai = 10 karakter, '#' terisi. */
function setRows(g: Game, rows: Record<number, string>): void {
  const b = S(g).board;
  b.fill(0);
  for (const [y, line] of Object.entries(rows)) {
    assert.equal(line.length, COLS, `baris ${y} harus 10 karakter`);
    for (let x = 0; x < COLS; x++) if (line[x] === "#") b[Number(y) * COLS + x] = 8;
  }
}

function put(g: Game, type: PieceType, rot: Rot, x: number, y: number): void {
  debugSetActive(g, type, rot, x, y);
}

const buf = new Uint8Array(32);
function tick(g: Game, ...actions: number[]): void {
  buf.set(actions);
  g.events.clear();
  g.step(buf, actions.length);
}

function events(g: Game, type: number) {
  const out = [];
  for (let i = 0; i < g.events.count; i++) if (g.events.at(i).type === type) out.push(g.events.at(i));
  return out;
}

/** Jalankan aksi dan kembalikan selisih skor. */
function scoreOf(g: Game, ...actions: number[]): number {
  const before = S(g).score;
  tick(g, ...actions);
  return S(g).score - before;
}

const I = PIECE.I;
const O = PIECE.O;
const T = PIECE.T;

// ---------- 1-4: SRS ----------

function parseKickTable(section: string): number[] {
  const out: number[] = [];
  for (const line of section.split("\n")) {
    if (!/^\| [0RL2] ke [0RL2] \|/.test(line)) continue;
    for (const m of line.matchAll(/\(([-+]?\d+), ([-+]?\d+)\)/g)) out.push(Number(m[1]), Number(m[2]));
  }
  return out;
}

test("1. tabel kick sama dengan SPEC.md bagian 3", () => {
  const spec = readFileSync(new URL("../docs/prd/SPEC.md", import.meta.url), "utf8");
  const s31 = spec.slice(spec.indexOf("### 3.1"), spec.indexOf("### 3.2"));
  const s32 = spec.slice(spec.indexOf("### 3.2"), spec.indexOf("### 3.3"));
  const jlstz = parseKickTable(s31);
  const iTable = parseKickTable(s32);
  assert.equal(jlstz.length, 80);
  assert.equal(iTable.length, 80);
  assert.deepEqual([...KICKS_JLSTZ], jlstz);
  assert.deepEqual([...KICKS_I], iTable);
});

test("2. T R ke 2 di board kosong memakai tes pertama", () => {
  const g = newGame();
  setRows(g, {});
  put(g, T, 1, 4, 8);
  tick(g, ACT.ROT_CW);
  assert.equal(S(g).rot, 2);
  assert.equal(S(g).kickIndex, 0);
  assert.equal(S(g).x, 4);
});

test("3. I tegak di dinding kanan diputar ke 0 memakai kick", () => {
  const g = newGame();
  setRows(g, {});
  put(g, I, 1, 7, 5); // sel di kolom 9
  tick(g, ACT.ROT_CCW);
  assert.equal(S(g).rot, 0);
  assert.ok(S(g).kickIndex > 0);
  assert.equal(S(g).x, 6); // kolom 6..9
});

test("4. O diputar tidak bergeser", () => {
  const g = newGame();
  setRows(g, {});
  put(g, O, 0, 3, 8);
  tick(g, ACT.ROT_CW);
  assert.equal(S(g).x, 3);
  assert.equal(S(g).y, 8 - 0); // tidak ada gravitasi di tick pertama (acc < 1 baris)
  assert.equal(S(g).kickIndex, 0);
  assert.equal(events(g, EV.ROTATE).length, 1);
});

// ---------- 5-6: 7-bag ----------

test("5. setiap kelompok 7 berisi ketujuh jenis tepat sekali", () => {
  for (const seed of [1, 2, 3]) {
    const bag = createBag(seed);
    for (let group = 0; group < 10; group++) {
      const seen = new Set<number>();
      for (let i = 0; i < 7; i++) seen.add(take(bag));
      assert.equal(seen.size, 7, `seed ${seed}, kelompok ${group}`);
    }
  }
});

test("6. seed sama menghasilkan urutan sama", () => {
  const seq = (seed: number) => {
    const bag = createBag(seed);
    return Array.from({ length: 70 }, () => take(bag)).join("");
  };
  assert.equal(seq(42), seq(42));
  assert.notEqual(seq(42), seq(43));
});

// ---------- 7: gravitasi ----------

test("7. tabel gravitasi sesuai rumus SPEC 6.1", () => {
  for (let L = 1; L <= 18; L++) {
    const secs = Math.pow(0.8 - (L - 1) * 0.007, L - 1);
    const expected = Math.round((1 / 60 / secs) * FP);
    assert.ok(Math.abs(gravityFor(L) - expected) <= 1, `level ${L}`);
  }
  assert.equal(gravityFor(19), 20 * FP);
  assert.equal(gravityFor(30), 20 * FP);
});

// ---------- 8-13: skor ----------

const LONE = "....#....."; // mencegah Bersih Total

test("8. Single, Double, Triple, Quad di level 1", () => {
  const expected = [100, 300, 500, 800];
  for (let n = 1; n <= 4; n++) {
    const g = newGame();
    const rows: Record<number, string> = { 5: LONE };
    for (let y = 0; y < n; y++) rows[y] = ".#########";
    setRows(g, rows);
    put(g, I, 1, -2, 0);
    assert.equal(scoreOf(g, ACT.HARD), expected[n - 1], `${n} baris`);
    assert.equal(S(g).lines, n);
  }
});

test("9. Quad lalu Quad mendapat B2B dan combo", () => {
  const g = newGame();
  const rows: Record<number, string> = { 8: LONE };
  for (let y = 0; y < 8; y++) rows[y] = ".#########";
  setRows(g, rows);
  put(g, I, 1, -2, 0);
  assert.equal(scoreOf(g, ACT.HARD), 800);
  assert.equal(S(g).b2b, true);
  put(g, I, 1, -2, 0);
  assert.equal(scoreOf(g, ACT.HARD), 1200 + 50);
  const clear = events(g, EV.CLEAR)[0]!;
  assert.equal(clear.score[1], 1); // B2B diterapkan
  assert.equal(clear.score[4], 1250);
  assert.equal(S(g).quads, 2);
});

test("10. Single di antara dua Quad memutus B2B", () => {
  const g = newGame();
  setRows(g, {
    0: ".#########",
    1: ".#########",
    2: ".#########",
    3: ".#########",
    4: ".#########",
    5: "..########",
    6: "..########",
    7: "..########",
    8: "#.########",
    9: LONE,
  });
  put(g, I, 1, -2, 0);
  assert.equal(scoreOf(g, ACT.HARD), 800);
  put(g, I, 1, -2, 0);
  assert.equal(scoreOf(g, ACT.HARD), 100 + 50); // Single + combo 1
  assert.equal(S(g).b2b, false);
  put(g, I, 1, -1, 0);
  assert.equal(scoreOf(g, ACT.HARD), 800 + 100); // tanpa B2B, combo 2
  assert.equal(S(g).maxCombo, 2);
});

test("11. lock tanpa clear mengembalikan combo ke -1", () => {
  const g = newGame();
  setRows(g, { 0: ".#########", 1: LONE });
  put(g, I, 1, -2, 0);
  tick(g, ACT.HARD);
  assert.equal(S(g).combo, 0);
  put(g, O, 0, 5, 10);
  tick(g, ACT.HARD);
  assert.equal(S(g).combo, -1);
});

test("12. bonus Bersih Total", () => {
  // Single yang mengosongkan board: 100 + 800.
  const g1 = newGame();
  setRows(g1, { 0: "###....###" });
  put(g1, I, 0, 3, -2);
  assert.equal(scoreOf(g1, ACT.HARD), 100 + 800);
  assert.equal(events(g1, EV.CLEAR)[0]!.score[3], 800);

  // Quad saat B2B aktif yang mengosongkan board: 1200 + combo 50 + 3200.
  const g2 = newGame();
  const rows: Record<number, string> = {};
  for (let y = 0; y < 8; y++) rows[y] = ".#########";
  setRows(g2, rows);
  put(g2, I, 1, -2, 0);
  tick(g2, ACT.HARD);
  put(g2, I, 1, -2, 0);
  assert.equal(scoreOf(g2, ACT.HARD), 1200 + 50 + 3200);
});

test("13. hard drop +2 per sel dan tidak dikali level", () => {
  const g = newGame();
  setRows(g, {});
  S(g).level = 5;
  put(g, O, 0, 3, 10);
  assert.equal(scoreOf(g, ACT.HARD), 20);
});

// ---------- 14-17: T-Spin ----------

const TSD = { 0: "####.#####", 1: "###...####", 2: "...#......" };

test("14. T-Spin Double", () => {
  const g = newGame();
  setRows(g, TSD);
  put(g, T, 1, 3, 0);
  assert.equal(scoreOf(g, ACT.ROT_CW, ACT.HARD), 1200);
  const clear = events(g, EV.CLEAR)[0]!;
  assert.equal(clear.a, 2);
  assert.equal(clear.b, SPIN_FULL);
  assert.equal(S(g).tspins, 1);
});

// Board untuk Mini: sudut A dan C adalah dinding kiri, D terisi, B kosong.
const MINI_BOARD = { 0: ".#........", 1: "..........", 5: "........##" };

test("15. putar lalu geser membatalkan T-Spin", () => {
  const g = newGame();
  setRows(g, MINI_BOARD);
  put(g, T, 0, 0, 3);
  tick(g, ACT.ROT_CW, ACT.LEFT);
  assert.equal(S(g).lastAction, 1);
  tick(g, ACT.HARD);
  assert.equal(S(g).tspins, 0);
  assert.equal(events(g, EV.CLEAR).length, 0);
});

test("16. T-Spin Mini tanpa baris", () => {
  const g = newGame();
  setRows(g, MINI_BOARD);
  put(g, T, 0, 0, 0);
  tick(g, ACT.ROT_CW);
  assert.equal(S(g).kickIndex, 1);
  assert.equal(S(g).x, -1);
  const gained = scoreOf(g, ACT.HARD);
  assert.equal(gained, 100);
  assert.equal(events(g, EV.CLEAR)[0]!.b, SPIN_MINI);
});

test("17. kick tes ke-5 menaikkan Mini menjadi T-Spin penuh", () => {
  const g = newGame();
  setRows(g, MINI_BOARD);
  const b = S(g).board;
  assert.equal(detectTSpin(b, T, 1, -1, 0, 2, 1), SPIN_MINI);
  assert.equal(detectTSpin(b, T, 1, -1, 0, 2, 4), SPIN_FULL);
  assert.equal(detectTSpin(b, T, 1, -1, 0, 1, 4), SPIN_NONE); // aksi terakhir geser
  assert.equal(detectTSpin(b, O, 1, -1, 0, 2, 4), SPIN_NONE); // bukan T
});

// ---------- 18-20: lock delay ----------

function locked(g: Game): boolean {
  return S(g).pieces > 1;
}

test("18. lock delay 400 ms", () => {
  const g = newGame();
  setRows(g, {});
  put(g, O, 0, 3, 0);
  const startPieces = S(g).pieces;
  for (let i = 0; i < 23; i++) tick(g);
  assert.equal(S(g).pieces, startPieces, "belum terkunci di tick 23");
  tick(g);
  assert.equal(S(g).pieces, startPieces + 1, "terkunci di tick 24 (400 ms)");
});

test("19. maksimal 15 reset", () => {
  const g = newGame();
  setRows(g, {});
  put(g, O, 0, 3, 0);
  const start = S(g).pieces;
  for (let i = 0; i < 15; i++) tick(g, i % 2 === 0 ? ACT.LEFT : ACT.RIGHT);
  assert.equal(S(g).resets, 15);
  assert.equal(S(g).pieces, start, "15 reset masih memperpanjang");
  tick(g, ACT.RIGHT);
  assert.equal(S(g).pieces, start + 1, "aksi ke-16 langsung mengunci");
  assert.ok(locked(g));
});

test("20. reset kembali 0 saat piece mencapai baris lebih rendah", () => {
  const g = newGame();
  setRows(g, { 0: "....##...." });
  put(g, O, 0, 3, 1); // berdiri di atas tonjolan
  const start = S(g).pieces;
  for (let i = 0; i < 15; i++) tick(g, i % 2 === 0 ? ACT.LEFT : ACT.RIGHT);
  assert.equal(S(g).resets, 15);
  tick(g, ACT.RIGHT, ACT.RIGHT, ACT.RIGHT, ACT.SOFT_ON); // keluar dari tonjolan
  assert.equal(S(g).pieces, start);
  for (let i = 0; i < 10 && S(g).y > 0; i++) tick(g);
  assert.equal(S(g).y, 0);
  assert.equal(S(g).resets, 0);
  assert.equal(S(g).forceLock, false);
  assert.equal(S(g).pieces, start);
});

// ---------- 21: tanpa jeda ----------

test("21. piece berikutnya muncul di tick clear dan bisa digeser di tick berikutnya", () => {
  const g = newGame();
  setRows(g, { 0: ".#########", 1: LONE });
  put(g, I, 1, -2, 0);
  tick(g, ACT.HARD);
  assert.equal(events(g, EV.CLEAR).length, 1);
  assert.equal(events(g, EV.SPAWN).length, 1);
  const x = S(g).x;
  tick(g, ACT.LEFT);
  assert.equal(S(g).x, x - 1);
});

// ---------- 22: mode ----------

test("22a. Sprint selesai di baris ke-40", () => {
  const g = newGame("sprint40");
  setRows(g, { 0: ".#########", 1: LONE });
  S(g).lines = 39;
  put(g, I, 1, -2, 0);
  tick(g, ACT.HARD);
  assert.equal(S(g).status, STATUS.FINISHED);
  assert.equal(events(g, EV.FINISH).length, 1);
  assert.equal(S(g).level, 1);
});

test("22b. Ultra berhenti di tick 7200", () => {
  const g = newGame("ultra");
  for (let i = 0; i < 7199; i++) tick(g);
  assert.equal(S(g).status, STATUS.PLAYING);
  tick(g);
  assert.equal(S(g).status, STATUS.TIME_UP);
  assert.equal(S(g).tick, 7200);
});

const BLOCK_SPAWN = { 18: "...####...", 19: "...####...", 20: "...####...", 21: "...####..." };

test("22c. Zen mengosongkan board saat top out", () => {
  const g = newGame("zen");
  setRows(g, BLOCK_SPAWN);
  S(g).score = 500;
  put(g, O, 0, -1, 0);
  tick(g, ACT.HARD);
  assert.equal(S(g).status, STATUS.PLAYING);
  assert.equal(events(g, EV.ZEN_RESET).length, 1);
  assert.equal(S(g).score, 500);
  const filled = S(g).board.reduce((n, v) => n + (v ? 1 : 0), 0);
  assert.equal(filled, 0);
});

test("22d. Maraton berakhir saat block out", () => {
  const g = newGame("marathon150");
  setRows(g, BLOCK_SPAWN);
  put(g, O, 0, -1, 0);
  tick(g, ACT.HARD);
  assert.equal(S(g).status, STATUS.GAME_OVER);
  assert.equal(events(g, EV.GAME_OVER)[0]!.a, 0);
});

// ---------- 23: hold ----------

test("23. hold sekali per piece", () => {
  const g = newGame();
  const first = S(g).type;
  const second = g.peekNext(0);
  tick(g, ACT.HOLD, ACT.HOLD);
  assert.equal(S(g).hold, first);
  assert.equal(S(g).type, second);
  assert.equal(events(g, EV.HOLD).length, 1, "hold kedua diabaikan");
  tick(g, ACT.HARD);
  const third = S(g).type;
  tick(g, ACT.HOLD);
  assert.equal(events(g, EV.HOLD).length, 1, "hold tersedia lagi setelah lock");
  assert.equal(S(g).hold, third);
  assert.equal(S(g).type, first);
});

// ---------- 24: replay ----------

test("24. seed dan aksi sama menghasilkan permainan identik", () => {
  const play = () => {
    const g = newGame("marathonEndless", 1234);
    let r = 99;
    const acts = [ACT.LEFT, ACT.RIGHT, ACT.ROT_CW, ACT.ROT_CCW, ACT.HARD, ACT.HOLD, ACT.SOFT_ON, ACT.SOFT_OFF];
    for (let i = 0; i < 3000 && S(g).status === STATUS.PLAYING; i++) {
      r = (r * 1103515245 + 12345) >>> 0;
      if (r % 3 === 0) tick(g, acts[(r >>> 8) % acts.length]!);
      else tick(g);
    }
    return { board: [...S(g).board].join(""), score: S(g).score, lines: S(g).lines, tick: S(g).tick };
  };
  const a = play();
  assert.deepEqual(play(), a);
  assert.ok(a.score > 0);
});

// ---------- 25: i18n ----------

test("25. key i18n id dan en identik dan tidak kosong", () => {
  const idKeys = Object.keys(id).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, idKeys);
  for (const k of idKeys) {
    assert.ok((id as Record<string, string>)[k]!.length > 0, `id ${k}`);
    assert.ok((en as Record<string, string>)[k]!.length > 0, `en ${k}`);
  }
});
