# SAJIVA — Laporan Audit Gabungan G0–G6
**Tanggal:** 10 November 2026, Asia/Jakarta  
**Status:** **HOLD — belum dapat dinyatakan matang / DEMO v1.0 PASS**

## Ruang lingkup dan metode
Audit mengacu pada `SAJIVA_MASTER_BLUEPRINT_DEMO_V1.0.md` (15 skenario inti S01–S15 dan kriteria keluar G0–G6). Pemeriksaan dilakukan terhadap source GitHub, skema/RPC Supabase, dan serangkaian transaksi dummy terisolasi yang dibatalkan via `ROLLBACK`.

**Batas verifikasi:** Live URL `https://demo-sajiva.pages.dev` tidak dapat dijangkau oleh lingkungan browser/network yang tersedia (DNS gagal di container, web preview tidak tersedia). GitHub connector tidak memberikan hasil push Actions/CI (`statuses: []`, workflow runs untuk commit tidak dapat ditampilkan). Karena itu **build akhir, deployment hash Cloudflare, dan E2E hCaptcha tidak diklaim lulus**.

## Temuan diperbaiki
1. **P1 — Payment idempotency lintas-order:** RPC `complete_demo_payment` sebelumnya mengembalikan payment ID dari order A ketika request UUID yang sama dipakai untuk order B. Kasus direproduksi dalam rollback SQL lalu diperbaiki: request key kini harus cocok pada order, amount, method, status. Pengulangan identik tetap idempotent; lintas-order dan perubahan nominal ditolak. Migration: `20261110_g6_fix_payment_idempotency_cross_order.sql`. GitHub commit `c960400`.
2. **P2 — Kunci retry frontend:** POS dan cashier kini me-reset request UUID jika menu, channel, quantity, notes, table, payment order, amount, atau method diedit sebelum retry. GitHub commit `fd7ac40`.
3. **P1 QA infrastructure — live smoke tidak berjalan saat source berubah:** `.github/workflows/live-smoke.yml` diperbaiki untuk mengamati perubahan `src/**`, `index.html`, aset, serta menunggu Cloudflare menayangkan penanda versi G5 sebelum tes browser. GitHub commit `d67933d`.

## Database transaction checks yang berhasil (di-ROLLBACK, tanpa transaksi sungguhan)
- Alur gabungan dine-in: buat order 2 porsi, tambah 1 item, attach meja kedua, kitchen `waiting→preparing→ready→served` untuk kedua baris, bayar dummy Rp10.000+Rp8.000, status selesai, kedua meja cleaning/available, financial view sama dengan pembayaran.
- Payment request UUID: exact replay → ID sama; replay pada order lain dan nominal berubah ditolak; tidak ada pembayaran ganda.
- Tenant isolation: JWT demo A tidak dapat membaca orders/ingredients milik demo B; RPC pembuatan SKU pada demo B ditolak.
- Produksi dua tingkat raw → WIP → finished: konsumsi stok mentah, kuantitas WIP tersisa, hasil jadi, cost output dan ledger diverifikasi; overproduction dan replay berbeda ditolak.
- Biaya operasional dummy: exact retry idempotent; perubahan nominal dengan key sama ditolak; daily operating-result view mencakup biaya.
- Pemeriksaan P1/G1–G2 sebelumnya ada di dokumen fase, tetapi bukan bukti eksekusi ulang di browser.

