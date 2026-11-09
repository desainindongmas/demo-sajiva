# G2.2 — Recipe Management, Waste & Stock Opname

## Implemented
- Set or update a recipe ingredient quantity for one menu portion; remove a recipe ingredient.
- Protect recipes while pending kitchen items reserve their ingredients, preventing immediate reservation mismatch.
- Record waste using non-reserved physical stock; deny quantities exceeding on_hand minus reserved.
- Record physical stock opname with positive or negative difference, never below kitchen-reserved quantity.
- Append a stock movement, immutable inventory event, and audit event for each successful adjustment.
- Tenant-scoped, authenticated, security-definer RPCs and read-only RLS-protected inventory events.
- Request UUID is idempotent; an identical retry returns the original event; changed payload with same UUID is rejected.
- Owner/Manager can manage recipes, record waste/opname, and inspect the latest inventory adjustments.
- Database changes are in versioned SQL migrations under supabase/migrations.

## Database QA evidence
A rollback transaction exercised adding and removing a recipe line, wasting physical stock, exact replay of the same waste operation, rejecting reused request UUID with changed quantity, refusing waste above the unreserved stock, posting a stock count, creating an actual stock reservation from an order, refusing stock count below the reserved amount, and verifying ledger events.

First test attempt did not establish a nonzero reservation and therefore couldn't validate the below-reserved case; the test was corrected to reserve an ingredient through a real dummy order, and the corrected SQL transaction completed without error. No test records were committed.

## Live release and QA
Expected version marker: `Versi situs: G2.2 · Resep / Waste / Stock Opname`.
Owner or Manager should now see a new G2.2 form:
1. Add/update one ingredient quantity in a recipe. Confirm HPP changes.
2. Remove that recipe line. Confirm HPP changes accordingly.
3. Record 1 unit waste with a reason. Confirm stock decreases by 1 but reserved does not change.
4. Record stock opname to a quantity greater than or equal to the reserved amount; confirm physical stock matches the count.
5. Check the new adjustment history and refresh to confirm records persist.
6. Create an order with a waiting kitchen item; attempt to alter that recipe and confirm server rejection.
7. Try waste larger than available unreserved stock and a count below reserved; both must reject without modifying ledger.
8. Recheck G2.1 purchase/WAC as well as G1 POS, kitchen, table management, and billing.

## Limitations and next backlog
- G2.1 live gate has not been independently verified; user explicitly authorized continuing with G2.2.
- Browser automation is limited to public smoke checks and does not currently pass hCaptcha or run logged-in E2E.
- This is a demo with role switching, not independent employee authentication.
- Waste currently reduces available inventory immediately; cost snapshot is recorded but a full financial waste P&L is future scope.
- No batch tracking, expiry, inventory locations, approval workflow for high-value adjustments, or production conversion WIP/finished goods yet.
- Inventory is tenant-wide in G2.2, not branch-specific. Production branch-level separation requires further schema work.
- Do not mark G2.2 as fully released until live browser QA and previous regression gates pass.
