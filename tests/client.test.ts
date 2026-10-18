// Tes modul klien yang tidak butuh DOM: penyimpanan, DAS/ARR, dan i18n.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ACT } from "../src/core/constants.ts";
import { InputRepeater, createActionBuffer, BTN } from "../src/input/repeat.ts";
import { parseSave, submitResult, SCHEMA, type Records } from "../src/store/storage.ts";
import { formatClock, formatMs, pickLocale, setLocale, t } from "../src/i18n/index.ts";

// ---------- DAS / ARR ----------

const STEP = 1000 / 60;

/** Jalankan tick sampai waktu `until` dan kumpulkan aksi geser per tick. */
function shifts(rep: InputRepeater, from: number, until: number): { time: number; n: number }[] {
  const buf = createActionBuffer();
  const out = [];
  for (let now = from; now <= until + 1e-9; now += STEP) {
    rep.fill(now, buf);
    let n = 0;
    for (let i = 0; i < buf.count; i++) if (buf.data[i] === ACT.LEFT || buf.data[i] === ACT.RIGHT) n++;
    if (n) out.push({ time: Math.round(now), n });
  }
  return out;
}

test("DAS: geser sekali, diam selama DAS, lalu berulang setiap ARR", () => {
  const rep = new InputRepeater(167, 33);
  rep.push(BTN.RIGHT, true, 0);
  const got = shifts(rep, STEP, 300);
  assert.equal(got[0]!.time, 17); // tekan pertama
  assert.ok(got[1]!.time >= 167, "tidak ada pengulangan sebelum DAS");
  assert.ok(got[1]!.time < 167 + STEP);
  const total = got.reduce((a, g) => a + g.n, 0);
  // 1 tekan + pengulangan di 167, 200, 233, 266, 299
  assert.equal(total, 6);
});

test("ARR 0 langsung ke dinding setelah DAS", () => {
  const rep = new InputRepeater(100, 0);
  rep.push(BTN.LEFT, true, 0);
  const got = shifts(rep, STEP, 120);
  assert.equal(got[0]!.n, 1);
  assert.equal(got[1]!.n, 10);
});

test("arah terakhir menang; melepasnya mengembalikan arah lain dengan DAS baru", () => {
  const rep = new InputRepeater(100, 50);
  const buf = createActionBuffer();
  rep.push(BTN.LEFT, true, 0);
  rep.push(BTN.RIGHT, true, 10);
  rep.fill(STEP, buf);
  assert.deepEqual([...buf.data.subarray(0, buf.count)], [ACT.LEFT, ACT.RIGHT]);
  rep.push(BTN.RIGHT, false, 40);
  const got = shifts(rep, 2 * STEP, 200);
  // Kiri masih ditahan: berulang lagi mulai 40 + 100 = 140 ms.
  assert.ok(got[0]!.time >= 140 && got[0]!.time < 140 + STEP);
});

test("tombol sekali tekan tidak berulang saat ditahan", () => {
  const rep = new InputRepeater(167, 33);
  const buf = createActionBuffer();
  rep.push(BTN.HARD, true, 0);
  rep.push(BTN.SOFT, true, 0);
  rep.fill(STEP, buf);
  assert.deepEqual([...buf.data.subarray(0, buf.count)], [ACT.HARD, ACT.SOFT_ON]);
  rep.fill(2 * STEP, buf);
  assert.equal(buf.count, 0);
  rep.push(BTN.SOFT, false, 40);
  rep.fill(3 * STEP, buf);
  assert.deepEqual([...buf.data.subarray(0, buf.count)], [ACT.SOFT_OFF]);
});

test("releaseAll menghentikan geser berulang", () => {
  const rep = new InputRepeater(50, 10);
  rep.push(BTN.RIGHT, true, 0);
  shifts(rep, STEP, 100);
  rep.releaseAll();
  assert.equal(shifts(rep, 101, 300).length, 0);
});

// ---------- gestur ----------

import { GestureRecognizer } from "../src/input/gesture.ts";

function recorder() {
  const out: string[] = [];
  const names = ["LEFT", "RIGHT", "SOFT", "HARD", "CW", "CCW", "HOLD"];
  const rec = new GestureRecognizer((btn, down) => out.push(`${names[btn]}${down ? "+" : "-"}`));
  rec.unit = 20;
  return { rec, out };
}

test("gestur: ketuk satu jari = putar kanan", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  rec.up(1, 102, 101, 120);
  assert.deepEqual(out, ["CW+", "CW-"]);
});

test("gestur: ketuk dua jari = putar kiri, sekali saja", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  rec.down(2, 160, 100, 10);
  rec.up(1, 100, 100, 100);
  rec.up(2, 160, 100, 110);
  assert.deepEqual(out, ["CCW+", "CCW-"]);
});

