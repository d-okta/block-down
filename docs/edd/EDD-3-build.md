# EDD 3: Proyek, Build, dan Rilis

Rancangan teknis rinci untuk konfigurasi proyek, aset, PWA, Android, deploy, dan cara verifikasi. Sumber: `docs/prd/ARCHITECTURE.md` dan `ROADMAP.md`.

---

## 1. Struktur akhir repo

Folder dokumentasi dan desain yang sudah ada tidak dipindah. Kode ditambahkan di sampingnya.

```
block-down/
  README.md
  package.json
  tsconfig.json
  vite.config.ts
  capacitor.config.ts
  index.html
  docs/            PRD dan EDD (sudah ada)
  design/          ekspor Stitch (sudah ada)
  public/
    manifest.webmanifest
    sw.js
    icons.svg       sprite ikon UI
    app-icon/       ikon aplikasi (placeholder sampai Fase 5)
  src/
    main.ts  loop.ts  styles.css
    fonts/          woff2
    core/  render/  input/  audio/  i18n/  ui/  store/  platform/
  tests/
    core.test.ts
  android/          dibuat oleh `npx cap add android` di Fase 5
```

`android/` dan `dist/` tidak dibuat sebelum fasenya. `.gitignore` berisi `node_modules/`, `dist/`, dan berkas build Android.

## 2. TypeScript dan tes

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

Alasan pilihan yang tidak biasa:
- `erasableSyntaxOnly` dan `allowImportingTsExtensions`: tes dijalankan langsung oleh Node dengan penghapusan tipe bawaan, jadi kode hanya boleh memakai sintaks yang bisa dihapus dan import harus memakai `.ts`.
- `types: ["node"]` hanya untuk file tes. Kode `src/core/` tetap tidak boleh memakai API Node; ini dicek dengan grep (bagian 8).

`package.json` (bagian yang penting):

```json
{
  "name": "block-down",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.18" },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "node --test \"tests/*.test.ts\"",
    "check": "tsc && npm test"
  }
}
```

Node 22.18 ke atas menjalankan `.ts` tanpa flag. Versi paket ditetapkan saat Fase 1 dimulai, dengan versi stabil terbaru waktu itu, lalu dikunci di `package-lock.json`.

Dependensi:

| Paket | Jenis | Kapan |
|---|---|---|
| `vite` | dev | Fase 1 |
| `typescript` | dev | Fase 1 |
| `@types/node` | dev | Fase 1, untuk tes |
| `@capacitor/core` | runtime | Fase 4 (haptics) |
| `@capacitor/haptics` | runtime | Fase 4 |
| `@capacitor/app` | runtime | Fase 5, tombol kembali Android |
| `@capacitor/android` | runtime | Fase 5 |
| `@capacitor/cli` | dev | Fase 5 |
| `@capacitor-community/keep-awake` | runtime | Hanya jika uji gamepad membutuhkannya |

