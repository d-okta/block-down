// Intensitas efek (DESIGN 8.5). Murni, tanpa DOM, supaya bisa dites.

export type FxLevel = "full" | "medium" | "minimal";

export interface FxScale {
  level: FxLevel;
  /** Pengali jumlah partikel (0 = tanpa partikel). */
  particles: number;
  /** Simpangan shake maksimum dalam piksel CSS. */
  shake: number;
  /** Opasitas shockwave, riak, gelombang (0 = tidak digambar). */
  waves: number;
  /** Pantulan elastis saat tumpukan turun. */
  bounce: boolean;
  /** Squash, kemiringan kick, garis jejak jatuh cepat. */
  feedback: boolean;
  /** Pita ambient bergerak naik-turun. */
  ambientMotion: boolean;
}

const TABLE: Record<FxLevel, FxScale> = {
  full: { level: "full", particles: 1, shake: 4, waves: 1, bounce: true, feedback: true, ambientMotion: true },
  medium: { level: "medium", particles: 0.5, shake: 2, waves: 0.5, bounce: false, feedback: true, ambientMotion: true },
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

/** Kurva masuk dan pegas (DESIGN 8.4 butir 5). t di 0..1. */
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn = (t: number): number => t * t;
/** Turun dengan sedikit pantulan: melewati 1 sedikit, lalu kembali. */
export const easeSpring = (t: number): number => 1 - Math.pow(1 - t, 3) * Math.cos(t * 6.5);