test("gestur: seret ke kanan 3 sel = 3 geser kanan", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  for (let x = 105; x <= 165; x += 5) rec.move(1, x, 102, x);
  rec.up(1, 165, 102, 300);
  assert.equal(out.filter((s) => s === "RIGHT+").length, 3);
  assert.equal(out.filter((s) => s.startsWith("CW")).length, 0, "bukan ketukan");
});

// Satuan di tes ini: 1 sel = 20 px. Kecepatan bantingan 20 sel/detik = 400 px/detik = 6,4 px per 16 ms.

test("gestur: bantingan cepat ke bawah = jatuh cepat, ke atas = simpan", () => {
  const a = recorder();
  a.rec.down(1, 100, 100, 0);
  a.rec.move(1, 101, 120, 16);
  a.rec.move(1, 101, 160, 32);
  a.rec.up(1, 101, 200, 48);
  assert.deepEqual(a.out, ["HARD+", "HARD-"]);

  const b = recorder();
  b.rec.down(1, 100, 200, 0);
  b.rec.move(1, 100, 170, 16);
  b.rec.move(1, 100, 130, 32);
  b.rec.up(1, 100, 100, 48);
  assert.deepEqual(b.out, ["HOLD+", "HOLD-"]);
});

test("gestur: seret pelan ke bawah jatuh cepat setelah 2,5 sel, sebelum jari diangkat, sekali saja", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  for (let i = 1; i <= 8; i++) rec.move(1, 100, 100 + i * 6, i * 100); // 48 px = 2,4 sel, pelan
  assert.deepEqual(out, [], "belum di 2,4 sel");
  rec.move(1, 100, 154, 900); // 2,7 sel
  assert.deepEqual(out, ["HARD+", "HARD-"]);
  for (let i = 10; i <= 20; i++) rec.move(1, 100, 100 + i * 6, i * 100);
  rec.up(1, 100, 220, 2100);
  assert.deepEqual(out, ["HARD+", "HARD-"], "tidak dipicu ulang");
});

test("gestur: gerak kecil ke bawah, cepat atau pelan, tidak memicu apa pun", () => {
  // Masalah dari uji HP: geser sedikit ke bawah langsung jatuh cepat.
  for (const [dy, ms] of [[16, 60], [20, 40], [26, 120], [28, 300], [45, 400]] as const) {
    const { rec, out } = recorder();
    rec.down(1, 100, 100, 0);
    rec.move(1, 100, 100 + dy / 2, ms / 2);
    rec.up(1, 100, 100 + dy, ms);
    assert.deepEqual(out, [], `${dy} px dalam ${ms} ms`);
  }
});

test("gestur: bantingan tanpa titik gerak sama sekali tetap jatuh cepat", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  rec.up(1, 102, 190, 60); // browser hanya mengirim titik turun dan titik lepas
  assert.deepEqual(out, ["HARD+", "HARD-"]);
});

test("gestur: sentuhan dibatalkan browser di tengah bantingan memakai gerak yang sudah diterima", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  rec.move(1, 100, 120, 16);
  rec.move(1, 100, 135, 24);
  rec.cancel(1, 40);
  assert.deepEqual(out, ["HARD+", "HARD-"]);
});

test("gestur: seret ke samping yang menurun 50 derajat di awal tetap geser, bukan jatuh cepat", () => {
  // Jempol kanan menyeret ke kiri sering mulai dengan gerak miring ke bawah.
  const { rec, out } = recorder();
  rec.down(1, 200, 100, 0);
  rec.move(1, 190, 112.5, 16); // sekitar 51 derajat dari mendatar, melewati LOCK_DIST
  for (let i = 2; i <= 8; i++) rec.move(1, 200 - i * 9, 109 + i * 2, i * 16);
  rec.up(1, 128, 125, 150);
  assert.ok(out.filter((s) => s === "LEFT+").length >= 3, out.join(","));
  assert.ok(!out.includes("HARD+"), out.join(","));
});

test("gestur: geser lalu banting ke bawah tanpa mengangkat jari = geser, lalu jatuh cepat", () => {
  // Permintaan dari uji HP.
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  for (let i = 1; i <= 6; i++) rec.move(1, 100 + i * 10, 101, i * 30); // 3 sel ke kanan
  rec.move(1, 161, 115, 200);
  rec.move(1, 162, 140, 216);
  rec.up(1, 162, 170, 232);
  assert.equal(out.filter((s) => s === "RIGHT+").length, 3, out.join(","));
  assert.equal(out.filter((s) => s === "HARD+").length, 1, out.join(","));
  assert.ok(out.indexOf("HARD+") > out.lastIndexOf("RIGHT+"), "jatuh cepat sesudah geser");
});

