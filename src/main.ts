// Menyambungkan core, input, render, dan UI. Fase 2: Maraton bisa dimainkan dengan keyboard.
import { createGame, STATUS, type Game } from "./core/game.ts";
import { EV } from "./core/events.ts";
import { NEXT_COUNT, ticksToMs } from "./core/constants.ts";
import type { ModeId } from "./core/modes.ts";
import { InputRepeater, createActionBuffer } from "./input/repeat.ts";
import { Keyboard } from "./input/keyboard.ts";
import { BoardRenderer, PreviewRenderer } from "./render/board.ts";
import { applyI18n, fmt, formatClock, pickLocale, setLocale, t, type Key } from "./i18n/index.ts";
import { load, save, submitResult, type Locale, type SaveData } from "./store/storage.ts";

const STEP = 1000 / 60;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- data ----------

const loaded = load();
const data: SaveData = loaded.data;
const storageOk = loaded.status !== "unavailable" && loaded.status !== "newer";

// ---------- elemen ----------

const scrMenu = $("scr-menu");
const scrGame = $("scr-game");
const dlgPause = $<HTMLDialogElement>("dlg-pause");
const dlgConfirm = $<HTMLDialogElement>("dlg-confirm");
const dlgOver = $<HTMLDialogElement>("dlg-over");
const live = $("live");
const field = $("field");
const cvMain = $<HTMLCanvasElement>("cv-main");

const board = new BoardRenderer(cvMain, $<HTMLCanvasElement>("cv-bg"));
const holdView = new PreviewRenderer($<HTMLCanvasElement>("cv-hold"), 1);
const nextView = new PreviewRenderer($<HTMLCanvasElement>("cv-next"), NEXT_COUNT);
board.ghost = data.settings.ghost;
board.grid = data.settings.grid;
board.colorSafe = data.settings.colorSafe;

const hud = {
  score: $("hud-score"),
  level: $("hud-level"),
  lines: $("hud-lines"),
  combo: $("hud-combo"),
  comboBox: $("stat-combo"),
  mode: $("hud-mode"),
};

// ---------- pengumuman ----------

let lastAnnounce = 0;
let announceTimer = 0;
function announce(text: string): void {
  const now = performance.now();
  const wait = Math.max(0, lastAnnounce + 1000 - now);
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    live.textContent = text;
    lastAnnounce = performance.now();
  }, wait);
}

// ---------- status permainan ----------

let game: Game | null = null;
let modeId: ModeId = "marathon150";
let running = false;
let overShown = false;
/** Jam loop. */
const clk = {
  acc: 0,
  last: 0,
  sim: 0,
  /** Selisih jam event DOM dan jam simulasi, ditetapkan saat mulai dan resume. */
  offset: 0,
  /** y piece sebelum tick terakhir, untuk interpolasi jatuh. NaN jika piece baru. */
  fallFrom: NaN,
};

const input = new InputRepeater(data.settings.dasMs, data.settings.arrMs);
const actions = createActionBuffer();
const keyboard = new Keyboard({
  press: (btn, down, ts) => input.push(btn, down, ts - clk.offset),
  pause: () => pauseGame(),
});
keyboard.setKeymap(data.settings.keymap);

// Nilai HUD terakhir, supaya DOM hanya disentuh saat berubah.
const shown = { score: -1, level: -1, lines: -1, combo: -2, hold: -1, holdUsed: false };

// ponytail: Fase 2 hanya Maraton. Nama mode lain ditambahkan bersama modenya di Fase 3.
function modeName(_id: ModeId): string {
  return t("mode.marathon.name");
}

function startGame(id: ModeId): void {
  modeId = id;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  game = createGame(id, seed, { softDropFactor: data.settings.softDropFactor });
  input.releaseAll();
  shown.score = shown.level = shown.lines = shown.hold = -1;
  shown.combo = -2;
  overShown = false;
  clk.fallFrom = NaN;
  clk.sim = 0;
  hud.mode.textContent = `${modeName(id)} ${t(id === "marathon150" ? "menu.marathon150" : "menu.marathonEndless")}`;
  showScreen("game");
  layout();
  updateHud(true);
  resume();
}

