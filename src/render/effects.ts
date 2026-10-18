// Efek lapis 2 (feedback) dan lapis 3 (reward) di atas papan (DESIGN 8.2, 8.3, revisi Fase 4).
// Semua status disimpan sebagai angka di objek ini; tidak ada alokasi per frame.
// Efek hanya membaca event core dan tidak pernah menunda logika atau input (DESIGN 8.4 butir 1).
//
// Bertingkat menurut kekuatan (fx.ts clearPower): setiap clear punya efek yang terlihat jelas,
// makin besar makin meriah. Cahaya digambar dengan mode "lighter" (penjumlahan), tanpa gradien
// yang dibuat setiap frame, supaya tetap murah di HP kelas bawah.
import { COLS, VISIBLE_ROWS } from "../core/constants.ts";
import { BLOCK_COLORS } from "./sprites.ts";
import { Particles } from "./particles.ts";
import { easeOut, SHAKE_SHARE, type FxScale, type Power } from "./fx.ts";

const WHITE = "#FFFFFF";
const ACCENT = "#5B7CFA";
const T_COLOR = BLOCK_COLORS[3]!;
const GOLD = BLOCK_COLORS[2]!;

/** Partikel per sel baris yang dihapus, per kekuatan. */
const PER_CELL = [0, 2, 3, 4, 6, 6] as const;
/** Kecepatan ledakan partikel (sel per detik), per kekuatan. */
const BURST = [0, 6, 8, 10, 14, 14] as const;

export class Effects {
  readonly particles = new Particles();
  fx: FxScale;
  /** Ukuran sel dan DPR terakhir, dipakai untuk mengubah satuan sel ke piksel perangkat. */
  cell = 0;
  dpr = 1;

