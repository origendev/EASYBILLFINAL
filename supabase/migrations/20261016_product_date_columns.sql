-- Restore product date fields expected by the EasyBILL cloud client on older databases.
alter table public.products
  add column if not exists manufacturing_date date,
  add column if not exists expiry_date date;

grant select (manufacturing_date, expiry_date)
  on public.products to authenticated;