// Satu-satunya modul yang menyentuh localStorage (SPEC 13, EDD-2 bagian 9).
// Fase 2 memakai rekor dan nilai bawaan pengaturan; layar Pengaturan menyusul di Fase 3.

export const KEY = "blockdown";
export const SCHEMA = 1;

export type Locale = "id" | "en";
export type Btn = "left" | "right" | "soft" | "hard" | "cw" | "ccw" | "hold";
export const BTNS: readonly Btn[] = ["left", "right", "soft", "hard", "cw", "ccw", "hold"];

export interface Settings {
  locale: Locale | null; // null = ikuti navigator.language
 dasMs: number;
  arrMs: number;
  softDropFactor: number | "instant";
  keymap: Record<Btn, string[]>;
  ghost: boolean;
  grid: boolean;
  colorSafe: boolean;
  effects: "full" | "medium" | "minimal";
  reduceMotion: boolean | null; // null = ikuti sistem
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
}

export interface ScoreRecord {
  score: number;
  lines: number;
  level: number;
  at: string;
}
export interface Records {
  marathon150?: ScoreRecord;
  marathonEndless?: ScoreRecord;
  sprint40?: { timeMs: number; at: string };
  ultra?: { score: number; lines: number; at: string };
  zen?: { lines: number; at: string };
}

export interface SaveData {
  schema: number;
  settings: Settings;
  records: Records;
}

export type LoadStatus = "ok" | "empty" | "corrupt" | "newer" | "unavailable";

export function defaultKeymap(): Record<Btn, string[]> {
  return {
    // Satu tombol per aksi (keputusan pemilik). Panah atas = simpan, sama seperti gestur seret ke atas.
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    soft: ["ArrowDown"],
    hard: ["Space"],
    cw: ["KeyX"],
    ccw: ["KeyZ"],
    hold: ["ArrowUp"],
  };
}

export function defaultSettings(): Settings {
  return {
    locale: null,
    dasMs: 167,
    arrMs: 33,
    softDropFactor: 20,
    keymap: defaultKeymap(),
    ghost: true,
    grid: true,
    colorSafe: false,
    effects: "full",
    reduceMotion: null,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    haptics: true,
  };
}

// ---------- validasi ----------

/** Sama dengan RESERVED_CODES di input/keyboard.ts; disalin supaya modul ini tetap bebas DOM. */
const RESERVED = new Set(["Escape", "KeyP", "Tab"]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number, def: number): number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : def;
const num = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : def;
const bool = (v: unknown, def: boolean): boolean => (typeof v === "boolean" ? v : def);
function oneOf<T>(v: unknown, list: readonly T[], def: T): T {
  return list.includes(v as T) ? (v as T) : def;
}
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isoDate = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

function readKeymap(v: unknown): Record<Btn, string[]> {
  const def = defaultKeymap();
  if (!isObj(v)) return def;
  const used = new Set<string>();
  const out = {} as Record<Btn, string[]>;
  for (const b of BTNS) {
    const raw = v[b];
    const codes = Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === "string" && /^[A-Za-z0-9]{1,24}$/.test(c) && !RESERVED.has(c))
      : [];
    const kept: string[] = [];
    for (const c of codes) {
      if (kept.length === 2 || used.has(c)) continue;
      used.add(c);
      kept.push(c);
    }
    out[b] = kept;
  }
  // Aksi tanpa tombol kembali ke bawaan, selama tombol bawaannya belum dipakai aksi lain.
  for (const b of BTNS) {
    if (out[b].length > 0) continue;
    out[b] = def[b].filter((c) => !used.has(c));
    out[b].forEach((c) => used.add(c));
  }
  return out;
}

function readSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  const sd = v["softDropFactor"];
  return {
    locale: v["locale"] === "id" || v["locale"] === "en" ? v["locale"] : null,
   dasMs: int(v["dasMs"], 50, 300, d.dasMs),
    arrMs: int(v["arrMs"], 0, 100, d.arrMs),
    softDropFactor: sd === "instant" ? "instant" : Number.isSafeInteger(sd) && (sd as number) % 5 === 0 ? int(sd, 5, 40, 20) : 20,
    keymap: readKeymap(v["keymap"]),
    ghost: bool(v["ghost"], d.ghost),
    grid: bool(v["grid"], d.grid),
    colorSafe: bool(v["colorSafe"], d.colorSafe),
    effects: oneOf(v["effects"], ["full", "medium", "minimal"] as const, d.effects),
    reduceMotion: v["reduceMotion"] === null ? null : typeof v["reduceMotion"] === "boolean" ? v["reduceMotion"] : null,
    musicVolume: num(v["musicVolume"], 0, 1, d.musicVolume),
    sfxVolume: num(v["sfxVolume"], 0, 1, d.sfxVolume),
    haptics: bool(v["haptics"], d.haptics),
  };
}

