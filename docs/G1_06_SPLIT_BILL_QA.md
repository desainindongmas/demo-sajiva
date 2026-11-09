# Sajiva G1.6 — Split Bill / Advanced Billing (demo)

## Implemented
- Cashier/Manager can choose an unpaid order, pick a menu line, pay 1..remaining quantity, and choose cash, dummy QRIS, dummy transfer, or dummy COD.
- One original order, one item/stock ledger; split bill is a set of payment allocations, **not** duplicate orders.
- Server derives exact amount from order-item immutable unit price x quantity. Client cannot supply a discounted amount.
- Server locks the order and item, checks item and tenant membership, prevents quantity or amount overpayment, and uses a request UUID for safe retries.
- Existing general partial payments cannot be reallocated to item-level checkout. Once item allocations exist, the generic payment path is blocked for that order to avoid double collection.
- Cancellation after a split payment requires a separate refund workflow; existing cancellation RPCs reject paid orders.
- New RLS-protected `demo_item_payment_allocations` table is included in Supabase Realtime.
- The demo has no actual payment gateway.

## Database tests completed (transaction rollback)
- Three portions in one takeaway order.
- Pay one portion with dummy cash; repeat the same request UUID and confirm the same payment ID is returned.
- Assert exactly one payment row after repeat.
- Attempt to pay three more portions; confirm rejection.
- Attempt generic payment after starting itemized checkout; confirm rejection.
- Pay remaining two portions with dummy QRIS.
- Verify order paid, summed payment amounts equal order total, and exactly three quantities allocated.
- All test writes rolled back.

## Live and build QA
The live smoke test expects HTML `Versi situs: G1.6`. Its execution result and browser E2E through hCaptcha have **not** been verified from the connected tools.
The user should not mark G1.6 PASS solely from database tests; project quality gate remains HOLD until both live and regression evidence exist.

## Live QA scenario
1. Confirm Cloudflare deployed the G1.6 commit and the HTML version marker reads G1.6.
2. Create a new demo and choose Waiter; place a takeaway order with quantity **3** of Nasi Timbel Komplit (expected Rp105.000 if base demo price is unchanged).
3. Choose Cashier -> G1.6 Split Bill; select the order, menu item, quantity **1**, and cash; submit. Verify paid Rp35.000 and remaining Rp70.000.
4. Select the same order and item, quantity **2**, dummy QRIS; submit. Verify paid Rp105.000 total and zero remaining.
5. Verify no duplicate payment rows in billing preview, then move to Kitchen, advance all remaining items as normal; order completion should work.
6. Verify general payment cannot duplicate an itemized payment (the UI may not hide the option, but the backend must reject it).
7. Test an order with a **previous generic partial payment**; itemized split should be unavailable.
8. Check prior G1.1–G1.5 scenarios and tenant boundaries.

## Deferred
- Discount/tax/service-charge allocation rules and per-guest invoice presentation.
- True multiple-party checkout and receipt printing.
- Refund/void procedures.
- Server-side independent cashier/manager role permissions in production.
- Real-payment settlement and cash drawer reconciliation.
