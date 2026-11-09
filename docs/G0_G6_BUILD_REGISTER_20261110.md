# Sajiva — G0–G6 Build Register (2026-11-10)

This is the build inventory of a **dummy-data demo MVP**, not production or live-QA certification.

## Build slices

| Gate | Implemented demo capability | Outstanding |
| --- | --- | --- |
| G0 | React/Vite/Cloudflare architecture, anonymous hCaptcha demo session, Supabase isolated organizations and RLS | hardening, production multi-tenant auth |
| G1.1–G1.3 | Waiter POS, dine-in/takeaway/manual delivery, kitchen, simulated payment, table lifecycle, realtime and retry keys | independent staff identities, offline sync |
| G1.4–G1.6 | Move table, manager-approved cancellation, attach spare table to one order, item quantity split payments | merge two already-open bills, approvals with individual manager accounts, refund and actual settlement |
| G2.1 | Atomic purchase receipt, weighted average cost, recipe-based HPP view | PO approvals, partial goods receipts, supplier invoice reconciliation |
| G2.2 | Recipe line editing, waste, stock opname, audit ledger and reservation checks | stock count approvals, expiry and batch/location tracking |
| G2.3 | Raw/WIP/finished SKU creation, production bill-of-materials, one-step atomic conversion with input costs | multi-step production jobs, yield losses, byproducts and production scheduling |
| G3 | Simulated payment tracking, invoice-level financial view, operating expense entry, estimated operating result | validated accrual accounting, real payments, refunds, tax/discount allocation policy |
| G4 | Owner revenue/cost/receivable metrics by day and order channel, menu estimated HPP | advanced historical benchmarks, export, budgets and alerts |
| G5 | Guided demo step navigation across Owner, Waiter, Kitchen, Cashier and Manager | polished onboarding, multi-device sharing, embedded guided annotations |
| G6 | React build workflow, Playwright public smoke workflow, testing documents and acceptance gates | comprehensive browser E2E with authenticated/hCaptcha fixture, regression, cross-tenant concurrency, real deploy signoff |

## Quality gate policy for later user-requested consolidated QA
1. Confirm GitHub `main`, Cloudflare deployment hash and expected release marker.
2. Build React + TypeScript and review browser errors.
3. Execute G0–G5 E2E once in a dedicated dummy tenant: session → POS → Kitchen → Cashier → invoice → table clean.
4. Test G1.4–G1.6 table sharing, cancellation approval, partial and itemized payments, and duplicate request keys.
5. Test G2.1–G2.3 purchase/WAC → recipe edit → waste/opname → WIP production → HPP.
6. Test G3 operating expenses and G4 financial calculation using known fixtures. Verify zero-order expense dates.
7. Test G5 role navigation, mobile viewport, latency and accessible controls.
8. Test failed/malicious operations (cross-tenant, unauthorized roles, overselling, reserved stock, overpayment, duplicate requests, concurrent updates).
9. Review SQL privileges and audit trails. Demo role buttons are NOT authorization: backend remains tenant membership only.
10. Block production readiness until every P0/P1 defect is corrected and E2E evidence is recorded.

## Known demo constraints
- Public role switcher shows workflows; it does not grant or enforce independent employee roles.
- All monetary and stock activities use **dummy** data only, no real payment gateway.
- Historical cost estimates are limited by order-time snapshots and recipe completeness; operating result is not audited profit.
- All inventory storage is currently organization-wide, not per branch or stock location.
- Site access through an interactive browser/hCaptcha is not guaranteed by the GitHub and Supabase connectors alone.
- Build success, Cloudflare publication, and actual user flow are independent conditions and must each be verified.
- User requested to defer the final combined G0–G6 live QA until after the build passes are implemented. Do not label them PASS prematurely.

## Latest build
The application is intended to display `Versi situs: G5 · Produksi / Keuangan / Owner Analytics / Guided Demo`.
G6 is the **final QA/release gate**, not an extra feature generation stage.
