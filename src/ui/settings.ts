// Layar Pengaturan (DESIGN 7.5, EDD-2 bagian 6.3). Setiap perubahan langsung disimpan dan berlaku.
// Musik dan Efek suara baru ditampilkan di Fase 4 tahap 2, bersama fiturnya.
import { t, type Key } from "../i18n/index.ts";
import { keyLabel, RESERVED_CODES } from "../input/keyboard.ts";
import { BTNS, defaultSettings, type Btn, type Locale, type Settings } from "../store/storage.ts";

const SOFT_STEPS = [5, 10, 15, 20, 25, 30, 35, 40] as const;

export interface SettingsHooks {
  /** Dipanggil setelah nilai berubah; `what` memberi tahu bagian mana yang perlu diterapkan ulang. */
  changed(what: "input" | "keymap" | "display" | "locale"): void;
  /** Kurangi animasi dari sistem (`prefers-reduced-motion`), dipakai saat pemain belum memilih. */
  systemReduce(): boolean;
  /** Getar tersedia di perangkat ini. */
  hapticsAvailable(): boolean;
  setLocale(l: Locale): void;
  announce(text: string): void;
  back(): void;
}

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

export class SettingsScreen {
  private root: HTMLElement;
  private s: Settings;
  private h: SettingsHooks;
  private listening: { btn: Btn; slot: number; el: HTMLButtonElement } | null = null;
  private keyMsg: HTMLElement;

