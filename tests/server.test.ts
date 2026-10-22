// Tes leaderboard (PRD-7) dengan Redis tiruan di memori: hanya perintah yang dipakai server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submit, top, RATE_PER_MIN, type Store } from "../src/server/leaderboard.ts";
import { ReplayRecorder, toBase64, type Replay } from "../src/core/replay.ts";
import { createGame, STATUS } from "../src/core/game.ts";
import { ACT } from "../src/core/constants.ts";
import type { ModeId } from "../src/core/modes.ts";

function fakeRedis(): Store {
  const kv = new Map<string, string>();
  const z = new Map<string, Map<string, number>>();
  const h = new Map<string, Map<string, string>>();
  const zs = (k: string) => z.get(k) ?? (z.set(k, new Map()), z.get(k)!);
  const sorted = (k: string, rev: boolean) => [...zs(k)].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]) || a[0].localeCompare(b[0]));
  return async (cmd) => {
    const [c, ...a] = cmd.map(String);
    switch (c) {
      case "INCR": {
        const v = Number(kv.get(a[0]!) ?? 0) + 1;
        kv.set(a[0]!, String(v));
        return v;
      }
      case "EXPIRE":
        return 1;
      case "SET":
        if (a[2] === "NX" && kv.has(a[0]!)) return null;
        kv.set(a[0]!, a[1]!);
        return "OK";
      case "GET":
        return kv.get(a[0]!) ?? null;
      case "ZADD": {
        const [key, flag, , score, member] = a as [string, string, string, string, string];
        const set = zs(key);
        const cur = set.get(member);
        const s = Number(score);
        if (cur === undefined || (flag === "GT" ? s > cur : s < cur)) {
          set.set(member, s);
          return 1;
        }
        return 0;
      }
      case "ZSCORE":
        return zs(a[0]!).has(a[1]!) ? String(zs(a[0]!).get(a[1]!)) : null;
      case "ZRANK":
      case "ZREVRANK":
        return sorted(a[0]!, c === "ZREVRANK").findIndex(([m]) => m === a[1]);
      case "ZRANGE": {
        const rev = a.includes("REV");
        return sorted(a[0]!, rev)
          .slice(Number(a[1]), Number(a[2]) + 1)
          .flatMap(([m, s]) => [m, String(s)]);
      }
      case "HSET": {
        const m = h.get(a[0]!) ?? (h.set(a[0]!, new Map()), h.get(a[0]!)!);
        m.set(a[1]!, a[2]!);
        return 1;
      }
      case "HMGET":
        return a.slice(1).map((f) => h.get(a[0]!)?.get(f) ?? null);
    }
    throw new Error(`perintah tidak didukung: ${c}`);
  };
}

/** Permainan acak deterministik sampai selesai, direkam. */
function recorded(mode: ModeId, seed: number, rngSeed = 3): Replay {
  const g = createGame(mode, seed, { softDropFactor: 20 });
  const r = new ReplayRecorder();
  let x = rngSeed;
  const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) % 1000) / 1000;
  const acts = new Uint8Array(4);
  for (let t = 0; t < 60 * 60 * 20 && g.state.status === STATUS.PLAYING; t++) {
    let n = 0;
    const p = rnd();
    if (p < 0.06) acts[n++] = ACT.HARD;
    else if (p < 0.16) acts[n++] = ACT.LEFT;
    else if (p < 0.26) acts[n++] = ACT.RIGHT;
    else if (p < 0.31) acts[n++] = ACT.ROT_CW;
    r.record(t, acts, n);
    g.events.clear();
    g.step(acts, n);
  }
  return { mode, seed, ticks: r.ticks, soft: 20, data: toBase64(r.bytes()) };
}

const KEY_A = "a".repeat(32);
const KEY_B = "b".repeat(32);
const now = new Date("2026-10-22T10:00:00Z");

test("server: skor sah masuk peringkat, nilai dihitung ulang dari rekaman", async () => {
  const store = fakeRedis();
  const rep = recorded("ultra", 4);
  const res = await submit(store, { name: "Andra", key: KEY_A, replay: { ...rep, score: 999999999 } }, "1.1.1.1", now);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.rank, 1);
  assert.ok(res.best > 0 && res.best < 999999999, "skor yang diklaim perangkat diabaikan");
  const list = await top(store, "ultra");
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name, "Andra");
  assert.equal(list[0]!.value, res.best);
  assert.equal(list[0]!.at, now.toISOString());
});

