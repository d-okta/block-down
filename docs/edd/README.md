# EDD BlockDown

Rancangan teknis rinci yang menjadi acuan langsung saat menulis kode. Diturunkan dari PRD di `docs/prd/` dan desain di `design/stitch/`.

| File | Isi | Dipakai di fase |
|---|---|---|
| `EDD-1-core.md` | Board, bentuk piece, tabel kick, 7-bag, gravitasi fixed-point, state, urutan `step()`, lock delay, T-Spin, skor, event, mode, 25 kasus tes | 1 |
| `EDD-2-klien.md` | Loop, input (DAS/ARR, sentuh, gamepad), render dan sprite, efek dan pool partikel, audio dan musik, UI dan dialog, aksesibilitas, i18n, penyimpanan, platform | 2, 3, 4 |
| `EDD-3-build.md` | Struktur repo, TypeScript, tes, Vite, aset, PWA, Android, perubahan dari PRD, verifikasi, deploy, listing | 1, 5, semua |

Urutan prioritas jika ada perbedaan: SPEC.md untuk aturan permainan, DESIGN.md untuk tampilan, EDD untuk cara membangun. Perubahan dari PRD yang dibuat EDD dicatat di `EDD-3-build.md` bagian 7.

Data yang masih ditunggu dari pemilik:
- (Selesai) Perangkat acuan: Samsung Galaxy A13, Android 14.
- Konsep ikon aplikasi (sebelum Fase 5).
