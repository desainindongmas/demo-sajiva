# G6 — Sajiva Consolidated QA & Release Gate

## Status
**PREPARED / NOT EXECUTED.** The user has explicitly deferred consolidated live testing until the build stages are created. This document prepares the release checklist; it does not prove readiness.

## Automated gates already in repository
- `.github/workflows/ci.yml`: `npm install` then TypeScript/Vite build on push/PR.
- `.github/workflows/live-smoke.yml`: Playwright public page, G5 version marker, role switch and hidden Super Admin checks.
- `tests/live/sajiva.spec.ts`: public non-login browser smoke checks (requires reachable deployed Cloudflare Pages).
- DB migration files: `supabase/migrations/`.
- Transactional rollback scenarios have been run by the developer for critical G1, G2 and G3/G4 slices; these are NOT a complete automatic regression suite.

## Consolidated release acceptance cases
| Area | Must pass |
| --- | --- |
| Deployment | Correct commit, main branch, expected build hash, G5 release marker |
| Auth | hCaptcha anonymous session succeeds; reload restores same tenant |
| RLS | Tenant A cannot view or mutate tenant B |
| POS | All order channels, notes, quantity validation, add-to-open-order |
| Kitchen | queued → preparing → ready → served, reserved material consumed exactly once |
| Cashier | dummy full/partial/item split, request-key idempotency, no overpayment |
| Dining tables | move, attach free table, prevent duplicate bills, cleaning and release |
| Cancellation | waiting cancel releases reservation, preparing/ready needs approval, paid item requires refund workflow |
| Purchase | receipt adjusts physical stock, weighted-average cost, HPP; duplicate receipt rejected |
| Recipe | edit component, read HPP, prevent recipe change while waiting reservations |
| Inventory | waste ≤ available free stock, stock count ≥ reservations, immutable ledger |
| Production | raw → WIP → finished stock conservation, weighted output cost, idempotency |
| Expenses | dummy rent/utilities/other expense, correct operating result including expense-only days |
| Analytics | owner totals, daily/channel mix, stock alert, no label of net audited profit |
| Guided demo | all five role steps work on desktop and mobile |
| Reliability | retry/reload, network loss, realtime fallback, multi-tab conflicts |
| UX | mobile readability, labels, no unexpected overflow, accessible navigation |

## Release blockers
Any failure of payment idempotency, stock reservation invariants, tenant separation, RLS, build/deployment, or data mutation atomicity blocks the release.

## Known non-MVP production requirements
Independent staff authentication and permissions, real gateways/refund flows, fiscal tax/accounting, multi-branch stock locations, recipe batch expiry/lot tracing, procurement approvals, offline operations, and compliance reviews remain separate implementation work. This is only a simulated pilot demo.

## Evidence expected when user activates QA later
Attach actual CI run links, Cloudflare deployed commit, tests with timestamps, relevant logs/screenshots, failed case reproduction, fix commit, and final re-run outcome. Do not change PASS status without observed evidence.
