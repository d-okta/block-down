import { BTNS, type Btn } from "../store/storage.ts";
import { BTN, type BtnCode } from "./repeat.ts";

const CODE: Record<Btn, BtnCode> = {
  left: BTN.LEFT,
  right: BTN.RIGHT,
  soft: BTN.SOFT,
  hard: BTN.HARD,
  cw: BTN.CW,
  ccw: BTN.CCW,
  hold: BTN.HOLD,
};

/** Tombol yang tidak boleh dipetakan: Esc dan P untuk jeda, Tab untuk navigasi fokus. */
export const RESERVED_CODES: ReadonlySet<string> = new Set(["Escape", "KeyP", "Tab"]);

const NAMED: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Space: "Space",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  Enter: "Enter",
  Backspace: "Backspace",
};

/** Label pendek dari KeyboardEvent.code: "KeyX" jadi "X", "ArrowLeft" jadi "←". */
export function keyLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

export interface KeyboardHandlers {
  press(btn: BtnCode, down: boolean, timeStamp: number): void;
  pause(): void;
}

/**
 * Keyboard untuk layar Game. Aktif hanya saat `enabled` true, supaya Tab dan Space
 * tetap normal di menu dan dialog (EDD-2 bagian 2.3).
 */
export class Keyboard {
  enabled = false;
  private map = new Map<string, BtnCode>();
  private h: KeyboardHandlers;

  constructor(h: KeyboardHandlers) {
    this.h = h;
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
  }

  setKeymap(km: Record<Btn, string[]>): void {
    this.map.clear();
    for (const b of BTNS) for (const code of km[b]) this.map.set(code, CODE[b]);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.enabled) return;
    if (e.code === "Escape" || e.code === "KeyP") {
      if (down && !e.repeat) {
        e.preventDefault();
        this.h.pause();
      }
      return;
    }
    const btn = this.map.get(e.code);
    if (btn === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    this.h.press(btn, down, e.timeStamp);
  }
}
