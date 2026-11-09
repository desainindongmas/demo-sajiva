# Sajiva — G1.4 Advanced Order & Table Management (first slice)

## Implemented
- Move one active dine-in order to a different **available** table within the same organization/branch.
- Preserve the order's ID and payment ledger, update its assigned table, release the prior table if no other active order is using it, and record an audit event.
- Kitchen: request cancellation of an item already preparing or ready, with mandatory reason.
- Manager (public demo role switch): approve or reject a pending cancellation. Server RPC requires an authenticated Owner/Manager *membership*. The current demo session has a real authenticated Owner membership; role switching itself is not an authorization mechanism.
- Approved cancellation reduces the **unpaid** simulated order balance. Ingredients already consumed are **not** returned to stock.
- Reject cancellation leaves order item and stock unchanged.
- Any existing simulated payment prevents this cancellation path; refund workflow is separate.
- Realtime subscription also observes pending approval requests.
- All requests and decisions are stored in audit events.

## Verified at database level
A transaction-scoped integration scenario (rolled back) exercised creation, changing tables, kitchen preparing state, requested and approved cancellation, unchanged consumed-stock deduction, zeroed order total, and table cleaning requirement. No transaction fixtures were committed.

## Browser verification after fresh Cloudflare deployment
1. Confirm footer HTML says `Versi situs: G1.4`.
2. Create a new dine-in order as Waiter.
3. Use `G1.4 · Pindah meja` to move it to a different available table.
4. Change to Kitchen and progress the item to `Memasak`.
5. Enter an approval reason (4+ characters) and request cancellation.
6. Change to Manager, approve or reject the pending request.
7. Check order total and table state; if approved after preparing, table requires cleaning.
8. Test cancellation of a **partially paid** order: must be blocked until refund workflow exists.

## Not yet complete
- Merge tables under one bill, and split bill.
- Advanced order amendments after kitchen starts, refund approvals, and policy-driven manager controls.
- Independent Manager accounts: current role switcher is a demo simulation only.
- Multi-device Guided Presentation sharing.
- Automated end-to-end, cross-tenant and concurrency validation.
- Production-grade audit, monitoring, permissions and cost analytics.

No production readiness claim. Data and payments remain dummy.
