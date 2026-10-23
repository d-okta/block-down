// Atlas blok yang di-cache sekali per ukuran sel (EDD-2 bagian 3.3).
// Satu-satunya tempat gradien, path, dan pola dibuat. Loop gambar hanya memanggil drawImage.

import { THEMES, type Theme } from "./themes.ts";

export const ROW_BLOCK = 0;
export const ROW_GHOST = 1;
export const ROW_FLASH = 2;
/** Piece yang sedang jatuh. Sama dengan ROW_BLOCK kecuali tema Monokrom (piece aktif berwarna sendiri). */
export const ROW_ACTIVE = 3;

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

/**
 * Pola mode aman buta warna per jenis (DESIGN 4.2). ink: warna pola. Bawaan gelap transparan di atas
 * blok berwarna penuh; tema Neon (isi blok gelap) memakai warna bloknya sendiri supaya pola terlihat.
 */
function drawPattern(ctx: Ctx, type: number, x: number, y: number, s: number, ink = "rgba(15, 18, 23, 0.35)"): void {
  const u = s / 8;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
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
function drawBlock(ctx: Ctx, color: string, x: number, y: number, s: number, r: number, px: number, style: Theme["style"] = "solid"): void {
  if (style === "neon") {
    // Garis tepi menyala dengan isi samar (tema Neon garis). Cahaya tetap di dalam sel atlas.
    const lw = Math.max(2 * px, Math.round(s * 0.09));
    ctx.save();
    roundRect(ctx, x, y, s, s, r);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = s * 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    roundRect(ctx, x + lw / 2, y + lw / 2, s - lw, s - lw, Math.max(1, r - lw / 2));
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (style === "soft") r = Math.round(s * 0.26);
  ctx.save();
  roundRect(ctx, x, y, s, s, r);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);

  if (style === "glass") {
    // Kaca (tema Malam): kilau diagonal dan tepi dalam terang.
    const gl = ctx.createLinearGradient(x, y, x + s, y + s);
    gl.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    gl.addColorStop(0.45, "rgba(255, 255, 255, 0.06)");
    gl.addColorStop(1, "rgba(0, 0, 0, 0.25)");
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = Math.max(1, px);
    roundRect(ctx, x + px / 2, y + px / 2, s - px, s - px, Math.max(1, r - px / 2));
    ctx.stroke();
    ctx.restore();
    return;
  }

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

/**
 * Tanda Blok Pengisi: tanda tambah di tengah (PRD-6 bagian 14). Selalu tampil, tidak hanya di mode buta
 * warna, karena warnanya (putih) bisa mirip blok lain di tema Monokrom.
 */
function drawFillerMark(ctx: Ctx, x: number, y: number, s: number, ink: string): void {
  const u = s / 8;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.fillRect(x + u * 3.4, y + u * 2, u * 1.2, u * 4);
  ctx.fillRect(x + u * 2, y + u * 3.4, u * 4, u * 1.2);
  ctx.restore();
}

/** size: piksel perangkat per sel. dpr dipakai untuk menskalakan radius dan garis. */
export function buildAtlas(size: number, dpr: number, colorSafe: boolean, theme: Theme = THEMES.classic): Atlas {
  const canvas = makeCanvas(size * 9, size * 4);
  const ctx = canvas.getContext("2d") as Ctx;
  const r = Math.max(1, Math.round(4 * dpr * (size / (22 * dpr))));
  const px = Math.max(1, Math.round(dpr));
  const inset = Math.max(1, Math.round(dpr)); // celah antar blok

  for (let type = 1; type <= 8; type++) {
    const color = theme.blocks[type]!;
    // Blok Pengisi memakai warnanya sendiri juga di Monokrom, supaya tetap terlihat istimewa.
    const activeColor = type === 8 ? color : (theme.active ?? color);
    const x = type * size + inset / 2;
    const s = size - inset;

    // Blok normal (DESIGN 5) dan piece aktif (berbeda hanya di tema Monokrom).
    for (const [row, c] of [[ROW_BLOCK, color], [ROW_ACTIVE, activeColor]] as const) {
      const y = row * size + inset / 2;
      drawBlock(ctx, c, x, y, s, r, px, theme.style);
      // Tanda gelap di semua tema: di Neon, isi Blok Pengisi sudah terang karena cahayanya putih.
      if (type === 8) drawFillerMark(ctx, x, y, s, theme.style === "neon" ? "rgba(5, 5, 7, 0.85)" : "rgba(15, 18, 23, 0.55)");
      else if (colorSafe) {
        ctx.save();
        roundRect(ctx, x, y, s, s, r);
        ctx.clip();
        drawPattern(ctx, type, x, y, s, theme.style === "neon" ? c : undefined);
        ctx.restore();
      }
    }

    // Ghost: outline 2px warna piece aktif, dengan isi sangat tipis supaya bentuknya terbaca sebagai satu piece.
    let y = ROW_GHOST * size + inset / 2;
    const ghostColor = activeColor;
    const lw = Math.max(1, Math.round(2 * dpr));
    roundRect(ctx, x + lw / 2, y + lw / 2, s - lw, s - lw, Math.max(1, r - lw / 2));
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = ghostColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ghostColor;
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
