// Menyambungkan core, input, render, dan UI.
import { createGame, STATUS, type Game } from "./core/game.ts";
import { EV } from "./core/events.ts";
import { NEXT_COUNT, ticksToMs } from "./core/constants.ts";
import { ULTRA_TICKS, type ModeId } from "./core/modes.ts";
import { InputRepeater, createActionBuffer, type BtnCode } from "./input/repeat.ts";
import { Keyboard, keyLabel } from "./input/keyboard.ts";
import { bindGestures } from "./input/touch.ts";
import { GamepadInput, type MenuNav } from "./input/gamepad.ts";
import { BoardRenderer, PreviewRenderer } from "./render/board.ts";
import { applyI18n, fmt, formatClock, formatMs, pickLocale, setLocale, t, type Key } from "./i18n/index.ts";
import { BTNS, load, save, submitResult, type Locale, type ResultInput, type SaveData } from "./store/storage.ts";
import { SettingsScreen } from "./ui/settings.ts";

const STEP = 1000 / 60;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- data ----------

const loaded = load();
const data: SaveData = loaded.data;
const storageOk = loaded.status !== "unavailable" && loaded.status !== "newer";
let saveFailedShown = false;

function persist(): boolean {
  if (!storageOk) return false;
  const ok = save(data);
  if (!ok && !saveFailedShown) {
    saveFailedShown = true;
    toast(t("notice.storageFailed"));
  }
  return ok;
}

// ---------- elemen ----------

const scrMenu = $("scr-menu");
const scrGame = $("scr-game");
const scrSettings = $("scr-settings");
const dlgPause = $<HTMLDialogElement>("dlg-pause");
const dlgConfirm = $<HTMLDialogElement>("dlg-confirm");
const dlgOver = $<HTMLDialogElement>("dlg-over");
const live = $("live");
const field = $("field");
const cvMain = $<HTMLCanvasElement>("cv-main");

const board = new BoardRenderer(cvMain, $<HTMLCanvasElement>("cv-bg"));
const holdView = new PreviewRenderer($<HTMLCanvasElement>("cv-hold"), 1);
const nextView = new PreviewRenderer($<HTMLCanvasElement>("cv-next"), NEXT_COUNT);
nextView.horizontal = true;
const queueRow = document.querySelector<HTMLElement>(".queue-row")!;

const hud = {
  score: $("hud-score"),
  level: $("hud-level"),
  lines: $("hud-lines"),
  time: $("hud-time"),
  timeBox: $("stat-time"),
  combo: $("hud-combo"),
  comboBox: $("stat-combo"),
  mode: $("hud-mode"),
};


// ---------- pengumuman dan toast ----------

let lastAnnounce = 0;
let announceTimer = 0;
function announce(text: string): void {
  const wait = Math.max(0, lastAnnounce + 1000 - performance.now());
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    live.textContent = text;
    lastAnnounce = performance.now();
  }, wait);
}

let toastTimer = 0;
function toast(text: string): void {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2500);
}

// ---------- status permainan ----------

let game: Game | null = null;
let modeId: ModeId = "marathon150";
let running = false;
let overShown = false;
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
const playing = () => running && !!game && game.state.status === STATUS.PLAYING;
const press = (btn: BtnCode, down: boolean, ts: number) => {
  if (playing()) input.push(btn, down, ts - clk.offset);
};

const keyboard = new Keyboard({ press, pause: () => pauseGame() });
const releaseGesture = bindGestures(scrGame, press, playing, () => cellCss);
const gamepad = new GamepadInput({
  press,
  pause: () => pauseGame(),
  menu: (nav) => menuNav(nav),
  connected: (on) => toast(t(on ? "notice.gamepadOn" : "notice.gamepadOff")),
});

const shown = { score: -1, level: -1, lines: -1, combo: -2, hold: -1, holdUsed: false, time: -1 };
let cellCss = 20;

const MODE_NAME: Record<ModeId, Key> = {
  marathon150: "mode.marathon.name",
  marathonEndless: "mode.marathon.name",
  sprint40: "mode.sprint40.name",
  ultra: "mode.ultra.name",
  zen: "mode.zen.name",
};

function modeLabel(id: ModeId): string {
  if (id === "marathon150") return `${t(MODE_NAME[id])} ${t("menu.marathon150")}`;
  if (id === "marathonEndless") return `${t(MODE_NAME[id])} ${t("menu.marathonEndless")}`;
  return t(MODE_NAME[id]);
}

