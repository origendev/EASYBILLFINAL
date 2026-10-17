-- EasyBILL additive upgrade migration (Stages 1-10 support)
-- SAFE: creates new tables/columns/functions only; does not delete or rewrite existing business records.
-- Review and back up the database before applying. Do not run clear_business_data().

alter table public.invoices add column if not exists client_transaction_id uuid;
alter table public.invoices add column if not exists loyalty_points_redeemed integer not null default 0 check(loyalty_points_redeemed >= 0);
create unique index if not exists invoices_business_client_txn_uq
  on public.invoices (business_id, client_transaction_id) where client_transaction_id is not null;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check(length(trim(name)) > 0), phone text, email text, gstin text, address text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_business_name_phone_uq on public.suppliers(business_id, lower(name), coalesce(phone,''));

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null, supplier_invoice_ref text,
  purchase_date date not null default current_date, status text not null default 'draft' check(status in ('draft','received','cancelled')),
  subtotal numeric(14,2) not null default 0 check(subtotal >= 0), tax numeric(14,2) not null default 0 check(tax >= 0),
  notes text, created_by uuid references auth.users(id), received_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade, product_id uuid not null references public.products(id),
  product_name text not null, quantity numeric(14,3) not null check(quantity > 0), received_quantity numeric(14,3) not null default 0 check(received_quantity >= 0),
  unit_cost numeric(14,2) not null check(unit_cost >= 0), tax numeric(14,2) not null default 0 check(tax >= 0),
  batch_number text, expiry_date date, created_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id), return_number text not null, reason text not null,
  status text not null default 'requested' check(status in ('requested','approved','refund_pending','refunded','rejected')),
  refund_method text, refund_amount numeric(14,2) not null default 0 check(refund_amount >= 0),
  stock_disposition text not null default 'non_resalable' check(stock_disposition in ('resalable','damaged','expired','non_resalable')),
  created_by uuid references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz,
  refunded_at timestamptz, created_at timestamptz not null default now(), unique(business_id, return_number)
);
create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  return_id uuid not null references public.returns(id) on delete cascade, invoice_item_id uuid not null references public.invoice_items(id),
  product_id uuid references public.products(id), product_name text not null, quantity numeric(14,3) not null check(quantity > 0),
  refund_amount numeric(14,2) not null check(refund_amount >= 0), stock_restored boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.cashier_shifts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  cashier_id uuid not null references auth.users(id), terminal_id text not null default 'Counter 1',
  opening_cash numeric(14,2) not null check(opening_cash >= 0), closing_cash numeric(14,2), expected_cash numeric(14,2),
  difference numeric(14,2), status text not null default 'open' check(status in ('open','closed','reviewed')),
  opened_at timestamptz not null default now(), closed_at timestamptz, opening_note text, closing_note text,
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz
);
create unique index if not exists cashier_one_open_shift_idx on public.cashier_shifts(business_id,cashier_id,terminal_id) where status='open';
alter table public.invoices add column if not exists shift_id uuid references public.cashier_shifts(id);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  shift_id uuid not null references public.cashier_shifts(id), direction text not null check(direction in ('in','out')),
  amount numeric(14,2) not null check(amount > 0), reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  method text not null check(method in ('cash','upi','card','bank_transfer','store_credit','other')),
  amount numeric(14,2) not null check(amount >= 0), reference text, status text not null default 'recorded' check(status in ('recorded','pending','confirmed','failed','refunded')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id), actor_role text, action text not null, target_type text not null, target_id text,
  reason text, details jsonb not null default '{}'::jsonb, request_id uuid, created_at timestamptz not null default now()
);
create index if not exists audit_logs_business_created_idx on public.audit_logs(business_id,created_at desc);
create table if not exists public.loyalty_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  earn_points_per_100 numeric(8,3) not null default 1 check(earn_points_per_100 >= 0),
  currency_per_point numeric(8,3) not null default 0.5 check(currency_per_point >= 0),
  minimum_redemption_points integer not null default 10 check(minimum_redemption_points >= 0),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id), invoice_id uuid references public.invoices(id),
  points integer not null check(points <> 0), entry_type text not null check(entry_type in ('earn','redeem','return_reversal','manual_adjustment','expiry')),
  reason text not null, idempotency_key text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);
