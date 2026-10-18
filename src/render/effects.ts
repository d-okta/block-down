// Efek lapis 2 (feedback) dan lapis 3 (reward) di atas papan (DESIGN 8.2, 8.3).
// Semua status disimpan sebagai angka di objek ini; tidak ada alokasi per frame.
// Efek hanya membaca event core dan tidak pernah menunda logika atau input (DESIGN 8.4 butir 1).
import { COLS, VISIBLE_ROWS } from "../core/constants.ts";
import { BLOCK_COLORS } from "./sprites.ts";
import { Particles } from "./particles.ts";
import { easeOut, type FxScale } from "./fx.ts";

const WHITE = "#FFFFFF";
const T_COLOR = BLOCK_COLORS[3]!;
const GOLD = BLOCK_COLORS[2]!;

export class Effects {
  readonly particles = new Particles();
  fx: FxScale;
  /** Ukuran sel dan DPR terakhir, dipakai untuk mengubah satuan sel ke piksel perangkat. */
  cell = 0;
  dpr = 1;

  // Kilat tepi baris yang dihapus (0 ms storyboard).
  private rowFlashT = -1;
  private rowFlashDur = 0;
  readonly rowFlash = new Int8Array(4).fill(-1);
  // Shockwave horizontal (Quad, 80 ms).
  private shockT = -1;
  private shockY = 0;
  // Riak cincin T-Spin.
  private ringT = -1;
  private ringX = 0;
  private ringY = 0;
  // Gelombang Bersih Total dari bawah ke atas.
  private waveT = -1;
  // Bingkai naik level.
  private frameT = -1;
  // Shake papan: arah 0 = turun (Quad), 1 = samping (T-Spin, Bersih Total).
  private shakeT = -1;
  private shakeAmp = 0;
  private shakeAxis = 0;
  // Squash jatuh cepat dan garis jejak.
  private squashT = -1;
  readonly trailX = new Int8Array(4);
  private trailTop = 0;
  private trailBottom = 0;
  // Kemiringan putaran dengan kick.
  private tiltT = -1;
  private tiltDir = 0;

  constructor(fx: FxScale) {
    this.fx = fx;
  }

  reset(): void {
    this.particles.clear();
    this.rowFlashT = this.shockT = this.ringT = this.waveT = this.frameT = -1;
    this.shakeT = this.squashT = this.tiltT = -1;
  }

  // ---------- pemicu ----------

  /** rows: indeks baris core (0 = bawah), -1 untuk kosong. colors: 10 warna per baris. */
  lineClear(now: number, n: number, rows: Int8Array, colors: Uint8Array, quad: boolean): void {
    this.rowFlash.set(rows);
    this.rowFlashT = now;
    this.rowFlashDur = quad ? 200 : 140;
    if (this.fx.particles > 0) {
      const per = Math.round((quad ? 7 : n >= 2 ? 4 : 2) * this.fx.particles);
      const c = this.cell;
      for (let r = 0; r < 4; r++) {
        const row = rows[r]!;
        if (row < 0 || row >= VISIBLE_ROWS) continue;
        const cy = (VISIBLE_ROWS - 1 - row) * c + c / 2;
        for (let x = 0; x < COLS; x++) {
          const color = colors[r * COLS + x]! || 1;
          for (let k = 0; k < per; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (0.6 + Math.random() * 1.6) * c * (quad ? 9 : 6);
            this.particles.emit(
              x * c + Math.random() * c,
              cy + (Math.random() - 0.5) * c,
              Math.cos(a) * sp,
              Math.sin(a) * sp - c * 3,
              0.35 + Math.random() * 0.35,
              c * (0.18 + Math.random() * 0.2),
              color,
            );
          }
        }
      }
    }
    if (quad) {
      const mid = rows[0]! >= 0 ? rows[0]! : 0;
      this.shockY = (VISIBLE_ROWS - 1 - mid) * this.cell;
      this.shockT = now + 80;
      this.shake(now + 80, 0);
    }
  }

  tspin(now: number, cx: number, cy: number, withLines: boolean): void {
    this.ringX = (cx + 0.5) * this.cell;
    this.ringY = (VISIBLE_ROWS - 1 - cy + 0.5) * this.cell;
    this.ringT = now;
    if (withLines) this.shake(now, 1);
  }

  perfectClear(now: number): void {
    this.waveT = now;
    this.shake(now, 1);
  }

  levelUp(now: number): void {
    this.frameT = now;
  }

  /** cells: 8 angka (x, y) core; dist dalam sel. */
  hardDrop(now: number, cells: Int8Array, dist: number): void {
    if (!this.fx.feedback) return;
    this.squashT = now;
    let top = -1, bottom = 99;
    for (let i = 0; i < 4; i++) {
      this.trailX[i] = cells[i * 2]!;
      const y = cells[i * 2 + 1]!;
      if (y > top) top = y;
      if (y < bottom) bottom = y;
    }
    this.trailTop = top + dist;
    this.trailBottom = bottom;
  }

  kick(now: number, dir: number): void {
    if (!this.fx.feedback) return;
    this.tiltT = now;
    this.tiltDir = dir;
  }

  private shake(start: number, axis: number): void {
    if (this.fx.shake <= 0) return;
    this.shakeT = start;
    this.shakeAmp = this.fx.shake;
    this.shakeAxis = axis;
  }

  // ---------- nilai untuk renderer ----------

