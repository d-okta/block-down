// Callout reward di sepertiga atas papan (DESIGN 8.3, EDD-2 bagian 4.4).
// Animasi memakai Web Animations API (transform dan opacity saja). Callout baru menggantikan yang lama.
import type { FxScale } from "../render/fx.ts";

export type CalloutTone = "normal" | "spin" | "gold";

export class Callout {
  private root: HTMLElement;
  private points: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private anims: Animation[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.points = root.querySelector("#callout-points")!;
    this.title = root.querySelector("#callout-title")!;
    this.sub = root.querySelector("#callout-sub")!;
  }

  /** delay: ms sebelum muncul (Quad muncul di 200 ms storyboard). */
  show(title: string, points: string, sub: string, tone: CalloutTone, fx: FxScale, delay = 0): void {
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
    this.title.textContent = title;
    this.points.textContent = points;
    this.sub.textContent = sub;
    this.points.hidden = points === "";
    this.sub.hidden = sub === "";
    this.root.dataset["tone"] = tone;

    const minimal = fx.level === "minimal";
    const hold = 900;
    const total = delay + 180 + hold + 260;
    const at = (ms: number) => ms / total;
    // Muncul dengan sedikit membesar, diam, lalu memudar naik. Minimal: hanya pudar.
    this.anims.push(
      this.root.animate(
        minimal
          ? [
              { opacity: 0, offset: 0 },
              { opacity: 0, offset: at(delay) },
              { opacity: 1, offset: at(delay + 180) },
              { opacity: 1, offset: at(delay + 180 + hold) },
              { opacity: 0, offset: 1 },
            ]
          : [
              { opacity: 0, transform: "translateY(6px) scale(0.92)", offset: 0 },
              { opacity: 0, transform: "translateY(6px) scale(0.92)", offset: at(delay) },
              { opacity: 1, transform: "translateY(0) scale(1)", offset: at(delay + 180), easing: "ease-out" },
              { opacity: 1, transform: "translateY(0) scale(1)", offset: at(delay + 180 + hold), easing: "ease-in" },
              { opacity: 0, transform: "translateY(-10px) scale(1)", offset: 1 },
            ],
        { duration: total, fill: "forwards" },
      ),
    );
    if (!minimal) {
      // Sapuan cahaya aksen sekali melintasi judul (bukan denyut berulang).
      this.anims.push(
        this.title.animate([{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }], {
          duration: 420,
          delay: delay + 80,
          easing: "ease-out",
          fill: "both",
        }),
      );
      // Angka skor melayang naik sedikit lebih jauh dari judul.
      if (points) {
        this.anims.push(
          this.points.animate([{ transform: "translateY(8px)" }, { transform: "translateY(-6px)" }], {
            duration: 700,
            delay,
            easing: "ease-out",
            fill: "both",
          }),
        );
      }
    }
  }

  hide(): void {
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
    this.root.style.opacity = "0";
  }
}