  constructor(root: HTMLElement, settings: Settings, hooks: SettingsHooks) {
    this.root = root;
    this.s = settings;
    this.h = hooks;
    this.keyMsg = $(root, "#keys-msg");

    this.bindRange("in-das", (v) => {
      this.s.dasMs = v;
      this.h.changed("input");
    });
    this.bindRange("in-arr", (v) => {
      this.s.arrMs = v;
      this.h.changed("input");
    });
    this.bindRange("in-soft", (v) => {
      this.s.softDropFactor = v === 9 ? "instant" : SOFT_STEPS[v - 1]!;
      this.h.changed("input");
    });

    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (!el) return;
      const set = el.dataset["set"];
      if (set === "ghost" || set === "grid" || set === "colorSafe" || set === "haptics") {
        this.s[set] = !this.s[set];
        this.h.changed("display");
      } else if (set === "reduceMotion") {
        // Nilai efektif dibalik; setelah dipilih pemain, tidak lagi mengikuti sistem.
        this.s.reduceMotion = !(this.s.reduceMotion ?? this.h.systemReduce());
        this.h.changed("display");
      } else if (set === "effects") {
        if (el.getAttribute("aria-disabled") === "true") return;
        this.s.effects = el.dataset["value"] as Settings["effects"];
        this.h.changed("display");
      } else if (el.dataset["locale"]) {
        this.h.setLocale(el.dataset["locale"] as Locale);
      } else if (el.dataset["bind"]) {
        this.startListening(el as HTMLButtonElement);
        return;
      } else if (el.id === "btn-reset") {
        this.resetControls();
        this.render();
        return;
      } else if (el.id === "btn-settings-back") {
        this.h.back();
        return;
      } else return;
      this.renderValues();
    });

    // Tombol kembali dan Esc. Saat mendengarkan tombol baru, Esc hanya membatalkan.
    window.addEventListener(
      "keydown",
      (e) => {
        if (root.hidden) return;
        if (this.listening) {
          e.preventDefault();
          e.stopPropagation();
          this.captureKey(e.code);
          return;
        }
        if (e.code === "Escape") {
          e.preventDefault();
          this.h.back();
        }
      },
      { capture: true },
    );
  }

  open(): void {
    this.keyMsg.textContent = "";
    this.render();
    $<HTMLElement>(this.root, "#btn-settings-back").focus();
  }

  /** Dipakai saat bahasa berganti, karena label tombol keyboard dibuat dari kode. */
  render(): void {
    this.renderValues();
    this.renderKeymap();
  }

  private renderValues(): void {
    const s = this.s;
    const das = $<HTMLInputElement>(this.root, "#in-das");
    das.value = String(s.dasMs);
    this.showValue("out-das", das, t("settings.unit.ms", { n: s.dasMs }));
    const arr = $<HTMLInputElement>(this.root, "#in-arr");
    arr.value = String(s.arrMs);
    this.showValue("out-arr", arr, t("settings.unit.ms", { n: s.arrMs }));
    const soft = $<HTMLInputElement>(this.root, "#in-soft");
    const softIdx = s.softDropFactor === "instant" ? 9 : SOFT_STEPS.indexOf(s.softDropFactor as (typeof SOFT_STEPS)[number]) + 1 || 4;
    soft.value = String(softIdx);
    this.showValue(
      "out-soft",
      soft,
      s.softDropFactor === "instant" ? t("settings.softDrop.instant") : t("settings.unit.x", { n: s.softDropFactor }),
    );

    for (const k of ["ghost", "grid", "colorSafe"] as const) {
      $<HTMLElement>(this.root, `[data-set="${k}"]`).setAttribute("aria-checked", String(s[k]));
    }

    // Kurangi animasi mengunci intensitas ke Minimal (DESIGN 10 butir 5).
    const reduce = s.reduceMotion ?? this.h.systemReduce();
    $<HTMLElement>(this.root, '[data-set="reduceMotion"]').setAttribute("aria-checked", String(reduce));
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-set="effects"]')) {
      const shown = reduce ? "minimal" : s.effects;
      b.setAttribute("aria-pressed", String(b.dataset["value"] === shown));
      b.setAttribute("aria-disabled", String(reduce));
    }
    $<HTMLElement>(this.root, "#effects-locked").hidden = !reduce;

    // Getar: nonaktif dengan alasan jika perangkat tidak mendukung (DESIGN 7.5).
    const hap = $<HTMLElement>(this.root, '[data-set="haptics"]');
    const available = this.h.hapticsAvailable();
    hap.setAttribute("aria-checked", String(available && s.haptics));
    hap.toggleAttribute("disabled", !available);
    $<HTMLElement>(this.root, "#haptics-desc").textContent = t(available ? "settings.haptics.desc" : "notice.hapticsUnavailable");
  }

  private bindRange(inputId: string, apply: (v: number) => void): void {
    const input = $<HTMLInputElement>(this.root, `#${inputId}`);
    input.addEventListener("input", () => {
      apply(Number(input.value));
      this.renderValues();
    });
  }

  private showValue(outId: string, input: HTMLInputElement, text: string): void {
    $<HTMLElement>(this.root, `#${outId}`).textContent = text;
    input.setAttribute("aria-valuetext", text);
  }

  // ---------- pemetaan tombol ----------

  private renderKeymap(): void {
    const box = $<HTMLElement>(this.root, "#keymap");
    box.textContent = "";
    for (const b of BTNS) {
      const row = document.createElement("div");
      row.className = "key-row";
      const name = document.createElement("span");
      name.className = "key-action";
      name.textContent = t(`controls.${b}` as Key);
      row.append(name);
      for (let slot = 0; slot < 2; slot++) {
        const code = this.s.keymap[b][slot];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key-btn num";
        btn.dataset["bind"] = b;
        btn.dataset["slot"] = String(slot);
        btn.textContent = code ? keyLabel(code) : "+";
        btn.setAttribute(
          "aria-label",
          t("settings.keys.slot", { action: t(`controls.${b}` as Key), n: slot + 1, key: code ? keyLabel(code) : t("settings.keys.empty") }),
        );
        row.append(btn);
      }
      box.append(row);
    }
  }

  private startListening(el: HTMLButtonElement): void {
    const btn = el.dataset["bind"] as Btn;
    const slot = Number(el.dataset["slot"]);
    this.listening = { btn, slot, el };
    el.classList.add("listening");
    el.textContent = "...";
    this.keyMsg.textContent = t("settings.keys.listening", { action: t(`controls.${btn}` as Key) });
  }

  private captureKey(code: string): void {
    const L = this.listening!;
    const action = t(`controls.${L.btn}` as Key);
    const list = this.s.keymap[L.btn];
    let msg = "";
    if (code === "Escape") {
      msg = "";
    } else if (code === "Backspace" || code === "Delete") {
      const other = list.filter((_, i) => i !== L.slot);
      if (other.length === 0) msg = t("settings.keys.lastKey");
      else {
        this.s.keymap[L.btn] = other;
        msg = t("settings.keys.saved", { action, key: t("settings.keys.empty") });
        this.h.changed("keymap");
      }
    } else if (RESERVED_CODES.has(code)) {
      msg = t("settings.keys.reserved");
    } else {
      const owner = BTNS.find((b) => b !== L.btn && this.s.keymap[b].includes(code));
      if (owner) {
        msg = t("settings.keys.conflict", { action: t(`controls.${owner}` as Key) });
      } else {
        const next = list.slice();
        const dup = next.indexOf(code);
        if (dup >= 0 && dup !== L.slot) next.splice(dup, 1);
        if (L.slot < next.length) next[L.slot] = code;
        else next.push(code);
        this.s.keymap[L.btn] = next.slice(0, 2);
        msg = t("settings.keys.saved", { action, key: keyLabel(code) });
        this.h.changed("keymap");
      }
    }
    this.listening = null;
    this.renderKeymap();
    this.keyMsg.textContent = msg;
    const again = this.root.querySelector<HTMLElement>(`[data-bind="${L.btn}"][data-slot="${L.slot}"]`);
    again?.focus();
  }

  private resetControls(): void {
    const d = defaultSettings();
   this.s.dasMs = d.dasMs;
    this.s.arrMs = d.arrMs;
    this.s.softDropFactor = d.softDropFactor;
    this.s.keymap = d.keymap;
    this.h.changed("input");
    this.h.changed("keymap");
   this.keyMsg.textContent = "";
    this.h.announce(t("settings.reset.done"));
  }
}
