# G1.3 — Realtime operational sync (demo)

Changes pushed to branch `main`:
- Enabled `supabase_realtime` publication for the RLS-protected `orders`, `order_items`, `dining_tables`, and `payments` tables.
- Frontend subscribes to PostgreSQL change events filtered by its own `organization_id`.
- On any change, frontend reloads session-scoped operational data. A 20-second polling fallback remains for disconnected websocket environments.
- Added visible sync status and G1.3 release marker.
- POS order and simulated payment now reuse their request UUID on retries to reduce duplicate creations from transient network errors.

## Browser acceptance test (not yet verified)
1. Wait for Cloudflare Pages deployment commit `f9e2cd2`.
2. Open the same browser session, create a dummy order as Waiter.
3. Change to Kitchen and check the new order appears. Kitchen status changes should update the order list.
4. Change to Cashier; perform partial and final *dummy* payments.
5. Observe the Owner dashboard update and table status.
6. Inspect browser console for WebSocket errors if sync status is not "Realtime aktif".
7. Test page reload; the same demo session should recover.

## Constraints and pending work
- Realtime is limited to users who are already authorized for a demo tenant. Anonymous sign-in on another device creates a different identity and cannot join an existing session yet.
- Role Switcher is a public simulation, not user role authorization.
- A passing database migration is not a passing frontend build; Cloudflare deployment and end-to-end tests remain to be verified.
- Browser security and cross-tenant/concurrency tests are required before production.
- No real money or customer data; no production deployment is implied.