function resume(): void {
  clk.acc = 0;
  clk.last = performance.now();
  clk.offset = clk.last - clk.sim;
  keyboard.enabled = true;
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

function stopLoop(): void {
  running = false;
  keyboard.enabled = false;
  input.releaseAll();
}

function frame(now: number): void {
  if (!running || !game) return;
  clk.acc += Math.min(now - clk.last, 250);
  clk.last = now;
  const s = game.state;
  while (clk.acc >= STEP && s.status === STATUS.PLAYING) {
    clk.sim += STEP;
    input.fill(clk.sim, actions);
    const beforeY = s.y;
    const beforePieces = s.pieces;
    game.events.clear();
    game.step(actions.data, actions.count);
    clk.fallFrom = s.pieces === beforePieces ? beforeY : NaN;
    clk.acc -= STEP;
    handleEvents(now);
  }
  updateHud(false);
  board.draw(s, clk.fallFrom, clk.acc / STEP, now, s.status === STATUS.PLAYING);
  if (s.status !== STATUS.PLAYING && !overShown) {
    overShown = true;
    stopLoop();
    showGameOver();
    return;
  }
  requestAnimationFrame(frame);
}

function handleEvents(now: number): void {
  const q = game!.events;
  for (let i = 0; i < q.count; i++) {
    const e = q.at(i);
    if (e.type === EV.LOCK) board.lockFlash(e.cells, e.a, now);
    else if (e.type === EV.LEVEL_UP) announce(t("callout.levelUp"));
    else if (e.type === EV.CLEAR) announceClear(e.a, e.b, e.score[1]! > 0, e.score[3]! > 0, e.score[4]!);
  }
}

const SPIN_KEYS: Record<number, Key> = { 0: "callout.tspin", 1: "callout.tspin1", 2: "callout.tspin2", 3: "callout.tspin3" };
const MINI_KEYS: Record<number, Key> = { 0: "callout.tspinMini", 1: "callout.tspinMini1", 2: "callout.tspinMini2" };
const LINE_KEYS: Record<number, Key> = { 2: "callout.double", 3: "callout.triple", 4: "callout.quad" };

/** Callout visual dibuat di Fase 4. Di Fase 2 momen penting sudah diumumkan untuk pembaca layar. */
function announceClear(n: number, spin: number, b2b: boolean, perfect: boolean, total: number): void {
  const key = spin === 2 ? SPIN_KEYS[n] : spin === 1 ? MINI_KEYS[n] : LINE_KEYS[n];
  if (!key) return;
  const parts = [t(key)];
  if (b2b) parts.push(t("callout.b2b"));
  if (perfect) parts.push(t("callout.perfect"));
  parts.push(t("callout.points", { n: total }));
  announce(parts.join(", "));
}

function updateHud(force: boolean): void {
  const s = game!.state;
  if (force || s.score !== shown.score) {
    shown.score = s.score;
    hud.score.textContent = fmt(s.score);
  }
  if (force || s.level !== shown.level) {
    shown.level = s.level;
    hud.level.textContent = String(s.level);
    cvMain.setAttribute("aria-label", t("a11y.board", { mode: modeName(modeId), level: s.level }));
  }
  if (force || s.lines !== shown.lines) {
    shown.lines = s.lines;
    hud.lines.textContent = String(s.lines);
  }
  if (force || s.combo !== shown.combo) {
    shown.combo = s.combo;
    hud.comboBox.hidden = s.combo < 1;
    hud.combo.textContent = String(Math.max(s.combo, 0));
  }
  if (force || s.hold !== shown.hold || s.holdUsed !== shown.holdUsed) {
    shown.hold = s.hold;
    shown.holdUsed = s.holdUsed;
    const label = s.hold === 0 ? t("piece.none") : t(`piece.${s.hold}` as Key);
    $("cv-hold").setAttribute("aria-label", t("a11y.holdBox", { piece: s.holdUsed ? `${label}, ${t("hud.holdLocked")}` : label }));
  }
  holdBuf[0] = s.hold;
  holdView.draw(holdBuf, s.holdUsed);
  for (let i = 0; i < NEXT_COUNT; i++) nextBuf[i] = game!.peekNext(i);
  nextView.draw(nextBuf, false);
  if (force) {
    const names = Array.from(nextBuf, (p) => t(`piece.${p}` as Key)).join(", ");
    $("cv-next").setAttribute("aria-label", t("a11y.nextBox", { pieces: names }));
  }
}
const nextBuf = new Uint8Array(NEXT_COUNT);
const holdBuf = new Uint8Array(1);

// ---------- tata letak ----------

function layout(): void {
  if (scrGame.hidden) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = field.getBoundingClientRect();
  const cell = board.resize(rect.width - 2, rect.height - 2, dpr);
  const mini = Math.max(8, Math.min(14, Math.floor(cell * 0.6)));
  holdView.resize(mini, dpr, data.settings.colorSafe);
  nextView.resize(mini, dpr, data.settings.colorSafe);
  if (game) {
    updateHud(true);
    board.draw(game.state, NaN, 1, performance.now(), game.state.status === STATUS.PLAYING);
  }
}

new ResizeObserver(layout).observe(field);

// ---------- pause dan dialog ----------

function pauseGame(): void {
  if (!game || !running || game.state.status !== STATUS.PLAYING) return;
  stopLoop();
  $("pause-time").textContent = formatClock(ticksToMs(game.state.tick));
  dlgPause.showModal();
}

function resumeGame(): void {
  dlgPause.close();
  resume();
}

dlgPause.addEventListener("cancel", (e) => {
  e.preventDefault();
  resumeGame();
});
dlgPause.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") resumeGame();
});

let confirmAction: "restart" | "menu" = "menu";
dlgPause.addEventListener("click", (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset["act"];
  if (act === "resume") resumeGame();
  else if (act === "restart" || act === "menu") {
    // Konfirmasi hanya jika permainan sudah berjalan lebih dari satu piece (DESIGN 7.3).
    if (game && game.state.pieces > 1) {
      confirmAction = act;
      $("confirm-ok").textContent = t(act === "restart" ? "confirm.restart" : "confirm.menu");
      dlgPause.close();
      dlgConfirm.showModal();
    } else {
      dlgPause.close();
      act === "restart" ? startGame(modeId) : showMenu();
    }
  }
});

