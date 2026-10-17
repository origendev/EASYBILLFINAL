# EasyBILL database migration and backup guide

## What this package contains

- `supabase/setup.sql`: baseline schema/functions for a new EasyBILL Supabase project.
- `supabase/migrations/20261016_product_date_columns.sql`: idempotent compatibility fix for older `products` tables missing `manufacturing_date` and `expiry_date`.
- `supabase/migrations/20261016_stage1_10_additive.sql`: additive upgrade for an existing project. It creates new operational tables, adds columns/indexes/functions/policies, and tightens product cost-price reads. It does not reset existing data.

## Before applying to any existing database

1. Export a verified database backup using Supabase's supported backup/export method and confirm it can be restored to a separate test project.
2. Compare the live schema, functions, policies, and grants with both SQL files. Do not run `setup.sql` blindly on an existing production database.
3. If the live `products` table is missing either date column, apply `20261016_product_date_columns.sql` first. Then apply the additive migration to a disposable test project that already has the baseline schema and current EasyBILL helper functions.
4. Inspect every SQL error and verify tables, indexes, policies, RPC grants, and owner/cashier behavior before considering production.
5. Back up production again immediately before the approved maintenance window. Apply only after a restore path is confirmed.

Migrations are not automatically executed by the app. The product date compatibility migration only adds missing columns and grants authenticated read access to those fields; it does not modify existing rows. The destructive `public.clear_business_data(uuid)` function in the baseline setup must not be called for upgrades.

## Migration contents

Adds suppliers/purchases/purchase items, return requests/items, cashier shifts/cash movements, invoice payment allocations, audit logs, loyalty settings/ledger, offline sync receipts, `invoices.client_transaction_id`, `invoices.shift_id`, and `business_members.is_active`. Adds atomic RPCs for purchase receiving, return request validation, split-payment checkout, shift close, and bulk product import. Cost price is returned only by an owner/manager-authorized RPC.

## Recovery

If a migration fails, do not manually drop tables or rerun partial statements without checking the database state. Capture the exact error, compare which statements committed (Supabase SQL editor behavior may wrap/execute scripts differently), restore the verified backup to a separate project if necessary, and resolve forward with an additive corrective migration. Do not run data-clearing functions to “fix” schema errors.


## Staff invitation function

`supabase/functions/invite-staff/index.ts` is a separate Supabase Edge Function, not a frontend secret. Deploy it with the Supabase CLI after applying the migration, then set its secrets in Supabase Function Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and comma-separated `ALLOWED_ORIGINS`. Restrict allowed origins to the actual desktop/web origins. Never copy the service-role key into `.env.example`, `js/supabase-config.js`, Electron renderer code, or the ZIP. Test owner/manager/cashier invitations in a disposable project first.
