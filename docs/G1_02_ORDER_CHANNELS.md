# Sajiva G1 — Incremental operational extensions

Implemented after user-confirmed successful end-to-end flows (Waiter → Kitchen → Cashier → Table → Owner).

## Added
- Channel-aware ordering: dine-in requires a table; takeaway and manual delivery do not assign one.
- Order notes (max 500 characters).
- Add menu item to an active unpaid order, with recipe-based ingredient reservation and cost snapshot.
- Backend validation of tenant, branch, menu, stock, and order state before mutation.
- All changes saved as repeatable Supabase SQL migration in Git.

## Database integration test
Transaction test simulated authenticated access using the existing dummy demo account; verified:
1. Dine-in creation with notes.
2. Additional 2 Nasi Timbel to an initial order of 1 (expected total Rp105,000).
3. All order items advance to served, then dummy QRIS settlement.
4. Table cleaning and order completion.
5. A separate manual-delivery order has channel 'delivery'.
The test ran without SQL errors and ended with ROLLBACK; no test transactions persisted.

## Still pending before G1 completion
- Verify latest Cloudflare Pages build and real browser run.
- Multi-item cart before checkout (currently adds to active unpaid order).
- Table moves/merges and split bills.
- Owner/Manager approvals for cancellation after kitchen processing.
- Realtime subscriptions (currently polling).
- Expanded menu and recipe seed fixtures.
- Tests for cross-tenant isolation, concurrent additions, missing/oversold stock and exact idempotency under retries.
- Receipt preview and printing.

No production readiness claim. All records and payments remain simulated.
