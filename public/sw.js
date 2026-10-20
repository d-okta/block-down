// Service worker BlockDown (EDD-3 bagian 5): game bisa dimainkan tanpa internet setelah kunjungan pertama.
// - Saat dipasang: simpan halaman, ikon, font, dan 17 file suara ke cache.
// - Halaman (navigasi): jaringan dulu supaya versi baru langsung terpakai; offline memakai salinan di cache.
// - File lain: cache dulu. Aset build bernama hash, jadi file baru selalu punya nama baru.
// - VERSION diganti setiap rilis yang mengubah daftar PRECACHE; cache versi lama dihapus saat aktif.
const VERSION = "v1";
const CACHE = `blockdown-${VERSION}`;
const PRECACHE = [
  "./",
  "./manifest.webmanifest",
  "./icons.svg",
  "./app-icon/192.png",
  "./app-icon/512.png",
  "./app-icon/512-maskable.png",
  "./app-icon/favicon-32.png",
  ...[
    "click_003.ogg", "select_001.ogg", "tick_004.ogg", "impactPlate_heavy_001.ogg", "drop_004.ogg", "select_006.ogg",
    "confirmation_001.ogg", "confirmation_002.ogg", "confirmation_003.ogg", "powerUp5.ogg", "phaserUp4.ogg",
    "pluck_002.ogg", "jingles_STEEL00.ogg", "jingles_STEEL16.ogg", "zapThreeToneDown.ogg", "switch_002.ogg",
    "crystal-cave.mp3",
  ].map((f) => `./sfx/${f}`),
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Aset build (JS, CSS, font) dibaca dari halaman yang baru diambil, supaya ikut tersimpan sejak awal.
      const html = await (await cache.match("./")).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => new URL(m[1], location.href).href);
      // Font dirujuk dari CSS, bukan dari HTML: baca setiap file CSS dan ambil url(...) di dalamnya.
      for (const css of assets.filter((a) => a.endsWith(".css"))) {
        const text = await (await fetch(css)).text();
        for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!m[1].startsWith("data:")) assets.push(new URL(m[1], css).href);
      }
      await cache.addAll([...new Set(assets)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("blockdown-") && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          await cache.put("./", res.clone());
          return res;
        } catch {
          return (await caches.match("./")) ?? Response.error();
        }
      })(),
    );
    return;
  }
  e.respondWith(
    (async () => {
      // ignoreVary: font diminta browser dengan header Origin, sedangkan saat dipasang disimpan tanpa itu.
      // Server yang mengirim `Vary: Origin` membuat cocokan biasa gagal, dan font hilang saat offline.
      const hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      // Hanya respons utuh yang disimpan (bukan 206 Range dari pemutar audio, bukan error).
      if (res.ok && res.status === 200) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })(),
  );
});
