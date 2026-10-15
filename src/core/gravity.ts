import { MAX_G } from "./constants.ts";

// Unit gravitasi per tick (1 baris = 65536) untuk level 1..18, dari rumus SPEC 6.1:
// detik per baris = (0.8 - (L - 1) * 0.007) ^ (L - 1), lalu (1/60) / detik * 65536.
// Ditulis sebagai konstanta supaya hasil identik di semua mesin. Level 19 ke atas: MAX_G.
// prettier-ignore
const TABLE = Int32Array.of(
  1092, 1377, 1768, 2311, 3075, 4169, 5759, 8107, 11634,
  17026, 25416, 38709, 60169, 95483, 154742, 256187, 433425, 749597,
);

export function gravityFor(level: number): number {
  return level <= TABLE.length ? TABLE[Math.max(level, 1) - 1]! : MAX_G;
}
