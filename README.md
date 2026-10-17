# EasyBILL Desktop

EasyBILL is the existing HTML/CSS/vanilla-JavaScript POS application packaged with Electron for Windows and connected to Supabase/PostgreSQL for multi-user data. The existing dashboard, POS, reports, customers, products, stocks, barcode generator, and settings screens are retained; the combined upgrade adds an Operations & Loyalty workspace.

## Run and test

Use Node.js 22 LTS (or the supported version declared by the Electron dependencies). From the project directory:

```powershell
npm install
npm test
npm run check
npm start
```

The desktop shell serves the app at `http://127.0.0.1:5501` so Supabase authentication can use an HTTP redirect origin. `node_modules` is intentionally excluded from the source ZIP; `npm install` recreates dependencies from `package.json` and `package-lock.json`.

## Supabase setup and migration safety

- Configure the project URL and **publishable** key in `js/supabase-config.js`. That key is designed for client use; never put a service-role key or database password in HTML, renderer JavaScript, the ZIP, or Git.
- For a brand-new Supabase project, review and apply `supabase/setup.sql`.
- For an existing database already using the baseline schema, take and verify a backup, compare the live schema, test on a separate project, then apply `supabase/migrations/20261016_stage1_10_additive.sql`.
- The migration is not automatically applied by the app. The split-payment, purchase receiving, return approval, shift-close, cost-price permissions, loyalty, bulk import, and active-membership features require it. Deploy `supabase/functions/invite-staff/index.ts` as a Supabase Edge Function and configure its secrets server-side to enable staff invitations.
- Never run `public.clear_business_data(uuid)` as part of an upgrade. See `docs/DATABASE_MIGRATIONS.md`.

## Operations & Loyalty workspace

The new workspace includes supplier management, purchase receiving with batch/expiry metadata, return requests and manager approval, cashier shifts and cash in/out reconciliation, loyalty earning/redemption rules and ledger, audit history, product CSV import/export, sales-summary CSV/PDF export, and a durable local invoice outbox. Cloud writes use the included migration-backed RPCs where implemented. Local-only workflows remain device-local and are labelled accordingly.

Offline checkout is marked **pending sync** until server-confirmed. The idempotent retry path requires the additive migration. Offline stock snapshots cannot guarantee inventory availability across multiple disconnected terminals. Regularly export backups.

## Windows installer

After installing dependencies and testing locally, run:

```powershell
npm run dist:win
```

The installer is written to `release/EasyBill-Setup-1.0.2.exe`. Packaging was not run in the build environment used for this source ZIP. Test the generated installer on a clean Windows machine before release. The installer is unsigned unless you configure code signing.

## Supabase redirects

In Supabase Dashboard, add these to **Authentication → URL Configuration → Redirect URLs**:

- `http://127.0.0.1:5501/**` for the desktop app
- `http://localhost:5500/**` for local browser development
- Your deployed website origin and callback paths when the public site is hosted

## Status and limitations

See `docs/UPGRADE_STATUS.md`, `docs/ROLE_PERMISSION_MATRIX.md`, `docs/OFFLINE_SYNC.md`, `docs/TESTING.md`, and `docs/USER_GUIDE.md`. Unit tests and syntax checks passed, but live Supabase RLS/RPC tests, browser end-to-end tests, real offline network-fault tests, printer hardware tests, and Electron installer packaging were not run. Do not treat this source ZIP as production-certified until those release gates pass. Android/iOS packaging, `.xlsx` import/export, complete operational-record offline sync, shift review/reopen, and full provider-integrated refunds remain out of scope for this delivery. Staff invitation Edge Function source is included but must be deployed and configured in Supabase.
