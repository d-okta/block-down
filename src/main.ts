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
import { ThemesScreen } from "./ui/themes.ts";
import { SettingsScreen } from "./ui/settings.ts";
import { perfFrame, perfPause, perfTag } from "./debug/perf.ts";
import { Effects } from "./render/effects.ts";
import { clearPower, effectiveFx } from "./render/fx.ts";
import { THEMES } from "./render/themes.ts";
import { earnedBy, isUnlocked, unlock, type ThemeId } from "./core/unlocks.ts";
import { Callout, type CalloutTone } from "./ui/callout.ts";
import { hapticsAvailable, vibrate } from "./platform/haptics.ts";
import { audioAvailable, comboRate, Sound } from "./audio/sound.ts";

const STEP = 1000 / 60;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- data ----------

const loaded = load();
const data: SaveData = loaded.data;
const storageOk = loaded.status !== "unavailable" && loaded.status !== "newer";
let saveFailedShown = false;

/**
 * ?coba-tema: semua tema bisa dipilih selama alamat ini dipakai, untuk mencoba tampilannya.
 * Kemajuan asli (data.unlocks) tidak diubah. Tema yang belum terbuka dan dipilih di sini kembali
 * ke Klasik saat game dibuka tanpa ?coba-tema (validasi di storage.ts).
 */
const trialThemes = new URLSearchParams(location.search).has("coba-tema");
const shownUnlocks = trialThemes
  ? { night: "trial", neon: "trial", dawn: "trial", mono: "trial" }
  : data.unlocks;
if (trialThemes) document.title = "BlockDown (coba tema)";
// Kembali dari ?coba-tema dengan tema yang belum terbuka: storage.ts sudah mengembalikannya ke Klasik,
// simpan sekarang supaya data tersimpan juga bersih.
else if (loaded.status === "ok" && localStorage.getItem("blockdown")?.includes(`"theme":"`) && !localStorage.getItem("blockdown")!.includes(`"theme":"${data.settings.theme}"`)) persist();

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
const scrThemes = $("scr-themes");
const dlgPause = $<HTMLDialogElement>("dlg-pause");
const dlgConfirm = $<HTMLDialogElement>("dlg-confirm");
const dlgOver = $<HTMLDialogElement>("dlg-over");
const live = $("live");
const field = $("field");
const cvMain = $<HTMLCanvasElement>("cv-main");

// Kurangi animasi dari sistem (DESIGN 8.5): dipakai selama pemain belum memilih sendiri.
const systemReduceMq = matchMedia("(prefers-reduced-motion: reduce)");
const currentFx = () => effectiveFx(data.settings.effects, data.settings.reduceMotion, systemReduceMq.matches);
const effects = new Effects(currentFx());
const board = new BoardRenderer(cvMain, $<HTMLCanvasElement>("cv-stack"), $<HTMLCanvasElement>("cv-bg"), effects);
const boardEl = $("board");
board.wrap = boardEl;
const ambient = $("ambient");
const frameEl = $("board-frame");
const fxFlash = $("fx-flash");
const fxPillar = $("fx-pillar");
const callout = new Callout($("callout"));
const sound = new Sound();
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
  const theme = THEMES[s.theme];
  const displayChanged = board.ghost !== s.ghost || board.grid !== s.grid || board.colorSafe !== s.colorSafe || board.theme !== theme;
  board.ghost = s.ghost;
  board.grid = s.grid;
  if (displayChanged) {
    board.colorSafe = s.colorSafe;
    board.theme = theme;
    effects.theme = theme;
    applyThemeCss(theme);
    board.rebuild();
    // Pratinjau Simpan dan Antrean dibangun ulang dengan tema baru di ukuran yang sama.
    holdView.resize(0, 1, false);
    nextView.resize(0, 1, false);
    layout();
  }
  effects.fx = currentFx();
  ambient.classList.toggle("moving", effects.fx.ambientMotion);
  document.documentElement.classList.toggle("reduce", effects.fx.level === "minimal");
  sound.setVolume(s.musicVolume, s.sfxVolume);
  renderControlsList();
}