  /** Offset papan dalam piksel CSS: x, y. Ditulis ke `out` supaya tanpa alokasi. */
  shakeOffset(now: number, out: Float32Array): void {
    out[0] = 0;
    out[1] = 0;
    if (this.shakeT < 0) return;
    const p = (now - this.shakeT) / 200;
    if (p < 0) return;
    if (p >= 1) {
      this.shakeT = -1;
      return;
    }
    // Quad: satu dorongan ke bawah yang meluruh. T-Spin: getaran samping yang meluruh.
    const v = this.shakeAxis === 0 ? this.shakeAmp * Math.sin(p * Math.PI) * (1 - p) : this.shakeAmp * Math.sin(p * 30) * (1 - p);
    if (this.shakeAxis === 0) out[1] = v;
    else out[0] = v;
  }

  /** Skala vertikal piece saat squash (1 = normal). */
  squash(now: number): number {
    if (this.squashT < 0) return 1;
    const p = (now - this.squashT) / 80;
    if (p >= 1) {
      this.squashT = -1;
      return 1;
    }
    return 1 - 0.1 * Math.sin(p * Math.PI);
  }

  /** Sudut miring piece dalam radian (DESIGN 8.2: sekitar 1,5 derajat). */
  tilt(now: number): number {
    if (this.tiltT < 0) return 0;
    const p = (now - this.tiltT) / 90;
    if (p >= 1) {
      this.tiltT = -1;
      return 0;
    }
    return this.tiltDir * 0.026 * Math.sin(p * Math.PI);
  }

  /** Lapisan efek digambar di canvas utama setelah piece. dt dalam detik. */
  draw(ctx: CanvasRenderingContext2D, now: number, dt: number, w: number, h: number): void {
    const c = this.cell;

    // Garis jejak jatuh cepat: tipis, warna putih pudar, sesuai kolom piece.
    if (this.squashT >= 0 && this.trailTop > this.trailBottom) {
      const p = (now - this.squashT) / 120;
      if (p < 1) {
        ctx.globalAlpha = 0.18 * (1 - p);
        ctx.fillStyle = WHITE;
        const yTop = (VISIBLE_ROWS - 1 - Math.min(this.trailTop, VISIBLE_ROWS - 1)) * c;
        const yBot = (VISIBLE_ROWS - 1 - this.trailBottom) * c;
        for (let i = 0; i < 4; i++) ctx.fillRect(this.trailX[i]! * c + c * 0.35, yTop, c * 0.3, Math.max(0, yBot - yTop));
        ctx.globalAlpha = 1;
      }
    }

    // Kilat tepi baris yang dihapus: pita putih yang memudar di posisi baris lama.
    if (this.rowFlashT >= 0) {
      const p = (now - this.rowFlashT) / this.rowFlashDur;
      if (p >= 1) this.rowFlashT = -1;
      else {
        ctx.fillStyle = WHITE;
        ctx.globalAlpha = 0.85 * (1 - easeOut(p));
        for (let r = 0; r < 4; r++) {
          const row = this.rowFlash[r]!;
          if (row < 0 || row >= VISIBLE_ROWS) continue;
          const y = (VISIBLE_ROWS - 1 - row) * c;
          const grow = c * 0.15 * p;
          ctx.fillRect(0, y - grow, w, c + grow * 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Partikel.
    this.particles.update(dt, c * 40);
    this.particles.draw(ctx, BLOCK_COLORS);

    const waves = this.fx.waves;
    if (waves > 0) {
      // Shockwave: garis mendatar tipis yang melebar dari tengah ke tepi.
      if (this.shockT >= 0) {
        const p = (now - this.shockT) / 260;
        if (p >= 1) this.shockT = -1;
        else if (p >= 0) {
          const e = easeOut(p);
          const half = (w / 2) * e;
          ctx.globalAlpha = waves * (1 - p);
          ctx.fillStyle = WHITE;
          ctx.fillRect(w / 2 - half, this.shockY + c / 2 - Math.max(1, this.dpr), half * 2, Math.max(2, this.dpr * 2));
          ctx.globalAlpha = 1;
        }
      }
      // Riak cincin ungu T-Spin.
      if (this.ringT >= 0) {
        const p = (now - this.ringT) / 420;
        if (p >= 1) this.ringT = -1;
        else {
          ctx.strokeStyle = T_COLOR;
          ctx.lineWidth = Math.max(2, this.dpr * 2);
          for (let k = 0; k < 2; k++) {
            const q = p - k * 0.18;
            if (q <= 0) continue;
            ctx.globalAlpha = waves * (1 - q) * 0.9;
            ctx.beginPath();
            ctx.arc(this.ringX, this.ringY, c * (0.6 + 3.2 * easeOut(q)), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      // Gelombang emas Bersih Total, naik dari bawah ke atas.
      if (this.waveT >= 0) {
        const p = (now - this.waveT) / 600;
        if (p >= 1) this.waveT = -1;
        else {
          const y = h * (1 - easeOut(p));
          ctx.globalAlpha = waves * 0.35 * (1 - p);
          ctx.fillStyle = GOLD;
          ctx.fillRect(0, y, w, c * 1.2);
          ctx.globalAlpha = waves * 0.12 * (1 - p);
          ctx.fillRect(0, y, w, h - y);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /** Progres bingkai naik level (0..1) atau -1. Digambar oleh CSS, bukan canvas. */
  frameProgress(now: number): number {
    if (this.frameT < 0) return -1;
    const p = (now - this.frameT) / 600;
    if (p >= 1) {
      this.frameT = -1;
      return -1;
    }
    return p;
  }
}
