// Gamepad lewat Gamepad API, mapping standar (SPEC 11.3, EDD-2 bagian 2.6).
// Dibaca sekali per frame. Hanya perubahan tombol yang diteruskan.
import { BTN, type BtnCode } from "./repeat.ts";

/** Indeks tombol standar ke tombol abstrak permainan. -1 = jeda. */
const GAME_MAP: ReadonlyArray<readonly [number, BtnCode | -1]> = [
  [14, BTN.LEFT], // D-pad kiri
  [15, BTN.RIGHT], // D-pad kanan
  [13, BTN.SOFT], // D-pad bawah
  [12, BTN.HARD], // D-pad atas
  [0, BTN.CW], // A
  [1, BTN.CCW], // B
  [4, BTN.HOLD], // LB
  [5, BTN.HOLD], // RB
  [9, -1], // Start
];

export type MenuNav = "up" | "down" | "left" | "right" | "ok" | "back";
const MENU_MAP: ReadonlyArray<readonly [number, MenuNav]> = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
  [0, "ok"],
  [1, "back"],
  [9, "back"],
];

const STICK = 0.5;

export interface GamepadHandlers {
  press(btn: BtnCode, down: boolean, time: number): void;
  pause(): void;
  menu(nav: MenuNav): void;
  connected(on: boolean): void;
}

export class GamepadInput {
  /** true saat layar Game aktif dan berjalan; false = navigasi menu. */
  playing = false;
  private prev = new Uint8Array(20);
  private h: GamepadHandlers;
  private count = 0;

  constructor(h: GamepadHandlers) {
    this.h = h;
    window.addEventListener("gamepadconnected", () => {
      this.count++;
      h.connected(true);
    });
    window.addEventListener("gamepaddisconnected", () => {
      this.count = Math.max(0, this.count - 1);
      this.prev.fill(0);
      h.connected(false);
    });
  }

  get active(): boolean {
    return this.count > 0;
  }

  /**
   * Dipanggil saat berpindah antara menu dan permainan. Tombol yang masih ditekan dicatat
   * sebagai sudah ditekan, supaya tidak terbaca sebagai tekan baru di konteks berikutnya
   * (misalnya Start yang membuka Pause langsung terbaca sebagai "kembali" di menu Pause).
   */
  reset(): void {
    const pad = this.pad();
    for (let i = 0; i < 17; i++) this.prev[i] = pad ? this.read(pad, i) : 0;
  }

  private pad(): Gamepad | null {
    if (this.count === 0 || !navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected && p.mapping === "standard") return p;
    }
    return null;
  }

  private read(pad: Gamepad, i: number): number {
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (pad.buttons[i]?.pressed) return 1;
    // Stik kiri ikut menggerakkan arah. Atas/bawah stik hanya untuk menu, supaya tidak tak sengaja jatuh cepat.
    if (i === 14 && ax < -STICK) return 1;
    if (i === 15 && ax > STICK) return 1;
    if (i === 13 && ay > STICK && !this.playing) return 1;
    if (i === 12 && ay < -STICK && !this.playing) return 1;
    return 0;
  }

  poll(now: number): void {
    const pad = this.pad();
    if (!pad) return;
    for (let i = 0; i < 17; i++) {
      const on = this.read(pad, i);
      if (on === this.prev[i]) continue;
      this.prev[i] = on;
      const wasPlaying = this.playing;
      if (wasPlaying) {
        for (const [idx, btn] of GAME_MAP) {
          if (idx !== i) continue;
          if (btn === -1) {
            if (on) this.h.pause();
          } else this.h.press(btn, on === 1, now);
        }
      } else if (on) {
        for (const [idx, nav] of MENU_MAP) if (idx === i) this.h.menu(nav);
      }
      // Pause atau mulai permainan mengubah konteks; sisa tombol dibaca di frame berikutnya.
      if (this.playing !== wasPlaying) return;
    }
  }
}
