# Offline billing and synchronization behavior

## Current implementation

- The product catalogue and customer/invoice cache are stored in local storage for the current business/device.
- Checkout assigns a stable client transaction UUID. If a cloud checkout fails, EasyBILL saves the invoice snapshot and a pending outbox record locally, reduces the local stock snapshot, and clearly labels the sale as pending server confirmation.
- When connectivity returns, the outbox retries the invoice using the same client transaction UUID. The migration's `save_invoice_with_payments` checks that UUID before creating another invoice, so retry after an ambiguous network failure can return the already-created invoice instead of creating a duplicate.
- The server transaction validates allocations, writes the invoice/lines/payment rows, and invokes the existing stock-safe checkout function in one database transaction.
- Operational records such as local-mode purchases/returns are not all automatically synchronized. The UI marks local-only and pending cloud-migration records rather than silently claiming they synced.

## Important limits

- Browser local storage is durable across refresh/restart in normal conditions but can be cleared, corrupted, quota-limited, or unavailable. Export backups regularly.
- An offline stock snapshot cannot guarantee stock is still available when another terminal sells the same item. Online server checkout remains authoritative; conflicts must be resolved by the operator.
- The app does not yet provide a dedicated IndexedDB transactional outbox, device-level encryption, automatic conflict-resolution UI, or full synchronization of every operational record. Treat offline sales as locally accepted, not server-confirmed, until the outbox status changes to synced.
- The stable UUID / RPC path requires `supabase/migrations/20261016_stage1_10_additive.sql` to be applied.
- No real disconnect/restart/reconnect test was run in this environment.
