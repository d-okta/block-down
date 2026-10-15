import { TICK_HZ } from "./constants.ts";

export type ModeId = "marathon150" | "marathonEndless" | "sprint40" | "ultra" | "zen";

export interface ModeState {
  lines: number;
  tick: number;
}

/** 0 lanjut, 2 target tercapai, 3 waktu habis (sama dengan GameState.status). */
export type EndResult = 0 | 2 | 3;

export interface Mode {
  id: ModeId;
  levelFor(lines: number): number;
  checkEnd(s: ModeState): EndResult;
  onTopOut(): "gameOver" | "reset";
}

const marathonLevel = (lines: number): number => 1 + Math.floor(lines / 10);
const fixedLevel = (): number => 1;
const never = (): EndResult => 0;
const gameOver = (): "gameOver" => "gameOver";

export const ULTRA_TICKS = 120 * TICK_HZ;

export const MODES: Record<ModeId, Mode> = {
  marathon150: {
    id: "marathon150",
    levelFor: marathonLevel,
    checkEnd: (s) => (s.lines >= 150 ? 2 : 0),
    onTopOut: gameOver,
  },
  marathonEndless: { id: "marathonEndless", levelFor: marathonLevel, checkEnd: never, onTopOut: gameOver },
  sprint40: {
    id: "sprint40",
    levelFor: fixedLevel,
    checkEnd: (s) => (s.lines >= 40 ? 2 : 0),
    onTopOut: gameOver,
  },
  ultra: {
    id: "ultra",
    levelFor: marathonLevel,
    checkEnd: (s) => (s.tick >= ULTRA_TICKS ? 3 : 0),
    onTopOut: gameOver,
  },
  zen: { id: "zen", levelFor: fixedLevel, checkEnd: never, onTopOut: () => "reset" },
};
