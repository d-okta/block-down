// Mode ukur performa, aktif hanya dengan ?perf di URL (ROADMAP Fase 2, uji di Galaxy A13).
// Bukan fitur pemain: angka teknis tanpa teks bahasa, tidak tampil tanpa parameter.
// Mengukur jarak antar frame (yang dirasakan pemain) dan waktu kerja frame (yang dihabiskan kode kita).

const N = 8192; // sekitar 2 menit di 60 Hz, 1,5 menit di 90 Hz
const interval = new Float32Array(N);
const work = new Float32Array(N);
const sorted = new Float32Array(N);
let count = 0;
let lastFrame = -1;
let el: HTMLElement | null = null;
let lastShow = 0;

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

/** Dipanggil saat loop berhenti (jeda, game over), supaya waktu jeda tidak dihitung sebagai frame lambat. */
export function perfPause(): void {
  lastFrame = -1;
}

/** start: timestamp rAF; end: performance.now() setelah frame selesai digambar. */
export function perfFrame(start: number, end: number): void {
  if (!el) return;
  if (lastFrame >= 0 && count < N) {
    interval[count] = start - lastFrame;
    work[count] = end - start;
    count++;
  }
  lastFrame = start;
  if (end - lastShow > 1000) {
    lastShow = end;
    show();
  }
}

function pct(arr: Float32Array, n: number, p: number): number {
  sorted.set(arr.subarray(0, n));
  const s = sorted.subarray(0, n).sort();
  return s[Math.min(n - 1, Math.floor(n * p))]!;
}

function show(): void {
  const n = count;
  if (n < 10) return;
  const med = pct(interval, n, 0.5);
  let slow = 0;
  let max = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = interval[i]!;
    total += v;
    if (v > med * 1.5) slow++;
    if (v > max) max = v;
  }
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  const heap = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB` : "-";
  el!.textContent =
    `waktu ${(total / 1000).toFixed(0)} s, frame ${n}${n === N ? " (penuh)" : ""}\n` +
    `fps ${(1000 / med).toFixed(0)}  lambat ${slow} (${((slow / n) * 100).toFixed(1)}%)  maks ${max.toFixed(0)} ms\n` +
    `kerja p50 ${pct(work, n, 0.5).toFixed(1)}  p99 ${pct(work, n, 0.99).toFixed(1)}  maks ${pct(work, n, 1).toFixed(1)} ms\n` +
    `heap ${heap}`;
}
