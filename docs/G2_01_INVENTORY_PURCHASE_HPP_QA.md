# Sajiva G2.1 — Inventory, Purchasing, Weighted Average and Recipe HPP

## Scope delivered
- Server RPC `receive_demo_purchase`: receive 1–30 dummy ingredient lines atomically, validate tenant/supplier/branch, record a single purchase and its lines, append purchase entries to stock ledger, update physical stock and weighted-average ingredient cost.
- Idempotent request UUID; exact replay returns the original receipt. Reusing the UUID for changed item quantities/costs rejects the new request.
- Weighted-average cost calculated as `round((old_on_hand * old_avg_cost + received_qty * unit_cost)/(old_on_hand + received_qty), 2)` matching physical database precision. Maximum 3 decimal places for quantities and 2 for unit costs.
- `demo_menu_hpp` is a read-only RLS invoker view estimating menu ingredient cost and gross margin using current ingredient costs and recipe quantities.
- Owner/Manager demo screen: select ingredient/supplier, receive dummy stock, inspect available stock, reserved quantities, cost, recent purchase totals, and per-menu HPP.
- Realtime table publications include purchases and ingredients; 20-second fallback polling remains in client.

## Database QA performed
Transactional rollback tests (no persisted fixture writes) verified:
- Receipt adds expected physical stock and inserts one purchase movement.
- Weighted average equals 2-decimal formula.
- Exact repeated request key does not duplicate stock.
- A request key replay with changed purchase quantity is rejected.
- Unsupported precision is rejected.
- HPP view is visible to authenticated demo user.

## Remaining G2 gates
- Browser build and deployment verification: marker `Versi situs: G2.1 · Inventory / Pembelian / HPP`.
- Manually/automatically verify Owner/Manager receipt and HPP changes on Cloudflare Pages.
- More complete recipe editor (UI), supplier purchase order lifecycle, partial receiving, batch expiry, waste and stock-opname.
- Tenant isolation and multi-user concurrency tests.
- HPP estimation caveat: menus with missing recipes can show zero ingredient cost. This must NOT be interpreted as real profitability.
- Stock and HPP figures are pilot demo only, not financial accounting.
- Do not proceed to G2.2 until required live test and regression gate is met.

## Suggested G2.1 live check
1. Select Owner, start or restore an authenticated demo session, confirm G2.1 marker.
2. In G2.1 inventory section, record starting on_hand and avg_cost for Ayam ungkep.
3. Receive 10 pcs at Rp20,000/pcs from a dummy supplier.
4. Verify on_hand increases by 10, reserved remains unchanged, displayed avg_cost matches weighted average (2 decimals in DB).
5. Verify Nasi Timbel estimated ingredient HPP changes; ensure old order prices and existing payment ledger do not change.
6. Refresh browser; purchase and stock should persist in the same demo session.
7. Repeat with a different purchase; verify correct cumulative weighted average.
8. Regress Waiter → Kitchen → Cashier and multi-table/split-bill dummy flows.

This module is **G2.1 implementation**, NOT a claim of full G2 release or live QA PASS.