## 3. Vite

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsInlineLimit: 0, sourcemap: true },
  server: { host: true },
});
```

- `base: "./"` supaya hasil build berjalan di Vercel dan di WebView Capacitor tanpa konfigurasi berbeda.
- `assetsInlineLimit: 0` supaya font tetap file terpisah dan bisa di-cache service worker.
- `server.host` supaya bisa diuji dari HP di jaringan yang sama.

## 4. Aset

### 4.1 Font

- Sora 400, 500, 600, 700 dan JetBrains Mono 500, 700 dalam woff2, subset Latin (termasuk tanda baca Indonesia dan simbol `+`, `.`, `,`, `:`).
- Sumber: repositori resmi masing-masing font (lisensi OFL). File lisensi disalin ke `src/fonts/`.
- `@font-face` di `styles.css` dengan `font-display: swap`. Dua font yang tampil di layar pertama (Sora 700 untuk logo, Sora 500 untuk menu) di-preload di `index.html`.
- Angka tabular: `.num { font-family: "JetBrains Mono", monospace; font-variant-numeric: tabular-nums; }`.

### 4.2 Ikon UI

Material Symbols Outlined (Apache 2.0), diunduh sebagai SVG satu per satu, lalu digabung secara manual menjadi satu `public/icons.svg` berisi `<symbol id="...">`. Tidak memuat font ikon.

| Ikon | Dipakai di |
|---|---|
| `settings` | Menu |
| `pause` | Game |
| `swap_horiz` | Tombol Simpan |
| `arrow_left_alt`, `arrow_right_alt` | Geser |
| `rotate_left`, `rotate_right` | Putar |
| `south` | Jatuh pelan |
| `keyboard_double_arrow_down` | Jatuh cepat |
| `play_arrow` | Lanjutkan |
| `replay` | Ulangi, Main Lagi |
| `tune` | Pengaturan dari Pause |
| `home` | Ke Menu |
| `arrow_back` | Kembali dari Pengaturan |
| `restart_alt` | Kembalikan bawaan |

Ikon dari Stitch yang tidak dipakai: `person`, `account_circle`, `military_tech`, `leaderboard`, `insights`, `videogame_asset`, `layers`, `chevron_right`, `bolt`, `music_note`, `volume_up`, `vibration` (DESIGN 9.1).

### 4.3 Ikon aplikasi

Final, dipilih pemilik (DESIGN 6). Sumber: `design/app-icon/ikon.svg` dan `ikon-maskable.svg`, dibuat oleh `design/app-icon/generate.mjs` (ubah lalu jalankan ulang, lalu render ke PNG). File di `public/app-icon/`: `192.png`, `512.png`, `512-maskable.png`, `apple-touch-icon.png` (180), `favicon-32.png`. Ikon launcher Android (mipmap) dibuat dari SVG yang sama saat proyek Capacitor ditambahkan.

## 5. PWA

`public/manifest.webmanifest`:

```json
{
  "name": "BlockDown",
  "short_name": "BlockDown",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F1217",
  "theme_color": "#0F1217",
  "lang": "id",
  "icons": [
    { "src": "app-icon/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "app-icon/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "app-icon/512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`orientation: portrait` adalah preferensi, bukan kunci. Tata letak landscape tetap dibuat (DESIGN 7).

`public/sw.js` (ditulis tangan):
- Versi cache dari konstanta `VERSION`, diganti setiap rilis yang mengubah daftar file tetap.
- `install`: simpan halaman, manifest, ikon, sprite ikon UI, 17 file suara, lalu aset build (JS dan CSS dibaca dari HTML, font dibaca dari CSS), lalu `skipWaiting()`.
- Navigasi: jaringan dulu (versi baru langsung terpakai, salinannya disimpan), offline memakai salinan di cache.
- Permintaan GET same-origin lain: cache dulu dengan `ignoreVary` (font diminta dengan header `Origin`; tanpa opsi ini font tidak cocok dan hilang saat offline). Respons 200 dari jaringan disimpan; 206 dari pemutar audio tidak.
- Uji: Chrome offline setelah kunjungan pertama memuat Menu, font, suara (ter-decode), dan permainan berjalan, tanpa error.
- `activate`: hapus cache versi lama, lalu `clients.claim()`.
- Karena nama file hasil Vite memakai hash, cache-first aman: file baru punya nama baru.
- Didaftarkan di `main.ts` hanya jika `location.protocol === "https:"` (aplikasi Android Capacitor memakai skema sendiri, jadi tidak ikut terdaftar).

`index.html` memuat `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` dan `<meta name="theme-color" content="#0F1217">`.

## 6. Android (Fase 5)

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.nusavisionmedia.blockdown",
  appName: "BlockDown",
  webDir: "dist",
  backgroundColor: "#0F1217",
  android: { allowMixedContent: false },
};
export default config;
```

Langkah:
1. `npm run build`
2. `npx cap add android` (sekali)
3. `npx cap sync android`
4. Tema Android: `windowBackground` dan warna status bar `#0F1217`, layout edge-to-edge. Safe-area ditangani CSS `env(safe-area-inset-*)`.
5. `minSdkVersion` mengikuti bawaan Capacitor (ARCHITECTURE 14).
6. Build release AAB dengan keystore pemilik. Keystore dan sandinya tidak disimpan di repo.

## 7. Perubahan dari PRD yang dibuat EDD

| Hal | PRD | EDD | Alasan |
|---|---|---|---|
| Dependensi | 4 paket Capacitor | Ditambah `@capacitor/app` | Tombol kembali Android dan event pause aplikasi butuh plugin ini. |
| Waktu spawn | "Piece berikutnya muncul di tick berikutnya" | Muncul di tick yang sama dengan lock, bisa digerakkan mulai tick berikutnya | Lebih tepat menggambarkan jeda 0 ms. SPEC, ARCHITECTURE, dan ROADMAP sudah diselaraskan. |
| Waktu tick | 16.667 ms | Disimpan sebagai jumlah tick, dikonversi `floor(tick * 1000 / 60)` | Menghindari galat pecahan pada timer Sprint dan Ultra. |
| Gravitasi | Rumus | Tabel fixed-point dari rumus | Hasil identik di semua mesin. |
| Blur Pause | Blur statis | Snapshot canvas diblur sekali dengan `ctx.filter`, tanpa `backdrop-filter` | Satu kali hitung, tanpa beban komposit terus-menerus. |
| Versi Node | Tidak disebut | 22.18 ke atas | Menjalankan tes `.ts` tanpa flag dan tanpa `tsx`. |
| File core | Daftar di ARCHITECTURE 3 | Ditambah `constants.ts`, `gravity.ts`, `actions.ts` | Konstanta, tabel gravitasi, dan kode aksi dipakai bersama oleh core, input, dan tes. |
| Ikon UI | `src/icons/` | Satu sprite `public/icons.svg` | Satu permintaan jaringan dan bisa dipakai lewat `<use>`. |

## 8. Verifikasi

### 8.1 Perintah per fase

| Perintah | Lulus jika |
|---|---|
| `npm run check` | `tsc` tanpa error, semua tes `node:test` lulus |
| `npm run build` | Build selesai tanpa peringatan TypeScript |
| `rg -n "window|document|performance|Math\.random|Date" src/core` | Tidak ada hasil |
| `rg -n "[\u2014\u2013]" src docs` | Tidak ada hasil |
| `rg -ni "tet[r]is" --glob "!design/**" .` | Tidak ada hasil (pola ditulis dengan `[r]` supaya baris ini sendiri tidak memuat merek) |
| `rg -n "createLinearGradient|createRadialGradient|createPattern|new Path2D" src/render` | Hanya di fungsi rebuild sprite dan ambient, tidak di jalur gambar per frame |
| Pencarian string Indonesia atau Inggris di `src/` di luar `src/i18n/` | Tidak ada teks untuk pemain |

### 8.2 Uji manual (dicatat sebagai click-through, R-35)

Format catatan: satu baris per kontrol, `Kontrol -> hasil yang terlihat, konsol bersih`. Disimpan di deskripsi PR fase tersebut.

| Fase | Yang diuji |
|---|---|
| 2 | Setiap tombol keyboard bawaan, Pause dan setiap tombolnya, Game Over dan setiap tombolnya, rekor setelah reload, localStorage berisi JSON rusak |
| 3 | Setiap baris mode di Menu, switch bahasa di Menu dan Pengaturan, setiap kontrol Pengaturan, pemetaan ulang termasuk konflik dan Esc, mode Tombol dan Gestur di HP, gamepad, lebar 320/390/600/768/1024 dan landscape, zoom 200% di Menu dan Pengaturan |
| 4 | Setiap momen reward di ketiga intensitas, `prefers-reduced-motion` di sistem, mode buta warna (screenshot grayscale), setiap suara, Getar, TalkBack dan NVDA |
| 5 | Pasang PWA, mode pesawat, APK di perangkat acuan, tombol kembali Android, notch dan navigasi gestur |

### 8.3 Performa

- Chrome remote debugging ke perangkat acuan (ARCHITECTURE 14, menunggu data pemilik).
- Rekaman Performance 60 detik di Maraton level 10 ke atas dengan intensitas Penuh, termasuk minimal satu Quad.
- Lulus jika: tidak ada frame di atas 16.7 ms, dan heap tidak naik bertahap (pola gigi gergaji dari GC minor yang disebabkan loop dianggap gagal).
- Input lag: build debug mencatat `simTime` saat aksi diproses dikurangi waktu event. Lulus jika persentil ke-95 di bawah 16.7 ms.

## 9. Deploy Vercel

- Proyek Vercel diarahkan ke folder repo, build command `npm run build`, output `dist`.
- Domain: `*.vercel.app` sampai pemilik menyiapkan domain sendiri.
- `vercel.json` hanya berisi header cache:
  - `sw.js`: `Cache-Control: no-cache`, supaya pembaruan service worker terdeteksi.
  - `assets/*`: `Cache-Control: public, max-age=31536000, immutable`.

## 10. Listing toko

Ditulis di Fase 5 dari daftar fitur yang lolos uji Fase 1 sampai 4. Setiap kalimat listing dipetakan ke kriteria ROADMAP yang membuktikannya, dalam tabel di deskripsi PR Fase 5. Tidak ada angka, testimoni, peringkat, atau klaim performa. Tidak ada kata merek dagang permainan blok jatuh.
