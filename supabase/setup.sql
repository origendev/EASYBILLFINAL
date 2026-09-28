-- EASYBILL multi-tenant Supabase schema. Safe to re-run in a new project.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  gstin text,
  phone text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  gstin text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  image_url text,
  barcode text,
  hsn_sac text,
  unit text not null default 'Pcs',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  gst_rate numeric(5, 2) not null default 0 check (gst_rate >= 0 and gst_rate <= 100),
  current_stock numeric(14, 3) not null default 0 check (current_stock >= 0),
  low_stock_threshold numeric(14, 3) not null default 5 check (low_stock_threshold >= 0),
  track_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, barcode)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  status text not null default 'unpaid',
  payment_method text,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  hsn_sac text,
  quantity numeric(14, 3) not null check (quantity > 0),
  price numeric(14, 2) not null check (price >= 0),
  gst_rate numeric(5, 2) not null default 0 check (gst_rate >= 0 and gst_rate <= 100),
  discount_amount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  type text not null check (type in ('purchase', 'sale', 'adjustment', 'return')),
  quantity numeric(14, 3) not null check (quantity > 0),
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  business_name text not null,
  phone text,
  email text,
  address text,
  gstin text,
  logo_url text,
  invoice_prefix text not null default 'EB',
  last_invoice_number bigint not null default 0 check (last_invoice_number >= 0),
  default_terms text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings
  add column if not exists last_invoice_number bigint not null default 0;