test("gestur: geser lalu turun sedikit tanpa mengangkat jari tidak jatuh cepat", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  for (let i = 1; i <= 4; i++) rec.move(1, 100 + i * 10, 101, i * 30);
  rec.move(1, 141, 115, 200); // turun 0,7 sel, pelan
  rec.up(1, 141, 118, 400);
  assert.equal(out.filter((s) => s === "RIGHT+").length, 2);
  assert.ok(!out.includes("HARD+"), out.join(","));
});

test("gestur: geser dengan jari sedikit bergelombang tidak dianggap turun", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  for (let i = 1; i <= 12; i++) rec.move(1, 100 + i * 8, 100 + (i % 2 ? 7 : 0), i * 20);
  rec.up(1, 196, 100, 260);
  assert.ok(out.filter((s) => s === "RIGHT+").length >= 4);
  assert.ok(!out.includes("HARD+"), out.join(","));
});

test("gestur: arah dikunci, sapu ke bawah yang sedikit miring tidak menggeser", () => {
  const { rec, out } = recorder();
  rec.down(1, 100, 100, 0);
  rec.move(1, 104, 120, 16);
  rec.move(1, 112, 160, 32);
  rec.up(1, 118, 200, 48);
  assert.ok(!out.some((s) => s.startsWith("RIGHT")));
  assert.ok(out.includes("HARD+"));
});

// ---------- efek ----------

import { effectiveFx } from "../src/render/fx.ts";
import { Particles, POOL } from "../src/render/particles.ts";

test("efek: Kurangi animasi mengunci ke Minimal; null mengikuti sistem", () => {
  assert.equal(effectiveFx("full", null, false).level, "full");
  assert.equal(effectiveFx("full", null, true).level, "minimal", "sistem minta kurangi animasi");
  assert.equal(effectiveFx("full", false, true).level, "full", "pilihan pemain menang atas sistem");
  assert.equal(effectiveFx("medium", true, false).level, "minimal");
  const min = effectiveFx("minimal", false, false);
  assert.equal(min.particles, 0);
  assert.equal(min.shake, 0, "tanpa shake di Minimal (DESIGN 8.5)");
  assert.ok(effectiveFx("full", false, false).shake <= 4, "shake maksimal 4 px (DESIGN 8.4)");
});

test("efek: pool partikel tetap 300, partikel tertua ditimpa, mati setelah umurnya habis", () => {
  const p = new Particles();
  for (let i = 0; i < POOL + 50; i++) p.emit(0, 0, 10, 0, 0.5, 4, 1 + (i % 7));
  p.update(0.016, 0);
  assert.equal(p.alive, POOL, "tidak lebih dari kapasitas");
  assert.equal(p.x.length, POOL, "array tidak tumbuh");
  for (let i = 0; i < 40; i++) p.update(0.016, 0);
  assert.equal(p.alive, 0, "semua mati setelah 0,5 detik");
});

// ---------- penyimpanan ----------

test("penyimpanan: kosong, rusak, dan bukan objek memakai bawaan", () => {
  assert.equal(parseSave(null).status, "empty");
  assert.equal(parseSave("{bukan json").status, "corrupt");
  assert.equal(parseSave("[1,2]").status, "corrupt");
  assert.equal(parseSave('{"settings":{}}').status, "corrupt"); // tanpa schema
  const d = parseSave("{bukan json").data;
  assert.equal(d.settings.dasMs, 167);
  assert.deepEqual(d.records, {});
});

test("penyimpanan: field tidak valid diganti satu per satu", () => {
  const raw = JSON.stringify({
    schema: 1,
    settings: { dasMs: 999, arrMs: 20, ghost: "ya", effects: "medium", softDropFactor: 7, locale: "fr" },
    records: {
      marathon150: { score: 1200, lines: 12, level: 2, at: "2026-10-15T10:00:00.000Z" },
      marathonEndless: { score: -5, lines: 1, level: 1, at: "2026-10-15T10:00:00.000Z" },
      ultra: { score: 1.5, lines: 1, at: "2026-10-15T10:00:00.000Z" },
      sprint40: { timeMs: 61234, at: "bukan tanggal" },
    },
  });
  const { data, status } = parseSave(raw);
  assert.equal(status, "ok");
  assert.equal(data.settings.dasMs, 167, "di luar rentang");
  assert.equal(data.settings.arrMs, 20, "valid dipertahankan");
  assert.equal(data.settings.ghost, true);
  assert.equal(data.settings.effects, "medium");
  assert.equal(data.settings.softDropFactor, 20, "bukan kelipatan 5");
  assert.equal(data.settings.locale, null);
  assert.equal(data.records.marathon150?.score, 1200);
  assert.equal(data.records.marathonEndless, undefined, "skor negatif");
  assert.equal(data.records.ultra, undefined, "bukan bilangan bulat");
  assert.equal(data.records.sprint40, undefined, "tanggal tidak valid");
});

