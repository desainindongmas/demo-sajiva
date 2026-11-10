# Sajiva UI/UX refresh — Responsive Multi-device Workspace
Date: 2026-11-10
Status: **IMPLEMENTED IN SOURCE / LIVE BUILD NOT YET VERIFIED**

## Visual design
- New `AppShell`: persistent desktop sidebar, tablet compact icon rail, mobile slide-in drawer with backdrop and always-accessible 5-item dock.
- Light theme first. User-selectable dark theme saved in localStorage; surface, border, text, input, and status colors adapt together.
- Brand: Sajiva emerald, warm-neutral off-white, understated typography, Lucide vector icons, no emoji decoration.
- View-level navigation: Summary, Orders, Kitchen, Tables, Billing, Stock/Purchasing, Recipes/HPP, Production, Finance, Guided Demo. Only one workspace module is shown at once.
- Responsive topbar: role selector, data refresh, connectivity status, theme toggle.
- 390px phone, 820px tablet, 1440px desktop smoke scenarios added under `tests/live/sajiva.spec.ts`.
- Removed the old visible deployment diagnostic text; version remains in `meta[name=sajiva-release]` set to `g6-ux-responsive-20261110`.

## Efficiency workflows
- **Orders:** searchable menu tiles, quantity controls, add several menu items to a shared cart, one RPC for order creation, retained single-item addition to existing unpaid order.
- **Cashier:** select multiple ordinary unpaid bills, record atomic full-remaining dummy payments with one action; existing partial payments and per-item split bills remain. Quick amount presets: outstanding balance or 50%.
- **Purchasing:** queue multiple ingredients (qty and unit cost) with one receipt RPC, record WAC once transactionally, show sum before committing.
- **Stock opname and waste:** queue multiple inventory changes with individual stable request IDs; one atomic `record_demo_inventory_batch` RPC. A failed line rolls back entire batch.
- **Recipes/HPP:** queue multiple ingredient components for one menu and update in a single `set_demo_recipe_batch` RPC; clear queued components on changing the menu.
- **Inventory & production:** existing WIP and finished output forms preserved in compact modular workspace.
- **Owner:** quick shortcuts to Order, Billing, Inventory, and Analytics; summary cards and less navigation scrolling.

## Technical safeguards
- Existing tenant membership RLS remains.
- All existing dummy transaction endpoints remain server-side.
- Bulk checkout delegates to `complete_demo_payment` and respects request UUID idempotency.
- Bulk stock delegates to `record_demo_inventory_event` and preserves ingredient/quantity/reason/request-key validation.
- Bulk recipe delegates to `set_demo_recipe_line`, including existing waiting-kitchen safeguards.
- SQL tests (explicit BEGIN/ROLLBACK) passed for positive bulk inventory, batch recipe, and batch checkout cases, and for deliberate invalid second rows where no partial stock/payment changes were observed.

## Things still NOT confirmed
- Github Actions/Cloudflare build for latest commit (not independently readable from current GitHub connector).
- Actual browser rendering across devices and hCaptcha login.
- Full 15-scenario G6 regression and independent staff permissions.
- Multi-device *shared* live demo joining has not been implemented: each anonymous session is tenant-isolated. Responsive rendering across devices does not equal cross-device shared-session authorization.
- Advanced inventory approvals, refunds, and real payment settlement are not production-ready.

## Manual acceptance checklist when live deployment is available
1. Desktop 1440px: sidebar collapse/re-expand, module switch, role selector, theme toggle.
2. Tablet 820px: icon rail, module switch, content grid does not overflow.
3. Mobile 390px and 360px: bottom dock, drawer close-on-selection, no horizontal scrolling, forms and keypad fit.
4. Create a dummy session and submit 3 distinct menu items via cart; verify one order with 3 lines and correct amounts.
5. Submit 2 different purchase ingredients in one receipt; verify stock, WAC and ledger.
6. Submit 2 valid waste/opname lines as one batch; verify both commit.
7. Submit one valid and one invalid batch line; verify nothing commits.
8. Submit 2 recipe ingredients at once; verify both apply and menu HPP updates.
9. Bulk-pay 2 unpaid bills, then confirm no duplicates and proper payment status.
10. Verify cross-tenant reads fail, no Super Admin role in public demo, and prior G1/G2 operations remain functional.
