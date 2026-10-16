// Kontrol sentuh: mode Tombol dan mode Gestur (SPEC 11.2, EDD-2 bagian 2.4 dan 2.5).
import { BTN, type BtnCode } from "./repeat.ts";
import { GestureRecognizer } from "./gesture.ts";

type Press = (btn: BtnCode, down: boolean, timeStamp: number) => void;

const BTN_BY_NAME: Record<string, BtnCode> = {
  left: BTN.LEFT,
  right: BTN.RIGHT,
  soft: BTN.SOFT,
  hard: BTN.HARD,
  cw: BTN.CW,
  ccw: BTN.CCW,
  hold: BTN.HOLD,
};

/**
 * Tombol di layar. Setiap jari dicatat ke tombolnya, jadi geser sambil putar bisa bersamaan.
 * pointerdown memanggil preventDefault supaya tidak ada klik tiruan atau zoom ketuk dua kali.
 */
export function bindTouchButtons(root: HTMLElement, press: Press, isActive: () => boolean): () => void {
  const held = new Map<number, BtnCode>();

  const onDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-btn]");
    if (!el || !isActive()) return;
    const btn = BTN_BY_NAME[el.dataset["btn"]!];
    if (btn === undefined) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    held.set(e.pointerId, btn);
    el.classList.add("pressed");
    press(btn, true, e.timeStamp);
  };
  const onUp = (e: PointerEvent) => {
    const btn = held.get(e.pointerId);
    if (btn === undefined) return;
    held.delete(e.pointerId);
    (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.classList.remove("pressed");
    press(btn, false, e.timeStamp);
  };

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  return () => {
    for (const [, btn] of held) press(btn, false, performance.now());
    held.clear();
    root.querySelectorAll(".pressed").forEach((el) => el.classList.remove("pressed"));
  };
}

/** Gestur di atas papan. `unit` dibaca saat jari menyentuh, jadi selalu sesuai ukuran sel terbaru. */
export function bindGestures(area: HTMLElement, press: Press, isActive: () => boolean, cellCss: () => number): () => void {
  const rec = new GestureRecognizer(press);

  area.addEventListener("pointerdown", (e) => {
    if (!isActive() || e.pointerType === "mouse") return;
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

  return () => rec.reset();
}