create index if not exists business_members_user_idx on public.business_members (user_id, business_id);
create index if not exists customers_business_name_idx on public.customers (business_id, name);
create index if not exists products_business_name_idx on public.products (business_id, name);
create index if not exists products_business_barcode_idx on public.products (business_id, barcode);
create index if not exists invoices_business_date_idx on public.invoices (business_id, invoice_date desc);
create index if not exists invoice_items_invoice_idx on public.invoice_items (business_id, invoice_id);
create index if not exists stock_movements_product_idx on public.stock_movements (business_id, product_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['businesses', 'profiles', 'customers', 'products', 'invoices', 'business_settings'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_easybill on auth.users;
create trigger on_auth_user_created_easybill
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_business_member(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business and user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(target_business uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business
      and user_id = auth.uid()
      and role = any (allowed_roles)
  );
$$;

create or replace function public.create_business(
  p_name text,
  p_gstin text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Business name is required'; end if;

  insert into public.profiles (id, name, email)
  values (
    auth.uid(),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    auth.jwt() ->> 'email'
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.businesses (name, gstin, phone, email, address)
  values (trim(p_name), p_gstin, p_phone, p_email, p_address)
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  insert into public.business_settings (business_id, business_name, gstin, phone, email, address)
  values (new_business_id, trim(p_name), p_gstin, p_phone, p_email, p_address);

  return new_business_id;
end;
$$;

create or replace function public.add_business_member(
  p_business_id uuid,
  p_user_id uuid,
  p_role text default 'cashier'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_membership_id uuid;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to add business members';
  end if;
  if p_role not in ('owner', 'manager', 'cashier') then raise exception 'Invalid business role'; end if;
  if p_role in ('owner', 'manager') and not public.has_business_role(p_business_id, array['owner']) then
    raise exception 'Only an owner can assign owner or manager roles';
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (p_business_id, p_user_id, p_role)
  returning id into new_membership_id;
  return new_membership_id;
end;
$$;

create or replace function public.set_invoice_status(p_business_id uuid, p_invoice_id uuid, p_status text)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.invoices;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to change invoice status';
  end if;
  if p_status not in ('paid', 'unpaid', 'partial', 'overdue', 'cancelled') then
    raise exception 'Invalid invoice status';
  end if;
  update public.invoices set status = p_status
    where id = p_invoice_id and business_id = p_business_id returning * into saved;
  if not found then raise exception 'Invoice not found'; end if;
  return saved;
end;
$$;

create or replace function public.save_product(p_business_id uuid, p_product jsonb)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.products;
  requested_id uuid;
  old_stock numeric(14, 3);
  new_stock numeric(14, 3);
  stock_delta numeric(14, 3);
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to manage products';
  end if;

  requested_id := nullif(p_product ->> 'id', '')::uuid;
  new_stock := coalesce(nullif(p_product ->> 'current_stock', '')::numeric, 0);

  if requested_id is null or not exists (
    select 1 from public.products where id = requested_id and business_id = p_business_id
  ) then
    insert into public.products (
      id, business_id, name, description, image_url, barcode, hsn_sac, unit,
      unit_price, purchase_price, gst_rate, current_stock, low_stock_threshold, track_stock
    ) values (
      coalesce(requested_id, gen_random_uuid()), p_business_id, trim(p_product ->> 'name'), p_product ->> 'description', p_product ->> 'image_url',
      nullif(trim(p_product ->> 'barcode'), ''), p_product ->> 'hsn_sac', coalesce(nullif(p_product ->> 'unit', ''), 'Pcs'),
      coalesce(nullif(p_product ->> 'unit_price', '')::numeric, 0),
      coalesce(nullif(p_product ->> 'purchase_price', '')::numeric, 0),
      coalesce(nullif(p_product ->> 'gst_rate', '')::numeric, 0), new_stock,
      coalesce(nullif(p_product ->> 'low_stock_threshold', '')::numeric, 5),
      coalesce(nullif(p_product ->> 'track_stock', '')::boolean, new_stock > 0)
    ) returning * into saved;
    if saved.track_stock and new_stock > 0 then
      insert into public.stock_movements (business_id, product_id, type, quantity, reference)
      values (p_business_id, saved.id, 'purchase', new_stock, 'Initial stock');
    end if;
  else
    select current_stock into old_stock from public.products
      where id = requested_id and business_id = p_business_id for update;
    if not found then raise exception 'Product not found'; end if;
    update public.products set
      name = trim(p_product ->> 'name'),
      description = p_product ->> 'description',
      image_url = p_product ->> 'image_url',
      barcode = nullif(trim(p_product ->> 'barcode'), ''),
      hsn_sac = p_product ->> 'hsn_sac',
      unit = coalesce(nullif(p_product ->> 'unit', ''), 'Pcs'),
      unit_price = coalesce(nullif(p_product ->> 'unit_price', '')::numeric, 0),
      purchase_price = coalesce(nullif(p_product ->> 'purchase_price', '')::numeric, 0),
      gst_rate = coalesce(nullif(p_product ->> 'gst_rate', '')::numeric, 0),
      current_stock = new_stock,
      low_stock_threshold = coalesce(nullif(p_product ->> 'low_stock_threshold', '')::numeric, 5),
      track_stock = coalesce(nullif(p_product ->> 'track_stock', '')::boolean, new_stock > 0)
    where id = requested_id and business_id = p_business_id returning * into saved;
    stock_delta := new_stock - old_stock;
    if stock_delta <> 0 then
      insert into public.stock_movements (business_id, product_id, type, quantity, reference)
      values (p_business_id, saved.id, case when stock_delta > 0 then 'purchase' else 'adjustment' end, abs(stock_delta), 'Manual stock update');
    end if;
  end if;
  return saved;
end;
$$;

create or replace function public.import_legacy_invoice(
  p_business_id uuid,
  p_invoice jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invoice_id uuid;
  item jsonb;
  customer_id uuid;
  product_id uuid;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to import invoices';
  end if;
  customer_id := nullif(p_invoice ->> 'customer_id', '')::uuid;
  if customer_id is not null and not exists (
    select 1 from public.customers where id = customer_id and business_id = p_business_id
  ) then raise exception 'Imported customer does not belong to this business'; end if;

  insert into public.invoices (
    business_id, customer_id, invoice_number, invoice_date, due_date,
    subtotal, tax, discount, total, status, payment_method, notes, terms
  ) values (
    p_business_id, customer_id, p_invoice ->> 'invoice_number',
    coalesce(nullif(p_invoice ->> 'invoice_date', '')::date, current_date),
    nullif(p_invoice ->> 'due_date', '')::date,
    coalesce(nullif(p_invoice ->> 'subtotal', '')::numeric, 0),
    coalesce(nullif(p_invoice ->> 'tax', '')::numeric, 0),
    coalesce(nullif(p_invoice ->> 'discount', '')::numeric, 0),
    coalesce(nullif(p_invoice ->> 'total', '')::numeric, 0),
    coalesce(nullif(p_invoice ->> 'status', ''), 'unpaid'),
    p_invoice ->> 'payment_method', p_invoice ->> 'notes', p_invoice ->> 'terms'
  ) returning id into new_invoice_id;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    product_id := nullif(item ->> 'product_id', '')::uuid;
    if product_id is not null and not exists (
      select 1 from public.products where id = product_id and business_id = p_business_id
    ) then raise exception 'Imported product does not belong to this business'; end if;
    insert into public.invoice_items (
      business_id, invoice_id, product_id, product_name, hsn_sac, quantity,
      price, gst_rate, discount_amount, tax, total
    ) values (
      p_business_id, new_invoice_id, product_id,
      coalesce(nullif(item ->> 'product_name', ''), 'Item'), item ->> 'hsn_sac',
      greatest(coalesce(nullif(item ->> 'quantity', '')::numeric, 1), 0.001),
      coalesce(nullif(item ->> 'price', '')::numeric, 0),
      coalesce(nullif(item ->> 'gst_rate', '')::numeric, 0),
      coalesce(nullif(item ->> 'discount_amount', '')::numeric, 0),
      coalesce(nullif(item ->> 'tax', '')::numeric, 0),
      coalesce(nullif(item ->> 'total', '')::numeric, 0)
    );
  end loop;
  return new_invoice_id;
end;
$$;

create or replace function public.save_invoice_with_stock(
  p_business_id uuid,
  p_invoice jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_invoice_id uuid;
  requested_id uuid;
  invoice_number_value text;
  invoice_prefix_value text;
  invoice_counter_value bigint;
  invoice_number_match text[];
  item jsonb;
  item_product_id uuid;
  available_stock numeric(14, 3);
  item_quantity numeric(14, 3);
  was_tracked boolean;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager', 'cashier']) then
    raise exception 'You are not a member of this business';
  end if;
  requested_id := nullif(p_invoice ->> 'id', '')::uuid;
  if nullif(p_invoice ->> 'customer_id', '') is not null and not exists (
    select 1 from public.customers
    where id = nullif(p_invoice ->> 'customer_id', '')::uuid and business_id = p_business_id
  ) then raise exception 'Invoice customer does not belong to this business'; end if;

  if requested_id is not null then
    select id into saved_invoice_id from public.invoices
      where id = requested_id and business_id = p_business_id for update;
    if not found then raise exception 'Invoice not found'; end if;
    for item in select to_jsonb(ii) from public.invoice_items ii
      where ii.invoice_id = saved_invoice_id and ii.business_id = p_business_id
    loop
      if item ->> 'product_id' is not null then
        update public.products set current_stock = current_stock + (item ->> 'quantity')::numeric
          where id = (item ->> 'product_id')::uuid and business_id = p_business_id and track_stock;
        if found then
          insert into public.stock_movements (business_id, product_id, type, quantity, reference)
          values (p_business_id, (item ->> 'product_id')::uuid, 'return', (item ->> 'quantity')::numeric, 'Invoice edit reversal');
        end if;
      end if;
    end loop;
    delete from public.invoice_items where invoice_id = saved_invoice_id and business_id = p_business_id;
    update public.invoices set
      customer_id = nullif(p_invoice ->> 'customer_id', '')::uuid,
      invoice_number = p_invoice ->> 'invoice_number',
      invoice_date = coalesce(nullif(p_invoice ->> 'invoice_date', '')::date, current_date),
      due_date = nullif(p_invoice ->> 'due_date', '')::date,
      subtotal = coalesce(nullif(p_invoice ->> 'subtotal', '')::numeric, 0),
      tax = coalesce(nullif(p_invoice ->> 'tax', '')::numeric, 0),
      discount = coalesce(nullif(p_invoice ->> 'discount', '')::numeric, 0),
      total = coalesce(nullif(p_invoice ->> 'total', '')::numeric, 0),
      status = coalesce(nullif(p_invoice ->> 'status', ''), 'unpaid'),
      payment_method = p_invoice ->> 'payment_method',
      notes = p_invoice ->> 'notes', terms = p_invoice ->> 'terms'
    where id = saved_invoice_id and business_id = p_business_id;
  else
    select invoice_prefix, last_invoice_number
      into invoice_prefix_value, invoice_counter_value
      from public.business_settings where business_id = p_business_id for update;
    invoice_number_value := p_invoice ->> 'invoice_number';
    if exists (
      select 1 from public.invoices
      where business_id = p_business_id and invoice_number = invoice_number_value
    ) then
      invoice_counter_value := invoice_counter_value + 1;
      invoice_number_value := invoice_prefix_value || '-' || lpad(invoice_counter_value::text, 4, '0');
      while exists (
        select 1 from public.invoices
        where business_id = p_business_id and invoice_number = invoice_number_value
      ) loop
        invoice_counter_value := invoice_counter_value + 1;
        invoice_number_value := invoice_prefix_value || '-' || lpad(invoice_counter_value::text, 4, '0');
      end loop;
    else
      invoice_number_match := regexp_match(invoice_number_value, '([0-9]+)$');
      if invoice_number_match is not null then
        invoice_counter_value := greatest(invoice_counter_value, invoice_number_match[1]::bigint);
      end if;
    end if;
    update public.business_settings set last_invoice_number = invoice_counter_value
      where business_id = p_business_id;
    insert into public.invoices (
      business_id, customer_id, invoice_number, invoice_date, due_date,
      subtotal, tax, discount, total, status, payment_method, notes, terms
    ) values (
      p_business_id, nullif(p_invoice ->> 'customer_id', '')::uuid,
      invoice_number_value,
      coalesce(nullif(p_invoice ->> 'invoice_date', '')::date, current_date),
      nullif(p_invoice ->> 'due_date', '')::date,
      coalesce(nullif(p_invoice ->> 'subtotal', '')::numeric, 0),
      coalesce(nullif(p_invoice ->> 'tax', '')::numeric, 0),
      coalesce(nullif(p_invoice ->> 'discount', '')::numeric, 0),
      coalesce(nullif(p_invoice ->> 'total', '')::numeric, 0),
      coalesce(nullif(p_invoice ->> 'status', ''), 'unpaid'),
      p_invoice ->> 'payment_method', p_invoice ->> 'notes', p_invoice ->> 'terms'
    ) returning id into saved_invoice_id;
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    item_product_id := nullif(item ->> 'product_id', '')::uuid;
    item_quantity := coalesce(nullif(item ->> 'quantity', '')::numeric, 0);
    if item_quantity <= 0 then raise exception 'Invoice item quantity must be greater than zero'; end if;

    insert into public.invoice_items (
      business_id, invoice_id, product_id, product_name, hsn_sac, quantity, price,
      gst_rate, discount_amount, tax, total
    ) values (
      p_business_id, saved_invoice_id, item_product_id,
      coalesce(nullif(item ->> 'product_name', ''), 'Item'), item ->> 'hsn_sac', item_quantity,
      coalesce(nullif(item ->> 'price', '')::numeric, 0),
      coalesce(nullif(item ->> 'gst_rate', '')::numeric, 0),
      coalesce(nullif(item ->> 'discount_amount', '')::numeric, 0),
      coalesce(nullif(item ->> 'tax', '')::numeric, 0),
      coalesce(nullif(item ->> 'total', '')::numeric, 0)
    );

    if item_product_id is not null then
      select current_stock, track_stock into available_stock, was_tracked
        from public.products where id = item_product_id and business_id = p_business_id for update;
      if not found then raise exception 'Invoice product does not belong to this business'; end if;
      if was_tracked and available_stock < item_quantity then raise exception 'Insufficient stock for %', item ->> 'product_name'; end if;
      if was_tracked then
        update public.products set current_stock = current_stock - item_quantity
          where id = item_product_id and business_id = p_business_id;
        insert into public.stock_movements (business_id, product_id, type, quantity, reference)
        values (p_business_id, item_product_id, 'sale', item_quantity, p_invoice ->> 'invoice_number');
      end if;
    end if;
  end loop;
  return saved_invoice_id;
end;
$$;

create or replace function public.delete_invoice_and_restore_stock(p_business_id uuid, p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to delete invoices';
  end if;
  if not exists (select 1 from public.invoices where id = p_invoice_id and business_id = p_business_id) then
    raise exception 'Invoice not found';
  end if;
  for item in select product_id, quantity from public.invoice_items
    where invoice_id = p_invoice_id and business_id = p_business_id and product_id is not null
  loop
    update public.products set current_stock = current_stock + item.quantity
      where id = item.product_id and business_id = p_business_id and track_stock;
    if found then
      insert into public.stock_movements (business_id, product_id, type, quantity, reference)
      values (p_business_id, item.product_id, 'return', item.quantity, 'Invoice deleted');
    end if;
  end loop;
  delete from public.invoices where id = p_invoice_id and business_id = p_business_id;
end;
$$;

create or replace function public.clear_business_data(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_business_role(p_business_id, array['owner']) then
    raise exception 'Only a business owner can clear business data';
  end if;
  delete from public.invoices where business_id = p_business_id;
  delete from public.customers where business_id = p_business_id;
  delete from public.stock_movements where business_id = p_business_id;
  delete from public.products where business_id = p_business_id;
  update public.business_settings set
    business_name = (select name from public.businesses where id = p_business_id),
    phone = (select phone from public.businesses where id = p_business_id),
    email = (select email from public.businesses where id = p_business_id),
    address = (select address from public.businesses where id = p_business_id),
    gstin = (select gstin from public.businesses where id = p_business_id),
    logo_url = (select logo_url from public.businesses where id = p_business_id),
    invoice_prefix = 'EB', last_invoice_number = 0, default_terms = null, website = null
  where business_id = p_business_id;
  update public.businesses set logo_url = null where id = p_business_id;
  update public.business_settings set logo_url = null where business_id = p_business_id;
end;
$$;

create or replace function public.save_business_settings(p_business_id uuid, p_settings jsonb)
returns public.business_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.business_settings;
begin
  if not public.has_business_role(p_business_id, array['owner', 'manager']) then
    raise exception 'You do not have permission to change business settings';
  end if;
  update public.businesses set
    name = coalesce(nullif(p_settings ->> 'business_name', ''), name),
    gstin = p_settings ->> 'gstin', phone = p_settings ->> 'phone',
    email = p_settings ->> 'email', address = p_settings ->> 'address',
    logo_url = p_settings ->> 'logo_url'
  where id = p_business_id;
  insert into public.business_settings (
    business_id, business_name, phone, email, address, gstin, logo_url,
    invoice_prefix, last_invoice_number, default_terms, website
  ) values (
    p_business_id, coalesce(nullif(p_settings ->> 'business_name', ''), 'EasyBill Business'),
    p_settings ->> 'phone', p_settings ->> 'email', p_settings ->> 'address',
    p_settings ->> 'gstin', p_settings ->> 'logo_url',
    coalesce(nullif(p_settings ->> 'invoice_prefix', ''), 'EB'),
    coalesce(nullif(p_settings ->> 'last_invoice_number', '')::bigint, 0),
    p_settings ->> 'default_terms', p_settings ->> 'website'
  ) on conflict (business_id) do update set
    business_name = excluded.business_name, phone = excluded.phone,
    email = excluded.email, address = excluded.address, gstin = excluded.gstin,
    logo_url = excluded.logo_url, invoice_prefix = excluded.invoice_prefix,
    last_invoice_number = greatest(business_settings.last_invoice_number, excluded.last_invoice_number),
    default_terms = excluded.default_terms, website = excluded.website
  returning * into saved;
  return saved;
end;
$$;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.business_settings enable row level security;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists businesses_read_member on public.businesses;
create policy businesses_read_member on public.businesses for select to authenticated using (public.is_business_member(id));
drop policy if exists businesses_update_manager on public.businesses;
create policy businesses_update_manager on public.businesses for update to authenticated
  using (public.has_business_role(id, array['owner', 'manager']))
  with check (public.has_business_role(id, array['owner', 'manager']));

drop policy if exists business_members_read on public.business_members;
create policy business_members_read on public.business_members for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id));
drop policy if exists business_members_update on public.business_members;
create policy business_members_update on public.business_members for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'manager']))
  with check (
    public.has_business_role(business_id, array['owner'])
    or (role = 'cashier' and public.has_business_role(business_id, array['manager']))
  );
drop policy if exists business_members_insert on public.business_members;
create policy business_members_insert on public.business_members for insert to authenticated
  with check (
    public.has_business_role(business_id, array['owner'])
    or (role = 'cashier' and public.has_business_role(business_id, array['manager']))
  );
drop policy if exists business_members_delete on public.business_members;
create policy business_members_delete on public.business_members for delete to authenticated
  using (
    public.has_business_role(business_id, array['owner'])
    or (role = 'cashier' and public.has_business_role(business_id, array['manager']))
  );

drop policy if exists customers_read_member on public.customers;
create policy customers_read_member on public.customers for select to authenticated using (public.is_business_member(business_id));
drop policy if exists customers_insert_manager on public.customers;
create policy customers_insert_manager on public.customers for insert to authenticated with check (public.has_business_role(business_id, array['owner', 'manager']));
drop policy if exists customers_update_manager on public.customers;
create policy customers_update_manager on public.customers for update to authenticated using (public.has_business_role(business_id, array['owner', 'manager'])) with check (public.has_business_role(business_id, array['owner', 'manager']));
drop policy if exists customers_delete_manager on public.customers;
create policy customers_delete_manager on public.customers for delete to authenticated using (public.has_business_role(business_id, array['owner', 'manager']));

drop policy if exists products_read_member on public.products;
create policy products_read_member on public.products for select to authenticated using (public.is_business_member(business_id));
drop policy if exists products_insert_manager on public.products;
create policy products_insert_manager on public.products for insert to authenticated with check (public.has_business_role(business_id, array['owner', 'manager']));
drop policy if exists products_update_manager on public.products;
create policy products_update_manager on public.products for update to authenticated using (public.has_business_role(business_id, array['owner', 'manager'])) with check (public.has_business_role(business_id, array['owner', 'manager']));
drop policy if exists products_delete_manager on public.products;
create policy products_delete_manager on public.products for delete to authenticated using (public.has_business_role(business_id, array['owner', 'manager']));

drop policy if exists invoices_read_member on public.invoices;
create policy invoices_read_member on public.invoices for select to authenticated using (public.is_business_member(business_id));
drop policy if exists invoice_items_read_member on public.invoice_items;
create policy invoice_items_read_member on public.invoice_items for select to authenticated using (public.is_business_member(business_id));
drop policy if exists stock_movements_read_member on public.stock_movements;
create policy stock_movements_read_member on public.stock_movements for select to authenticated using (public.is_business_member(business_id));

drop policy if exists business_settings_read_member on public.business_settings;
create policy business_settings_read_member on public.business_settings for select to authenticated using (public.is_business_member(business_id));
drop policy if exists business_settings_manage on public.business_settings;
create policy business_settings_manage on public.business_settings for all to authenticated
  using (public.has_business_role(business_id, array['owner', 'manager']))
  with check (public.has_business_role(business_id, array['owner', 'manager']));

grant execute on function public.create_business(text, text, text, text, text) to authenticated;
grant execute on function public.add_business_member(uuid, uuid, text) to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, text[]) to authenticated;
grant execute on function public.save_product(uuid, jsonb) to authenticated;
grant execute on function public.save_invoice_with_stock(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.import_legacy_invoice(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.delete_invoice_and_restore_stock(uuid, uuid) to authenticated;
grant execute on function public.clear_business_data(uuid) to authenticated;

grant select on public.businesses, public.profiles, public.business_members,
  public.customers, public.products, public.invoices, public.invoice_items,
  public.stock_movements, public.business_settings to authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.customers to authenticated;
grant delete on public.products to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on function public.set_invoice_status(uuid, uuid, text) to authenticated;
grant execute on function public.save_business_settings(uuid, jsonb) to authenticated;

revoke all on function public.create_business(text, text, text, text, text) from public, anon;
revoke all on function public.add_business_member(uuid, uuid, text) from public, anon;
revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.has_business_role(uuid, text[]) from public, anon;
revoke all on function public.save_product(uuid, jsonb) from public, anon;
revoke all on function public.save_invoice_with_stock(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.import_legacy_invoice(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.delete_invoice_and_restore_stock(uuid, uuid) from public, anon;
revoke all on function public.clear_business_data(uuid) from public, anon;
revoke all on function public.set_invoice_status(uuid, uuid, text) from public, anon;
revoke all on function public.save_business_settings(uuid, jsonb) from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('easybill-assets', 'easybill-assets', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists easybill_assets_read_member on storage.objects;
create policy easybill_assets_read_member on storage.objects for select to authenticated
  using (
    bucket_id = 'easybill-assets'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_business_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists easybill_assets_insert_manager on storage.objects;
create policy easybill_assets_insert_manager on storage.objects for insert to authenticated
  with check (
    bucket_id = 'easybill-assets'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_business_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager'])
  );
drop policy if exists easybill_assets_update_manager on storage.objects;
create policy easybill_assets_update_manager on storage.objects for update to authenticated
  using (
    bucket_id = 'easybill-assets'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_business_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager'])
  )
  with check (
    bucket_id = 'easybill-assets'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_business_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager'])
  );
drop policy if exists easybill_assets_delete_manager on storage.objects;
create policy easybill_assets_delete_manager on storage.objects for delete to authenticated
  using (
    bucket_id = 'easybill-assets'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.has_business_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager'])
  );
