// Layar Tema (PRD-6, revisi: dipisah dari Pengaturan atas permintaan pemilik, supaya mudah ditemukan).
// Satu kartu per tema dengan contoh mini-papan, nama, dan syarat jika terkunci. Tema terkunci tetap
// terlihat supaya pemain tahu apa yang bisa dikejar, tapi tidak bisa dipilih.
import { t, type Key } from "../i18n/index.ts";
import { isUnlocked, THEME_IDS, type ThemeId } from "../core/unlocks.ts";
import { THEMES, type Theme } from "../render/themes.ts";
import type { Settings, Unlocks } from "../store/storage.ts";

export interface ThemesHooks {
  /** Tema dipilih: terapkan dan simpan. */
  pick(id: ThemeId): void;
  back(): void;
}

/** Contoh mini-papan: 6 kolom x 4 baris dari bawah. Huruf = jenis blok (indeks warna tema), titik = kosong. */
const SAMPLE = ["IIII.O", "JJ.TOO", "JLTTTS", "LLZZSS"].reverse();
const IDX: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

function sample(th: Theme): HTMLElement {
  const board = document.createElement("span");
  board.className = `theme-sample style-${th.style}`;
  board.setAttribute("aria-hidden", "true");
  board.style.background = th.css["--surface-1"]!;
  board.style.borderColor = th.css["--line-deco"]!;
  for (let r = SAMPLE.length - 1; r >= 0; r--) {
    for (const ch of SAMPLE[r]!) {
      const cell = document.createElement("i");
      if (ch !== ".") cell.style.setProperty("--c", th.blocks[IDX[ch]!]!);
      else cell.className = "empty";
      board.append(cell);
    }
  }
  return board;
}

export class ThemesScreen {
  private root: HTMLElement;
  private s: Settings;
  private unlocks: Unlocks;
  private h: ThemesHooks;

  constructor(root: HTMLElement, settings: Settings, unlocks: Unlocks, hooks: ThemesHooks) {
    this.root = root;
    this.s = settings;
    this.unlocks = unlocks;
    this.h = hooks;
    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (!el) return;
      if (el.id === "btn-themes-back") {
        this.h.back();
        return;
      }
      const id = el.dataset["theme"] as ThemeId | undefined;
      if (!id || !isUnlocked(this.unlocks, id) || this.s.theme === id) return;
      this.h.pick(id);
      this.render();
      root.querySelector<HTMLElement>(`[data-theme="${id}"]`)?.focus();
    });
    // Panah memindahkan fokus antar kartu (pola radiogroup); Esc kembali.
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.h.back();
        return;
      }
      const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      const cards = [...root.querySelectorAll<HTMLElement>(".theme-card")];
      const i = cards.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      cards[(i + dir + cards.length) % cards.length]!.focus();
    });
  }

  open(): void {
    this.render();
    this.root.querySelector<HTMLElement>(`[data-theme="${this.s.theme}"]`)?.focus();
  }

  render(): void {
    const open = THEME_IDS.filter((id) => isUnlocked(this.unlocks, id)).length;
    this.root.querySelector("#themes-intro")!.textContent = t("themes.intro", { n: open, total: THEME_IDS.length });
    const box = this.root.querySelector<HTMLElement>("#themes")!;
    box.textContent = "";
    for (const id of THEME_IDS) {
      const th = THEMES[id];
      const unlocked = isUnlocked(this.unlocks, id);
      const active = this.s.theme === id;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "theme-card";
      card.dataset["theme"] = id;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(active));
      card.setAttribute("aria-disabled", String(!unlocked));
      const text = document.createElement("span");
      text.className = "theme-text";
      const name = document.createElement("span");
      name.className = "theme-name";
      name.textContent = t(`theme.${id}` as Key);
      const status = document.createElement("span");
      status.className = "theme-status";
      status.textContent = active ? t("themes.inUse") : unlocked ? t("themes.tapToUse") : t(`theme.req.${id}` as Key);
      text.append(name, status);
      if (!unlocked) {
        const lock = document.createElement("span");
        lock.className = "theme-lock";
        lock.textContent = t("themes.locked");
        text.prepend(lock);
      }
      card.append(sample(th), text);
      box.append(card);
    }
  }
}
