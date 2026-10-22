// Leaderboard online (PRD-7). Logika server tanpa ketergantungan pada Vercel atau Upstash, supaya bisa
// dites dengan penyimpanan palsu. api/leaderboard.ts hanya menyambungkan ke HTTP dan Redis.
//
// Data di Redis:
//   lb:{mode}         sorted set, member = nama, score = nilai terbaik (Sprint: ms, makin kecil makin baik)
//   lbat:{mode}       hash, nama -> tanggal ISO nilai terbaik
//   name:{nama kecil} sha256 dari kode rahasia perangkat pemilik nama
//   rl:{ip}:{menit}   hitungan kiriman per IP per menit (kedaluwarsa 60 detik)
import { STATUS } from "../core/game.ts";
import { replay, type Replay } from "../core/replay.ts";

export const BOARD_MODES = ["sprint40", "ultra", "marathon150"] as const;
export type BoardMode = (typeof BOARD_MODES)[number];
export const TOP = 50;
export const RATE_PER_MIN = 10;
/** Sama dengan NAME_RE di store/storage.ts. */
const NAME_RE = /^[\p{L}\p{N} ._-]{2,16}$/u;

/** Penyimpanan: satu perintah Redis, hasil `result` dari REST API Upstash. */
export type Store = (cmd: (string | number)[]) => Promise<unknown>;

const lowerBetter = (m: BoardMode) => m === "sprint40";

export interface Entry {
  name: string;
  value: number;
  at: string;
}

export async function top(store: Store, mode: BoardMode): Promise<Entry[]> {
  const flat = (await store(lowerBetter(mode) ? ["ZRANGE", `lb:${mode}`, 0, TOP - 1, "WITHSCORES"] : ["ZRANGE", `lb:${mode}`, 0, TOP - 1, "REV", "WITHSCORES"])) as string[];
  const names: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    names.push(flat[i]!);
    values.push(Number(flat[i + 1]));
  }
  if (names.length === 0) return [];
  const ats = (await store(["HMGET", `lbat:${mode}`, ...names])) as (string | null)[];
  return names.map((name, i) => ({ name, value: values[i]!, at: ats[i] ?? "" }));
}

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type SubmitResult =
  | { ok: true; rank: number; best: number; improved: boolean }
  | { ok: false; status: number; error: "bad_request" | "bad_name" | "name_taken" | "rejected" | "rate_limited" };

/**
 * Kirim skor. Nilai dihitung ulang dari rekaman; nilai yang dikirim perangkat tidak dipakai.
 * Satu entri per nama per mode, hanya diganti jika lebih baik.
 */
export async function submit(store: Store, body: unknown, ip: string, now: Date): Promise<SubmitResult> {
  const b = body as { name?: unknown; key?: unknown; replay?: Partial<Replay> } | null;
  if (!b || typeof b !== "object") return { ok: false, status: 400, error: "bad_request" };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!NAME_RE.test(name)) return { ok: false, status: 400, error: "bad_name" };
  if (typeof b.key !== "string" || !/^[0-9a-f]{32}$/.test(b.key)) return { ok: false, status: 400, error: "bad_request" };
  const r = b.replay;
  if (!r || typeof r !== "object" || !BOARD_MODES.includes(r.mode as BoardMode) || typeof r.data !== "string") {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const mode = r.mode as BoardMode;

  // Batas kiriman per IP, sebelum pekerjaan berat (putar ulang).
  const minute = Math.floor(now.getTime() / 60000);
  const count = (await store(["INCR", `rl:${ip}:${minute}`])) as number;
  if (count === 1) await store(["EXPIRE", `rl:${ip}:${minute}`, 60]);
  if (count > RATE_PER_MIN) return { ok: false, status: 429, error: "rate_limited" };

  const res = replay({ mode, seed: Number(r.seed), ticks: Number(r.ticks), soft: r.soft as Replay["soft"], data: r.data });
  if (!res || res.status === STATUS.PLAYING) return { ok: false, status: 422, error: "rejected" };
  let value: number;
  if (mode === "sprint40") {
    if (res.sprintMs === null) return { ok: false, status: 422, error: "rejected" };
    value = res.sprintMs;
  } else {
    if (res.score <= 0) return { ok: false, status: 422, error: "rejected" };
    value = res.score;
  }

  // Kepemilikan nama: nama pertama kali dipakai oleh kode rahasia tertentu, setelah itu hanya kode itu.
  const owner = `name:${name.toLowerCase()}`;
  const hash = await sha256(b.key);
  const set = await store(["SET", owner, hash, "NX"]);
  if (set !== "OK") {
    const cur = (await store(["GET", owner])) as string | null;
    if (cur !== hash) return { ok: false, status: 409, error: "name_taken" };
  }

  const changed = (await store(["ZADD", `lb:${mode}`, lowerBetter(mode) ? "LT" : "GT", "CH", value, name])) as number;
  if (changed > 0) await store(["HSET", `lbat:${mode}`, name, now.toISOString()]);
  const best = Number(await store(["ZSCORE", `lb:${mode}`, name]));
  const rank = (await store([lowerBetter(mode) ? "ZRANK" : "ZREVRANK", `lb:${mode}`, name])) as number;
  return { ok: true, rank: rank + 1, best, improved: changed > 0 };
}
