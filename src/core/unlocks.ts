// Tema yang terbuka lewat prestasi (PRD-6). Fungsi murni, tanpa DOM, supaya bisa dites.

export const THEME_IDS = ["classic", "night", "neon", "dawn", "mono"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Syarat tiap tema (PRD-6 bagian 4, angka diputuskan pemilik). */
export const SPRINT_MS = 3 * 60 * 1000;
export const QUADS_IN_GAME = 10;

/** Hasil satu permainan yang selesai (bukan ditinggalkan lewat Ke Menu). */
export interface GameResult {
  mode: "marathon150" | "marathonEndless" | "sprint40" | "ultra" | "zen";
  /** Maraton 150 mencapai 150 baris (status FINISHED). */
  marathonDone: boolean;
  /** Waktu Sprint 40 jika selesai, selain itu null. */
  sprintMs: number | null;
  quads: number;
  perfects: number;
}

/** Tema yang terpenuhi oleh satu permainan. */
export function earnedBy(r: GameResult): ThemeId[] {
  const out: ThemeId[] = [];
  if (r.mode === "marathon150" && r.marathonDone) out.push("night");
  if (r.mode === "sprint40" && r.sprintMs !== null && r.sprintMs < SPRINT_MS) out.push("neon");
  if (r.quads >= QUADS_IN_GAME) out.push("dawn");
  if (r.perfects >= 1) out.push("mono");
  return out;
}

/** Rekor lama yang tercatat sebelum tema ada (keputusan pemilik: tema langsung terbuka). */
export interface OldRecords {
  marathon150?: { lines: number };
  sprint40?: { timeMs: number };
}
export function earnedByRecords(r: OldRecords): ThemeId[] {
  const out: ThemeId[] = [];
  if (r.marathon150 && r.marathon150.lines >= 150) out.push("night");
  if (r.sprint40 && r.sprint40.timeMs < SPRINT_MS) out.push("neon");
  return out;
}

/** Catat tema baru ke `unlocks` (id -> tanggal ISO). Mengembalikan yang baru saja terbuka. */
export function unlock(unlocks: Partial<Record<ThemeId, string>>, ids: readonly ThemeId[], now: Date): ThemeId[] {
  const fresh: ThemeId[] = [];
  for (const id of ids) {
    if (id === "classic" || unlocks[id]) continue;
    unlocks[id] = now.toISOString();
    fresh.push(id);
  }
  return fresh;
}

export function isUnlocked(unlocks: Partial<Record<ThemeId, string>>, id: ThemeId): boolean {
  return id === "classic" || !!unlocks[id];
}