systemReduceMq.addEventListener("change", applySettings);

/** Warna antarmuka tema (PRD-6): variabel CSS di :root dan warna bilah browser. */
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
function applyThemeCss(theme: (typeof THEMES)[ThemeId]): void {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(theme.css)) root.setProperty(k, v);
  themeMeta?.setAttribute("content", theme.css["--bg"]!);
}

// ---------- pita ambient ----------

/** Warna pita per level (DESIGN 8.1): urutan warna blok I, T, S, L, Z, O, J, berulang. */
const AMBIENT_ORDER = [1, 3, 4, 7, 5, 2, 6] as const;
let comboWarm = 0;

function ambientFor(level: number): void {
  const color = THEMES[data.settings.theme].blocks[AMBIENT_ORDER[(level - 1) % AMBIENT_ORDER.length]!]!;
  // Combo panjang menggeser warna ke hangat (warna L), DESIGN 8.3.
  ambient.style.setProperty("--ambient-color", comboWarm > 0 ? `color-mix(in srgb, ${color}, #E39A55 ${Math.round(comboWarm * 100)}%)` : color);
}

let ambientBoostTimer = 0;
function ambientBoost(): void {
  ambient.style.setProperty("--ambient-opacity", "0.09");
  clearTimeout(ambientBoostTimer);
  ambientBoostTimer = window.setTimeout(() => ambient.style.setProperty("--ambient-opacity", "0.05"), 600);
}

// ---------- skor bergulir ----------

/** Skor tampil mengejar skor asli selama 300 ms (DESIGN 8.3); langsung di Minimal. */
const roll = { from: 0, to: 0, t: -1, last: -1 };
function scoreText(now: number, actual: number): string | null {
  if (roll.t < 0) return null;
  const p = (now - roll.t) / 300;
  if (p >= 1) {
    roll.t = -1;
    hud.score.classList.remove("bump");
    return fmt(actual);
  }
  // Teks diganti paling sering setiap 33 ms (sekitar 30 kali per detik): cukup untuk terlihat bergulir.
  if (now - roll.last < 33) return null;
  roll.last = now;
  return fmt(Math.round(roll.from + (roll.to - roll.from) * (1 - (1 - p) * (1 - p))));
}

function startGame(id: ModeId): void {
  modeId = id;
  // ?seed=N di URL: urutan piece tetap, untuk uji dan reproduksi laporan. Tanpa itu, acak.
  const seedParam = Number(new URLSearchParams(location.search).get("seed"));
  const seed = Number.isSafeInteger(seedParam) && seedParam > 0 ? seedParam : crypto.getRandomValues(new Uint32Array(1))[0]!;
  game = createGame(id, seed, { softDropFactor: data.settings.softDropFactor });
  input.releaseAll();
  releaseGesture();
  shown.score = shown.level = shown.lines = shown.hold = shown.time = -1;
  shown.combo = -2;
  overShown = false;
  clk.fallFrom = NaN;
  clk.sim = 0;
  board.reset();
  callout.hide();
  fxFlash.hidden = fxPillar.hidden = true;
  light.flash = light.pillar = -1;
  roll.t = -1;
  hud.score.classList.remove("bump");
  comboWarm = 0;
  ambientFor(1);
  hud.mode.textContent = modeLabel(id);
  hud.timeBox.hidden = !(id === "sprint40" || id === "ultra");
  $("btn-end").hidden = id !== "zen";
  showScreen("game");
  layout();
  if (!warmedUp) {
    // Sekali per halaman: jalankan jalur efek dan callout tanpa terlihat (BoardRenderer.warmUp).
    warmedUp = true;
    board.warmUp(performance.now());
    callout.warmUp(effects.fx);
  }
  updateHud(true);
  sound.musicStop();
  sound.musicStart();
  resume();
}
let warmedUp = false;

function resume(): void {
  perfPause(); // frame pertama setelah lanjut tidak dihitung sebagai tersendat
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
  perfPause();
  keyboard.enabled = false;
  gamepad.playing = false;
  gamepad.reset();
  input.releaseAll();
  releaseGesture();
}