test("penyimpanan: keymap duplikat dibuang dan Escape ditolak", () => {
  const raw = JSON.stringify({
    schema: 1,
    settings: { keymap: { left: ["KeyA", "KeyA"], right: ["KeyA", "KeyD"], hard: ["Escape"], cw: ["<script>"], hold: ["KeyP", "Tab"] } },
  });
  const km = parseSave(raw).data.settings.keymap;
  assert.deepEqual(km.left, ["KeyA"]);
  assert.deepEqual(km.right, ["KeyD"]);
  assert.deepEqual(km.hard, ["Space"], "kosong kembali ke bawaan");
  assert.deepEqual(km.cw, ["KeyX"]);
  assert.deepEqual(km.hold, ["ArrowUp"], "P dan Tab dicadangkan, kembali ke bawaan");
});

test("penyimpanan: keymap lama (bawaan sebelumnya) dipertahankan apa adanya", () => {
  // Pemain yang sudah menyimpan bawaan lama tidak dipaksa pindah; "Kembalikan bawaan" memberi susunan baru.
  const old = { cw: ["KeyX", "ArrowUp"], ccw: ["KeyZ", "ControlLeft"], hold: ["KeyC", "ShiftLeft"] };
  const km = parseSave(JSON.stringify({ schema: 1, settings: { keymap: old } })).data.settings.keymap;
  assert.deepEqual(km.cw, ["KeyX", "ArrowUp"]);
  assert.deepEqual(km.hold, ["KeyC", "ShiftLeft"]);
});

test("penyimpanan: field lama touchMode diabaikan tanpa merusak pengaturan lain", () => {
  const { data, status } = parseSave(JSON.stringify({ schema: 1, settings: { touchMode: "buttons", dasMs: 120 } }));
  assert.equal(status, "ok");
  assert.equal(data.settings.dasMs, 120);
  assert.equal("touchMode" in data.settings, false);
});

test("penyimpanan: skema lebih baru dibaca tetapi ditandai", () => {
  const { data, status } = parseSave(JSON.stringify({ schema: SCHEMA + 1, settings: { dasMs: 120 } }));
  assert.equal(status, "newer");
  assert.equal(data.settings.dasMs, 120);
});

test("rekor: hanya ditulis jika lebih baik", () => {
  const rec: Records = {};
  const now = new Date("2026-10-15T10:00:00Z");
  assert.equal(submitResult(rec, { mode: "marathon150", score: 0, lines: 0, level: 1 }, now), false, "skor 0 bukan rekor");
  assert.equal(submitResult(rec, { mode: "marathon150", score: 500, lines: 3, level: 1 }, now), true);
  assert.equal(submitResult(rec, { mode: "marathon150", score: 500, lines: 3, level: 1 }, now), false, "seri bukan rekor baru");
  assert.equal(submitResult(rec, { mode: "marathon150", score: 900, lines: 5, level: 1 }, now), true);
  assert.equal(rec.marathon150?.score, 900);
  assert.equal(submitResult(rec, { mode: "sprint40", timeMs: null }, now), false, "Sprint gagal tidak dicatat");
  assert.equal(submitResult(rec, { mode: "sprint40", timeMs: 70000 }, now), true);
  assert.equal(submitResult(rec, { mode: "sprint40", timeMs: 71000 }, now), false, "lebih lambat");
  assert.equal(submitResult(rec, { mode: "sprint40", timeMs: 69000 }, now), true);
  assert.equal(submitResult(rec, { mode: "ultra", score: 3000, lines: 20 }, now), true);
  assert.equal(submitResult(rec, { mode: "ultra", score: 2000, lines: 30 }, now), false, "Ultra dinilai dari skor");
  assert.equal(submitResult(rec, { mode: "zen", lines: 0 }, now), false, "Zen 0 baris bukan rekor");
  assert.equal(submitResult(rec, { mode: "zen", lines: 25 }, now), true);
  assert.equal(rec.zen?.lines, 25);
});

// ---------- i18n ----------

test("i18n: pilih bahasa dan format angka", () => {
  assert.equal(pickLocale(null, ["en-US"]), "en");
  assert.equal(pickLocale(null, ["fr-FR", "id-ID"]), "id");
  assert.equal(pickLocale(null, ["fr-FR"]), "id");
  assert.equal(pickLocale("en", ["id-ID"]), "en");
  setLocale("id");
  assert.equal(t("callout.points", { n: 1200 }), "+1.200");
  setLocale("en");
  assert.equal(t("callout.points", { n: 1200 }), "+1,200");
  assert.equal(formatMs(61234), "1:01.234");
  assert.equal(formatClock(258420), "04:18.42");
});
