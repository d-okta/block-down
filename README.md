# BlockDown

Game puzzle blok jatuh untuk browser. Tenang saat bermain, meriah saat kamu menghapus banyak baris sekaligus. Aturannya modern: rotasi SRS, 7-bag, Simpan, lima piece berikutnya, lock delay, T-Spin, dan Back-to-Back.

**Main sekarang: https://block-down.vercel.app**

Bisa dipasang ke layar utama HP atau komputer, lalu dimainkan tanpa internet.

## Fitur

- Empat mode: Maraton (150 baris atau tanpa batas), Sprint 40, Ultra (2 menit), dan Zen (tanpa kalah, tanpa waktu).
- Kontrol keyboard, gestur sentuh di HP (posisi tegak), dan gamepad.
- Efek bertingkat setiap menghapus baris, dengan momen khusus untuk 4 Baris, T-Spin, dan Bersih Total, serta getar di HP.
- Suara dan musik latar, dengan volume Musik dan Efek yang bisa diatur.
- Ghost piece, Simpan (sekali per piece), dan 5 piece berikutnya.
- Skor lengkap: 1 sampai 4 Baris, T-Spin dan Mini, Back-to-Back, Combo, Bersih Total.
- Rekor pribadi per mode, tersimpan di perangkat.
- Pengaturan: DAS, ARR, kecepatan jatuh pelan, atur tombol keyboard, ghost, grid, mode aman buta warna, intensitas efek, kurangi animasi, getar, dan bahasa.
- Bahasa Indonesia dan Inggris.

Semua data (rekor dan pengaturan) hanya disimpan di browser perangkatmu. Tidak ada akun, iklan, atau data yang dikirim ke server.

## Memasang ke layar utama

**Android (Chrome):** buka https://block-down.vercel.app, tunggu menu tampil, ketuk menu ⋮, lalu pilih **Instal aplikasi** atau **Tambahkan ke layar utama**.

**iPhone (Safari):** buka alamat yang sama, ketuk tombol Bagikan, lalu pilih **Tambah ke Layar Utama**.

**Komputer (Chrome atau Edge):** klik ikon pasang di ujung kanan bilah alamat.

Setelah kunjungan pertama, game, font, dan suara tersimpan di perangkat, jadi bisa dimainkan dalam mode pesawat. Saat online, versi terbaru otomatis dipakai.

## Kontrol

| Aksi | Keyboard (bisa diubah) | Gamepad | Gestur di HP |
|---|---|---|---|
| Geser | ← → | D-pad kiri/kanan, stik | Seret ke samping |
| Jatuh pelan | ↓ | D-pad bawah | (tidak ada) |
| Jatuh cepat | Space | D-pad atas | Banting ke bawah |
| Putar kanan | X | A | Ketuk |
| Putar kiri | Z | B | Ketuk dua jari |
| Simpan | ↑ | LB atau RB | Banting ke atas |
| Jeda | Esc atau P | Start | Tombol jeda |

Di HP, gestur bisa dilakukan di mana saja di layar permainan, tidak harus di atas papan. Geser lalu banting ke bawah bisa dilakukan tanpa mengangkat jari.

## Menjalankan di komputer sendiri

Butuh Node 22.18 atau lebih baru.

```
npm install
npm run dev       # buka http://localhost:5173
npm run check     # TypeScript + 59 tes
npm run build     # hasil di dist/
```

Di Windows PowerShell yang memblokir skrip, pakai `npm.cmd` sebagai pengganti `npm`.

Setiap push ke cabang `main` otomatis di-deploy ke Vercel. Service worker hanya aktif di HTTPS, jadi mode offline tidak berjalan di `localhost`.

Tambahkan `?perf` di akhir alamat untuk menampilkan panel ukur performa (fps, frame tersendat, waktu kerja per frame, memori).

## Isi folder

```
block-down/
  docs/
    prd/        DESIGN, SPEC, ARCHITECTURE, ROADMAP
    edd/        rancangan teknis rinci
  design/
    stitch/     ekspor Google Stitch: zip asli dan ekstrak per layar
    app-icon/   sumber SVG ikon aplikasi dan generatornya
  src/
    core/       logika permainan murni (tanpa DOM)
    input/      keyboard, sentuh, gestur, gamepad, DAS dan ARR
    render/     canvas: blok, ghost, pratinjau, efek, partikel
    audio/      pemutar suara dan musik
    ui/         layar Pengaturan, callout
    store/      penyimpanan dan rekor
    platform/   getar
    i18n/       kamus id dan en
    fonts/      Sora dan JetBrains Mono, self-host
  tests/        tes core dan klien (node:test)
  public/
    sfx/        efek suara dan musik
    app-icon/   ikon aplikasi (PNG)
    icons.svg   ikon UI
    sw.js       service worker (offline)
```

Urutan baca dokumen: `docs/prd/DESIGN.md`, `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, lalu `docs/edd/`.

## Lisensi pihak ketiga

- Efek suara: Kenney (www.kenney.nl), CC0 1.0.
- Musik "Crystal Cave (song18)": cynicmusic, OpenGameArt, CC0 1.0.
- Font Sora dan JetBrains Mono: SIL Open Font License 1.1 (`src/fonts/`).
- Ikon Material Symbols: Apache License 2.0 (`public/icons.svg`).

Rincian file suara ada di `public/sfx/LISENSI.txt`.
