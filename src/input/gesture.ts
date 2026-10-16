// Pengenal gestur sentuh (SPEC 11.2, EDD-2 bagian 2.5).
// Murni: menerima titik (x, y, waktu) dan memanggil `emit` dengan tombol abstrak. Tidak menyentuh DOM.
import { BTN, type BtnCode } from "./repeat.ts";

/** Nilai awal; disetel setelah uji di Galaxy A13. Satuan jarak = lebar satu sel. */
export const GESTURE = {
  TAP_MAX_MS: 220,
  TAP_MAX_MOVE: 0.5,
  /** Gerak pertama di atas jarak ini mengunci arah (mendatar atau tegak). */
  LOCK_DIST: 0.5,
  /** Seret tegak sejauh ini memicu jatuh cepat (ke bawah) atau simpan (ke atas), sekali per sentuhan. */
  VERTICAL_DIST: 1.5,
} as const;

export type Emit = (btn: BtnCode, down: boolean, time: number) => void;

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  startT: number;
  refX: number;
  axis: 0 | 1 | 2; // 0 belum, 1 mendatar, 2 tegak
  fired: boolean; // aksi tegak sudah dipicu
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
    this.pts.push({ id, startX: x, startY: y, startT: t, refX: x, axis: 0, fired: false, moved: false });
    this.maxActive = Math.max(this.maxActive, this.pts.length);
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.pts.find((q) => q.id === id);
    if (!p) return;
    const u = this.unit;
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
    // Tegak: dipicu langsung saat jarak tercapai, tanpa menunggu jari diangkat.
    if (p.fired) return;
    if (dy >= GESTURE.VERTICAL_DIST * u) {
      p.fired = true;
      this.tap(BTN.HARD, t);
    } else if (-dy >= GESTURE.VERTICAL_DIST * u) {
      p.fired = true;
      this.tap(BTN.HOLD, t);
    }
  }

  up(id: number, x: number, y: number, t: number): void {
    const i = this.pts.findIndex((q) => q.id === id);
    if (i < 0) return;
    const p = this.pts[i]!;
    this.pts.splice(i, 1);
    const dur = t - p.startT;
    const dist = Math.hypot(x - p.startX, y - p.startY);
    if (!p.moved && dur <= GESTURE.TAP_MAX_MS && dist <= GESTURE.TAP_MAX_MOVE * this.unit) {
      // Ketuk saat dua jari menempel: putar kiri sekali, saat jari terakhir diangkat. Satu jari: putar kanan.
      if (this.maxActive >= 2) {
        if (this.pts.length === 0) this.tap(BTN.CCW, t);
      } else {
        this.tap(BTN.CW, t);
      }
    }
    if (this.pts.length === 0) this.maxActive = 0;
  }

  cancel(id: number): void {
    const i = this.pts.findIndex((q) => q.id === id);
    if (i < 0) return;
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
