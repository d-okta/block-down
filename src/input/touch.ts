// Kontrol sentuh: gestur di layar Game (SPEC 11.2, EDD-2 bagian 2.5).
import type { BtnCode } from "./repeat.ts";
import { GestureRecognizer } from "./gesture.ts";

type Press = (btn: BtnCode, down: boolean, timeStamp: number) => void;

/**
 * Gestur di seluruh area layar Game, kecuali tombol (jeda). Jari tidak harus di atas papan,
 * jadi papan tetap terlihat. `unit` dibaca saat jari menyentuh, supaya selalu sesuai ukuran sel.
 */
export function bindGestures(area: HTMLElement, press: Press, isActive: () => boolean, cellCss: () => number): () => void {
  const rec = new GestureRecognizer(press);

  area.addEventListener("pointerdown", (e) => {
    if (!isActive() || e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    area.setPointerCapture(e.pointerId);
    rec.unit = cellCss();
    rec.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  });
  area.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") return;
    rec.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  });
  area.addEventListener("pointerup", (e) => rec.up(e.pointerId, e.clientX, e.clientY, e.timeStamp));
  area.addEventListener("pointercancel", (e) => rec.cancel(e.pointerId, e.timeStamp));
  area.addEventListener("contextmenu", (e) => e.preventDefault());

  return () => rec.reset();
}
