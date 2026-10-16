// Pengenal gestur sentuh untuk mode Gestur (SPEC 11.2, EDD-2 bagian 2.5).
// Murni: menerima titik (x, y, waktu) dan memanggil `emit` dengan tombol abstrak. Tidak menyentuh DOM.
import { BTN, type BtnCode } from "./repeat.ts";

/** Nilai awal; disetel ulang setelah uji di Galaxy A13. Satuan jarak = lebar satu sel. */
export const GESTURE = {
  TAP_MAX_MS: 220,
  TAP_MAX_MOVE: 0.5,
  /** Kecepatan sapuan (sel per detik) yang dianggap jatuh cepat atau simpan. */
  FLICK_SPEED: 25,
  /** Jarak minimum sapuan vertikal agar dihitung sebagai sapuan. */
  FLICK_MIN: 1.5,
  /** Gerak pertama di atas jarak ini mengunci arah. */
  LOCK_DIST: 0.5,
} as const;

export type Emit = (btn: BtnCode, down: boolean, time: number) => void;

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  startT: number;
  refX: number;
  refY: number;
  axis: 0 | 1 | 2; // 0 belum, 1 horizontal, 2 vertikal
  softOn: boolean;
  // Dua sampel terakhir untuk kecepatan saat jari diangkat.
  prevY: number;
  prevT: number;
  lastY: number;
  lastT: number;
  moved: boolean;
}

export class GestureRecognizer {
  /** Lebar satu sel dalam piksel CSS. */
  unit = 20;
  private pts: Pointer[] = [];
  private maxActive = 0;
  private emit: Emit;

  constructor(emit: Emit) {
    this.emit = emit;
  }

  down(id: number, x: number, y: number, t: number): void {
    this.pts.push({ id, startX: x, startY: y, startT: t, refX: x, refY: y, axis: 0, softOn: false, prevY: y, prevT: t, lastY: y, lastT: t, moved: false });
    this.maxActive = Math.max(this.maxActive, this.pts.length);
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.pts.find((q) => q.id === id);
    if (!p) return;
    const u = this.unit;
    p.prevY = p.lastY;
    p.prevT = p.lastT;
    p.lastY = y;
    p.lastT = t;
    const dx = x - p.startX;
    const dy = y - p.startY;
    if (p.axis === 0) {
      if (Math.abs(dx) < GESTURE.LOCK_DIST * u && Math.abs(dy) < GESTURE.LOCK_DIST * u) return;
      p.axis = Math.abs(dx) >= Math.abs(dy) ? 1 : 2;
      p.moved = true;
    }
    if (p.axis === 1) {
      // Satu geser untuk setiap satu sel yang ditempuh sejak titik acuan.
      while (x - p.refX >= u) {
        this.tap(BTN.RIGHT, t);
        p.refX += u;
      }
      while (p.refX - x >= u) {
        this.tap(BTN.LEFT, t);
        p.refX -= u;
      }
      return;
    }
    // Vertikal ke bawah: jatuh pelan selama jari bergerak turun. Naik atau berhenti: lepas.
    const goingDown = y - p.refY >= u * 0.25;
    const goingUp = p.refY - y >= u * 0.25;
    if (goingDown) {
      if (!p.softOn) {
        p.softOn = true;
        this.emit(BTN.SOFT, true, t);
      }
      p.refY = y;
    } else if (goingUp) {
      if (p.softOn) {
        p.softOn = false;
        this.emit(BTN.SOFT, false, t);
      }
      p.refY = y;
    }
  }

  up(id: number, x: number, y: number, t: number): void {
    const i = this.pts.findIndex((q) => q.id === id);
    if (i < 0) return;
    const p = this.pts[i]!;
    this.pts.splice(i, 1);
    const u = this.unit;
    if (p.softOn) this.emit(BTN.SOFT, false, t);

    const dur = t - p.startT;
    const dist = Math.hypot(x - p.startX, y - p.startY);
    if (!p.moved && dur <= GESTURE.TAP_MAX_MS && dist <= GESTURE.TAP_MAX_MOVE * u) {
      // Ketuk saat dua jari menempel: putar kiri. Satu jari: putar kanan.
      if (this.maxActive >= 2) {
        if (this.pts.length === 0) this.tap(BTN.CCW, t);
      } else {
        this.tap(BTN.CW, t);
      }
    } else if (p.axis === 2) {
      const dt = Math.max(1, t - p.prevT);
      const speed = ((y - p.prevY) / u) * (1000 / dt);
      const total = (y - p.startY) / u;
      if (speed >= GESTURE.FLICK_SPEED && total >= GESTURE.FLICK_MIN) this.tap(BTN.HARD, t);
      else if (-speed >= GESTURE.FLICK_SPEED && -total >= GESTURE.FLICK_MIN) this.tap(BTN.HOLD, t);
    }
    if (this.pts.length === 0) this.maxActive = 0;
  }

  cancel(id: number, t: number): void {
    const i = this.pts.findIndex((q) => q.id === id);
    if (i < 0) return;
    if (this.pts[i]!.softOn) this.emit(BTN.SOFT, false, t);
    this.pts.splice(i, 1);
    if (this.pts.length === 0) this.maxActive = 0;
  }

  reset(): void {
    this.pts.length = 0;
    this.maxActive = 0;
  }

  private tap(btn: BtnCode, t: number): void {
    this.emit(btn, true, t);
    this.emit(btn, false, t);
  }
}
