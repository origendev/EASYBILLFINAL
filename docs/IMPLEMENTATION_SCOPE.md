# Combined upgrade scope (all work packaged together)

This archive combines the safe code improvements that could be implemented and verified from the supplied source snapshot in one delivery. It is not a staged series of downloads.

| Area | Delivery state | Evidence |
|---|---|---|
| Existing UI and feature preservation | Preserved in source | Existing entry point, styles, and feature modules retained |
| Shared checkout validation and financial math | Implemented and unit-tested | `js/domain.js`, `js/pos.js`, `tests/domain.test.cjs` |
| Stock tracking edge cases | Implemented and unit-tested | `EasyBillDomain.isStockTracked` and `validateCart` |
| Backup shape validation and safer local rollback | Implemented; unit-tested at domain level | `js/storage.js`, `js/domain.js` |
| Electron local HTTP server hardening | Implemented; syntax-checked | `electron/main.cjs` |
| Repeatable automated checks | Implemented and run | `package.json`, `tests/` |
| Supabase auth and business data | Existing implementation retained; live tests blocked | `js/cloud.js`, `supabase/setup.sql` |
| Supplier purchasing / lot tracking | Not complete in supplied baseline | Requires schema, UI, services, migration and tests |
| Returns / refunds | Not complete in supplied baseline | Requires transactional reversal and audit design |
| Cashier shifts / reconciliation | Not complete in supplied baseline | Requires persisted shift lifecycle and cash movement model |
| Loyalty ledger | Not complete in supplied baseline | Requires business rules, schema, UI and transactional tests |
| Durable offline outbox / conflict-safe sync | Not verified or certified | Requires idempotency keys, durable queue, conflict handling and multi-terminal tests |
| Split payments | Not certified | Requires payment allocation records and atomic save path |
| Android / iOS packaging | Not present in supplied Electron-only packaging | Separate mobile packaging and device testing required |

No database migration is automatically run by the app. No production data is deleted or reset by this package.
