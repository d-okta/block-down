import {
  ACT,
  COLS,
  FILLER_MAX_CELLS,
  FP,
  LOCK_TICKS,
  MAX_G,
  MAX_RESETS,
  ROWS,
  VISIBLE_ROWS,
  type PieceType,
  type Rot,
} from "./constants.ts";
import { clearLines, createBoard, fits, isEmpty } from "./board.ts";
import { SHAPES, SPAWN_X, SPAWN_Y, shapeOffset } from "./piece.ts";
import { findKick, kick } from "./srs.ts";
import { createBag, peek, queueFiller, take, type Bag } from "./bag.ts";
import { gravityFor } from "./gravity.ts";
import { detectTSpin, scoreLock, SC, SPIN_NONE } from "./score.ts";
import { EV, EventQueue } from "./events.ts";
import { MODES, type Mode, type ModeId } from "./modes.ts";

export const STATUS = { PLAYING: 0, GAME_OVER: 1, FINISHED: 2, TIME_UP: 3 } as const;
const LAST_NONE = 0;
const LAST_MOVE = 1;
const LAST_ROTATE = 2;

export interface GameState {
  board: Uint8Array;
  type: PieceType;
  rot: Rot;
  x: number;
  y: number;
  ghostY: number;
  hold: PieceType | 0;
  holdUsed: boolean;
  gravAcc: number;
  lockTicks: number;
  resets: number;
  lowestY: number;
  grounded: boolean;
  forceLock: boolean;
  softHeld: boolean;
  lastAction: number;
  kickIndex: number;
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: boolean;
  quads: number;
  tspins: number;
  maxCombo: number;
  /** Jumlah Bersih Total (syarat tema Monokrom, PRD-6). */
  perfects: number;
  /** Jumlah piece yang sudah muncul, termasuk yang aktif. */
  pieces: number;
  tick: number;
  status: number;
}

export interface CoreConfig {
  /** 5..40, atau "instant". */
  softDropFactor: number | "instant";
}

export interface Game {
  readonly state: Readonly<GameState>;
  readonly events: EventQueue;
  readonly mode: Mode;
  step(actions: ArrayLike<number>, count: number): void;
  peekNext(i: number): PieceType;
  /** Pemain mengakhiri permainan sendiri (Zen tidak punya akhir lain). Status menjadi FINISHED. */
  end(): void;
  setConfig(cfg: CoreConfig): void;
}