function frame(now: number): void {
  if (!running || !game) return;
  const begin = performance.now();
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
  const rolled = scoreText(now, s.score);
  if (rolled !== null) hud.score.textContent = rolled;
  board.draw(s, clk.fallFrom, clk.acc / STEP, now, s.status === STATUS.PLAYING);
  drawFrame(now);
  drawLight(now);
  perfFrame(now, begin, performance.now());
  if (s.status !== STATUS.PLAYING && !overShown) {
    overShown = true;
    endGame(now);
    return;
  }
  requestAnimationFrame(frame);
}

/** Bingkai naik level: tergambar dengan aksen lalu memudar (DESIGN 8.3). */
let frameShown = false;
function drawFrame(now: number): void {
  const p = effects.frameProgress(now);
  if (p < 0) {
    if (frameShown) {
      frameEl.style.opacity = "0";
      frameShown = false;
    }
    return;
  }
  frameShown = true;
  frameEl.style.opacity = String(p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7);
}

/**
 * Kilat papan dan pilar cahaya sebagai lapisan CSS (opacity dan transform saja).
 * Nilai ditulis hanya jika berubah, dan dihentikan begitu kedua efek selesai.
 */
const lightOut = new Float32Array(6);
const light = { flash: -1, pillar: -1, flashColor: "", pillarColor: "" };
function drawLight(now: number): void {
  effects.lightLayers(now, lightOut);
  const f = lightOut[0]!;
  const pl = lightOut[1]!;
  if (f > 0 || light.flash > 0) {
    if (f > 0 && effects.flashColor !== light.flashColor) {
      light.flashColor = effects.flashColor;
      fxFlash.style.setProperty("--fx-flash", light.flashColor);
    }
    fxFlash.style.opacity = f > 0 ? f.toFixed(3) : "0";
    fxFlash.hidden = f <= 0;
    light.flash = f;
  }
  if (pl > 0 || light.pillar > 0) {
    if (pl > 0) {
      if (effects.pillarTint !== light.pillarColor) {
        light.pillarColor = effects.pillarTint;
        fxPillar.style.setProperty("--fx-pillar", light.pillarColor);
      }
      // Dasar pilar di baris yang dihapus; tinggi tumbuh ke atas, lebar menyempit.
      const base = lightOut[4]!;
      fxPillar.style.transform = `translateY(${((base - 1) * 100).toFixed(2)}%) scale(${lightOut[3]!.toFixed(3)}, ${(lightOut[2]! / Math.max(0.01, base)).toFixed(3)})`;
    }
    fxPillar.style.opacity = pl > 0 ? pl.toFixed(3) : "0";
    fxPillar.hidden = pl <= 0;
    light.pillar = pl;
  }
}

/**
 * Permainan berakhir: input berhenti sekarang, tumpukan runtuh (DESIGN 7.4), lalu dialog Game Over.
 * Top out saja yang runtuh; target tercapai atau waktu habis langsung ke dialog.
 */
function endGame(now: number): void {
  stopLoop();
  const s = game!.state;
  sound.musicStop();
  if (s.status === STATUS.GAME_OVER) {
    vibrate("over", data.settings.haptics);
    sound.play("over");
    board.collapse(now);
    const tick = (t: number) => {
      if (!game || scrGame.hidden) return;
      board.draw(game.state, NaN, 1, t, false);
      if (board.collapsing(t)) requestAnimationFrame(tick);
      else showGameOver();
    };
    requestAnimationFrame(tick);
  } else {
    showGameOver();
  }
}

/** Hard drop sudah berbunyi benturan; bunyi lock di tick yang sama dilewati. */
let hardThisTick = false;

