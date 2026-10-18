// Mode ukur performa, aktif hanya dengan ?perf di URL (ROADMAP Fase 2, uji di Galaxy A13).
// Bukan fitur pemain: angka teknis tanpa teks bahasa, tidak tampil tanpa parameter.
// Mengukur jarak antar frame (yang dirasakan pemain) dan waktu kerja frame (yang dihabiskan kode kita).
//
// Memakai histogram (kotak 0,25 ms) supaya biaya per frame tetap kecil: tanpa mengurutkan data,
// tanpa alokasi. Versi pertama mengurutkan 8.000 angka empat kali per detik, dan di Galaxy A13
// itu sendiri bisa membuat frame tersendat.

const BIN = 0.25; // ms per kotak
const BINS = 2000; // sampai 500 ms; nilai di atasnya masuk kotak terakhir
const gapHist = new Uint32Array(BINS);
const workHist = new Uint32Array(BINS);
let count = 0;
let slow = 0;
let gapMax = 0;
let workMax = 0;
let total = 0;
let lastFrame = -1;
let lastShow = 0;
let heapStart = -1;
let el: HTMLElement | null = null;

export const perfEnabled = new URLSearchParams(location.search).has("perf");

if (perfEnabled) {
  el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;left:calc(4px + env(safe-area-inset-left));bottom:calc(4px + env(safe-area-inset-bottom));z-index:20;" +
    "padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.75);color:#E6E9EF;pointer-events:none;" +
    "font:500 11px/1.4 'JetBrains Mono',monospace;white-space:pre";
  el.textContent = "perf: mulai main";
  document.body.append(el);
}

const bin = (ms: number) => Math.min(BINS - 1, Math.floor(ms / BIN));

/** Persentil dari histogram, dalam ms (batas atas kotak). */
function pct(h: Uint32Array, p: number): number {
  const target = Math.ceil(count * p);
  let acc = 0;
  for (let i = 0; i < BINS; i++) {
    acc += h[i]!;
    if (acc >= target) return (i + 1) * BIN;
  }
  return BINS * BIN;
}

/** Dipanggil saat loop berhenti (jeda, game over), supaya waktu jeda tidak dihitung sebagai frame lambat. */
export function perfPause(): void {
  lastFrame = -1;
}

let workTag = "";
let frameTag = "";

/** Catat kejadian di frame ini (misalnya "clear4"), supaya frame terberat bisa dikenali. */
export function perfTag(tag: string): void {
  if (el) frameTag = tag;
}

/**
 * vsync: timestamp rAF (untuk jarak antar frame); begin dan end: performance.now() di awal dan
 * akhir kode frame (untuk waktu kerja). Versi pertama memakai vsync sebagai awal kerja, sehingga
 * keterlambatan browser memanggil frame ikut terhitung sebagai kerja game.
 */
export function perfFrame(vsync: number, begin: number, end: number): void {
  if (!el) return;
  if (lastFrame >= 0) {
    const gap = vsync - lastFrame;
    const w = end - begin;
    gapHist[bin(gap)]!++;
    workHist[bin(w)]!++;
    count++;
    total += gap;
    if (gap > gapMax) gapMax = gap;
    if (w > workMax) {
      workMax = w;
      workTag = frameTag;
    }
    // Tersendat: jarak frame lebih dari 1,5 kali satu frame 60 Hz (25 ms).
    if (gap > 25) slow++;
  }
  frameTag = "";
  lastFrame = vsync;
  if (end - lastShow > 2000) {
    lastShow = end;
    show();
  }
}

function show(): void {
  if (count < 10) return;
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  let heap = "-";
  if (mem) {
    const mb = mem.usedJSHeapSize / 1048576;
    if (heapStart < 0) heapStart = mb;
    heap = `${mb.toFixed(1)} MB (awal ${heapStart.toFixed(1)})`;
  }
  el!.textContent =
    `waktu ${(total / 1000).toFixed(0)} s, frame ${count}\n` +
    `fps ${(1000 / pct(gapHist, 0.5)).toFixed(0)}  tersendat ${slow} (${((slow / count) * 100).toFixed(1)}%)  maks ${gapMax.toFixed(0)} ms\n` +
    `kerja p50 ${pct(workHist, 0.5).toFixed(1)}  p99 ${pct(workHist, 0.99).toFixed(1)}  maks ${workMax.toFixed(1)} ms${workTag ? ` (${workTag})` : ""}\n` +
    `heap ${heap}`;
}
