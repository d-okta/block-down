// Atlas blok yang di-cache sekali per ukuran sel (EDD-2 bagian 3.3).
// Satu-satunya tempat gradien, path, dan pola dibuat. Loop gambar hanya memanggil drawImage.

export const BLOCK_COLORS = ["", "#5CC8D6", "#E3C35A", "#A57BD8", "#6CC489", "#E06C75", "#3F63C9", "#E39A55"] as const;

export const ROW_BLOCK = 0;
export const ROW_GHOST = 1;
export const ROW_FLASH = 2;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Atlas {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  size: number; // piksel perangkat per sel
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Pola mode aman buta warna per jenis (DESIGN 4.2). */
function drawPattern(ctx: Ctx, type: number, x: number, y: number, s: number): void {
  const u = s / 8;
  ctx.save();
  ctx.fillStyle = "rgba(15, 18, 23, 0.35)";
  ctx.strokeStyle = "rgba(15, 18, 23, 0.35)";
  ctx.lineWidth = Math.max(1, Math.round(u * 0.8));
  ctx.beginPath();
  switch (type) {
    case 1: // I garis horizontal
      for (let i = 2; i < 8; i += 2) {
        ctx.moveTo(x + u, y + i * u);
        ctx.lineTo(x + s - u, y + i * u);
      }
      ctx.stroke();
      break;
    case 2: // O titik tengah
      ctx.arc(x + s / 2, y + s / 2, u * 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 3: // T segitiga kecil
      ctx.moveTo(x + s / 2, y + u * 2.2);
      ctx.lineTo(x + u * 6, y + u * 5.8);
      ctx.lineTo(x + u * 2, y + u * 5.8);
      ctx.closePath();
      ctx.fill();
      break;
    case 4: // S diagonal naik
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x + u * (1 + i * 3), y + s - u);
        ctx.lineTo(x + u * (1 + i * 3) + u * 3, y + s - u * 4);
      }
      ctx.stroke();
      break;
    case 5: // Z diagonal turun
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x + u * (1 + i * 3), y + u);
        ctx.lineTo(x + u * (1 + i * 3) + u * 3, y + u * 4);
      }
      ctx.stroke();
      break;
    case 6: // J garis vertikal
      for (let i = 2; i < 8; i += 2) {
        ctx.moveTo(x + i * u, y + u);
        ctx.lineTo(x + i * u, y + s - u);
      }
      ctx.stroke();
      break;
    case 7: // L kotak berongga
      ctx.strokeRect(x + u * 2.5, y + u * 2.5, u * 3, u * 3);
      break;
  }
  ctx.restore();
}

/**
 * Blok dengan volume halus (revisi kedua setelah Fase 4: pemilik menilai tepi miring dan kilau
 * berlebihan). Warna solid, gradien cahaya tipis dari atas, garis terang di atas dan gelap di bawah
 * selebar 2 piksel CSS. Digambar sekali ke atlas, jadi tidak menambah kerja per frame.
 */
function drawBlock(ctx: Ctx, color: string, x: number, y: number, s: number, r: number, px: number): void {
  ctx.save();
  roundRect(ctx, x, y, s, s, r);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);

  const g = ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.10)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);

  const edge = 2 * px;
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(x, y, s, edge);
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(x, y + s - edge, s, edge);
  ctx.restore();
}

/** size: piksel perangkat per sel. dpr dipakai untuk menskalakan radius dan garis. */
export function buildAtlas(size: number, dpr: number, colorSafe: boolean): Atlas {
  const canvas = makeCanvas(size * 8, size * 3);
  const ctx = canvas.getContext("2d") as Ctx;
  const r = Math.max(1, Math.round(4 * dpr * (size / (22 * dpr))));
  const px = Math.max(1, Math.round(dpr));
  const inset = Math.max(1, Math.round(dpr)); // celah antar blok

  for (let type = 1; type <= 7; type++) {
    const color = BLOCK_COLORS[type]!;
    const x = type * size + inset / 2;
    const s = size - inset;

    // Blok normal (DESIGN 5).
    let y = ROW_BLOCK * size + inset / 2;
    drawBlock(ctx, color, x, y, s, r, px);
    if (colorSafe) {
      ctx.save();
      roundRect(ctx, x, y, s, s, r);
      ctx.clip();
      drawPattern(ctx, type, x, y, s);
      ctx.restore();
    }

    // Ghost: outline 2px warna penuh, dengan isi sangat tipis supaya bentuknya terbaca sebagai satu piece.
    y = ROW_GHOST * size + inset / 2;
    const lw = Math.max(1, Math.round(2 * dpr));
    roundRect(ctx, x + lw / 2, y + lw / 2, s - lw, s - lw, Math.max(1, r - lw / 2));
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Kilat lock: blok dicampur putih 30%.
    y = ROW_FLASH * size;
    ctx.drawImage(canvas, type * size, 0, size, size, type * size, y, size, size);
    ctx.save();
    roundRect(ctx, x, y + inset / 2, s, s, r);
    ctx.clip();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x, y, s, size);
    ctx.restore();
  }
  return { canvas, size };
}
