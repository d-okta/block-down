// Pengenal gestur sentuh (SPEC 11.2, EDD-2 bagian 2.5).
// Murni: menerima titik (x, y, waktu) dan memanggil `emit` dengan tombol abstrak. Tidak menyentuh DOM.
import { BTN, type BtnCode } from "./repeat.ts";

/** Disetel dari uji di Galaxy A13. Satuan jarak = lebar satu sel. */
export const GESTURE = {
  TAP_MAX_MS: 220,
  TAP_MAX_MOVE: 0.5,
  /** Gerak pertama di atas jarak ini mengunci arah (mendatar atau tegak). */
  LOCK_DIST: 0.6,
  /**
   * Arah dianggap tegak hanya jika |dy| lebih dari VERTICAL_BIAS kali |dx| (sekitar 52 derajat).
   * Seret ke samping yang sedikit menurun tetap terbaca sebagai geser, bukan jatuh cepat.
   */
  VERTICAL_BIAS: 1.3,
  /** Seret tegak sejauh ini memicu jatuh cepat (ke bawah) atau simpan (ke atas), sekali per sentuhan. */
  VERTICAL_DIST: 1.5,
  /**
   * Bantingan cepat: jika jari diangkat dalam waktu ini setelah turun minimal FLICK_MIN sel,
   * tetap dihitung jatuh cepat walau browser hanya mengirim sedikit titik gerak.
   */
  FLICK_MS: 250,
  FLICK_MIN: 0.8,
} as const;

export type Emit = (btn: BtnCode, down: boolean, time: number) => void;

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastY: number;
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
    this.pts.push({ id, startX: x, startY: y, startT: t, lastX: x, lastY: y, refX: x, axis: 0, fired: false, moved: false });
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

  /** Browser membatalkan sentuhan (misalnya saat bantingan sangat cepat). Selesaikan dengan titik terakhir. */
  cancel(id: number, t: number): void {
    const p = this.remove(id);
    if (!p) return;
    this.finish(p, p.lastX, p.lastY, t);
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
    p.lastX = x;
    p.lastY = y;
    const dx = x - p.startX;
    const dy = y - p.startY;
    if (p.axis === 0) {
      if (Math.abs(dx) < GESTURE.LOCK_DIST * u && Math.abs(dy) < GESTURE.LOCK_DIST * u) return;
      p.axis = Math.abs(dy) > Math.abs(dx) * GESTURE.VERTICAL_BIAS ? 2 : 1;
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

  private finish(p: Pointer, x: number, y: number, t: number): void {
    const u = this.unit;
    const dur = t - p.startT;
    const dx = x - p.startX;
    const dy = y - p.startY;
    if (!p.moved && dur <= GESTURE.TAP_MAX_MS && Math.hypot(dx, dy) <= GESTURE.TAP_MAX_MOVE * u) {
      // Ketuk saat dua jari menempel: putar kiri sekali, saat jari terakhir diangkat. Satu jari: putar kanan.
      if (this.maxActive >= 2) {
        if (this.pts.length === 0) this.tap(BTN.CCW, t);
      } else {
        this.tap(BTN.CW, t);
      }
    } else if (!p.fired && p.axis !== 1 && dur <= GESTURE.FLICK_MS && Math.abs(dy) > Math.abs(dx) * GESTURE.VERTICAL_BIAS) {
      // Bantingan pendek dan cepat yang belum mencapai VERTICAL_DIST.
      if (dy >= GESTURE.FLICK_MIN * u) this.tap(BTN.HARD, t);
      else if (-dy >= GESTURE.FLICK_MIN * u) this.tap(BTN.HOLD, t);
    }
    if (this.pts.length === 0) this.maxActive = 0;
  }

  private tap(btn: BtnCode, t: number): void {
    this.emit(btn, true, t);
    this.emit(btn, false, t);
  }
}
