// Layar Statistik dan Peringkat (PRD-7). Tab "Saya": statistik pribadi dan rekor dari perangkat ini.
// Tab "Peringkat": leaderboard online per mode, diambil dari server saat tab dibuka.
import { formatMs, t, type Key } from "../i18n/index.ts";
import type { Records, Stats, Online } from "../store/storage.ts";

export type BoardMode = "sprint40" | "ultra" | "marathon150";

export interface BoardEntry {
  name: string;
  value: number;
  at: string;
}

export interface StatsHooks {
  back(): void;
  /** Ambil leaderboard. Mengembalikan null jika tidak bisa (offline, server belum aktif). */
  fetchBoard(mode: BoardMode): Promise<{ entries: BoardEntry[]; enabled: boolean } | null>;
  fmt(n: number): string;
}

const BOARD_MODES: readonly BoardMode[] = ["sprint40", "ultra", "marathon150"];

/** Format nilai leaderboard: Sprint waktu, lainnya skor. */
export function boardValue(mode: BoardMode, v: number, fmt: (n: number) => string): string {
  return mode === "sprint40" ? formatMs(v) : fmt(v);
}

/** Lama bermain dalam jam dan menit, atau menit dan detik jika di bawah satu jam. */
export function playTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? t("stats.hm", { h, m }) : t("stats.ms", { m, s: s % 60 });
}

export class StatsScreen {
  private root: HTMLElement;
  private stats: Stats;
  private records: Records;
  private online: () => Online | null;
  private h: StatsHooks;
  private tab: "me" | "board" = "me";
  private mode: BoardMode = "sprint40";
  private req = 0;

  constructor(root: HTMLElement, stats: Stats, records: Records, online: () => Online | null, hooks: StatsHooks) {
    this.root = root;
    this.stats = stats;
    this.records = records;
    this.online = online;
    this.h = hooks;
    root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (!el) return;
      if (el.id === "btn-stats-back") this.h.back();
      else if (el.dataset["tab"]) this.showTab(el.dataset["tab"] as "me" | "board");
      else if (el.dataset["board"]) {
        this.mode = el.dataset["board"] as BoardMode;
        void this.loadBoard();
      }
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.h.back();
      }
    });
  }

  open(): void {
    this.showTab(this.tab);
    this.root.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`)?.focus();
  }

  /** Dipakai saat bahasa berganti. */
  render(): void {
    this.renderMe();
    if (this.tab === "board") void this.loadBoard();
  }

  private showTab(tab: "me" | "board"): void {
    this.tab = tab;
    for (const b of this.root.querySelectorAll<HTMLElement>("[data-tab]")) {
      const on = b.dataset["tab"] === tab;
      b.setAttribute("aria-selected", String(on));
      b.setAttribute("aria-pressed", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    (this.root.querySelector("#panel-me") as HTMLElement).hidden = tab !== "me";
    (this.root.querySelector("#panel-board") as HTMLElement).hidden = tab !== "board";
    if (tab === "me") this.renderMe();
    else void this.loadBoard();
  }

  private renderMe(): void {
    const st = this.stats;
    const fmt = this.h.fmt;
    (this.root.querySelector("#stats-empty") as HTMLElement).hidden = st.games > 0;
    const grid = this.root.querySelector<HTMLElement>("#stats-grid")!;
    grid.textContent = "";
    const items: [Key, string][] = [
      ["stats.games", fmt(st.games)],
      ["stats.playTime", playTime(st.playMs)],
      ["stats.lines", fmt(st.lines)],
      ["stats.pieces", fmt(st.pieces)],
      ["stats.quads", fmt(st.quads)],
      ["stats.tspins", fmt(st.tspins)],
      ["stats.perfects", fmt(st.perfects)],
      ["stats.bestCombo", fmt(st.bestCombo)],
    ];
    for (const [k, v] of items) {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = t(k);
      const dd = document.createElement("dd");
      dd.className = "num";
      dd.textContent = v;
      div.append(dt, dd);
      grid.append(div);
    }
    const rec = this.root.querySelector<HTMLElement>("#stats-records")!;
    rec.textContent = "";
    const r = this.records;
    const none = t("menu.noRecord");
    const rows: [string, string][] = [
      [`${t("mode.marathon.name")} ${t("menu.marathon150")}`, r.marathon150 ? fmt(r.marathon150.score) : none],
      [`${t("mode.marathon.name")} ${t("menu.marathonEndless")}`, r.marathonEndless ? fmt(r.marathonEndless.score) : none],
      [t("mode.sprint40.name"), r.sprint40 ? formatMs(r.sprint40.timeMs) : none],
      [t("mode.ultra.name"), r.ultra ? fmt(r.ultra.score) : none],
      [t("mode.zen.name"), r.zen ? t("menu.recordLines", { n: r.zen.lines }) : none],
    ];
    for (const [k, v] of rows) {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.className = "num";
      dd.textContent = v;
      div.append(dt, dd);
      rec.append(div);
    }
    // Jumlah permainan per mode, di bawah rekor (tanpa grafik: angka saja sudah cukup jelas).
  }

  private async loadBoard(): Promise<void> {
    for (const b of this.root.querySelectorAll<HTMLElement>("[data-board]")) b.setAttribute("aria-pressed", String(b.dataset["board"] === this.mode));
    const list = this.root.querySelector<HTMLElement>("#board-list")!;
    const status = this.root.querySelector<HTMLElement>("#board-status")!;
    const me = this.online();
    this.root.querySelector("#board-me")!.textContent = me ? t("board.you", { name: me.name }) : t("board.noName");
    status.textContent = t("board.loading");
    list.textContent = "";
    const req = ++this.req;
    const mode = this.mode;
    const res = await this.h.fetchBoard(mode);
    if (req !== this.req) return; // tab atau mode sudah diganti
    if (!res) {
      status.textContent = t("board.offline");
      return;
    }
    if (!res.enabled) {
      status.textContent = t("board.disabled");
      return;
    }
    status.textContent = res.entries.length === 0 ? t("board.empty") : "";
    res.entries.forEach((e, i) => {
      const li = document.createElement("li");
      if (me && e.name === me.name) li.className = "mine";
      const rank = document.createElement("span");
      rank.className = "board-rank num";
      rank.textContent = String(i + 1);
      const name = document.createElement("span");
      name.className = "board-name";
      name.textContent = e.name;
      const val = document.createElement("span");
      val.className = "board-value num";
      val.textContent = boardValue(mode, e.value, this.h.fmt);
      li.append(rank, name, val);
      list.append(li);
    });
  }
}

export { BOARD_MODES };
