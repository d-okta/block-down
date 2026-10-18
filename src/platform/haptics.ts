// Getar (SPEC 11.4). Web: navigator.vibrate. Android (Capacitor, Fase 5) menyusul di modul yang sama.
// Hanya untuk momen penting; geser, putar, dan lock tidak bergetar.

export type HapticKind = "hard" | "big" | "over";

const PATTERN: Record<HapticKind, number | number[]> = {
  hard: 12,
  big: [30, 40, 30],
  over: [60, 80, 120],
};

export const hapticsAvailable: boolean = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function vibrate(kind: HapticKind, enabled: boolean): void {
  if (!enabled || !hapticsAvailable) return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    // Beberapa browser melempar jika dipanggil tanpa interaksi pengguna; abaikan.
  }
}