## Matrix 15 skenario blueprint
| Scenario | Status gate | Catatan |
| --- | --- | --- |
| S01 Waiter dine-in | DB PASS / browser BLOCKED | Lifecycle kitchen, tagihan, meja diuji |
| S02 Takeaway cashier | DB tested previously / browser BLOCKED | Perlu uji E2E |
| S03 Manual delivery COD | PARTIAL | Kanal delivery dan pembayaran dummy ada; status pengiriman khusus belum lengkap |
| S04 Split bill | DB tested previously / browser BLOCKED | Alokasi berdasarkan porsi; nominal bebas/per tamu belum |
| S05 Mixed/partial payment | DB PASS / browser BLOCKED | Dua metode dummy dan total cocok |
| S06 Edit/cancel setelah memasak | PARTIAL | Persetujuan pembatalan ada; editing/adjustment lanjutan belum lengkap |
| S07 Low stock & sold out | PARTIAL | Reservasi dan low stock; kalkulasi automated sold-out/available servings belum lengkap |
| S08 Supplier purchasing | PARTIAL | Direct receipt & WAC ada; PR/PO, GRN parsial dan payable belum lengkap |
| S09 Production | DB PASS / browser BLOCKED | Konversi raw/WIP/finished; actual yield, versioning belum lengkap |
| S10 Stock opname | PARTIAL | Adjustment ledger ada; approval + concurrent count reconciliation belum lengkap |
| S11 Shift close | NOT IMPLEMENTED | `cash_shifts` table ada, workflow open/close/variance belum |
| S12 Refund | NOT IMPLEMENTED | Partial/full reversal ledger dan anti-double-refund belum |
| S13 Profit analytics | PARTIAL | Gross/operating estimates ada; discount/tax, full cost, margin snapshots belum lengkap |
| S14 Approval & audit | PARTIAL | Cancel approval/audit ada; role switch bukan identitas staf dan granular permissions belum |
| S15 Multi-device reconnect | BLOCKED | Realtime infrastructure ada; collaborative join dan browser E2E belum diverifikasi |

## Blueprint completeness findings
- Seed yang diperiksa pada satu demo tenant: **2 menu, 1 bahan, 1 baris resep, 3 meja, 2 supplier**. Target blueprint: ±45 menu, ±65 bahan, ≥45 resep, 20 meja, 8 supplier, 30 hari histori dan tiga preset deterministik. **Belum memenuhi target.**
- G5 guided flow saat ini navigasi role berbasis klik; belum menunggu aksi yang dikonfirmasi server seperti persyaratan guided scenario.
- G0 reset sesi dan tiga preset deterministik belum lengkap.
- Preview white label dan offline draft recovery belum lengkap.
- Cash shift, full refund, partial GRN, tax/service/discount snapshot dan refund reconciliation belum lengkap.
- Public demo role switch belum menjadi kontrol server per persona; jangan pakai untuk data bisnis nyata.
- Backend memiliki migration RLS read-only dan member-checked RPC, tetapi pentest, concurrency/load, dan review security penuh belum lulus.

## Penilaian kelayakan
- **Prototipe untuk diskusi fitur:** tersedia (dengan data dummy; versi terbaru masih harus diverifikasi live).
- **Demo v1.0 sesuai locked blueprint:** **BELUM LULUS**.
- **Siap production / menerima pembayaran nyata:** **TIDAK**.
- G6 tidak boleh dinyatakan PASS hanya karena G0–G5 memiliki kode atau karena dashboard menampilkan label G5.

## Pekerjaan berikutnya sebelum final sign-off
1. Tutup gap P1 S11/S12 (cash shift/refund), PR/PO/partial GRN, pricing/discount/tax rules dan approved adjustments.
2. Seed tiga preset/15 skenario deterministik dengan data contoh yang memadai, serta reset per-session.
3. Lengkapi delivery, receipt/print dan guided scenario server acknowledgement.
4. Jalankan `npm run build` dan Playwright live smoke di GitHub Actions; ambil run ID, log/artefak serta Cloudflare deployed commit.
5. Sediakan fixture auth khusus staging untuk E2E tanpa bypass hCaptcha production; jalankan semua 15 skenario, tenant isolation dan concurrency.
6. Re-run P0/P1 regression setelah perbaikan; dokumentasikan bukti sebelum keputusan final PASS.

**Larangan laporan:** jangan menyebut demo sudah matang/siap rilis sampai bukti E2E dan persyaratan blueprint terpenuhi.
