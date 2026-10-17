# EasyBILL testing

## Commands run for this package

- `npm test` — 7/7 Node unit tests passed.
- `npm run check` — passed for Electron entry and core modules.
- `node --check js/<file>.js` across all JavaScript modules — passed after final changes (rerun before packaging).

## Unit test coverage

- Tracked zero-stock items and untracked services.
- Missing products and invalid quantities.
- Line GST / invoice totals rounded to cents.
- Invalid prices and GST rates.
- Backup JSON shape validation.
- Split-payment allocation totals and invalid allocations.
- Return quantities cannot exceed the remaining sold quantity.

## Required tests before production

1. Apply the additive migration to a disposable Supabase project.
2. Test owner, manager, cashier, inactive membership, missing membership, and direct RPC/table access.
3. Test online single/split payment checkout, duplicate submission, repeated client transaction UUID, concurrent stock sales, and payment allocation mismatch.
4. Test purchase receiving and stock movement rollback on invalid product/quantity.
5. Test partial/full return requests, repeated return quantities, manager approval, and no false claim of an external refund.
6. Test shifts with cash, UPI/card split, cash movements, discrepancy, double close, and concurrent open attempts.
7. Test product CSV valid/invalid rows, duplicate barcodes, and transaction rollback.
8. Test offline checkout, app restart, reconnection, duplicate retry, quota failure, and multi-terminal stock conflicts.
9. Test all existing dashboard/report graphs, customer/product workflows, receipt print, barcode label print, and Windows Electron installer.

Live PostgreSQL/RLS, browser end-to-end, printer/hardware, Electron package, and network fault tests were not run here. Do not treat unit tests as proof of production readiness.

## Additional checks not executed

- PostgreSQL parsing/execution and live RLS tests for the additive migration.
- Supabase Edge Function TypeScript/Deno type-check and deployed invite flow.
- Browser UI/E2E validation for split payments, loyalty redemption, supplier CRUD, purchase receiving, returns/approval, staff management, shifts, CSV import, PDF export, and role-based navigation.
- Electron runtime launch, Windows installer build, printer/scanner hardware, and multi-terminal offline conflict testing.
- `npm ci` was attempted but timed out while retrieving dependencies; no `node_modules` is included in the ZIP.
