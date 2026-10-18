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

  /**
   * delay: ms sebelum muncul (4 Baris muncul di 200 ms storyboard).
   * power: 1 kecil dan singkat, sampai 4 dan 5 yang masuk dengan hentakan besar (revisi Fase 4).
   */
  show(title: string, points: string, sub: string, tone: CalloutTone, fx: FxScale, delay = 0, power = 4): void {
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
    this.title.textContent = title;
    this.points.textContent = points;
    this.sub.textContent = sub;
    this.points.hidden = points === "";
    this.sub.hidden = sub === "";
    this.root.dataset["tone"] = tone;
    this.root.dataset["power"] = String(power);

    const minimal = fx.level === "minimal";
    const hold = power <= 1 ? 450 : power === 2 ? 650 : 950;
    const total = delay + 180 + hold + 260;
    const at = (ms: number) => ms / total;
    // Masuk dengan hentakan: membesar melewati ukuran akhir, lalu kembali. Makin kuat, makin besar.
    const from = power >= 4 ? 1.9 : power === 3 ? 1.45 : 0.85;
    const peak = power >= 4 ? 0.9 : power === 3 ? 0.95 : 1.06;
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
              { opacity: 0, transform: `scale(${from})`, offset: 0 },
              { opacity: 0, transform: `scale(${from})`, offset: at(delay) },
              { opacity: 1, transform: `scale(${peak})`, offset: at(delay + 120), easing: "ease-out" },
              { opacity: 1, transform: "scale(1)", offset: at(delay + 200), easing: "ease-out" },
              { opacity: 1, transform: "translateY(0) scale(1)", offset: at(delay + 180 + hold), easing: "ease-in" },
              { opacity: 0, transform: "translateY(-14px) scale(1.04)", offset: 1 },
            ],
        { duration: total, fill: "forwards" },
      ),
    );
    if (!minimal && power >= 3) {
      // Cahaya di belakang tulisan: menyala saat masuk lalu meredup.
      this.anims.push(
        this.root.animate(
          [
            { "--glow": "0" },
            { "--glow": "1", offset: 0.25 },
            { "--glow": "0.35" },
          ] as Keyframe[],
          { duration: 900, delay, easing: "ease-out", fill: "forwards" },
        ),
      );
    }
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
  }

  /** Siapkan animasi dan gaya teks callout sekali tanpa terlihat (lihat BoardRenderer.warmUp). */
  warmUp(fx: FxScale): void {
    this.root.style.visibility = "hidden";
    this.show("4", "+0", "0", "normal", fx, 0, 4);
    for (const a of this.anims) a.finish();
    this.hide();
    this.root.style.visibility = "";
  }
}
