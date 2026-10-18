// Intensitas efek (DESIGN 8.5). Murni, tanpa DOM, supaya bisa dites.

export type FxLevel = "full" | "medium" | "minimal";

export interface FxScale {
  level: FxLevel;
  /** Pengali jumlah partikel (0 = tanpa partikel). */
  particles: number;
  /** Simpangan shake maksimum dalam piksel CSS (untuk momen terbesar). */
  shake: number;
  /** Opasitas kilat, pilar cahaya, shockwave, cincin, gelombang (0 = tidak digambar). */
  waves: number;
  /** Pantulan elastis saat tumpukan turun, dan papan menghentak (zoom kecil). */
  bounce: boolean;
  /** Squash, kemiringan kick, garis jejak dan debu jatuh cepat. */
  feedback: boolean;
  /** Pita ambient bergerak naik-turun. */
  ambientMotion: boolean;
}

// Shake penuh 10 px (keputusan pemilik setelah uji Fase 4 tahap 1; sebelumnya 4 px).
const TABLE: Record<FxLevel, FxScale> = {
  full: { level: "full", particles: 1, shake: 10, waves: 1, bounce: true, feedback: true, ambientMotion: true },
  medium: { level: "medium", particles: 0.5, shake: 3, waves: 0.5, bounce: false, feedback: true, ambientMotion: true },
  minimal: { level: "minimal", particles: 0, shake: 0, waves: 0, bounce: false, feedback: false, ambientMotion: false },
};

/**
 * Kurangi animasi (pengaturan pemain, atau ikut sistem jika null) mengunci intensitas ke Minimal.
 * DESIGN 10 butir 5: dua kontrol terpisah, Kurangi animasi menang.
 */
export function effectiveFx(effects: FxLevel, reduceMotion: boolean | null, systemReduce: boolean): FxScale {
  const reduce = reduceMotion ?? systemReduce;
  return TABLE[reduce ? "minimal" : effects];
}

/**
 * Kekuatan momen (DESIGN 8.3, revisi): 1 Single, 2 Double, 3 Triple, 4 4 Baris atau T-Spin besar,
 * 5 Bersih Total. Combo panjang menaikkan satu tingkat.
 */
export type Power = 1 | 2 | 3 | 4 | 5;

export function clearPower(lines: number, spin: number, perfect: boolean, combo: number): Power {
  if (perfect) return 5;
  let p = lines;
  if (spin === 2 && lines > 0) p = lines + 2; // T-Spin penuh dengan baris
  else if (spin === 2) p = 2; // T-Spin tanpa baris
  else if (spin === 1) p = Math.max(1, lines); // Mini
  if (combo >= 3) p++;
  return Math.max(1, Math.min(4, p)) as Power;
}

/** Bagian dari shake maksimum per kekuatan: Single tanpa shake, 4 Baris dan Bersih Total penuh. */
export const SHAKE_SHARE = [0, 0, 0.2, 0.4, 1, 1] as const;

/** Kurva masuk dan pegas (DESIGN 8.4 butir 5). t di 0..1. */
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn = (t: number): number => t * t;
/** Turun dengan sedikit pantulan: melewati 1 sedikit, lalu kembali. */
export const easeSpring = (t: number): number => 1 - Math.pow(1 - t, 3) * Math.cos(t * 6.5);
