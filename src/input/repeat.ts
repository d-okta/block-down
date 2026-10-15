// Mengubah tekan/lepas tombol abstrak menjadi aksi core per tick, termasuk DAS dan ARR
// (SPEC 7.2, EDD-2 bagian 2.2). Waktu memakai jam simulasi, jadi perilaku sama di 60 Hz dan 120 Hz.
import { ACT } from "../core/constants.ts";

export const BTN = { LEFT: 0, RIGHT: 1, SOFT: 2, HARD: 3, CW: 4, CCW: 5, HOLD: 6 } as const;
export type BtnCode = (typeof BTN)[keyof typeof BTN];

const QCAP = 64;
const MAX_SHIFT_PER_TICK = 10; // cukup untuk mentok dinding dari posisi mana pun

export interface ActionBuffer {
  data: Uint8Array;
  count: number;
}

export function createActionBuffer(): ActionBuffer {
  return { data: new Uint8Array(32), count: 0 };
}

export class InputRepeater {
  das: number;
  arr: number;
  // Antrean event: waktu simulasi, tombol, 1 tekan / 0 lepas.
  private qTime = new Float64Array(QCAP);
  private qBtn = new Uint8Array(QCAP);
  private qDown = new Uint8Array(QCAP);
  private qHead = 0;
  private qLen = 0;
  private held = new Uint8Array(7);
  private dir = 0; // -1, 0, 1
  private nextRepeat = 0;

  constructor(das: number, arr: number) {
    this.das = das;
    this.arr = arr;
  }

  /** time: waktu simulasi (ms) saat event terjadi. */
  push(btn: BtnCode, down: boolean, time: number): void {
    if (this.qLen === QCAP) return; // 64 event dalam satu tick tidak terjadi pada input manusia
    const i = (this.qHead + this.qLen) % QCAP;
    this.qTime[i] = time;
    this.qBtn[i] = btn;
    this.qDown[i] = down ? 1 : 0;
    this.qLen++;
  }

  /** Lepas semua tombol (blur, pause). */
  releaseAll(): void {
    this.qLen = 0;
    this.held.fill(0);
    this.dir = 0;
  }

  isHeld(btn: BtnCode): boolean {
    return this.held[btn] === 1;
  }

  /** Isi `out` dengan aksi untuk tick yang berakhir di waktu simulasi `now`. */
  fill(now: number, out: ActionBuffer): void {
    out.count = 0;
    while (this.qLen > 0 && this.qTime[this.qHead]! <= now) {
      const t = this.qTime[this.qHead]!;
      const btn = this.qBtn[this.qHead] as BtnCode;
      const down = this.qDown[this.qHead] === 1;
      this.qHead = (this.qHead + 1) % QCAP;
      this.qLen--;
      this.handle(btn, down, t, out);
    }
    if (this.dir !== 0 && now >= this.nextRepeat) {
      const act = this.dir < 0 ? ACT.LEFT : ACT.RIGHT;
      let n: number;
      if (this.arr === 0) {
        n = MAX_SHIFT_PER_TICK;
        this.nextRepeat = now;
      } else {
        n = Math.min(Math.floor((now - this.nextRepeat) / this.arr) + 1, MAX_SHIFT_PER_TICK);
        this.nextRepeat += n * this.arr;
        if (this.nextRepeat <= now) this.nextRepeat = now + this.arr; // tertinggal jauh: jangan menumpuk
      }
      for (let i = 0; i < n; i++) emit(out, act);
    }
  }

  private handle(btn: BtnCode, down: boolean, t: number, out: ActionBuffer): void {
    const was = this.held[btn] === 1;
    this.held[btn] = down ? 1 : 0;
    if (btn === BTN.LEFT || btn === BTN.RIGHT) {
      const d = btn === BTN.LEFT ? -1 : 1;
      if (down && !was) {
        this.dir = d;
        this.nextRepeat = t + this.das;
        emit(out, d < 0 ? ACT.LEFT : ACT.RIGHT);
      } else if (!down && was && this.dir === d) {
        const other = d < 0 ? BTN.RIGHT : BTN.LEFT;
        if (this.held[other] === 1) {
          this.dir = -d;
          this.nextRepeat = t + this.das; // DAS dihitung ulang dari waktu lepas
        } else {
          this.dir = 0;
        }
      }
      return;
    }
    if (btn === BTN.SOFT) {
      if (down !== was) emit(out, down ? ACT.SOFT_ON : ACT.SOFT_OFF);
      return;
    }
    if (!down || was) return;
    if (btn === BTN.HARD) emit(out, ACT.HARD);
    else if (btn === BTN.CW) emit(out, ACT.ROT_CW);
    else if (btn === BTN.CCW) emit(out, ACT.ROT_CCW);
    else if (btn === BTN.HOLD) emit(out, ACT.HOLD);
  }
}

function emit(out: ActionBuffer, a: number): void {
  if (out.count < out.data.length) out.data[out.count++] = a;
}