create table if not exists public.offline_sync_receipts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  client_transaction_id uuid not null, invoice_id uuid references public.invoices(id), status text not null default 'received' check(status in ('received','conflict','rejected')),
  conflict_message text, device_id text, received_at timestamptz not null default now(), unique(business_id,client_transaction_id)
);

-- Enable RLS on every new tenant table.
do $$ declare t text; begin
  foreach t in array array['suppliers','purchases','purchase_items','returns','return_items','cashier_shifts','cash_movements','invoice_payments','audit_logs','loyalty_settings','loyalty_ledger','offline_sync_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Policies are additive and scoped to business membership; manager-only writes for sensitive records.
do $$ declare t text; begin
  foreach t in array array['suppliers','purchases','purchase_items','returns','return_items','cashier_shifts','cash_movements','invoice_payments','audit_logs','loyalty_settings','loyalty_ledger','offline_sync_receipts'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read_member', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))',t||'_read_member',t);
  end loop;
end $$;

drop policy if exists suppliers_manage on public.suppliers;
create policy suppliers_manage on public.suppliers for all to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists purchases_manage on public.purchases;
create policy purchases_manage on public.purchases for all to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists purchase_items_manage on public.purchase_items;
create policy purchase_items_manage on public.purchase_items for all to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists returns_insert_member on public.returns;
create policy returns_insert_member on public.returns for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']));
drop policy if exists returns_manage on public.returns;
create policy returns_manage on public.returns for update to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists return_items_insert_member on public.return_items;
create policy return_items_insert_member on public.return_items for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']));
drop policy if exists return_items_manage on public.return_items;
create policy return_items_manage on public.return_items for update to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists cashier_shifts_insert_self on public.cashier_shifts;
create policy cashier_shifts_insert_self on public.cashier_shifts for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']) and cashier_id=auth.uid());
drop policy if exists cashier_shifts_update_self_or_manager on public.cashier_shifts;
create policy cashier_shifts_update_self_or_manager on public.cashier_shifts for update to authenticated using(cashier_id=auth.uid() or public.has_business_role(business_id,array['owner','manager'])) with check(cashier_id=auth.uid() or public.has_business_role(business_id,array['owner','manager']));
drop policy if exists cash_movements_insert_self on public.cash_movements;
create policy cash_movements_insert_self on public.cash_movements for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']) and created_by=auth.uid());
drop policy if exists invoice_payments_insert_member on public.invoice_payments;
create policy invoice_payments_insert_member on public.invoice_payments for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']) and created_by=auth.uid());
drop policy if exists invoice_payments_manage on public.invoice_payments;
create policy invoice_payments_manage on public.invoice_payments for update to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists audit_logs_insert_member on public.audit_logs;
create policy audit_logs_insert_member on public.audit_logs for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']) and actor_id=auth.uid());
-- No UPDATE or DELETE policy is intentionally created for audit_logs.
drop policy if exists loyalty_settings_manage on public.loyalty_settings;
create policy loyalty_settings_manage on public.loyalty_settings for all to authenticated using(public.has_business_role(business_id,array['owner','manager'])) with check(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists loyalty_ledger_insert_member on public.loyalty_ledger;
create policy loyalty_ledger_insert_member on public.loyalty_ledger for insert to authenticated with check(created_by=auth.uid() and ((entry_type='manual_adjustment' and public.has_business_role(business_id,array['owner','manager'])) or (entry_type<>'manual_adjustment' and public.has_business_role(business_id,array['owner','manager','cashier']))));
-- No UPDATE/DELETE policy for loyalty ledger or offline receipts.
drop policy if exists offline_sync_receipts_insert_member on public.offline_sync_receipts;
create policy offline_sync_receipts_insert_member on public.offline_sync_receipts for insert to authenticated with check(public.has_business_role(business_id,array['owner','manager','cashier']));

-- Atomic purchase receiving: updates inventory and inserts the purchase/movement in one transaction.
create or replace function public.receive_purchase(p_business_id uuid,p_supplier_id uuid,p_product_id uuid,p_quantity numeric,p_unit_cost numeric,p_reference text default null,p_expiry_date date default null,p_batch_number text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare purchase_id uuid; product_row public.products; begin
  if not public.has_business_role(p_business_id,array['owner','manager']) then raise exception 'Manager permission required'; end if;
  if p_quantity is null or p_quantity<=0 or p_unit_cost is null or p_unit_cost<0 then raise exception 'Invalid purchase quantity or cost'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.suppliers where id=p_supplier_id and business_id=p_business_id) then raise exception 'Supplier does not belong to this business'; end if;
  select * into product_row from public.products where id=p_product_id and business_id=p_business_id for update;
  if not found then raise exception 'Product does not belong to this business'; end if;
  insert into public.purchases(business_id,supplier_id,supplier_invoice_ref,status,subtotal,created_by,received_at)
  values(p_business_id,p_supplier_id,p_reference,'received',round(p_quantity*p_unit_cost,2),auth.uid(),now()) returning id into purchase_id;
  insert into public.purchase_items(business_id,purchase_id,product_id,product_name,quantity,received_quantity,unit_cost,batch_number,expiry_date)
  values(p_business_id,purchase_id,p_product_id,product_row.name,p_quantity,p_quantity,p_unit_cost,p_batch_number,p_expiry_date);
  if product_row.track_stock then update public.products set current_stock=current_stock+p_quantity,purchase_price=p_unit_cost,expiry_date=coalesce(p_expiry_date,expiry_date) where id=p_product_id and business_id=p_business_id; end if;
  insert into public.stock_movements(business_id,product_id,type,quantity,reference) values(p_business_id,p_product_id,'purchase',p_quantity,coalesce(p_reference,purchase_id::text));
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details) values(p_business_id,auth.uid(),'manager','purchase.receive','purchase',purchase_id::text,'Received stock',jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'unit_cost',p_unit_cost));
  return purchase_id;
