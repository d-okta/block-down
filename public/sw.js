// Service worker BlockDown (EDD-3 bagian 5): game bisa dimainkan tanpa internet setelah kunjungan pertama.
// - Saat dipasang: simpan halaman, ikon, font, dan 17 file suara ke cache.
// - Halaman (navigasi): jaringan dulu supaya versi baru langsung terpakai; offline memakai salinan di cache.
// - Aset build (assets/, nama ber-hash): cache dulu. File baru selalu punya nama baru.
// - File lain bernama tetap (icons.svg, ikon aplikasi, suara, manifest): cache dulu supaya cepat dan
//   offline, sambil mengambil versi terbaru di latar untuk kunjungan berikutnya. Versi v1 hanya cache-first,
//   sehingga icons.svg lama tidak pernah diperbarui (ikon palet tidak muncul di HP pemilik).
// - VERSION diganti jika daftar PRECACHE berubah atau cache lama harus dibuang; cache versi lama dihapus saat aktif.
const VERSION = "v3";
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
  // /api/ (leaderboard, PRD-7) selalu langsung ke jaringan: data peringkat tidak boleh disajikan dari cache.
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          await cache.put("./", res.clone());
          return res;
        } catch {
          return (await (await caches.open(CACHE)).match("./")) ?? Response.error();
        }
      })(),
    );
    return;
  }
  e.respondWith(
    (async () => {
      // ignoreVary: font diminta browser dengan header Origin, sedangkan saat dipasang disimpan tanpa itu.
      // Server yang mengirim `Vary: Origin` membuat cocokan biasa gagal, dan font hilang saat offline.
      // Hanya dari cache versi ini: cache versi lama yang belum terhapus tidak boleh menyajikan file usang.
      const hit = await (await caches.open(CACHE)).match(req, { ignoreVary: true });
      const hashed = new URL(req.url).pathname.includes("/assets/");
      // Hanya respons utuh yang disimpan (bukan 206 Range dari pemutar audio, bukan error).
      const refresh = fetch(req).then(async (res) => {
        if (res.ok && res.status === 200) await (await caches.open(CACHE)).put(req, res.clone());
        return res;
      });
      if (hit) {
        if (!hashed) e.waitUntil(refresh.catch(() => {}));
        return hit;
      }
      return refresh;
    })(),
  );
});
