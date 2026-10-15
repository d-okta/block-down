# BlockDown

Game puzzle blok jatuh untuk browser, dengan versi Android menyusul. Tenang saat bermain, dengan aturan modern: rotasi SRS, 7-bag, Hold, lima piece berikutnya, lock delay, T-Spin, dan Back-to-Back.

**Coba sekarang: https://block-down.vercel.app**

## Status versi uji

Ini versi uji awal (Fase 2 dari 6). Yang sudah bisa dicoba:

- Mode Maraton: 150 baris, atau tanpa batas.
- Kontrol keyboard dengan geser berulang (DAS 167 ms, ARR 33 ms) dan lock delay 400 ms.
- Ghost piece, Simpan (sekali per piece), dan 5 piece berikutnya.
- Skor lengkap: Single sampai 4 Baris, T-Spin dan Mini, Back-to-Back, Combo, Bersih Total.
- Jeda, Game Over dengan statistik, dan rekor pribadi yang tersimpan di browser.
- Bahasa Indonesia dan Inggris.

Belum ada di versi ini:

- Kontrol sentuh. Di HP, game belum bisa dimainkan.
- Mode Sprint 40, Ultra, dan Zen.
- Layar Pengaturan (DAS, ARR, tombol, tampilan).
- Animasi saat menghapus baris, suara, dan getar.
- Aplikasi Android.

Urutan pengerjaannya ada di [docs/prd/ROADMAP.md](docs/prd/ROADMAP.md).

## Kontrol

| Aksi | Tombol |
|---|---|
| Geser | ← → |
| Jatuh pelan | ↓ |
| Jatuh cepat | Space |
| Putar kanan | X atau ↑ |
| Putar kiri | Z atau Ctrl |
| Simpan | C atau Shift |
| Jeda | Esc atau P |

## Menjalankan di komputer sendiri

Butuh Node 22.18 atau lebih baru.

```
npm install
npm run dev       # buka http://localhost:5173
npm run check     # TypeScript + 39 tes
npm run build     # hasil di dist/
```

Di Windows PowerShell yang memblokir skrip, pakai `npm.cmd` sebagai pengganti `npm`.

Setiap push ke cabang `main` otomatis di-deploy ke Vercel.

## Isi folder

```
block-down/
  docs/
    prd/      DESIGN, SPEC, ARCHITECTURE, ROADMAP
    edd/      rancangan teknis rinci
  design/
    stitch/   ekspor Google Stitch: zip asli dan ekstrak per layar
  src/
    core/     logika permainan murni (tanpa DOM)
    input/    keyboard, DAS dan ARR
    render/   canvas: blok, ghost, pratinjau
    store/    penyimpanan dan rekor
    i18n/     kamus id dan en
    fonts/    Sora dan JetBrains Mono (OFL), self-host
  tests/      tes core dan klien (node:test)
  public/     ikon UI (Material Symbols, Apache 2.0)
```

Urutan baca dokumen: `docs/prd/DESIGN.md`, `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, lalu `docs/edd/`. Jika desain Stitch berbeda dari PRD, yang berlaku PRD. Setiap perbedaan dicatat di DESIGN.md bagian 9.1.

## Lisensi pihak ketiga

- Font Sora dan JetBrains Mono: SIL Open Font License 1.1 (`src/fonts/`).
- Ikon Material Symbols: Apache License 2.0 (`public/icons.svg`).