end $$;
revoke all on function public.receive_purchase(uuid,uuid,uuid,numeric,numeric,text,date,text) from public,anon;
grant execute on function public.receive_purchase(uuid,uuid,uuid,numeric,numeric,text,date,text) to authenticated;

-- Controlled return request; records the request only. Refund and stock restoration require manager approval.
create or replace function public.request_invoice_return(p_business_id uuid,p_invoice_id uuid,p_invoice_item_id uuid,p_quantity numeric,p_refund_amount numeric,p_reason text,p_disposition text default 'non_resalable',p_refund_method text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare r_id uuid; item_row public.invoice_items; sold numeric; returned numeric; inv_number text; begin
  if not public.has_business_role(p_business_id,array['owner','manager','cashier']) then raise exception 'Business membership required'; end if;
  if p_quantity is null or p_quantity<=0 or p_refund_amount is null or p_refund_amount<0 or length(trim(coalesce(p_reason,'')))=0 then raise exception 'Invalid return request'; end if;
  if p_disposition not in ('resalable','damaged','expired','non_resalable') then raise exception 'Invalid stock disposition'; end if;
  select ii into item_row from public.invoice_items ii join public.invoices i on i.id=ii.invoice_id and i.business_id=ii.business_id where ii.id=p_invoice_item_id and ii.invoice_id=p_invoice_id and ii.business_id=p_business_id for update of ii;
  if not found then raise exception 'Invoice item not found'; end if;
  sold:=item_row.quantity;
  select coalesce(sum(ri.quantity),0) into returned from public.return_items ri join public.returns r on r.id=ri.return_id and r.business_id=ri.business_id where ri.business_id=p_business_id and ri.invoice_item_id=p_invoice_item_id and r.status<>'rejected';
  if returned+p_quantity>sold then raise exception 'Return quantity exceeds remaining sold quantity'; end if;
  if p_refund_amount>round((item_row.total/greatest(item_row.quantity,0.001))*p_quantity,2)+0.01 then raise exception 'Refund amount exceeds the remaining line value for this quantity'; end if;
  inv_number:=item_row.invoice_id::text;
  insert into public.returns(business_id,invoice_id,return_number,reason,status,refund_method,refund_amount,stock_disposition,created_by)
  values(p_business_id,p_invoice_id,'RET-'||replace(gen_random_uuid()::text,'-',''),trim(p_reason),'requested',p_refund_method,p_refund_amount,p_disposition,auth.uid()) returning id into r_id;
  insert into public.return_items(business_id,return_id,invoice_item_id,product_id,product_name,quantity,refund_amount)
  values(p_business_id,r_id,p_invoice_item_id,item_row.product_id,item_row.product_name,p_quantity,p_refund_amount);
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details) values(p_business_id,auth.uid(),'member','return.request','return',r_id::text,trim(p_reason),jsonb_build_object('invoice_id',p_invoice_id,'invoice_item_id',p_invoice_item_id,'quantity',p_quantity,'refund_amount',p_refund_amount));
  return r_id;
