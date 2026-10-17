# EasyBILL combined upgrade user guide

## Start locally

1. Install Node.js 22 LTS or a supported version.
2. Extract the project ZIP to a writable folder.
3. Open a terminal in that folder and run `npm install`.
4. Run `npm test` and `npm run check`.
5. Run `npm start` to launch the Electron desktop app.

The browser UI can also be served by a local static server, but cloud features require valid Supabase URL/publishable key configuration in `js/supabase-config.js` and the correct database schema. Do not place service-role keys in frontend code.

## Database setup

- For a brand-new Supabase project, review and apply `supabase/setup.sql`.
- If sign-in reports that `products.manufacturing_date` does not exist, apply `supabase/migrations/20261016_product_date_columns.sql` in the Supabase SQL Editor, then retry. It adds the missing product date columns without changing existing records.
- For an existing project that already has the baseline schema, back up and test first, then apply `supabase/migrations/20261016_stage1_10_additive.sql`.
- The app does not auto-run migrations. Do not call `clear_business_data` during setup. To enable staff invitations, deploy `supabase/functions/invite-staff/index.ts` with the Supabase CLI and configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOWED_ORIGINS` as **Edge Function secrets** (never in the app or ZIP).

## New Operations & Loyalty workspace

- **Suppliers:** create supplier records.
- **Purchases:** receive stock. Cloud mode uses an atomic database RPC after migration; local mode changes local stock only.
- **Returns:** record a return request with quantity, reason, disposition and refund method. This does not send a UPI/card refund and does not automatically restore stock.
- **Cashier shifts:** open a shift with opening cash and close with actual cash; investigate over/short differences.
- **Loyalty:** configure earn rate, point value and minimum redemption; points are earned on paid customer sales and can be redeemed for store credit at POS. Returns reverse points proportionally after manager approval. Review rules and test with a disposable business before production.
- **Import / Export:** validate CSV products before committing; export products, a sales summary, a template or a local JSON backup. CSV `.xlsx` support is not included.
- **Staff access:** owner/manager invites staff through the deployed Edge Function. Owners can invite managers or cashiers; managers can invite cashiers only. Existing memberships can be deactivated/reactivated within role permissions.
- **Audit log:** view/export audit records where the role permits. Local-only audit data is not tamper-proof.

## Split payment and offline sale

Choose Split payment and enter cash, UPI, card and/or bank transfer amounts whose sum matches the total within ₹0.01. Cloud checkout requires the additive migration. If cloud checkout fails while a user is signed in, a locally saved sale is marked pending and is not server-confirmed until the outbox sync succeeds. Keep the app's local storage intact and export backups regularly.

## Windows installer

After installing dependencies and testing locally, run `npm run dist:win`. Packaging was not executed in this environment. Confirm the generated installer on a clean Windows test machine before release.
