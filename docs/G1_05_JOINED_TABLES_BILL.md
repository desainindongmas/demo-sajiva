# G1.5 — Joined tables and itemized bill (demo)

## Implemented
- `demo_order_tables` records extra physical tables sharing one active dine-in order and one payment ledger. Row Level Security (RLS) enabled.
- `attach_demo_table` checks active demo membership, same branch, table availability, and existing active bills.
- Main table stays `orders.table_id`; attached tables refer to the same order without duplicating the order, order items, or payments.
- Transaction states propagate to attached tables: during active service the table is occupied; after paid status it is awaiting payment/settlement handling; upon completed/cancelled it requires cleaning.
- Explicit cleaning confirmation returns the table to available.
- Existing move-table RPC cannot move the primary table while the order has attachments.
- Database insert trigger prohibits creating another independent bill on a table already used by a different active bill (including joined tables).
- UI adds a table-join selector to Waiter/Manager, itemized bill preview to Cashier/Manager/Owner, and historical line prices from `order_items.unit_price`.
- Partial payments with multiple simulated payment methods remain tied to one order.

## Tests executed
Database transaction-scope tests (ROLLBACK):
1. New dine-in order with table A; attach available table B.
2. Assert B occupied, refuse moving the primary when joined.
3. Kitchen prepares, readies, serves; dummy split payments settle a single total.
4. Assert B enters cleaning, clean both tables, B returns available.
5. Attempt to start an independent second bill on attached B and assert rejection.

These SQL tests returned without errors; browser E2E and GitHub CI results are not independently verified in this conversation.

## Known limitations
- Two *already occupied* tables with separate active orders cannot yet have their bills merged safely.
- Split bill by item/guest is a separate workflow. Existing partial payments and mixed payment methods are supported.
- No independent staff authorization: public role switch is demonstration only.
- A multi-table bill cannot be moved until its attached tables are detached (detach workflow not yet built).
- No payment gateway or real financial activity.
- Room for improvements in itemized receipt taxes/discount snapshots and line-level historical adjustments.

## Release
Footer markers: `Versi situs: G1.5 · Gabung Meja / Tagihan Bersama`.
Github branch: `main`; Cloudflare Pages must deploy latest commit to display it.
