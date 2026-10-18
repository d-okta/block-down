// Getar (SPEC 11.4). Web: navigator.vibrate. Android (Capacitor, Fase 5) menyusul di modul yang sama.
// Durasi dinaikkan setelah uji di Galaxy A13: 12 ms hampir tidak terasa di motor getar HP kelas bawah,
// yang butuh sekitar 30 ms sebelum getarannya terasa jelas.
import type { Power } from "../render/fx.ts";

export type HapticKind = "hard" | Power | "over";

const PATTERN: Record<string, number | number[]> = {
  hard: 35,
  1: 45,
  2: 60,
  3: [70, 40, 50],
  4: [110, 50, 90, 50, 140],
  5: [90, 40, 90, 40, 90, 40, 200],
  over: [120, 80, 250],
};

export const hapticsAvailable: boolean = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function vibrate(kind: HapticKind, enabled: boolean): void {
  if (!enabled || !hapticsAvailable) return;
  try {
    navigator.vibrate(PATTERN[kind]!);
  } catch {
    // Beberapa browser melempar jika dipanggil tanpa interaksi pengguna; abaikan.
  }
}
