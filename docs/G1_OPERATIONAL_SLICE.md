# Sajiva G1 — Operational demo slice

## Implemented in this slice
- Waiter/Cashier/Manager: create dummy order with selected menu, quantity and table.
- Kitchen/Manager: per-item status waiting → preparing → ready → served.
- At the first transition to preparing, reserved ingredients are consumed once on the server.
- Cancel waiting unpaid items only, with inventory reservation released and simulated order total corrected.
- Cashier/Manager: dummy cash, QRIS, transfer, COD payments with partial payments supported through the backend.
- Table status: occupied → payment or cleaning as appropriate → available after cleaning confirmation.
- Owner/Manager: initial live summaries of orders and dummy payments (not final accounting or profit analytics).
- Isolated demo sessions retain a session reference across page reloads in the same browser tab.

## Browser test (after Cloudflare deployment)
1. Complete hCaptcha → create demo session.
2. Select Waiter and order 1 Nasi Timbel Komplit for Meja 01.
3. Select Kitchen and click status successively to Preparing, Ready, Served.
4. Select Cashier and record a Rp10,000 dummy payment then the remaining amount.
5. Verify the order is completed; select Waiter, mark the table cleaned.
6. Select Owner and observe the updated dummy payment summary.
7. Refresh the browser; the session should restore.
8. Try an unavailable quantity and ensure the server rejects it without partial stock mutation.

## Important limitations / not yet a production feature
- The role selector is **public demo simulation**, not role authentication.
- The demo is still a single-user session; collaborative session joining is not yet implemented.
- Order editing, split bill, refunds, dine-in/takeaway/delivery customization, complete menu catalog, multi-station KDS, supplier purchasing, stock opname, and real profit analytics are not yet complete.
- This initial G1 UI uses 8-second refresh, not Supabase Realtime subscriptions.
- There is no real payment gateway, invoicing, or money transfer.
- Customer-facing E2E and concurrency testing is pending; backend functions have been deployed but frontend build and interaction have not been independently verified.
- Keep dummy data only. No production signoff.

## Next work
- Verify GitHub CI build and Cloudflare deployment.
- Exercise the browser steps and capture actual errors, if any.
- Add more realistic seed menu ingredients and recipes.
- Complete order editor, safe cancellation/refund workflow, channel selection, richer KDS, and realtime.
- Perform tenant-isolation and concurrency tests before declaring G1 finished.
