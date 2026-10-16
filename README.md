# BlockDown

Game puzzle blok jatuh untuk browser, dengan versi Android menyusul. Tenang saat bermain, dengan aturan modern: rotasi SRS, 7-bag, Hold, lima piece berikutnya, lock delay, T-Spin, dan Back-to-Back.

**Coba sekarang: https://block-down.vercel.app**

## Status versi uji

Ini versi uji (Fase 3 dari 6). Yang sudah bisa dicoba:

- Empat mode: Maraton (150 baris atau tanpa batas), Sprint 40, Ultra (2 menit), dan Zen.
- Keyboard, gestur sentuh di HP (hanya posisi tegak), dan gamepad.
- Pengaturan: DAS, ARR, kecepatan jatuh pelan, atur tombol keyboard, ghost, grid, mode aman buta warna, dan bahasa.
- Ghost piece, Simpan (sekali per piece), dan 5 piece berikutnya. Lock delay 400 ms.
- Skor lengkap: Single sampai 4 Baris, T-Spin dan Mini, Back-to-Back, Combo, Bersih Total.
- Jeda, Game Over dengan statistik, dan rekor pribadi per mode yang tersimpan di browser.
- Bahasa Indonesia dan Inggris.

Belum ada di versi ini:

- Animasi saat menghapus baris, suara, musik, dan getar.
- Aplikasi Android dan pemasangan sebagai aplikasi (PWA).

Urutan pengerjaannya ada di [docs/prd/ROADMAP.md](docs/prd/ROADMAP.md).

## Kontrol

| Aksi | Keyboard (bisa diubah) | Gamepad | Gestur |
|---|---|---|---|
| Geser | â† â†’ | D-pad kiri/kanan, stik | Seret ke samping |
| Jatuh pelan | â†“ | D-pad bawah | (tidak ada) |
| Jatuh cepat | Space | D-pad atas | Seret ke bawah |
| Putar kanan | X atau â†‘ | A | Ketuk |
| Putar kiri | Z atau Ctrl | B | Ketuk dua jari |
| Simpan | C atau Shift | LB atau RB | Seret ke atas |
| Jeda | Esc atau P | Start | Tombol jeda |

Di HP, gestur bisa dilakukan di mana saja di layar permainan, tidak harus di atas papan.

## Menjalankan di komputer sendiri

Butuh Node 22.18 atau lebih baru.

```
npm install
npm run dev       # buka http://localhost:5173
npm run check     # TypeScript + 48 tes
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
    input/    keyboard, sentuh, gestur, gamepad, DAS dan ARR
    render/   canvas: blok, ghost, pratinjau
    ui/       layar Pengaturan
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