function handleEvents(now: number): void {
  const q = game!.events;
  const s = game!.state;
  hardThisTick = false;
  for (let i = 0; i < q.count; i++) {
    const e = q.at(i);
    switch (e.type) {
      case EV.MOVE:
        // Nada sedikit diacak supaya geser beruntun tidak terdengar seperti mesin.
        sound.play("move", 0.97 + Math.random() * 0.06, 0.6);
        break;
      case EV.SOFT:
        sound.play("soft", 1, 0.4);
        break;
      case EV.HOLD:
        sound.play("hold");
        break;
      case EV.LOCK:
        board.lockFlash(e.cells, e.a, now);
        if (!hardThisTick) sound.play("lock", 1, 0.8);
        break;
      case EV.HARD:
        perfTag("hard");
        effects.hardDrop(now, e.cells, e.a, e.b);
        vibrate("hard", data.settings.haptics);
        sound.play("hard");
        hardThisTick = true;
        break;
      case EV.ROTATE:
        if (e.b > 0) effects.kick(now, e.a);
        // Rotasi dengan kick: nada sedikit lebih tinggi.
        sound.play("rotate", e.b > 0 ? 1.12 : 1, 0.8);
        break;
      case EV.LEVEL_UP:
        perfTag("level");
        effects.levelUp(now);
        sound.play("level");
        ambientFor(e.a);
        callout.show(t("callout.levelUp"), "", "", "normal", effects.fx);
        announce(t("callout.levelUp"));
        break;
      case EV.CLEAR:
        // Blok Pengisi (PRD-6 bagian 14) dikirim core sesudah CLEAR di tick yang sama: disebut di baris kecil callout ini.
        fillerNow = false;
        for (let j = i + 1; j < q.count; j++) if (q.at(j).type === EV.FILLER) fillerNow = true;
        onClear(now, e.a, e.b, e.c, e.score[1]! > 0, e.score[3]! > 0, e.score[4]!, e.rows, e.colors, e.shift, s.level, s.score);
        break;
      case EV.ZEN_RESET:
        board.reset();
        callout.show(t("callout.zenReset"), "", "", "normal", effects.fx);
        announce(t("callout.zenReset"));
        break;
    }
  }
}

/** Blok Pengisi baru masuk antrean di tick ini (diisi handleEvents, dibaca onClear). */
let fillerNow = false;

const SPIN_KEYS: Record<number, Key> = { 0: "callout.tspin", 1: "callout.tspin1", 2: "callout.tspin2", 3: "callout.tspin3" };
const MINI_KEYS: Record<number, Key> = { 0: "callout.tspinMini", 1: "callout.tspinMini1", 2: "callout.tspinMini2" };
const LINE_KEYS: Record<number, Key> = { 1: "callout.single", 2: "callout.double", 3: "callout.triple", 4: "callout.quad" };

/**
 * Baris dihapus atau T-Spin (DESIGN 8.3, revisi Fase 4). Logika sudah selesai di core; semua di sini
 * hanya tampilan, dan piece berikutnya sudah bisa digerakkan sejak tick ini.
 * Setiap clear punya efek yang jelas, bertingkat menurut kekuatan (keputusan pemilik setelah uji tahap 1).
 */