dlgConfirm.addEventListener("click", (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset["act"];
  if (act === "cancel") {
    dlgConfirm.close();
    dlgPause.showModal();
  } else if (act === "ok") {
    dlgConfirm.close();
    confirmAction === "restart" ? startGame(modeId) : showMenu();
  }
});
dlgConfirm.addEventListener("cancel", (e) => {
  e.preventDefault();
  dlgConfirm.close();
  dlgPause.showModal();
});

$("btn-pause").addEventListener("click", () => pauseGame());

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
window.addEventListener("blur", () => input.releaseAll());

// ---------- game over ----------

function showGameOver(): void {
  const s = game!.state;
  const titleKey: Key =
    s.status === STATUS.FINISHED ? "over.titleFinished" : s.status === STATUS.TIME_UP ? "over.titleTimeUp" : "over.titleTopOut";
  $("over-title").textContent = t(titleKey);
  $("over-mode").textContent = hud.mode.textContent ?? "";
  $("over-result-label").textContent = t("over.score");
  $("over-value").textContent = fmt(s.score);
  $("over-level").textContent = String(s.level);
  $("over-lines").textContent = String(s.lines);
  $("over-quads").textContent = String(s.quads);
  $("over-tspins").textContent = String(s.tspins);
  $("over-combo").textContent = String(s.maxCombo);

  let isNew = false;
  let saved = true;
  if (modeId === "marathon150" || modeId === "marathonEndless") {
    isNew = submitResult(data.records, { mode: modeId, score: s.score, lines: s.lines, level: s.level }, new Date());
  }
  if (isNew) saved = storageOk && save(data);
  $("over-new").hidden = !(isNew && saved);
  const notice = $("over-notice");
  notice.hidden = !isNew || saved;
  notice.textContent = t("notice.storageFailed");

  dlgOver.showModal();
  announce(`${t(titleKey)}. ${t("over.score")} ${fmt(s.score)}${isNew && saved ? `. ${t("over.newRecord")}` : ""}`);
}

dlgOver.addEventListener("cancel", (e) => e.preventDefault());
dlgOver.addEventListener("click", (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset["act"];
  if (act === "again") {
    dlgOver.close();
    startGame(modeId);
  } else if (act === "menu") {
    dlgOver.close();
    showMenu();
  }
});

// ---------- menu ----------

const btnMarathon = $("mode-marathon");
const variants = $("marathon-variants");

function renderRecords(): void {
  for (const el of scrMenu.querySelectorAll<HTMLElement>("[data-record]")) {
    const r = data.records[el.dataset["record"] as "marathon150" | "marathonEndless"];
    el.textContent = r ? fmt(r.score) : t("menu.noRecord");
    el.classList.toggle("empty", !r);
  }
  const notice = $("menu-notice");
  notice.hidden = storageOk;
  notice.textContent = loaded.status === "newer" ? t("notice.storageNewer") : t("notice.storageFailed");
}

btnMarathon.addEventListener("click", () => {
  const open = btnMarathon.getAttribute("aria-expanded") !== "true";
  btnMarathon.setAttribute("aria-expanded", String(open));
  variants.hidden = !open;
  if (open) variants.querySelector<HTMLElement>("button")?.focus();
});

scrMenu.addEventListener("click", (e) => {
  const mode = (e.target as HTMLElement).closest<HTMLElement>("[data-mode]")?.dataset["mode"];
  if (mode) startGame(mode as ModeId);
});

// Panah atas/bawah memindahkan fokus di daftar mode (DESIGN 7.1).
scrMenu.querySelector(".modes")!.addEventListener("keydown", (e) => {
  const ev = e as KeyboardEvent;
  if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
  const items = [...scrMenu.querySelectorAll<HTMLElement>(".modes button")].filter((b) => b.offsetParent !== null);
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  ev.preventDefault();
  items[(i + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]!.focus();
});

for (const btn of scrMenu.querySelectorAll<HTMLButtonElement>("[data-locale]")) {
  btn.addEventListener("click", () => {
    const l = btn.dataset["locale"] as Locale;
    data.settings.locale = l;
    if (storageOk) save(data);
    applyLocale(l);
  });
}

function applyLocale(l: Locale): void {
  setLocale(l);
  applyI18n(document);
  for (const b of scrMenu.querySelectorAll<HTMLElement>("[data-locale]")) {
    b.setAttribute("aria-pressed", String(b.dataset["locale"] === l));
  }
  renderRecords();
}

function showScreen(which: "menu" | "game"): void {
  scrMenu.hidden = which !== "menu";
  scrGame.hidden = which !== "game";
}

function showMenu(): void {
  stopLoop();
  game = null;
  showScreen("menu");
  renderRecords();
  btnMarathon.focus();
}

// ---------- mulai ----------

applyLocale(pickLocale(data.settings.locale, navigator.languages ?? [navigator.language]));
showMenu();