function applySettings(): void {
  const s = data.settings;
  input.das = s.dasMs;
  input.arr = s.arrMs;
  keyboard.setKeymap(s.keymap);
  game?.setConfig({ softDropFactor: s.softDropFactor });
  const displayChanged = board.ghost !== s.ghost || board.grid !== s.grid || board.colorSafe !== s.colorSafe;
  board.ghost = s.ghost;
  board.grid = s.grid;
  if (board.colorSafe !== s.colorSafe || displayChanged) {
    board.colorSafe = s.colorSafe;
    board.rebuild();
  }
  renderControlsList();
}

function startGame(id: ModeId): void {
  modeId = id;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  game = createGame(id, seed, { softDropFactor: data.settings.softDropFactor });
  input.releaseAll();
  releaseGesture();
  shown.score = shown.level = shown.lines = shown.hold = shown.time = -1;
  shown.combo = -2;
  overShown = false;
  clk.fallFrom = NaN;
  clk.sim = 0;
  hud.mode.textContent = modeLabel(id);
  hud.timeBox.hidden = !(id === "sprint40" || id === "ultra");
  $("btn-end").hidden = id !== "zen";
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
  gamepad.playing = true;
  gamepad.reset();
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

function stopLoop(): void {
  running = false;
  keyboard.enabled = false;
  gamepad.playing = false;
  gamepad.reset();
  input.releaseAll();
  releaseGesture();
}

function frame(now: number): void {
  if (!running || !game) return;
  gamepad.poll(now);
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
    else if (e.type === EV.ZEN_RESET) announce(t("callout.zenReset"));
  }
}

const SPIN_KEYS: Record<number, Key> = { 0: "callout.tspin", 1: "callout.tspin1", 2: "callout.tspin2", 3: "callout.tspin3" };
const MINI_KEYS: Record<number, Key> = { 0: "callout.tspinMini", 1: "callout.tspinMini1", 2: "callout.tspinMini2" };
const LINE_KEYS: Record<number, Key> = { 2: "callout.double", 3: "callout.triple", 4: "callout.quad" };

/** Callout visual dibuat di Fase 4. Untuk sekarang momen penting diumumkan untuk pembaca layar. */
function announceClear(n: number, spin: number, b2b: boolean, perfect: boolean, total: number): void {
  const key = spin === 2 ? SPIN_KEYS[n] : spin === 1 ? MINI_KEYS[n] : LINE_KEYS[n];
  if (!key) return;
  const parts = [t(key)];
  if (b2b) parts.push(t("callout.b2b"));
  if (perfect) parts.push(t("callout.perfect"));
  parts.push(t("callout.points", { n: total }));
  announce(parts.join(", "));
}