  // Kilat baris yang dihapus.
  private rowFlashT = -1;
  private rowFlashDur = 0;
  readonly rowFlash = new Int8Array(4).fill(-1);
  private power = 0;
  // Kilat seluruh papan (kekuatan 3 ke atas).
  private boardFlashT = -1;
  private boardFlashAlpha = 0;
  private boardFlashColor = WHITE;
  // Pilar cahaya naik dari baris yang dihapus (kekuatan 3 ke atas).
  private pillarT = -1;
  private pillarY = 0;
  private pillarColor = WHITE;
  // Shockwave mendatar (kekuatan 2 ke atas).
  private shockT = -1;
  private shockY = 0;
  // Cincin melebar dari baris (kekuatan 4 ke atas) atau riak T-Spin.
  private ringT = -1;
  private ringX = 0;
  private ringY = 0;
  private ringColor = WHITE;
  private ringCount = 1;
  // Gelombang Bersih Total dari bawah ke atas.
  private waveT = -1;
  // Bingkai naik level.
  private frameT = -1;
  // Shake papan: arah 0 = turun, 1 = samping.
  private shakeT = -1;
  private shakeAmp = 0;
  private shakeAxis = 0;
  private shakeDur = 200;
  // Papan menghentak (skala), kekuatan 4 ke atas.
  private punchT = -1;
  private punchAmt = 0;
  // Squash jatuh cepat, garis jejak, debu.
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
    this.rowFlashT = this.boardFlashT = this.pillarT = this.shockT = this.ringT = this.waveT = this.frameT = -1;
    this.shakeT = this.punchT = this.squashT = this.tiltT = -1;
  }

  // ---------- pemicu ----------

  /**
   * rows: indeks baris core (0 = bawah), -1 untuk kosong. colors: 10 warna per baris.
   * delay: ms sebelum gelombang kedua (shockwave, shake), mengikuti storyboard 4 Baris (80 ms).
   */
  lineClear(now: number, n: number, rows: Int8Array, colors: Uint8Array, power: Power): void {
    this.power = power;
    this.rowFlash.set(rows);
    this.rowFlashT = now;
    this.rowFlashDur = 140 + power * 30;
    const c = this.cell;
    let top = -1, bottom = 99;
    for (let r = 0; r < 4; r++) {
      const row = rows[r]!;
      if (row < 0) continue;
      if (row > top) top = row;
      if (row < bottom) bottom = row;
    }
    const midRow = top >= 0 ? (top + bottom) / 2 : 0;
    const midY = (VISIBLE_ROWS - 1 - midRow) * c + c / 2;
    const second = now + (power >= 4 ? 80 : 30);

    // Partikel dari setiap sel yang dihapus.
    if (this.fx.particles > 0) {
      const per = Math.max(1, Math.round(PER_CELL[power] * this.fx.particles));
      const speed = BURST[power] * c;
      for (let r = 0; r < 4; r++) {
        const row = rows[r]!;
        if (row < 0 || row >= VISIBLE_ROWS) continue;
        const cy = (VISIBLE_ROWS - 1 - row) * c + c / 2;
        for (let x = 0; x < COLS; x++) {
          const color = colors[r * COLS + x]! || 1;
          for (let k = 0; k < per; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (0.5 + Math.random()) * speed;
            this.particles.emit(
              x * c + Math.random() * c,
              cy + (Math.random() - 0.5) * c,
              Math.cos(a) * sp,
              Math.sin(a) * sp - speed * 0.4,
              0.35 + Math.random() * (0.25 + power * 0.08),
              c * (0.16 + Math.random() * (0.12 + power * 0.03)),
              color,
            );
          }
        }
      }
    }

    // Kekuatan 2 ke atas: shockwave mendatar.
    if (n >= 2 || power >= 2) {
      this.shockY = midY;
      this.shockT = second;
    }
    // Kekuatan 3 ke atas: kilat papan dan pilar cahaya naik dari baris.
    if (power >= 3) {
      this.boardFlashT = second;
      this.boardFlashAlpha = power >= 4 ? 0.35 : 0.18;
      this.boardFlashColor = WHITE;
      this.pillarT = now;
      this.pillarY = midY;
      this.pillarColor = power >= 4 ? ACCENT : WHITE;
    }
    // Kekuatan 4 ke atas: dua cincin melebar dari tengah baris, papan menghentak.
    if (power >= 4) {
      this.ringX = (COLS * c) / 2;
      this.ringY = midY;
      this.ringT = second;
      this.ringColor = WHITE;
      this.ringCount = 3;
      this.punch(second, 0.035);
    }
    this.shake(second, power, 0);
  }

  tspin(now: number, cx: number, cy: number, withLines: boolean): void {
    this.ringX = (cx + 0.5) * this.cell;
    this.ringY = (VISIBLE_ROWS - 1 - cy + 0.5) * this.cell;
    this.ringT = now;
    this.ringColor = T_COLOR;
    this.ringCount = withLines ? 3 : 2;
    this.boardFlashT = now;
    this.boardFlashAlpha = withLines ? 0.3 : 0.15;
    this.boardFlashColor = T_COLOR;
    if (withLines) {
      this.punch(now, 0.03);
      this.shake(now, 4, 1);
    }
  }

  perfectClear(now: number): void {
    this.waveT = now;
    this.boardFlashT = now;
    this.boardFlashAlpha = 0.45;
    this.boardFlashColor = GOLD;
    this.punch(now, 0.05);
    this.shake(now, 5, 1);
    // Hujan partikel emas dari bawah.
    if (this.fx.particles > 0) {
      const c = this.cell;
      const w = COLS * c;
      const h = VISIBLE_ROWS * c;
      const count = Math.round(120 * this.fx.particles);
      for (let i = 0; i < count; i++) {
        this.particles.emit(Math.random() * w, h - Math.random() * c, (Math.random() - 0.5) * c * 4, -(8 + Math.random() * 14) * c, 0.6 + Math.random() * 0.5, c * (0.15 + Math.random() * 0.2), 2);
      }
    }
  }

  levelUp(now: number): void {
    this.frameT = now;
    this.boardFlashT = now;
    this.boardFlashAlpha = 0.2;
    this.boardFlashColor = ACCENT;
  }

  /** cells: 8 angka (x, y) core; dist dalam sel; type: jenis piece (warna debu). */
  hardDrop(now: number, cells: Int8Array, dist: number, type: number): void {
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
    // Debu kecil di bawah piece saat mendarat, hanya jika jatuh cukup jauh.
    if (this.fx.particles > 0 && dist >= 2) {
      const c = this.cell;
      const y = (VISIBLE_ROWS - bottom) * c;
      for (let i = 0; i < 4; i++) {
        const x = (this.trailX[i]! + 0.5) * c;
        for (let k = 0; k < 2; k++) {
          const dir = k === 0 ? -1 : 1;
          this.particles.emit(x, y - c * 0.1, dir * (2 + Math.random() * 3) * c, -(1 + Math.random() * 2) * c, 0.25 + Math.random() * 0.15, c * 0.14, type);
        }
      }
    }
    // Hentak kecil papan saat jatuh cepat dari tinggi.
    if (dist >= 6) this.shake(now, 1, 0);
  }

  kick(now: number, dir: number): void {
    if (!this.fx.feedback) return;
    this.tiltT = now;
    this.tiltDir = dir;
  }

  private shake(start: number, power: number, axis: number): void {
    const amp = this.fx.shake * (SHAKE_SHARE[power as Power] ?? 0) || (power === 1 ? this.fx.shake * 0.12 : 0);
    if (amp <= 0) return;
    this.shakeT = start;
    this.shakeAmp = amp;
    this.shakeAxis = axis;
    this.shakeDur = 180 + power * 40;
  }

  private punch(start: number, amt: number): void {
    if (!this.fx.bounce) return;
    this.punchT = start;
    this.punchAmt = amt;
  }

  // ---------- nilai untuk renderer ----------

  /**
   * Transform papan: geser x, y (piksel CSS) dan skala. Ditulis ke `out` (panjang 3) supaya tanpa alokasi.
   * Dikembalikan false jika papan diam.
   */
  boardTransform(now: number, out: Float32Array): boolean {
    out[0] = 0;
    out[1] = 0;
    out[2] = 1;
    let moving = false;
    if (this.shakeT >= 0) {
      const p = (now - this.shakeT) / this.shakeDur;
      if (p >= 1) this.shakeT = -1;
      else if (p >= 0) {
        const decay = (1 - p) * (1 - p);
        if (this.shakeAxis === 0) {
          // Dorongan ke bawah lalu getaran yang meluruh.
          out[1] = this.shakeAmp * Math.sin(p * Math.PI * 5) * decay;
          out[0] = this.shakeAmp * 0.35 * Math.sin(p * 37) * decay;
        } else {
          out[0] = this.shakeAmp * Math.sin(p * 34) * decay;
          out[1] = this.shakeAmp * 0.3 * Math.sin(p * 23) * decay;
        }
        moving = true;
      }
    }
    if (this.punchT >= 0) {
      const p = (now - this.punchT) / 260;
      if (p >= 1) this.punchT = -1;
      else if (p >= 0) {
        out[2] = 1 + this.punchAmt * Math.sin(p * Math.PI) * (1 - p);
        moving = true;
      }
    }
    return moving;
  }

  /** Skala vertikal piece saat squash (1 = normal). */
  squash(now: number): number {
    if (this.squashT < 0) return 1;
    const p = (now - this.squashT) / 90;
    if (p >= 1) {
      this.squashT = -1;
      return 1;
    }
    return 1 - 0.14 * Math.sin(p * Math.PI);
  }

  /** Sudut miring piece dalam radian (sekitar 2 derajat). */
  tilt(now: number): number {
    if (this.tiltT < 0) return 0;
    const p = (now - this.tiltT) / 110;
    if (p >= 1) {
      this.tiltT = -1;
      return 0;
    }
    return this.tiltDir * 0.035 * Math.sin(p * Math.PI);
  }

  /** Lapisan efek digambar di canvas utama setelah piece. dt dalam detik. */
  draw(ctx: CanvasRenderingContext2D, now: number, dt: number, w: number, h: number): void {
    const c = this.cell;
    const waves = this.fx.waves;

    // Garis jejak jatuh cepat: kolom cahaya tipis sesuai kolom piece.
    if (this.squashT >= 0 && this.trailTop > this.trailBottom) {
      const p = (now - this.squashT) / 160;
      if (p < 1) {
        ctx.globalAlpha = 0.28 * (1 - p);
        ctx.fillStyle = WHITE;
        const yTop = (VISIBLE_ROWS - 1 - Math.min(this.trailTop, VISIBLE_ROWS - 1)) * c;
        const yBot = (VISIBLE_ROWS - 1 - this.trailBottom) * c;
        for (let i = 0; i < 4; i++) ctx.fillRect(this.trailX[i]! * c + c * 0.3, yTop, c * 0.4, Math.max(0, yBot - yTop));
        ctx.globalAlpha = 1;
      }
    }

    // Kilat papan dan pilar cahaya tidak digambar di canvas: keduanya elemen CSS yang hanya
    // dipudarkan dan diregangkan (lightLayers()). Menggambarnya di canvas berarti mengisi hampir
    // seluruh papan setiap frame, yang membuat animasi patah-patah di Galaxy A13.
    ctx.globalCompositeOperation = "lighter";

    // Kilat baris yang dihapus: pita putih tebal yang melebar lalu memudar.
    if (this.rowFlashT >= 0) {
      const p = (now - this.rowFlashT) / this.rowFlashDur;
      if (p >= 1) this.rowFlashT = -1;
      else {
        ctx.fillStyle = WHITE;
        const grow = c * (0.2 + this.power * 0.08) * easeOut(p);
        for (let r = 0; r < 4; r++) {
          const row = this.rowFlash[r]!;
          if (row < 0 || row >= VISIBLE_ROWS) continue;
          const y = (VISIBLE_ROWS - 1 - row) * c;
          ctx.globalAlpha = (1 - easeOut(p)) * 0.95;
          ctx.fillRect(0, y - grow, w, c + grow * 2);
          // Inti terang yang menyempit.
          ctx.globalAlpha = (1 - p) * 0.6;
          ctx.fillRect(0, y + c * 0.5 * p, w, c * (1 - p));
        }
      }
    }

    ctx.globalCompositeOperation = "source-over";

    // Partikel.
    this.particles.update(dt, c * 30);
    this.particles.draw(ctx, BLOCK_COLORS);

    if (waves > 0) {
      ctx.globalCompositeOperation = "lighter";
      // Shockwave: garis mendatar yang melebar dari tengah ke tepi, ditambah garis kedua lebih pudar.
      if (this.shockT >= 0) {
        const p = (now - this.shockT) / 320;
        if (p >= 1) this.shockT = -1;
        else if (p >= 0) {
          const e = easeOut(p);
          const half = (w / 2) * e;
          const thick = Math.max(2, this.dpr * 2) * (1 + this.power * 0.5);
          ctx.fillStyle = WHITE;
          ctx.globalAlpha = waves * (1 - p);
          ctx.fillRect(w / 2 - half, this.shockY - thick / 2, half * 2, thick);
          ctx.globalAlpha = waves * 0.35 * (1 - p);
          ctx.fillRect(w / 2 - half, this.shockY - thick * 2, half * 2, thick * 4);
        }
      }
      // Cincin melebar (4 Baris) atau riak (T-Spin).
      if (this.ringT >= 0) {
        const p = (now - this.ringT) / 520;
        if (p >= 1) this.ringT = -1;
        else if (p >= 0) {
          ctx.strokeStyle = this.ringColor;
          for (let k = 0; k < this.ringCount; k++) {
            const q = p - k * 0.15;
            if (q <= 0) continue;
            ctx.lineWidth = Math.max(2, this.dpr * 3) * (1 - q);
            ctx.globalAlpha = waves * (1 - q) * 0.9;
            ctx.beginPath();
            ctx.arc(this.ringX, this.ringY, c * (0.6 + 6 * easeOut(q)), 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      // Gelombang emas Bersih Total, naik dari bawah ke atas.
      if (this.waveT >= 0) {
        const p = (now - this.waveT) / 700;
        if (p >= 1) this.waveT = -1;
        else {
          const y = h * (1 - easeOut(p));
          // Hanya pita tepinya; cahaya di bawahnya ikut lapisan kilat papan (CSS).
          ctx.fillStyle = GOLD;
          ctx.globalAlpha = waves * 0.6 * (1 - p);
          ctx.fillRect(0, y, w, c * 1.5);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Lapisan cahaya CSS (kilat papan dan pilar). Ditulis ke `out` (panjang 6) tanpa alokasi:
   * [0] opasitas kilat, [1] opasitas pilar, [2] tinggi pilar (0..1 dari baris ke atas papan),
   * [3] lebar pilar (0..1), [4] posisi dasar pilar (0..1 dari atas papan).
   * Warna dibaca lewat flashColor dan pillarColor (berubah hanya saat dipicu).
   */
  lightLayers(now: number, out: Float32Array): void {
    const waves = this.fx.waves;
    out[0] = 0;
    out[1] = 0;
    if (waves <= 0) {
      this.boardFlashT = this.pillarT = -1;
      return;
    }
    if (this.boardFlashT >= 0) {
      const p = (now - this.boardFlashT) / 260;
      if (p >= 1) this.boardFlashT = -1;
      else if (p >= 0) out[0] = this.boardFlashAlpha * waves * (1 - easeOut(p));
    }
    if (this.pillarT >= 0) {
      const p = (now - this.pillarT) / 520;
      if (p >= 1) this.pillarT = -1;
      else {
        const h = VISIBLE_ROWS * this.cell;
        const base = (this.pillarY + this.cell / 2) / h;
        out[1] = waves * 0.5 * (1 - p);
        out[2] = (0.2 + 0.8 * easeOut(p)) * base;
        out[3] = 1 - p * 0.4;
        out[4] = base;
      }
    }
  }

  get flashColor(): string {
    return this.boardFlashColor;
  }

  get pillarTint(): string {
    return this.pillarColor;
  }

  /** Progres bingkai naik level (0..1) atau -1. Digambar oleh CSS, bukan canvas. */
  frameProgress(now: number): number {
    if (this.frameT < 0) return -1;
    const p = (now - this.frameT) / 700;
    if (p >= 1) {
      this.frameT = -1;
      return -1;
    }
    return p;
  }
}
