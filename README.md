# BlockDown

Game puzzle blok jatuh untuk web (PWA) dan Android (Capacitor). appId `com.nusavisionmedia.blockdown`.

Status: Fase 2 berjalan. Maraton bisa dimainkan di browser dengan keyboard.

```
npm install
npm run dev       # buka http://localhost:5173
npm run check     # tsc + 39 tes
npm run build     # hasil di dist/
```

Kontrol: panah kiri/kanan geser, panah bawah jatuh pelan, Space jatuh cepat, X atau panah atas putar kanan, Z atau Ctrl putar kiri, C atau Shift simpan, Esc atau P jeda.

Butuh Node 22.18 atau lebih baru. Di Windows PowerShell yang memblokir skrip, pakai `npm.cmd`.

## Isi folder

```
block-down/
  README.md
  docs/
    prd/
      DESIGN.md         arah visual, layar, motion, kontras, checklist
      SPEC.md           aturan permainan, skor, mode, kontrol, suara, penyimpanan
      ARCHITECTURE.md   stack, struktur kode, loop, render, tes, performa
      ROADMAP.md        fase kerja dan kriteria selesai
    edd/
      README.md         peta EDD
      EDD-1-core.md     logika permainan dan tes
      EDD-2-klien.md    loop, input, render, efek, audio, UI, i18n, simpan
      EDD-3-build.md    proyek, build, PWA, Android, verifikasi, deploy
  src/
    core/               logika permainan murni (tanpa DOM)
    i18n/               kamus id dan en
  tests/
    core.test.ts
  design/
    stitch/
      stitch_blockdown_mobile_puzzle_ui.zip   ekspor asli, tidak diubah
      00-design-system/  dokumen sistem desain dari Stitch
      01-menu/           acuan Menu
      01-menu-ditolak/   tidak dipakai, alasannya di DESIGN.md 7.1
      02-game/
      03-quad/
      04-pause/
      05-game-over/
      06-pengaturan/
```

Setiap folder layar berisi `screen.png` dan `code.html` dari Stitch.

## Urutan baca

1. `docs/prd/DESIGN.md`, lalu `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`.
2. `design/stitch/` sebagai acuan visual. Jika Stitch dan PRD berbeda, yang berlaku PRD. Setiap perbedaan dicatat di DESIGN.md bagian 9.1.
3. `docs/edd/`. EDD menjadi acuan langsung untuk menulis kode, mulai dari Fase 1 di `docs/prd/ROADMAP.md`.