end $$;
revoke all on function public.request_invoice_return(uuid,uuid,uuid,numeric,numeric,text,text,text) from public,anon;
grant execute on function public.request_invoice_return(uuid,uuid,uuid,numeric,numeric,text,text,text) to authenticated;


-- Split-payment wrapper: nested function calls share this database transaction.
create or replace function public.save_invoice_with_payments(p_business_id uuid,p_invoice jsonb,p_items jsonb,p_payments jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; invoice_total numeric(14,2); payment_total numeric(14,2); store_credit_amount numeric(14,2):=0; payment jsonb; method_value text; amount_value numeric; txn_id uuid; invoice_payload jsonb; customer_id_value uuid; earn_rate numeric; point_value numeric; min_points integer; balance_points integer; redeem_points integer:=0; points_value integer; eligible_spend numeric(14,2); invoice_status text; begin
  if not public.has_business_role(p_business_id,array['owner','manager','cashier']) then raise exception 'Business membership required'; end if;
  if jsonb_typeof(coalesce(p_payments,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payments,'[]'::jsonb))=0 then raise exception 'At least one payment allocation is required'; end if;
  txn_id:=nullif(p_invoice->>'client_transaction_id','')::uuid;
  if txn_id is not null then
    select id into saved_id from public.invoices where business_id=p_business_id and client_transaction_id=txn_id;
    if found then return saved_id; end if;
  end if;
  invoice_total:=round(coalesce(nullif(p_invoice->>'grand_total','')::numeric,nullif(p_invoice->>'total','')::numeric,0),2);
  payment_total:=0;
  for payment in select value from jsonb_array_elements(p_payments) loop
    method_value:=lower(coalesce(payment->>'method',''));
    amount_value:=round(coalesce(nullif(payment->>'amount','')::numeric,0),2);
    if method_value not in ('cash','upi','card','bank_transfer','store_credit','other') or amount_value<0 then raise exception 'Invalid payment allocation'; end if;
    payment_total:=payment_total+amount_value;
    if method_value='store_credit' then store_credit_amount:=store_credit_amount+amount_value; end if;
  end loop;
  if abs(round(payment_total,2)-invoice_total)>0.01 then raise exception 'Payment allocations must equal invoice total'; end if;
  redeem_points:=greatest(0,coalesce(nullif(p_invoice->>'loyalty_points_redeemed','')::integer,0));
  customer_id_value:=nullif(p_invoice->>'customer_id','')::uuid;
  if redeem_points>0 then
    if customer_id_value is null then raise exception 'Select a customer to redeem loyalty points'; end if;
    perform 1 from public.customers where id=customer_id_value and business_id=p_business_id for update;
    if not found then raise exception 'Customer does not belong to this business'; end if;
    select coalesce(max(currency_per_point),0.5),coalesce(max(minimum_redemption_points),10) into point_value,min_points from public.loyalty_settings where business_id=p_business_id;
    select greatest(coalesce(sum(points),0),0)::integer into balance_points from public.loyalty_ledger where business_id=p_business_id and customer_id=customer_id_value;
    if redeem_points<coalesce(min_points,10) then raise exception 'Loyalty redemption is below the configured minimum'; end if;
    if redeem_points>balance_points then raise exception 'Insufficient loyalty points'; end if;
    if abs(store_credit_amount-round(redeem_points*coalesce(point_value,0.5),2))>0.01 then raise exception 'Store credit must match the points being redeemed'; end if;
  elsif store_credit_amount>0 then raise exception 'Store credit payment requires a matching loyalty points redemption'; end if;
  -- A stable client UUID is an idempotency key, not a server invoice primary key.
  invoice_payload:=p_invoice - 'id';
  saved_id:=public.save_invoice_with_stock(p_business_id,invoice_payload,p_items);
  if txn_id is not null then update public.invoices set client_transaction_id=txn_id where id=saved_id and business_id=p_business_id; end if;
  if nullif(p_invoice->>'shift_id','') is not null then update public.invoices set shift_id=(p_invoice->>'shift_id')::uuid where id=saved_id and business_id=p_business_id; end if;
  update public.invoices set loyalty_points_redeemed=redeem_points where id=saved_id and business_id=p_business_id;
  delete from public.invoice_payments where business_id=p_business_id and invoice_id=saved_id;
  for payment in select value from jsonb_array_elements(p_payments) loop
    insert into public.invoice_payments(business_id,invoice_id,method,amount,reference,status,created_by)
    values(p_business_id,saved_id,lower(payment->>'method'),round((payment->>'amount')::numeric,2),nullif(payment->>'reference',''),'recorded',auth.uid());
  end loop;
  select customer_id,total,status into customer_id_value,invoice_total,invoice_status from public.invoices where id=saved_id and business_id=p_business_id;
  if redeem_points>0 then insert into public.loyalty_ledger(business_id,customer_id,invoice_id,points,entry_type,reason,idempotency_key,created_by) values(p_business_id,customer_id_value,saved_id,-redeem_points,'redeem','Points redeemed at checkout','redeem:'||saved_id::text,auth.uid()) on conflict(business_id,idempotency_key) do nothing; end if;
  if customer_id_value is not null and invoice_status='paid' then
    select coalesce(max(earn_points_per_100),1) into earn_rate from public.loyalty_settings where business_id=p_business_id;
    eligible_spend:=greatest(0,invoice_total-store_credit_amount);
    points_value:=floor((eligible_spend/100)*coalesce(earn_rate,1))::integer;
    if points_value>0 then insert into public.loyalty_ledger(business_id,customer_id,invoice_id,points,entry_type,reason,idempotency_key,created_by) values(p_business_id,customer_id_value,saved_id,points_value,'earn','Points earned on completed sale','earn:'||saved_id::text,auth.uid()) on conflict(business_id,idempotency_key) do nothing; end if;
  end if;
  return saved_id;
end $$;
revoke all on function public.save_invoice_with_payments(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_invoice_with_payments(uuid,jsonb,jsonb,jsonb) to authenticated;

-- Active membership flag defaults existing memberships to active; owners can deactivate staff safely.
alter table public.business_members add column if not exists is_active boolean not null default true;
create index if not exists business_members_active_lookup_idx on public.business_members(user_id,business_id,is_active);
create or replace function public.is_business_member(target_business uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.business_members where business_id=target_business and user_id=auth.uid() and is_active=true);
$$;
create or replace function public.has_business_role(target_business uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.business_members where business_id=target_business and user_id=auth.uid() and is_active=true and role=any(allowed_roles));
$$;


-- Cashiers may add customer records but cannot edit/delete existing customer records.
drop policy if exists customers_insert_manager on public.customers;
create policy customers_insert_member on public.customers for insert to authenticated
  with check(public.has_business_role(business_id,array['owner','manager','cashier']));


-- Cost price is not directly selectable by cashier accounts. Owners/managers retrieve it via an authorized RPC.
revoke select on public.products from authenticated;
revoke select on public.products from anon;
revoke select on public.products from public;
grant select (id,business_id,name,description,image_url,barcode,hsn_sac,unit,unit_price,gst_rate,current_stock,low_stock_threshold,manufacturing_date,expiry_date,track_stock,created_at,updated_at) on public.products to authenticated;
create or replace function public.get_business_product_costs(p_business_id uuid)
returns table(product_id uuid,purchase_price numeric)
language sql stable security definer set search_path=public as $$
  select p.id,p.purchase_price from public.products p
  where p.business_id=p_business_id and public.has_business_role(p_business_id,array['owner','manager']);
$$;
revoke all on function public.get_business_product_costs(uuid) from public,anon;
grant execute on function public.get_business_product_costs(uuid) to authenticated;


create or replace function public.close_cashier_shift(p_business_id uuid,p_shift_id uuid,p_actual_cash numeric,p_closing_note text default null)
returns public.cashier_shifts language plpgsql security definer set search_path=public as $$
declare s public.cashier_shifts; cash_sales numeric(14,2); cash_in numeric(14,2); cash_out numeric(14,2); begin
  if p_actual_cash is null or p_actual_cash<0 then raise exception 'Closing cash must be non-negative'; end if;
  select * into s from public.cashier_shifts where id=p_shift_id and business_id=p_business_id for update;
  if not found then raise exception 'Shift not found'; end if;
  if not public.has_business_role(p_business_id,array['owner','manager']) and s.cashier_id<>auth.uid() then raise exception 'You may only close your own shift'; end if;
  if s.status<>'open' then raise exception 'Shift is already closed'; end if;
  select coalesce(sum(ip.amount),0) into cash_sales from public.invoice_payments ip join public.invoices i on i.id=ip.invoice_id and i.business_id=ip.business_id
    where ip.business_id=p_business_id and i.shift_id=p_shift_id and ip.method='cash' and ip.status in ('recorded','confirmed');
  select coalesce(sum(amount) filter(where direction='in'),0),coalesce(sum(amount) filter(where direction='out'),0) into cash_in,cash_out
    from public.cash_movements where business_id=p_business_id and shift_id=p_shift_id;
  update public.cashier_shifts set expected_cash=opening_cash+cash_sales+cash_in-cash_out,closing_cash=p_actual_cash,
    difference=p_actual_cash-(opening_cash+cash_sales+cash_in-cash_out),status='closed',closed_at=now(),closing_note=p_closing_note
    where id=p_shift_id and business_id=p_business_id returning * into s;
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details)
  values(p_business_id,auth.uid(),case when public.has_business_role(p_business_id,array['owner']) then 'owner' when public.has_business_role(p_business_id,array['manager']) then 'manager' else 'cashier' end,'shift.close','shift',p_shift_id::text,coalesce(p_closing_note,''),jsonb_build_object('expected_cash',s.expected_cash,'actual_cash',s.closing_cash,'difference',s.difference));
  return s;
end $$;
revoke all on function public.close_cashier_shift(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.close_cashier_shift(uuid,uuid,numeric,text) to authenticated;

-- Tighten read access for operational financial records.
drop policy if exists purchases_read_member on public.purchases;
create policy purchases_read_manager on public.purchases for select to authenticated using(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists purchase_items_read_member on public.purchase_items;
create policy purchase_items_read_manager on public.purchase_items for select to authenticated using(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists audit_logs_read_member on public.audit_logs;
create policy audit_logs_read_manager on public.audit_logs for select to authenticated using(public.has_business_role(business_id,array['owner','manager']));
drop policy if exists loyalty_settings_read_member on public.loyalty_settings;
create policy loyalty_settings_read_member on public.loyalty_settings for select to authenticated using(public.is_business_member(business_id));
drop policy if exists cashier_shifts_read_member on public.cashier_shifts;
create policy cashier_shifts_read_member on public.cashier_shifts for select to authenticated using(public.has_business_role(business_id,array['owner','manager']) or cashier_id=auth.uid());
drop policy if exists cash_movements_read_member on public.cash_movements;
create policy cash_movements_read_member on public.cash_movements for select to authenticated using(public.has_business_role(business_id,array['owner','manager']) or exists(select 1 from public.cashier_shifts s where s.id=cash_movements.shift_id and s.business_id=cash_movements.business_id and s.cashier_id=auth.uid()));

-- Transactional bulk product import/update. Any invalid row rolls back the entire batch.
create or replace function public.bulk_import_products(p_business_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare r jsonb; normalized jsonb; resolved_id uuid; count_rows integer:=0; seen_barcodes text[]:=array[]::text[]; barcode_value text; begin
  if not public.has_business_role(p_business_id,array['owner','manager']) then raise exception 'Manager permission required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>5000 then raise exception 'Import must contain 1 to 5000 product rows'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if length(trim(coalesce(r->>'name','')))=0 then raise exception 'Every product needs a name'; end if;
    if coalesce(nullif(r->>'unit_price','')::numeric,-1)<0 then raise exception 'Product price must be non-negative'; end if;
    if coalesce(nullif(r->>'purchase_price','')::numeric,-1)<0 then raise exception 'Product cost must be non-negative'; end if;
    if coalesce(nullif(r->>'gst_rate','')::numeric,-1)<0 or coalesce(nullif(r->>'gst_rate','')::numeric,101)>100 then raise exception 'GST rate must be between 0 and 100'; end if;
    if coalesce(nullif(r->>'current_stock','')::numeric,-1)<0 then raise exception 'Stock must be non-negative'; end if;
    barcode_value:=nullif(trim(r->>'barcode'),'');
    if barcode_value is not null then
      if lower(barcode_value)=any(select lower(v) from unnest(seen_barcodes) as t(v)) then raise exception 'Duplicate barcode in import: %',barcode_value; end if;
      seen_barcodes:=array_append(seen_barcodes,barcode_value);
    end if;
  end loop;
  for r in select value from jsonb_array_elements(p_rows) loop
    resolved_id:=nullif(r->>'id','')::uuid;
    if resolved_id is null and nullif(trim(r->>'barcode'),'') is not null then
      select id into resolved_id from public.products where business_id=p_business_id and barcode=trim(r->>'barcode') limit 1;
    end if;
    normalized:=jsonb_set(r,'{id}',to_jsonb(coalesce(resolved_id::text,'')),true);
    perform public.save_product(p_business_id,normalized);
    count_rows:=count_rows+1;
  end loop;
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details)
  values(p_business_id,auth.uid(),case when public.has_business_role(p_business_id,array['owner']) then 'owner' else 'manager' end,'products.bulk_import','products','bulk','Validated CSV import',jsonb_build_object('rows',count_rows));
  return count_rows;
end $$;
revoke all on function public.bulk_import_products(uuid,jsonb) from public,anon;
grant execute on function public.bulk_import_products(uuid,jsonb) to authenticated;


drop policy if exists suppliers_read_member on public.suppliers;
create policy suppliers_read_manager on public.suppliers for select to authenticated using(public.has_business_role(business_id,array['owner','manager']));


-- Manager-controlled return approval and one-time stock restoration. External payment is never executed here.
create or replace function public.approve_invoice_return(p_business_id uuid,p_return_id uuid,p_refund_confirmed boolean default false)
returns public.returns language plpgsql security definer set search_path=public as $$
declare r public.returns; ri record; inv public.invoices; earned integer; reversed_points integer; reverse_points integer; remaining_points integer; begin
  if not public.has_business_role(p_business_id,array['owner','manager']) then raise exception 'Manager permission required'; end if;
  select * into r from public.returns where id=p_return_id and business_id=p_business_id for update;
  if not found then raise exception 'Return request not found'; end if;
  if r.status='rejected' then raise exception 'Rejected return cannot be approved'; end if;
  if r.status='refunded' then return r; end if;
  if r.status='requested' then
    for ri in select * from public.return_items where return_id=r.id and business_id=p_business_id for update loop
      if r.stock_disposition='resalable' and not ri.stock_restored and ri.product_id is not null then
        update public.products set current_stock=current_stock+ri.quantity where id=ri.product_id and business_id=p_business_id and track_stock;
        if found then
          insert into public.stock_movements(business_id,product_id,type,quantity,reference) values(p_business_id,ri.product_id,'return',ri.quantity,'Approved return '||r.return_number);
          update public.return_items set stock_restored=true where id=ri.id and business_id=p_business_id;
        end if;
      end if;
    end loop;
    select * into inv from public.invoices where id=r.invoice_id and business_id=p_business_id;
    if inv.customer_id is not null and inv.total>0 then
      select coalesce(sum(points),0)::integer into earned from public.loyalty_ledger where business_id=p_business_id and invoice_id=inv.id and entry_type='earn';
      select coalesce(sum(points),0)::integer into reversed_points from public.loyalty_ledger where business_id=p_business_id and invoice_id=inv.id and entry_type='return_reversal';
      remaining_points:=greatest(earned+reversed_points,0);
      reverse_points:=least(remaining_points,floor(remaining_points*(r.refund_amount/inv.total))::integer);
      if reverse_points>0 then insert into public.loyalty_ledger(business_id,customer_id,invoice_id,points,entry_type,reason,idempotency_key,created_by) values(p_business_id,inv.customer_id,inv.id,-reverse_points,'return_reversal','Loyalty points reversed for return','return:'||r.id::text,auth.uid()) on conflict(business_id,idempotency_key) do nothing; end if;
    end if;
  end if;
  update public.returns set status=case when p_refund_confirmed then 'refunded' else 'approved' end,
    approved_by=coalesce(approved_by,auth.uid()),approved_at=coalesce(approved_at,now()),
    refunded_at=case when p_refund_confirmed then coalesce(refunded_at,now()) else refunded_at end
    where id=r.id and business_id=p_business_id returning * into r;
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details)
  values(p_business_id,auth.uid(),case when public.has_business_role(p_business_id,array['owner']) then 'owner' else 'manager' end,
    case when p_refund_confirmed then 'return.refund_confirmed' else 'return.approved' end,'return',r.id::text,r.reason,jsonb_build_object('refund_amount',r.refund_amount,'status',r.status));
  return r;
end $$;
revoke all on function public.approve_invoice_return(uuid,uuid,boolean) from public,anon;
grant execute on function public.approve_invoice_return(uuid,uuid,boolean) to authenticated;


-- Critical records are mutated only through validating SECURITY DEFINER RPCs, not direct table writes.
revoke insert,update,delete on public.returns from authenticated;
revoke insert,update,delete on public.return_items from authenticated;
revoke insert,update,delete on public.invoice_payments from authenticated;
revoke update,delete on public.cashier_shifts from authenticated;
revoke insert,update,delete on public.purchases from authenticated;
revoke insert,update,delete on public.purchase_items from authenticated;
revoke insert on public.loyalty_ledger from authenticated;

create or replace function public.adjust_loyalty_points(p_business_id uuid,p_customer_id uuid,p_points integer,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare entry_id uuid; begin
  if not public.has_business_role(p_business_id,array['owner','manager']) then raise exception 'Manager permission required'; end if;
  if p_points is null or p_points=0 or length(trim(coalesce(p_reason,'')))=0 then raise exception 'A non-zero points amount and reason are required'; end if;
  if not exists(select 1 from public.customers where id=p_customer_id and business_id=p_business_id) then raise exception 'Customer does not belong to this business'; end if;
  insert into public.loyalty_ledger(business_id,customer_id,points,entry_type,reason,idempotency_key,created_by)
  values(p_business_id,p_customer_id,p_points,'manual_adjustment',trim(p_reason),'manual:'||gen_random_uuid()::text,auth.uid()) returning id into entry_id;
  insert into public.audit_logs(business_id,actor_id,actor_role,action,target_type,target_id,reason,details)
  values(p_business_id,auth.uid(),case when public.has_business_role(p_business_id,array['owner']) then 'owner' else 'manager' end,'loyalty.adjust','customer',p_customer_id::text,trim(p_reason),jsonb_build_object('points',p_points));
  return entry_id;
end $$;
revoke all on function public.adjust_loyalty_points(uuid,uuid,integer,text) from public,anon;
grant execute on function public.adjust_loyalty_points(uuid,uuid,integer,text) to authenticated;

drop policy if exists loyalty_ledger_read_member on public.loyalty_ledger;
create policy loyalty_ledger_read_manager on public.loyalty_ledger for select to authenticated using(public.has_business_role(business_id,array['owner','manager']));


create or replace function public.get_customer_loyalty_balance(p_business_id uuid,p_customer_id uuid)
returns integer language plpgsql stable security definer set search_path=public as $$
declare balance integer; begin
  if not public.has_business_role(p_business_id,array['owner','manager','cashier']) then raise exception 'Business membership required'; end if;
  if not exists(select 1 from public.customers where id=p_customer_id and business_id=p_business_id) then raise exception 'Customer does not belong to this business'; end if;
  select greatest(coalesce(sum(points),0),0)::integer into balance from public.loyalty_ledger where business_id=p_business_id and customer_id=p_customer_id;
  return coalesce(balance,0);
end $$;
revoke all on function public.get_customer_loyalty_balance(uuid,uuid) from public,anon;
grant execute on function public.get_customer_loyalty_balance(uuid,uuid) to authenticated;

-- Allow owner/manager staff screens to read only profiles of members in businesses they manage.
drop policy if exists profiles_read_business_managers on public.profiles;
create policy profiles_read_business_managers on public.profiles for select to authenticated
  using (exists(select 1 from public.business_members target where target.user_id=profiles.id and public.has_business_role(target.business_id,array['owner','manager'])));