function onClear(
  now: number, n: number, spin: number, combo: number, b2b: boolean, perfect: boolean, total: number,
  rows: Int8Array, colors: Uint8Array, shift: Uint8Array, level: number, score: number,
): void {
  const power = clearPower(n, spin, perfect, combo);
  perfTag(`clear${n}${spin ? "t" : ""}`);
  if (n > 0) {
    effects.lineClear(now, n, rows, colors, power);
    board.stackDrop(shift, now, power);
  }
  if (spin > 0) {
    // Pusat riak: kolom tengah papan di baris terbawah yang dihapus, atau tengah papan jika tanpa baris.
    const row = rows[0]! >= 0 ? rows[0]! : 4;
    effects.tspin(now, 4.5, row, n > 0);
  }
  if (perfect) effects.perfectClear(now);
  vibrate(perfect ? 5 : power, data.settings.haptics);
  // Satu suara utama per clear (yang paling besar), ditambah nada combo yang naik.
  if (perfect) sound.play("pc");
  else if (spin > 0) sound.play("tspin");
  else if (n >= 4) sound.play("quad");
  else if (n > 0) sound.play(n === 1 ? "clear1" : n === 2 ? "clear2" : "clear3");
  if (combo >= 1) sound.play("combo", comboRate(combo), 0.8);
  if (power >= 3) ambientBoost();

  comboWarm = Math.min(1, Math.max(0, combo) / 8);
  ambientFor(level);

  // Skor bergulir dari nilai sebelum aksi ini.
  if (effects.fx.level !== "minimal" && total > 0) {
    roll.from = score - total;
    roll.to = score;
    roll.t = now;
    roll.last = -1;
    hud.score.classList.add("bump");
  }

  const key = perfect ? undefined : spin === 2 ? SPIN_KEYS[n] : spin === 1 ? MINI_KEYS[n] : LINE_KEYS[n];
  const title = perfect ? t("callout.perfect") : key ? t(key) : "";
  const subs: string[] = [];
  if (perfect && LINE_KEYS[n]) subs.push(t(LINE_KEYS[n]!));
  if (b2b) subs.push(t("callout.b2b"));
  if (combo >= 1) subs.push(`${t("callout.combo", { n: combo })} \u2713`);
  if (fillerNow) subs.push(t("callout.filler"));
  const points = t("callout.points", { n: total });
  if (title || subs.length) {
    const tone: CalloutTone = perfect ? "gold" : spin > 0 ? "spin" : "normal";
    callout.show(title || subs.shift()!, points, subs.join("  "), tone, effects.fx, power >= 4 ? 200 : 50, power);
  }
  if (title) {
    const parts = [title, ...subs, points];
    announce(parts.join(", "));
  }
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
    if (roll.t < 0 || force) hud.score.textContent = fmt(s.score); // saat bergulir, frame() yang menulis
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
  let nextChanged = force;
  for (let i = 0; i < NEXT_COUNT; i++) {
    const p = game!.peekNext(i);
    if (nextBuf[i] !== p) nextChanged = true;
    nextBuf[i] = p;
  }
  nextView.draw(nextBuf, false);
  // Label dibuat ulang hanya saat isi antrean berubah (sekali per piece), bukan setiap frame.
  if (nextChanged) {
    const names = Array.from(nextBuf, (p) => t(`piece.${p}` as Key)).join(", ");
    $("cv-next").setAttribute("aria-label", t("a11y.nextBox", { pieces: names }));
  }
}
const nextBuf = new Uint8Array(NEXT_COUNT);
const holdBuf = new Uint8Array(1);

// ---------- tata letak ----------

/**
 * Baris antrean: Simpan (4 sel mini) + Antrean NEXT_COUNT slot x 5 sel mini, ditambah padding sumur
 * dan jarak (sekitar 36 px). Sel mini dibatasi 5 sampai 14 px.
 */
const QUEUE_CELLS = 4 + 5 * NEXT_COUNT;
const QUEUE_CHROME = 36;