/** Waktu HUD: Sprint naik (m:ss.cc), Ultra turun (m:ss). Diperbarui tiap 6 tick (100 ms). */
function hudTime(tick: number): string {
  if (modeId === "ultra") {
    const left = Math.max(0, ULTRA_TICKS - tick);
    const sec = Math.ceil(left / 60);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }
  return formatClock(ticksToMs(tick)).replace(/^0/, "");
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
    cvMain.setAttribute("aria-label", t("a11y.board", { mode: modeLabel(modeId), level: s.level }));
  }
  if (force || s.lines !== shown.lines) {
    shown.lines = s.lines;
    hud.lines.textContent = String(s.lines);
  }
  if (!hud.timeBox.hidden) {
    const slot = Math.floor(s.tick / 6);
    if (force || slot !== shown.time) {
      shown.time = slot;
      hud.time.textContent = hudTime(s.tick);
    }
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

/**
 * Baris antrean: Simpan (4 sel mini) + Antrean 5 slot x 5 sel mini = 29 sel mini, ditambah
 * padding sumur dan jarak (sekitar 40 px). Sel mini dibatasi 7 sampai 14 px.
 */
const QUEUE_CELLS = 29;
const QUEUE_CHROME = 40;

function layout(): void {
  if (scrGame.hidden) return;
  const dpr = window.devicePixelRatio || 1;
  // Jendela lebar: Simpan dan Antrean di samping papan (antrean tegak). Selain itu di atas (mendatar).
  const side = innerWidth >= 600 && innerWidth > innerHeight * 0.9;
  if (side !== scrGame.classList.contains("side-layout")) {
    scrGame.classList.toggle("side-layout", side);
    nextView.horizontal = !side;
    nextView.resize(0, dpr, data.settings.colorSafe); // paksa bangun ulang di ukuran baru
  }
  let mini: number;
  if (side) {
    mini = Math.max(10, Math.min(16, Math.floor((innerHeight - 200) / (3 * NEXT_COUNT))));
  } else {
    const rowW = queueRow.getBoundingClientRect().width;
    mini = Math.max(7, Math.min(14, Math.floor((rowW - QUEUE_CHROME) / QUEUE_CELLS)));
  }
  holdView.resize(mini, dpr, data.settings.colorSafe);
  nextView.resize(mini, dpr, data.settings.colorSafe);
  const rect = field.getBoundingClientRect();
  cellCss = board.resize(rect.width - 2, rect.height - 2, dpr);
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
  else if (act === "end") {
    dlgPause.close();
    game!.end();
    overShown = true;
    showGameOver();
  } else if (act === "settings") {
    dlgPause.close();
    openSettings("pause");
  } else if (act === "restart" || act === "menu") {
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

// HP diputar mendatar: layar diganti pesan putar HP (CSS), permainan dijeda supaya tidak berjalan tanpa terlihat.
const landscapeTouch = matchMedia("(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 600px)");
landscapeTouch.addEventListener("change", () => {
  if (landscapeTouch.matches) pauseGame();
});
window.addEventListener("blur", () => {
  input.releaseAll();
  releaseGesture();
});

// ---------- game over ----------

function resultFor(id: ModeId): ResultInput {
  const s = game!.state;
  switch (id) {
    case "sprint40":
      return { mode: id, timeMs: s.status === STATUS.FINISHED ? ticksToMs(s.tick) : null };
    case "ultra":
      return { mode: id, score: s.score, lines: s.lines };
    case "zen":
      return { mode: id, lines: s.lines };
    default:
      return { mode: id, score: s.score, lines: s.lines, level: s.level };
  }
}

function showGameOver(): void {
  const s = game!.state;
  const titleKey: Key =
    modeId === "zen" || s.status === STATUS.FINISHED
      ? "over.titleFinished"
      : s.status === STATUS.TIME_UP
        ? "over.titleTimeUp"
        : "over.titleTopOut";
  $("over-title").textContent = t(titleKey);
  $("over-mode").textContent = modeLabel(modeId);

  // Hasil utama per mode (DESIGN 7.4): skor, waktu Sprint, atau baris Zen.
  let label: Key = "over.score";
  let value = fmt(s.score);
  const sprintDone = modeId === "sprint40" && s.status === STATUS.FINISHED;
  if (sprintDone) {
    label = "over.time";
    value = formatMs(ticksToMs(s.tick));
  } else if (modeId === "zen") {
    label = "over.lines";
    value = String(s.lines);
  }
  $("over-result-label").textContent = t(label);
  $("over-value").textContent = value;
  $("over-score-row").hidden = label === "over.score";
  $("over-score").textContent = fmt(s.score);
  $("over-level").textContent = String(s.level);
  $("over-lines").textContent = String(s.lines);
  $("over-quads").textContent = String(s.quads);
  $("over-tspins").textContent = String(s.tspins);
  $("over-combo").textContent = String(s.maxCombo);

  const isNew = submitResult(data.records, resultFor(modeId), new Date());
  const saved = isNew ? persist() : true;
  $("over-new").hidden = !(isNew && saved);
  const notice = $("over-notice");
  if (modeId === "sprint40" && !sprintDone) {
    notice.hidden = false;
    notice.textContent = t("over.sprintFailed");
  } else {
    notice.hidden = !isNew || saved;
    notice.textContent = t("notice.storageFailed");
  }

  dlgOver.showModal();
  announce(`${t(titleKey)}. ${t(label)} ${value}${isNew && saved ? `. ${t("over.newRecord")}` : ""}`);
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

function recordText(id: ModeId): string | null {
  const r = data.records;
  switch (id) {
    case "marathon150":
    case "marathonEndless":
      return r[id] ? fmt(r[id].score) : null;
    case "sprint40":
      return r.sprint40 ? formatMs(r.sprint40.timeMs) : null;
    case "ultra":
      return r.ultra ? fmt(r.ultra.score) : null;
    case "zen":
      return r.zen ? t("menu.recordLines", { n: r.zen.lines }) : null;
  }
}

function renderRecords(): void {
  for (const el of scrMenu.querySelectorAll<HTMLElement>("[data-record]")) {
    const text = recordText(el.dataset["record"] as ModeId);
    el.textContent = text ?? t("menu.noRecord");
    el.classList.toggle("empty", text === null);
  }
  const notice = $("menu-notice");
  notice.hidden = storageOk;
  notice.textContent = loaded.status === "newer" ? t("notice.storageNewer") : t("notice.storageFailed");
}

/** Daftar kontrol di Menu mengikuti pemetaan tombol pemain. */
function renderControlsList(): void {
  const dl = $("controls-list");
  dl.textContent = "";
  for (const b of BTNS) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = t(`controls.${b}` as Key);
    const dd = document.createElement("dd");
    for (const code of data.settings.keymap[b]) {
      const k = document.createElement("kbd");
      k.textContent = keyLabel(code);
      dd.append(k, " ");
    }
    row.append(dt, dd);
    dl.append(row);
  }
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = t("controls.pause");
  const dd = document.createElement("dd");
  for (const k of ["Esc", "P"]) {
    const el = document.createElement("kbd");
    el.textContent = k;
    dd.append(el, " ");
  }
  row.append(dt, dd);
  dl.append(row);
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

$("btn-settings").addEventListener("click", () => openSettings("menu"));

// Panah atas/bawah memindahkan fokus di daftar mode (DESIGN 7.1).
scrMenu.querySelector(".modes")!.addEventListener("keydown", (e) => {
  const ev = e as KeyboardEvent;
  if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
  ev.preventDefault();
  moveFocus(ev.key === "ArrowDown" ? 1 : -1, ".modes button");
});

function moveFocus(dir: 1 | -1, selector: string): void {
  const root = activeRoot();
  const items = [...root.querySelectorAll<HTMLElement>(selector)].filter((b) => b.offsetParent !== null);
  if (items.length === 0) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = i < 0 ? 0 : (i + dir + items.length) % items.length;
  items[next]!.focus();
}

function activeRoot(): ParentNode {
  for (const d of [dlgConfirm, dlgPause, dlgOver]) if (d.open) return d;
  if (!scrSettings.hidden) return scrSettings;
  return scrMenu;
}

/** Navigasi menu dengan gamepad: D-pad memindahkan fokus, A memilih, B kembali. */
function menuNav(nav: MenuNav): void {
  if (nav === "ok") {
    (document.activeElement as HTMLElement | null)?.click();
    return;
  }
  if (nav === "back") {
    if (dlgPause.open) resumeGame();
    else if (dlgConfirm.open) dlgConfirm.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (!scrSettings.hidden) closeSettings();
    return;
  }
  const el = document.activeElement as HTMLElement | null;
  if (el instanceof HTMLInputElement && el.type === "range" && (nav === "left" || nav === "right")) {
    el.value = String(Number(el.value) + (nav === "right" ? 1 : -1) * Number(el.step || 1));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  moveFocus(nav === "down" || nav === "right" ? 1 : -1, "button:not([disabled]), input");
}

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-locale]")) {
  btn.addEventListener("click", () => applyLocaleChoice(btn.dataset["locale"] as Locale));
}

function applyLocaleChoice(l: Locale): void {
  data.settings.locale = l;
  persist();
  applyLocale(l);
}

function applyLocale(l: Locale): void {
  setLocale(l);
  applyI18n(document);
  for (const b of document.querySelectorAll<HTMLElement>("[data-locale]")) {
    b.setAttribute("aria-pressed", String(b.dataset["locale"] === l));
  }
  renderRecords();
  renderControlsList();
  if (!scrSettings.hidden) settings.render();
  if (game) {
    hud.mode.textContent = modeLabel(modeId);
    shown.level = -1;
  }
}

function showScreen(which: "menu" | "game" | "settings"): void {
  scrMenu.hidden = which !== "menu";
  scrGame.hidden = which !== "game";
  scrSettings.hidden = which !== "settings";
}

function showMenu(): void {
  stopLoop();
  game = null;
  showScreen("menu");
  renderRecords();
  btnMarathon.focus();
}

// ---------- pengaturan ----------

let settingsFrom: "menu" | "pause" = "menu";

const settings = new SettingsScreen(scrSettings, data.settings, {
  changed: () => {
    applySettings();
    persist();
  },
  setLocale: (l) => applyLocaleChoice(l),
  announce: (text) => {
    announce(text);
    toast(text);
  },
  back: () => closeSettings(),
});

function openSettings(from: "menu" | "pause"): void {
  settingsFrom = from;
  showScreen("settings");
  settings.open();
}

function closeSettings(): void {
  if (settingsFrom === "pause" && game) {
    showScreen("game");
    layout();
    dlgPause.showModal();
    dlgPause.querySelector<HTMLElement>('[data-act="settings"]')?.focus();
  } else {
    showScreen("menu");
    $("btn-settings").focus();
  }
}

// Gamepad di menu dan Pengaturan: loop kecil yang hanya berjalan saat permainan tidak berjalan.
function menuPoll(now: number): void {
  if (!running && gamepad.active) gamepad.poll(now);
  requestAnimationFrame(menuPoll);
}
requestAnimationFrame(menuPoll);


// ---------- mulai ----------

applySettings();
applyLocale(pickLocale(data.settings.locale, navigator.languages ?? [navigator.language]));
showMenu();
