import { id, type Key } from "./id.ts";
import { en } from "./en.ts";
import type { Locale } from "../store/storage.ts";

export type { Key };

const DICTS: Record<Locale, Record<Key, string>> = { id, en };
let locale: Locale = "id";
let numFmt = new Intl.NumberFormat("id-ID");

/** Pilihan tersimpan, lalu bahasa browser, lalu id (SPEC 9). */
export function pickLocale(saved: Locale | null, nav: readonly string[]): Locale {
  if (saved) return saved;
  for (const l of nav) {
    const low = l.toLowerCase();
    if (low.startsWith("en")) return "en";
    if (low.startsWith("id") || low.startsWith("in")) return "id";
  }
  return "id";
}

export function setLocale(l: Locale): void {
  locale = l;
  numFmt = new Intl.NumberFormat(l === "id" ? "id-ID" : "en-US");
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function fmt(n: number): string {
  return numFmt.format(n);
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const s = DICTS[locale][key];
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    if (v === undefined) return m;
    return typeof v === "number" ? fmt(v) : v;
  });
}

/** Isi semua elemen bertanda data-i18n / data-i18n-aria / data-i18n-title di dalam root. */
export function applyI18n(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset["i18n"] as Key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset["i18nAria"] as Key));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset["i18nTitle"] as Key);
  });
}

/** m:ss.mmm untuk Sprint (SPEC 10). */
export function formatMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

/** mm:ss.cc untuk waktu berjalan (HUD, Pause). */
export function formatClock(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}