function layout(): void {
  if (scrGame.hidden) return;
  const dpr = window.devicePixelRatio || 1;
  // Jendela lebar: Simpan dan Antrean di samping papan (antrean tegak). Selain itu di atas (mendatar).
  const side = innerWidth >= 600 && innerWidth > innerHeight * 0.9;
  if (side !== scrGame.classList.contains("side-layout")) {
    scrGame.classList.toggle("side-layout", side);
    nextView.horizontal = !side;
    nextView.resize(0, dpr, data.settings.colorSafe, THEMES[data.settings.theme]); // paksa bangun ulang di ukuran baru
  }
  // Tinggi sumur antrean dihitung dari lebar layar saja (bukan dari papan), lalu dipasang sebelum papan
  // diukur. Dengan begitu tinggi antrean tetap selama lebar layar sama, papan dan antrean tidak saling
  // mengubah, dan sumur tidak lebih tinggi dari isinya.
  if (!side) {
    const cap = Math.max(5, Math.min(14, Math.floor((innerWidth - 24 - QUEUE_CHROME) / QUEUE_CELLS)));
    queueRow.style.setProperty("--well-h", `${cap * 3 + 14}px`);
  }
  // Papan dulu, karena lebarnya menentukan lebar HUD (semua baris sejajar dengan tepi papan).
  // Di tata letak samping, kolom papan selebar papan itu sendiri, jadi lebar yang tersedia diambil
  // dari jendela (setengah lebar), bukan dari kolom.
  const rect = field.getBoundingClientRect();
  cellCss = board.resize(side ? innerWidth * 0.5 : rect.width - 2, rect.height - 2, dpr);
  // Bungkus papan mengikuti ukuran canvas, supaya callout dan bingkai menempel tepat di papan.
  boardEl.style.width = cvMain.style.width;
  boardEl.style.height = cvMain.style.height;
  scrGame.style.setProperty("--board-w", cvMain.style.width);
  let mini: number;
  if (side) {
    mini = Math.max(10, Math.min(16, Math.floor((innerHeight - 200) / (3 * NEXT_COUNT))));
  } else {
    // Antrean selebar papan. Tinggi sumurnya tetap di CSS (.queue-row .well), jadi ukuran sel mini
    // tidak mengubah tinggi papan, dan papan serta antrean tidak saling mengubah tanpa henti.
    const rowW = parseFloat(cvMain.style.width) || queueRow.getBoundingClientRect().width;
    // Minimal 5 px: di layar 320x640 papan hanya sekitar 215 px, dan antrean harus tetap muat di dalamnya.
    mini = Math.max(5, Math.min(14, Math.floor((rowW - QUEUE_CHROME) / QUEUE_CELLS)));
  }
  holdView.resize(mini, dpr, data.settings.colorSafe, THEMES[data.settings.theme]);
  nextView.resize(mini, dpr, data.settings.colorSafe, THEMES[data.settings.theme]);
  if (game) {
    updateHud(true);
    board.draw(game.state, NaN, 1, performance.now(), game.state.status === STATUS.PLAYING);
  }
}

new ResizeObserver(layout).observe(field);
// Tata letak samping: kolom papan tidak ikut melebar saat jendela dilebarkan, jadi pantau jendela juga.
window.addEventListener("resize", layout);

// ---------- pause dan dialog ----------

function pauseGame(): void {
  if (!game || !running || game.state.status !== STATUS.PLAYING) return;
  stopLoop();
  sound.musicDuck(true);
  $("pause-time").textContent = formatClock(ticksToMs(game.state.tick));
  dlgPause.showModal();
}

function resumeGame(): void {
  dlgPause.close();
  sound.musicDuck(false);
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
  // Tema yang terbuka oleh permainan ini (PRD-6). Hanya dari permainan yang selesai, bukan yang ditinggalkan.
  const freshThemes = unlock(
    data.unlocks,
    earnedBy({
      mode: modeId,
      marathonDone: modeId === "marathon150" && s.status === STATUS.FINISHED,
      sprintMs: sprintDone ? ticksToMs(s.tick) : null,
      quads: s.quads,
      perfects: s.perfects,
    }),
    new Date(),
  );
  const saved = isNew || freshThemes.length > 0 ? persist() : true;
  $("over-new").hidden = !(isNew && saved);
  const unlocked = $("over-unlock");
  unlocked.hidden = freshThemes.length === 0;
  if (freshThemes.length > 0) {
    // Satu baris per permainan; jika lebih dari satu tema terbuka sekaligus, semua disebut dan yang pertama bisa langsung dipakai.
    const names = freshThemes.map((id) => t(`theme.${id}` as Key)).join(", ");
    $("over-unlock-text").textContent = t("over.themeUnlocked", { name: names });
    $("over-unlock-use").dataset["theme"] = freshThemes[0]!;
    $("over-unlock-use").hidden = data.settings.theme === freshThemes[0];
  }
  const notice = $("over-notice");
  if (modeId === "sprint40" && !sprintDone) {
    notice.hidden = false;
    notice.textContent = t("over.sprintFailed");
  } else {
    notice.hidden = !isNew || saved;
    notice.textContent = t("notice.storageFailed");
  }

  dlgOver.showModal();
  announce(
    `${t(titleKey)}. ${t(label)} ${value}${isNew && saved ? `. ${t("over.newRecord")}` : ""}${freshThemes.length ? `. ${$("over-unlock-text").textContent}` : ""}`,
  );
}

