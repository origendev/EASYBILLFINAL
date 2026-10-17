const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync(require('node:path').join(__dirname, '../supabase/migrations/20261016_stage1_10_additive.sql'), 'utf8').toLowerCase();
const productDateSql = fs.readFileSync(require('node:path').join(__dirname, '../supabase/migrations/20261016_product_date_columns.sql'), 'utf8').toLowerCase();
const setupSql = fs.readFileSync(require('node:path').join(__dirname, '../supabase/setup.sql'), 'utf8').toLowerCase();
const cloudJs = fs.readFileSync(require('node:path').join(__dirname, '../js/cloud.js'), 'utf8');
const inviteFunction = fs.readFileSync(require('node:path').join(__dirname, '../supabase/functions/invite-staff/index.ts'), 'utf8');
const supabaseConfig = fs.readFileSync(require('node:path').join(__dirname, '../supabase/config.toml'), 'utf8').toLowerCase();

test('fresh setup includes the active membership field required by sign-in', () => {
  assert.match(setupSql, /is_active boolean not null default true/);
  assert.match(setupSql, /alter table public\.business_members\s+add column if not exists is_active boolean not null default true/);
  assert.equal((cloudJs.match(/select\('business_id, role, created_at, is_active'\)/g) || []).length, 2);
});

test('staff invite adds existing accounts and invites new accounts', () => {
  assert.match(inviteFunction, /\.from\('profiles'\)[\s\S]*?\.ilike\('email', emailPattern\)/);
  assert.match(inviteFunction, /if \(!userId\)[\s\S]*?inviteUserByEmail\(email, inviteOptions\)/);
  assert.match(inviteFunction, /user_id: userId/);
});

test('staff invite verifies caller tokens in-function, not with the legacy gateway secret', () => {
  assert.match(supabaseConfig, /\[functions\.invite-staff\]\s+verify_jwt\s*=\s*false/);
  assert.match(inviteFunction, /auth\.getUser\(\)/);
});

test('upgrade migration is additive and does not drop/reset tables', () => {
  assert.doesNotMatch(sql, /\bdrop\s+table\b/);
  assert.doesNotMatch(sql, /\btruncate\s+(?:table\s+)?/);
  assert.match(sql, /alter table public\.invoices add column if not exists client_transaction_id/);
  assert.match(sql, /create table if not exists public\.suppliers/);
  assert.match(sql, /create table if not exists public\.audit_logs/);
});

test('migration protects sensitive writes with server-side RPCs and role checks', () => {
  assert.match(sql, /create or replace function public\.save_invoice_with_payments/);
  assert.match(sql, /create or replace function public\.receive_purchase/);
  assert.match(sql, /create or replace function public\.request_invoice_return/);
  assert.match(sql, /create or replace function public\.approve_invoice_return/);
  assert.match(sql, /create or replace function public\.bulk_import_products/);
  assert.match(sql, /get_business_product_costs/);
  assert.match(sql, /has_business_role\(p_business_id,array\['owner','manager'\]\)/);
});

test('product date compatibility migration adds and grants expected columns without deleting data', () => {
  assert.match(productDateSql, /add column if not exists manufacturing_date date/);
  assert.match(productDateSql, /add column if not exists expiry_date date/);
  assert.match(productDateSql, /grant select \(manufacturing_date, expiry_date\)\s+on public\.products to authenticated/);
  assert.doesNotMatch(productDateSql, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/);
});