test("server: hanya skor terbaik per nama yang disimpan; urutan Ultra naik, Sprint turun", async () => {
  const store = fakeRedis();
  const a = recorded("ultra", 4, 3);
  const b = recorded("ultra", 4, 99);
  const r1 = await submit(store, { name: "Andra", key: KEY_A, replay: a }, "1.1.1.1", now);
  const r2 = await submit(store, { name: "Andra", key: KEY_A, replay: b }, "1.1.1.1", now);
  assert.ok(r1.ok && r2.ok);
  if (!r1.ok || !r2.ok) return;
  assert.equal(r2.best, Math.max(r1.best, r2.best), "nilai tersimpan adalah yang terbaik");
  assert.equal((await top(store, "ultra")).length, 1, "satu entri per nama");
  await submit(store, { name: "Budi", key: KEY_B, replay: recorded("ultra", 8) }, "1.1.1.2", now);
  const list = await top(store, "ultra");
  assert.ok(list[0]!.value >= list[1]!.value, "Ultra: skor terbesar di atas");
});

test("server: rekaman palsu, mode salah, dan permainan yang belum selesai ditolak", async () => {
  const store = fakeRedis();
  const rep = recorded("ultra", 4);
  const bad = await submit(store, { name: "Andra", key: KEY_A, replay: { ...rep, data: rep.data.slice(0, -8) } }, "1.1.1.1", now);
  assert.deepEqual(bad, { ok: false, status: 422, error: "rejected" });
  const short = await submit(store, { name: "Andra", key: KEY_A, replay: { ...rep, ticks: 100 } }, "1.1.1.1", now);
  assert.equal(short.ok, false, "dipotong sebelum permainan berakhir");
  const zen = await submit(store, { name: "Andra", key: KEY_A, replay: { ...rep, mode: "zen" } }, "1.1.1.1", now);
  assert.deepEqual(zen, { ok: false, status: 400, error: "bad_request" });
  // Sprint yang tidak mencapai 40 baris tidak punya waktu, jadi ditolak.
  const sprint = await submit(store, { name: "Andra", key: KEY_A, replay: recorded("sprint40", 4) }, "1.1.1.1", now);
  assert.equal(sprint.ok, false);
  assert.equal((await top(store, "ultra")).length, 0);
});

test("server: nama milik kode rahasia pertama; nama dan kode tidak sah ditolak", async () => {
  const store = fakeRedis();
  const rep = recorded("ultra", 4);
  assert.equal((await submit(store, { name: "Andra", key: KEY_A, replay: rep }, "1.1.1.1", now)).ok, true);
  const taken = await submit(store, { name: "andra", key: KEY_B, replay: rep }, "1.1.1.2", now);
  assert.deepEqual(taken, { ok: false, status: 409, error: "name_taken" }, "huruf besar kecil dianggap sama");
  assert.equal((await submit(store, { name: "Andra", key: KEY_A, replay: rep }, "1.1.1.1", now)).ok, true, "pemilik tetap bisa");
  for (const name of ["A", "x".repeat(17), "<script>", "nama\nbaru", ""]) {
    assert.deepEqual(await submit(store, { name, key: KEY_A, replay: rep }, "1.1.1.3", now), { ok: false, status: 400, error: "bad_name" }, JSON.stringify(name));
  }
  assert.deepEqual(await submit(store, { name: "Citra", key: "pendek", replay: rep }, "1.1.1.3", now), { ok: false, status: 400, error: "bad_request" });
  assert.deepEqual(await submit(store, null, "1.1.1.3", now), { ok: false, status: 400, error: "bad_request" });
});

test("server: batas kiriman per IP per menit", async () => {
  const store = fakeRedis();
  const rep = recorded("ultra", 4);
  for (let i = 0; i < RATE_PER_MIN; i++) await submit(store, { name: "Andra", key: KEY_A, replay: rep }, "9.9.9.9", now);
  assert.deepEqual(await submit(store, { name: "Andra", key: KEY_A, replay: rep }, "9.9.9.9", now), { ok: false, status: 429, error: "rate_limited" });
  assert.equal((await submit(store, { name: "Andra", key: KEY_A, replay: rep }, "9.9.9.9", new Date(now.getTime() + 61000))).ok, true, "menit berikutnya boleh lagi");
});