function readRecords(v: unknown): Records {
  const out: Records = {};
  if (!isObj(v)) return out;
  for (const k of ["marathon150", "marathonEndless"] as const) {
    const r = v[k];
    if (isObj(r) && count(r["score"]) && count(r["lines"]) && count(r["level"]) && isoDate(r["at"])) {
      out[k] = { score: r["score"], lines: r["lines"], level: r["level"], at: r["at"] };
    }
  }
  const s = v["sprint40"];
  if (isObj(s) && count(s["timeMs"]) && s["timeMs"] > 0 && isoDate(s["at"])) out.sprint40 = { timeMs: s["timeMs"], at: s["at"] };
  const u = v["ultra"];
  if (isObj(u) && count(u["score"]) && count(u["lines"]) && isoDate(u["at"])) {
    out.ultra = { score: u["score"], lines: u["lines"], at: u["at"] };
  }
  const z = v["zen"];
  if (isObj(z) && count(z["lines"]) && isoDate(z["at"])) out.zen = { lines: z["lines"], at: z["at"] };
  return out;
}

/** Validasi data mentah hasil JSON.parse. Dipisah dari load() supaya bisa dites tanpa localStorage. */
export function parseSave(raw: string | null): { data: SaveData; status: LoadStatus } {
  const fresh = (status: LoadStatus) => ({ data: { schema: SCHEMA, settings: defaultSettings(), records: {} }, status });
  if (raw === null) return fresh("empty");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fresh("corrupt");
  }
  if (!isObj(parsed)) return fresh("corrupt");
  const schema = int(parsed["schema"], 1, Number.MAX_SAFE_INTEGER, 0);
  if (schema === 0) return fresh("corrupt");
  // Belum ada migrasi: skema 1 adalah yang pertama. Migrasi berikutnya ditambahkan di sini, berurutan.
  const data: SaveData = {
    schema: SCHEMA,
    settings: readSettings(parsed["settings"]),
    records: readRecords(parsed["records"]),
  };
  return { data, status: schema > SCHEMA ? "newer" : "ok" };
}

// ---------- akses localStorage ----------

let readOnly = false;

export function load(): { data: SaveData; status: LoadStatus } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    readOnly = true;
    return { ...parseSave(null), status: "unavailable" };
  }
  const res = parseSave(raw);
  // Data rusak tidak ditimpa sampai ada penyimpanan yang diminta pemain; data versi baru tidak pernah ditimpa.
  readOnly = res.status === "newer";
  return res;
}

export function save(data: SaveData): boolean {
  if (readOnly) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------- rekor ----------

export type ResultInput =
  | { mode: "marathon150" | "marathonEndless"; score: number; lines: number; level: number }
  | { mode: "sprint40"; timeMs: number | null }
  | { mode: "ultra"; score: number; lines: number }
  | { mode: "zen"; lines: number };

/** Tulis rekor jika lebih baik. Mengembalikan true jika ini rekor baru. Tidak menyimpan ke storage. */
export function submitResult(records: Records, r: ResultInput, now: Date): boolean {
  const at = now.toISOString();
  switch (r.mode) {
    case "marathon150":
    case "marathonEndless": {
      const prev = records[r.mode];
      if (r.score <= 0 || (prev && prev.score >= r.score)) return false;
      records[r.mode] = { score: r.score, lines: r.lines, level: r.level, at };
      return true;
    }
    case "sprint40": {
      if (r.timeMs === null) return false;
      const prev = records.sprint40;
      if (prev && prev.timeMs <= r.timeMs) return false;
      records.sprint40 = { timeMs: r.timeMs, at };
      return true;
    }
    case "ultra": {
      const prev = records.ultra;
      if (r.score <= 0 || (prev && prev.score >= r.score)) return false;
      records.ultra = { score: r.score, lines: r.lines, at };
      return true;
    }
    case "zen": {
      const prev = records.zen;
      if (r.lines <= 0 || (prev && prev.lines >= r.lines)) return false;
      records.zen = { lines: r.lines, at };
      return true;
    }
  }
}