export function createGame(modeId: ModeId, seed: number, cfg: CoreConfig): Game {
  const mode = MODES[modeId];
  const bag: Bag = createBag(seed);
  const events = new EventQueue();
  let softFactor = cfg.softDropFactor;
  const rows = new Int8Array(4);
  const shift = new Uint8Array(ROWS);
  const colors = new Uint8Array(40);
  const sc = new Int32Array(7);

  const s: GameState = {
    board: createBoard(),
    type: 1,
    rot: 0,
    x: 0,
    y: 0,
    ghostY: 0,
    hold: 0,
    holdUsed: false,
    gravAcc: 0,
    lockTicks: LOCK_TICKS,
    resets: 0,
    lowestY: 0,
    grounded: false,
    forceLock: false,
    softHeld: false,
    lastAction: LAST_NONE,
    kickIndex: 0,
    score: 0,
    lines: 0,
    level: mode.levelFor(0),
    combo: -1,
    b2b: false,
    quads: 0,
    tspins: 0,
    maxCombo: 0,
    perfects: 0,
    pieces: 0,
    tick: 0,
    status: STATUS.PLAYING,
  };

  function canMove(dx: number, dy: number): boolean {
    return fits(s.board, s.type, s.rot, s.x + dx, s.y + dy);
  }

  function computeGhost(): void {
    let gy = s.y;
    while (fits(s.board, s.type, s.rot, s.x, gy - 1)) gy--;
    s.ghostY = gy;
  }

  /** Dipanggil setiap posisi atau orientasi piece berubah. */
  function afterPositionChange(): void {
    computeGhost();
    if (s.y < s.lowestY) {
      s.lowestY = s.y;
      s.resets = 0;
      s.forceLock = false;
    }
    const g = s.ghostY === s.y;
    if (g && !s.grounded) {
      s.lockTicks = LOCK_TICKS;
      if (s.resets >= MAX_RESETS) s.forceLock = true;
    }
    s.grounded = g;
  }

  /** Geser atau putar berhasil (SPEC 6.2). */
  function onMoved(wasGrounded: boolean): void {
    if (wasGrounded) {
      if (s.resets < MAX_RESETS) {
        s.resets++;
        s.lockTicks = LOCK_TICKS;
      } else {
        s.forceLock = true;
      }
    }
    afterPositionChange();
  }

  function writeCells(out: Int8Array): void {
    const o = shapeOffset(s.type, s.rot);
    for (let i = 0; i < 8; i += 2) {
      out[i] = s.x + SHAPES[o + i]!;
      out[i + 1] = s.y + SHAPES[o + i + 1]!;
    }
  }

  function spawn(type: PieceType, fromHold: boolean): void {
    s.type = type;
    s.rot = 0;
    s.x = SPAWN_X;
    s.y = SPAWN_Y[type]!;
    s.lastAction = LAST_NONE;
    s.kickIndex = 0;
    s.gravAcc = 0;
    s.resets = 0;
    s.forceLock = false;
    s.lockTicks = LOCK_TICKS;
    s.grounded = false;
    if (!fromHold) s.holdUsed = false;
    s.pieces++;
    if (!canMove(0, 0)) {
      topOut(0);
      return;
    }
    if (canMove(0, -1)) s.y--;
    s.lowestY = s.y;
    computeGhost();
    s.grounded = s.ghostY === s.y;
    events.push(EV.SPAWN, type);
  }

  /** cause: 0 block out, 1 lock out. */
  function topOut(cause: number): void {
    if (mode.onTopOut() === "reset") {
      s.board.fill(0);
      events.push(EV.ZEN_RESET);
      spawn(take(bag), false);
      return;
    }
    s.status = STATUS.GAME_OVER;
    events.push(EV.GAME_OVER, cause);
  }

  function lockPiece(): void {
    const lockEv = events.push(EV.LOCK, s.type);
    const o = shapeOffset(s.type, s.rot);
    let lockOut = true;
    for (let i = 0; i < 8; i += 2) {
      const cx = s.x + SHAPES[o + i]!;
      const cy = s.y + SHAPES[o + i + 1]!;
      if (cy < VISIBLE_ROWS) lockOut = false;
      s.board[cy * COLS + cx] = s.type;
      if (lockEv) {
        lockEv.cells[i] = cx;
        lockEv.cells[i + 1] = cy;
      }
    }

    const spin = detectTSpin(s.board, s.type, s.rot, s.x, s.y, s.lastAction, s.kickIndex);
    const n = clearLines(s.board, rows, shift, colors);
    const perfect = n > 0 && isEmpty(s.board);
    const level = s.level;
    scoreLock(n, spin, level, s.b2b, s.combo, perfect, sc);

    s.score += sc[SC.TOTAL]!;
    s.b2b = sc[SC.NEW_B2B] === 1;
    s.combo = sc[SC.NEW_COMBO]!;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
    if (n === 4) s.quads++;
    if (perfect) s.perfects++;
    if (spin !== SPIN_NONE) s.tspins++;

    if (n > 0 || spin !== SPIN_NONE) {
      const e = events.push(EV.CLEAR, n, spin, s.combo);
      if (e) {
        e.rows.set(rows);
        e.shift.set(shift);
        e.colors.set(colors);
        e.score[0] = sc[SC.ACTION]!;
        e.score[1] = sc[SC.B2B_APPLIED]!;
        e.score[2] = sc[SC.COMBO]!;
        e.score[3] = sc[SC.PC]!;
        e.score[4] = sc[SC.TOTAL]!;
      }
    }

    s.lines += n;
    const newLevel = mode.levelFor(s.lines);
    if (newLevel > s.level) {
      s.level = newLevel;
      events.push(EV.LEVEL_UP, newLevel);
    }

    if (lockOut) {
      topOut(1);
      return;
    }
    // Blok Pengisi (PRD-6 bagian 14): baris baru saja terhapus dan papan tinggal sedikit, jadi satu blok 1x1
    // ditaruh di depan antrean untuk menambal lubang menuju Bersih Total. Muncul sebagai piece berikutnya
    // setelah piece yang sekarang muncul, supaya pemain sempat melihatnya di Antrean.
    if (n > 0 && !bag.filler) {
      let filled = 0;
      for (let i = 0; i < s.board.length; i++) if (s.board[i] !== 0) filled++;
      if (filled > 0 && filled <= FILLER_MAX_CELLS) {
        const next = take(bag);
        queueFiller(bag);
        events.push(EV.FILLER, filled);
        spawn(next, false);
        return;
      }
    }
    spawn(take(bag), false);
  }

  function tryShift(dx: number): void {
    if (!canMove(dx, 0)) return;
    const wasGrounded = s.grounded;
    s.x += dx;
    s.lastAction = LAST_MOVE;
    events.push(EV.MOVE, dx);
    onMoved(wasGrounded);
  }

  function tryRotate(dir: 1 | -1): void {
    const to = ((s.rot + dir + 4) % 4) as Rot;
    const i = findKick(s.board, s.type, s.rot, to, s.x, s.y);
    if (i < 0) return;
    const wasGrounded = s.grounded;
    s.x += kick(s.type, s.rot, to, i, 0);
    s.y += kick(s.type, s.rot, to, i, 1);
    s.rot = to;
    s.kickIndex = i;
    s.lastAction = LAST_ROTATE;
    events.push(EV.ROTATE, dir, i, s.type);
    onMoved(wasGrounded);
  }

  function doHold(): void {
    if (s.holdUsed) return;
    const cur = s.type;
    const next = s.hold === 0 ? take(bag) : s.hold;
    s.hold = cur;
    s.holdUsed = true;
    events.push(EV.HOLD, cur);
    spawn(next, true);
  }

  function hardDrop(): void {
    const dist = s.y - s.ghostY;
    s.y = s.ghostY;
    s.score += 2 * dist;
    const e = events.push(EV.HARD, dist, s.type);
    if (e) writeCells(e.cells);
    lockPiece();
  }

  /** Gravitasi dan soft drop untuk satu tick (EDD-1 bagian 7). */
  function applyGravity(): void {
    if (s.softHeld && softFactor === "instant") {
      const d = s.y - s.ghostY;
      if (d > 0) {
        s.y = s.ghostY;
        s.score += d;
        events.push(EV.SOFT, d);
        afterPositionChange();
      }
      s.gravAcc = 0;
      return;
    }
    let g = gravityFor(s.level);
    if (s.softHeld) g = Math.min(g * (softFactor as number), MAX_G);
    s.gravAcc += g;
    let fell = 0;
    while (s.gravAcc >= FP) {
      if (!canMove(0, -1)) {
        s.gravAcc = 0;
        break;
      }
      s.y--;
      s.gravAcc -= FP;
      fell++;
    }
    if (fell > 0) {
      if (s.softHeld) {
        s.score += fell;
        events.push(EV.SOFT, fell);
      }
      afterPositionChange();
    }
  }

  function step(actions: ArrayLike<number>, count: number): void {
    if (s.status !== STATUS.PLAYING) return;
    let locked = false;
    for (let i = 0; i < count; i++) {
      const a = actions[i];
      if (a === ACT.SOFT_ON) s.softHeld = true;
      else if (a === ACT.SOFT_OFF) s.softHeld = false;
      else if (locked) continue;
      else if (a === ACT.LEFT) tryShift(-1);
      else if (a === ACT.RIGHT) tryShift(1);
      else if (a === ACT.ROT_CW) tryRotate(1);
      else if (a === ACT.ROT_CCW) tryRotate(-1);
      else if (a === ACT.HOLD) doHold();
      else if (a === ACT.HARD) {
        hardDrop();
        locked = true;
      }
      if (s.status !== STATUS.PLAYING) return;
    }

    if (!locked) {
      applyGravity();
      if (s.grounded) {
        if (s.forceLock) lockPiece();
        else if (--s.lockTicks <= 0) lockPiece();
      }
      if (s.status !== STATUS.PLAYING) return;
    }

    s.tick++;
    const end = mode.checkEnd(s);
    if (end !== 0) {
      s.status = end;
      events.push(end === STATUS.FINISHED ? EV.FINISH : EV.TIME_UP);
    }
  }

  spawn(take(bag), false);

  return {
    state: s,
    events,
    mode,
    step,
    peekNext: (i) => peek(bag, i),
    end() {
      if (s.status !== STATUS.PLAYING) return;
      s.status = STATUS.FINISHED;
      events.push(EV.FINISH);
    },
    setConfig(c) {
      softFactor = c.softDropFactor;
    },
  };
}

/**
 * Hanya untuk tes: taruh piece aktif langsung di posisi tertentu.
 * lastAction diset kosong; grounded dan ghost dihitung ulang.
 */
export function debugSetActive(game: Game, type: PieceType, rot: Rot, x: number, y: number): void {
  const s = game.state as GameState;
  s.type = type;
  s.rot = rot;
  s.x = x;
  s.y = y;
  s.lastAction = LAST_NONE;
  s.kickIndex = 0;
  s.resets = 0;
  s.forceLock = false;
  s.lowestY = y;
  s.gravAcc = 0;
  s.lockTicks = LOCK_TICKS;
  let gy = y;
  while (fits(s.board, type, rot, x, gy - 1)) gy--;
  s.ghostY = gy;
  s.grounded = gy === y;
}
