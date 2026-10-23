// Suara (SPEC 14, revisi Fase 4 tahap 2): file CC0 pilihan pemilik di public/sfx, diputar lewat Web Audio.
// AudioContext dibuat dan file di-decode setelah sentuhan atau tombol pertama (aturan autoplay browser).
// Sebelum siap, play() diam saja. Tanpa Web Audio, permainan tetap berjalan tanpa suara.

export type SoundId =
  | "move" | "rotate" | "soft" | "hard" | "lock" | "hold"
  | "clear1" | "clear2" | "clear3" | "quad" | "tspin" | "combo" | "pc" | "level" | "over" | "ui";

const FILES: Record<SoundId, string> = {
  move: "click_003.ogg",
  rotate: "select_001.ogg",
  soft: "tick_004.ogg",
  hard: "impactPlate_heavy_001.ogg",
  lock: "drop_004.ogg",
  hold: "select_006.ogg",
  clear1: "confirmation_001.ogg",
  clear2: "confirmation_002.ogg",
  clear3: "confirmation_003.ogg",
  quad: "powerUp5.ogg",
  tspin: "phaserUp4.ogg",
  combo: "pluck_002.ogg",
  pc: "jingles_STEEL00.ogg",
  level: "jingles_STEEL16.ogg",
  over: "zapThreeToneDown.ogg",
  ui: "switch_002.ogg",
};
const MUSIC = "crystal-cave.mp3";

/** Suara yang sangat sering: dibatasi jumlah yang berbunyi bersamaan supaya tidak menumpuk. */
const RAPID: ReadonlySet<SoundId> = new Set(["move", "soft"]);
const RAPID_MAX = 4;

/** Combo naik di tangga nada pentatonik mayor (semitone dari nada dasar), jadi tidak pernah sumbang. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
export function comboRate(combo: number): number {
  return 2 ** (PENTA[Math.min(Math.max(combo, 1), PENTA.length) - 1]! / 12);
}

const AC: typeof AudioContext | undefined =
  typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

export const audioAvailable = AC !== undefined;

export class Sound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  /**
   * Musik diputar sebagai stream lewat elemen <audio>, bukan di-dekode penuh: buffer 50 detik stereo
   * 48 kHz memakan sekitar 18 MB memori, besar untuk HP kelas bawah. Suaranya tetap lewat GainNode
   * musik, jadi volume dan redam saat Pause tidak berubah.
   */
  private musicEl: HTMLAudioElement | null = null;
  private wantMusic = false;
  private duck = 1;
  private rapid = 0;
  private vol = { music: 0.6, sfx: 0.8 };

  constructor() {
    if (!AC) return;
    const unlock = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      this.init();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      // Elemen musik ikut berhenti bersama AudioContext; saat kembali, lanjut jika memang sedang diputar.
      if (document.hidden) {
        void this.ctx.suspend();
        this.musicEl?.pause();
      } else {
        void this.ctx.resume();
        if (this.wantMusic) this.startMusic();
      }
    });
  }

  private init(): void {
    const ctx = new AC!();
    this.ctx = ctx;
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(ctx.destination);
    this.music.connect(ctx.destination);
    this.applyVolume();
    void ctx.resume();
    const base = import.meta.env.BASE_URL + "sfx/";
    const load = async (file: string) => ctx.decodeAudioData(await (await fetch(base + file)).arrayBuffer());
    // Efek dulu (kecil, sekitar 135 KB), musik menyusul. File yang gagal dilewati: suara itu saja yang diam.
    for (const [id, file] of Object.entries(FILES) as [SoundId, string][]) {
      load(file).then((b) => this.buffers.set(id, b), () => {});
    }
    const el = new Audio(base + MUSIC);
    el.loop = true;
    el.preload = "auto";
    ctx.createMediaElementSource(el).connect(this.music);
    this.musicEl = el;
    if (this.wantMusic) this.startMusic();
  }

  setVolume(music: number, sfx: number): void {
    this.vol.music = music;
    this.vol.sfx = sfx;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Kuadrat: slider terasa lebih rata di telinga daripada linear.
    this.sfx!.gain.setTargetAtTime(this.vol.sfx ** 2, now, 0.02);
    this.music!.gain.setTargetAtTime(this.vol.music ** 2 * 0.5 * this.duck, now, 0.05);
  }

  /** rate: kecepatan putar (mengubah nada). gain: 0..1 relatif terhadap volume Efek. */
  play(id: SoundId, rate = 1, gain = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(id);
    if (!ctx || !buf || ctx.state !== "running" || this.vol.sfx === 0) return;
    const rapid = RAPID.has(id);
    if (rapid) {
      if (this.rapid >= RAPID_MAX) return;
      this.rapid++;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    let out: AudioNode = this.sfx!;
    if (gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(out);
      out = g;
    }
    src.connect(out);
    if (rapid) src.onended = () => this.rapid--;
    src.start();
  }

  /** Musik latar berulang selama permainan. Mulai dari awal setiap permainan baru. */
  musicStart(): void {
    this.wantMusic = true;
    this.musicDuck(false);
    this.startMusic();
  }

  musicStop(): void {
    this.wantMusic = false;
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.currentTime = 0;
    }
  }

  /** Pause: musik turun ke 30%, tidak berhenti. */
  musicDuck(on: boolean): void {
    this.duck = on ? 0.3 : 1;
    this.applyVolume();
  }

  private startMusic(): void {
    if (!this.musicEl || !this.musicEl.paused) return;
    void this.musicEl.play().catch(() => {});
  }
}
