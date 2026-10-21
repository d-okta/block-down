// Tema yang terbuka lewat prestasi (PRD-6). Fungsi murni, tanpa DOM, supaya bisa dites.

export const THEME_IDS = ["classic", "night", "neon", "dawn", "mono"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Syarat tiap tema (PRD-6 bagian 4 dan 15, angka diputuskan pemilik). */
export const MARATHON_LINES = 100;
export const SPRINT_MS = 3 * 60 * 1000;
export const QUADS_IN_GAME = 5;
/**
 * Monokrom: Bersih Total, atau combo ini dalam satu permainan. Combo dihitung mulai penghapusan kedua,
 * jadi Combo 3 = 4 kali menghapus baris berturut-turut (pemilik: Combo 8 masih terlalu sulit).
 */
export const MONO_COMBO = 3;

/** Hasil satu permainan yang selesai (bukan ditinggalkan lewat Ke Menu). */
export interface GameResult {
  mode: "marathon150" | "marathonEndless" | "sprint40" | "ultra" | "zen";
  /** Baris yang dihapus dalam permainan ini. */
  lines: number;
  /** Waktu Sprint 40 jika selesai, selain itu null. */
  sprintMs: number | null;
  quads: number;
  perfects: number;
  /** Combo terpanjang dalam permainan ini. */
  maxCombo: number;
}

/** Tema yang terpenuhi oleh satu permainan. */
export function earnedBy(r: GameResult): ThemeId[] {
  const out: ThemeId[] = [];
  if ((r.mode === "marathon150" || r.mode === "marathonEndless") && r.lines >= MARATHON_LINES) out.push("night");
  if (r.mode === "sprint40" && r.sprintMs !== null && r.sprintMs < SPRINT_MS) out.push("neon");
  if (r.quads >= QUADS_IN_GAME) out.push("dawn");
  if (r.perfects >= 1 || r.maxCombo >= MONO_COMBO) out.push("mono");
  return out;
}

/** Rekor lama yang tercatat sebelum tema ada (keputusan pemilik: tema langsung terbuka). */
export interface OldRecords {
  marathon150?: { lines: number };
  marathonEndless?: { lines: number };
  sprint40?: { timeMs: number };
}
export function earnedByRecords(r: OldRecords): ThemeId[] {
  const out: ThemeId[] = [];
  if ((r.marathon150?.lines ?? 0) >= MARATHON_LINES || (r.marathonEndless?.lines ?? 0) >= MARATHON_LINES) out.push("night");
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