/** "Pakai sekarang" di Game Over: ganti tema tanpa membuka Pengaturan. */
$("over-unlock-use").addEventListener("click", (e) => {
  const id = (e.currentTarget as HTMLElement).dataset["theme"] as ThemeId;
  if (!isUnlocked(shownUnlocks, id)) return;
  data.settings.theme = id;
  applySettings();
  persist();
  (e.currentTarget as HTMLElement).hidden = true;
  announce(t("settings.theme.applied", { name: t(`theme.${id}` as Key) }));
});

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
$("btn-themes").addEventListener("click", () => openThemes());

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
  if (!scrThemes.hidden) return scrThemes;
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
    else if (!scrThemes.hidden) closeThemes();
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
  if (!scrThemes.hidden) themes.render();
  if (game) {
    hud.mode.textContent = modeLabel(modeId);
    shown.level = -1;
  }
}

/**
 * Ganti layar. enter: putar animasi masuk (CSS `.enter`, styles.css). Tidak dipakai saat kembali
 * dari Pengaturan ke Pause, karena papan permainan yang sedang dijeda harus tetap diam.
 */
function showScreen(which: "menu" | "game" | "settings" | "themes", enter = true): void {
  const screens = { menu: scrMenu, game: scrGame, settings: scrSettings, themes: scrThemes };
  for (const [k, el] of Object.entries(screens)) {
    el.hidden = k !== which;
    el.classList.remove("enter");
  }
  clearTimeout(enterTimer);
  if (!enter) return;
  const el = screens[which];
  void el.offsetWidth; // mulai ulang animasi meski kelas dipasang lagi di layar yang sama
  el.classList.add("enter");
  // Animasi masuk terpanjang sekitar 1,1 s (Menu). Setelah itu kelas dilepas, jadi tidak ada animasi tersisa.
  enterTimer = window.setTimeout(() => el.classList.remove("enter"), 1200);
}
let enterTimer = 0;

function showMenu(): void {
  stopLoop();
  sound.musicStop();
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
  systemReduce: () => systemReduceMq.matches,
  hapticsAvailable: () => hapticsAvailable,
  audioAvailable: () => audioAvailable,
});

// Bunyi tombol di menu, dialog, dan Pengaturan (bukan saat bermain: tombol Pause punya Esc dan gestur).
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (b && !b.disabled && b.getAttribute("aria-disabled") !== "true" && !b.closest(".field")) sound.play("ui", 1, 0.6);
});

function openSettings(from: "menu" | "pause"): void {
  settingsFrom = from;
  showScreen("settings");
  settings.open();
}

function closeSettings(): void {
  if (settingsFrom === "pause" && game) {
    showScreen("game", false);
    layout();
    dlgPause.showModal();
    dlgPause.querySelector<HTMLElement>('[data-act="settings"]')?.focus();
  } else {
    showScreen("menu");
    $("btn-settings").focus();
  }
}

// ---------- tema ----------

const themes = new ThemesScreen(scrThemes, data.settings, shownUnlocks, {
  pick: (id) => {
    data.settings.theme = id;
    applySettings();
    persist();
    announce(t("settings.theme.applied", { name: t(`theme.${id}` as Key) }));
  },
  back: () => closeThemes(),
});

function openThemes(): void {
  showScreen("themes");
  themes.open();
}

function closeThemes(): void {
  showScreen("menu");
  $("btn-themes").focus();
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

// PWA: hanya di HTTPS (Vercel). Di localhost dan di aplikasi Android (Fase 5) tidak dipasang.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  // Versi baru service worker mengambil alih: muat ulang sekali supaya aset baru (misalnya ikon) langsung
  // terpakai. Hanya jika sebelumnya sudah ada service worker (bukan kunjungan pertama) dan pemain sedang
  // tidak bermain; jika sedang bermain, versi baru terpakai saat game dibuka lagi.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded || game) return;
    reloaded = true;
    location.reload();
  });
}
