// Pool partikel tetap (DESIGN 8.4): 300 slot, tanpa alokasi saat bermain.
// Koordinat dalam piksel perangkat di canvas utama.

export const POOL = 300;

export class Particles {
  readonly x = new Float32Array(POOL);
  readonly y = new Float32Array(POOL);
  readonly vx = new Float32Array(POOL);
  readonly vy = new Float32Array(POOL);
  readonly life = new Float32Array(POOL); // detik tersisa, 0 = mati
  readonly maxLife = new Float32Array(POOL);
  readonly size = new Float32Array(POOL);
  readonly color = new Uint8Array(POOL); // jenis piece 1..7
  private cursor = 0;
  /** Jumlah partikel hidup, diperbarui di update(). */
  alive = 0;

  /** Slot berikutnya; partikel tertua ditimpa saat pool penuh. */
  emit(x: number, y: number, vx: number, vy: number, life: number, size: number, color: number): void {
    const i = this.cursor;
    this.cursor = (i + 1) % POOL;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.color[i] = color;
  }

  /** dt dalam detik; gravity dalam piksel per detik kuadrat. */
  update(dt: number, gravity: number): void {
    let alive = 0;
    const drag = Math.pow(0.12, dt); // kecepatan tersisa 12% setelah 1 detik
    for (let i = 0; i < POOL; i++) {
      if (this.life[i]! <= 0) continue;
      const l = this.life[i]! - dt;
      if (l <= 0) {
        this.life[i] = 0;
        continue;
      }
      this.life[i] = l;
      this.vx[i] = this.vx[i]! * drag;
      this.vy[i] = this.vy[i]! * drag + gravity * dt;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      alive++;
    }
    this.alive = alive;
  }

  /** Gambar dikelompokkan per warna supaya fillStyle hanya berganti 7 kali per frame. */
  draw(ctx: CanvasRenderingContext2D, colors: readonly string[]): void {
    if (this.alive === 0) return;
    for (let c = 1; c <= 7; c++) {
      ctx.fillStyle = colors[c]!;
      for (let i = 0; i < POOL; i++) {
        if (this.color[i] !== c || this.life[i]! <= 0) continue;
        const t = this.life[i]! / this.maxLife[i]!;
        const s = this.size[i]! * (0.4 + 0.6 * t);
        ctx.globalAlpha = t;
        ctx.fillRect(this.x[i]! - s / 2, this.y[i]! - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.life.fill(0);
    this.alive = 0;
  }
}
