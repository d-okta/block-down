// Pengenal gestur sentuh (SPEC 11.2, EDD-2 bagian 2.5).
// Murni: menerima titik (x, y, waktu) dan memanggil `emit` dengan tombol abstrak. Tidak menyentuh DOM.
import { BTN, type BtnCode } from "./repeat.ts";

/** Disetel dari uji di Galaxy A13 (revisi ketiga). Satuan jarak = lebar satu sel. */
export const GESTURE = {
  TAP_MAX_MS: 220,
  TAP_MAX_MOVE: 0.5,
  /** Gerak di atas jarak ini menentukan arah segmen (mendatar atau tegak). */
  LOCK_DIST: 0.6,
  /** Tegak hanya jika |dy| lebih dari VERTICAL_BIAS kali |dx| (sekitar 52 derajat). */
  VERTICAL_BIAS: 1.3,
  /** Seret tegak pelan: jatuh cepat atau simpan setelah sejauh ini. */
  VERTICAL_DIST: 2.5,
  /** Bantingan: cukup sejauh ini jika kecepatan puncak segmen mencapai FLICK_SPEED. */
  FLICK_MIN: 1.5,
  /** Kecepatan bantingan dalam sel per detik (sekitar 640 px/detik pada sel 32 px). */
  FLICK_SPEED: 20,
} as const;

export type Emit = (btn: BtnCode, down: boolean, time: number) => void;

/**
 * Satu sentuhan terdiri dari segmen. Segmen mendatar menggeser; jika jari lalu bergerak tegak
 * tanpa diangkat, segmen tegak baru dimulai dari titik geser terakhir. Jadi pemain bisa
 * menggeser lalu langsung membanting ke bawah dalam satu sentuhan.
 */
interface Pointer {
  id: number;
  startX: number;
  startY: number;
  startT: number;
  prevY: number;
  prevT: number;
  lastX: number;
  lastY: number;
  /** 0 belum, 1 mendatar, 2 tegak. */
  mode: 0 | 1 | 2;
  /** Awal segmen saat ini. */
  segX: number;
  segY: number;
  /** Kecepatan tegak puncak segmen (sel per detik): positif ke bawah, negatif ke atas. */
  peakDown: number;
  peakUp: number;
  /** Titik acuan geser mendatar, dan posisi saat geser terakhir. */
  refX: number;
  stepX: number;
  stepY: number;
  fired: boolean;
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
    this.pts.push({
      id, startX: x, startY: y, startT: t, prevY: y, prevT: t, lastX: x, lastY: y,
      mode: 0, segX: x, segY: y, peakDown: 0, peakUp: 0,
      refX: x, stepX: x, stepY: y, fired: false, moved: false,
    });
    this.maxActive = Math.max(this.maxActive, this.pts.length);
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.pts.find((q) => q.id === id);
    if (p) this.track(p, x, y, t);
  }

  up(id: number, x: number, y: number, t: number): void {
    const p = this.remove(id);
    if (!p) return;
    // Titik lepas ikut diproses: bantingan cepat bisa tiba tanpa titik gerak di antaranya.
    this.track(p, x, y, t);
    this.finish(p, x, y, t);
  }

  /** Browser membatalkan sentuhan (misalnya saat bantingan sangat cepat). Titik terakhir sudah diproses. */
  cancel(id: number, t: number): void {
    const p = this.remove(id);
    if (p) this.finish(p, p.lastX, p.lastY, t);
  }

  reset(): void {
    this.pts.length = 0;
    this.maxActive = 0;
  }

  private remove(id: number): Pointer | null {
    const i = this.pts.findIndex((q) => q.id === id);
    if (i < 0) return null;
    const p = this.pts[i]!;
    this.pts.splice(i, 1);
    return p;
  }

  private track(p: Pointer, x: number, y: number, t: number): void {
    const u = this.unit;
    // Kecepatan tegak sesaat; jarak waktu minimal 8 ms supaya titik yang berdempetan tidak membuat lonjakan palsu.
    const v = (y - p.prevY) / u / (Math.max(8, t - p.prevT) / 1000);
    p.prevY = y;
    p.prevT = t;
    p.lastX = x;
    p.lastY = y;
    if (p.fired) return; // satu aksi tegak per sentuhan; sisa gerak diabaikan

    if (p.mode === 0) {
      const dx = x - p.startX;
      const dy = y - p.startY;
      if (Math.abs(dx) < GESTURE.LOCK_DIST * u && Math.abs(dy) < GESTURE.LOCK_DIST * u) return;
      p.moved = true;
      p.mode = Math.abs(dy) > Math.abs(dx) * GESTURE.VERTICAL_BIAS ? 2 : 1;
    } else if (p.mode === 1) {
      // Geser lalu banting tanpa melepas jari: gerak tegak sejak geser terakhir memulai segmen tegak.
      const vdx = x - p.stepX;
      const vdy = y - p.stepY;
      if (Math.abs(vdy) >= GESTURE.LOCK_DIST * u && Math.abs(vdy) > Math.abs(vdx) * GESTURE.VERTICAL_BIAS) {
        p.mode = 2;
        p.segX = p.stepX;
        p.segY = p.stepY;
        p.peakDown = 0;
        p.peakUp = 0;
      }
    }

    if (p.mode === 1) {
      // Satu geser untuk setiap satu sel yang ditempuh sejak titik acuan.
      let stepped = false;
      while (x - p.refX >= u) {
        this.tap(BTN.RIGHT, t);
        p.refX += u;
        stepped = true;
      }
      while (p.refX - x >= u) {
        this.tap(BTN.LEFT, t);
        p.refX -= u;
        stepped = true;
      }
      if (stepped) {
        p.stepX = x;
        p.stepY = y;
      }
      return;
    }

    // Segmen tegak.
    if (v > p.peakDown) p.peakDown = v;
    if (v < p.peakUp) p.peakUp = v;
    const dy = (y - p.segY) / u;
    if (dy >= GESTURE.VERTICAL_DIST || (dy >= GESTURE.FLICK_MIN && p.peakDown >= GESTURE.FLICK_SPEED)) {
      p.fired = true;
      this.tap(BTN.HARD, t);
    } else if (-dy >= GESTURE.VERTICAL_DIST || (-dy >= GESTURE.FLICK_MIN && -p.peakUp >= GESTURE.FLICK_SPEED)) {
      p.fired = true;
      this.tap(BTN.HOLD, t);
    }
  }

  private finish(p: Pointer, x: number, y: number, t: number): void {
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

  private tap(btn: BtnCode, t: number): void {
    this.emit(btn, true, t);
    this.emit(btn, false, t);
  }
}
