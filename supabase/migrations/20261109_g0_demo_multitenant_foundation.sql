
create extension if not exists pgcrypto;
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, demo boolean not null default true, created_at timestamptz default now());
create table public.branches(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, created_at timestamptz default now(), unique(id,organization_id));
create table public.demo_sessions(id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id) on delete cascade, owner_uid uuid not null, share_code text unique not null, expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz default now());
create table public.memberships(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, user_uid uuid not null, role text not null check(role in ('owner','manager','cashier','waiter','kitchen')), created_at timestamptz default now(), unique(organization_id,user_uid));
create table public.categories(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null);
create table public.ingredients(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, unit text not null default 'pcs', on_hand numeric(14,3) not null default 0 check(on_hand>=0), reserved numeric(14,3) not null default 0 check(reserved>=0 and reserved<=on_hand), avg_cost numeric(14,2) not null default 0 check(avg_cost>=0), reorder_point numeric(14,3) not null default 0);
create table public.menu_items(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, category_id uuid references public.categories(id), name text not null, price numeric(14,2) not null check(price>=0), available boolean not null default true, created_at timestamptz default now());
create table public.recipes(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, menu_item_id uuid not null references public.menu_items(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id), qty numeric(14,3) not null check(qty>0), unique(menu_item_id,ingredient_id));
create table public.dining_tables(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, branch_id uuid not null references public.branches(id), name text not null, area text not null default 'Indoor', capacity int not null default 4, status text not null default 'available' check(status in ('available','occupied','payment','cleaning')), unique(branch_id,name));
create table public.orders(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, branch_id uuid not null references public.branches(id), table_id uuid references public.dining_tables(id), channel text not null default 'dine_in' check(channel in ('dine_in','takeaway','delivery')), status text not null default 'open' check(status in ('open','preparing','ready','served','completed','cancelled')), payment_status text not null default 'unpaid' check(payment_status in ('unpaid','partial','paid','refunded')), notes text, subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, service_charge numeric(14,2) not null default 0, total numeric(14,2) not null default 0, created_at timestamptz not null default now(), created_by uuid, request_key uuid unique);
create table public.order_items(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, order_id uuid not null references public.orders(id) on delete cascade, menu_item_id uuid not null references public.menu_items(id), quantity int not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0), cost_snapshot numeric(14,2) not null default 0, status text not null default 'waiting' check(status in ('waiting','preparing','ready','served','cancelled')), notes text, created_at timestamptz default now());
create table public.payments(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, order_id uuid not null references public.orders(id), amount numeric(14,2) not null check(amount>0), method text not null check(method in ('cash','qris_dummy','transfer_dummy','cod_dummy')), status text not null default 'simulated' check(status in ('simulated','refunded','void')), request_key uuid unique, created_at timestamptz default now());
create table public.stock_movements(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id), movement_type text not null check(movement_type in ('purchase','consume','reserve','release','waste','adjust','produce')), quantity numeric(14,3) not null, cost_snapshot numeric(14,2), reference_id uuid, created_at timestamptz default now());
create table public.suppliers(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, phone text);
create table public.purchases(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, branch_id uuid not null references public.branches(id), supplier_id uuid references public.suppliers(id), status text not null default 'draft', total numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, created_at timestamptz default now());
create table public.purchase_items(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, purchase_id uuid not null references public.purchases(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id), qty numeric(14,3) not null check(qty>0), unit_cost numeric(14,2) not null check(unit_cost>=0));
create table public.cash_shifts(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, branch_id uuid not null references public.branches(id), opening_cash numeric(14,2) not null default 0, expected_cash numeric(14,2), counted_cash numeric(14,2), status text not null default 'open', opened_at timestamptz default now(), closed_at timestamptz);
create table public.expenses(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, branch_id uuid not null references public.branches(id), description text not null, category text not null default 'operational', amount numeric(14,2) not null check(amount>=0), incurred_at timestamptz default now());
create table public.audit_events(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, actor_uid uuid, event_type text not null, entity_type text not null, entity_id uuid, payload jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create index idx_orders_tenant_created on public.orders(organization_id,created_at desc);
create index idx_orders_branch_status on public.orders(branch_id,status);
create index idx_order_items_order on public.order_items(order_id);
create index idx_payments_order on public.payments(order_id);
create index idx_stock_moves_ingredient on public.stock_movements(ingredient_id,created_at);
create index idx_memberships_user on public.memberships(user_uid,organization_id);
create or replace function public.is_demo_member(target_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.memberships m join public.demo_sessions s on s.organization_id=m.organization_id where m.organization_id=target_org and m.user_uid=(select auth.uid()) and s.expires_at>now());
$$;
revoke all on function public.is_demo_member(uuid) from public;
grant execute on function public.is_demo_member(uuid) to authenticated;
do $$ declare t text; begin foreach t in array array['organizations','branches','demo_sessions','memberships','categories','ingredients','menu_items','recipes','dining_tables','orders','order_items','payments','stock_movements','suppliers','purchases','purchase_items','cash_shifts','expenses','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 if t='organizations' then execute 'create policy demo_read on public.organizations for select to authenticated using (public.is_demo_member(id))';
 elsif t='demo_sessions' then execute 'create policy demo_read on public.demo_sessions for select to authenticated using (public.is_demo_member(organization_id))';
 elsif t='memberships' then execute 'create policy demo_read on public.memberships for select to authenticated using (public.is_demo_member(organization_id))';
 else
 execute format('create policy demo_read on public.%I for select to authenticated using (public.is_demo_member(organization_id))',t);
 end if;
 end loop; end $$;
-- All writes are denied by default. Privileged RPC functions will implement validated mutations.
create or replace function public.start_demo() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); o uuid; b uuid; sess uuid; c uuid; it uuid; cat uuid; m uuid; i uuid; code text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if (select count(*) from public.demo_sessions where owner_uid=u and expires_at>now())>=3 then raise exception 'Demo session limit reached'; end if;
 code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
 insert into public.organizations(name,slug) values('Rumah Makan Sunda Simulasi','demo-'||replace(gen_random_uuid()::text,'-','')) returning id into o;
 insert into public.branches(organization_id,name) values(o,'Cabang Utama') returning id into b;
 insert into public.demo_sessions(organization_id,owner_uid,share_code) values(o,u,code) returning id into sess;
 insert into public.memberships(organization_id,user_uid,role) values(o,u,'owner');
 insert into public.categories(organization_id,name) values(o,'Paket Nasi') returning id into cat;
 insert into public.categories(organization_id,name) values(o,'Minuman') returning id into c;
 insert into public.menu_items(organization_id,category_id,name,price) values(o,cat,'Nasi Timbel Komplit',35000) returning id into m;
 insert into public.ingredients(organization_id,name,unit,on_hand,avg_cost,reorder_point) values(o,'Ayam ungkep','pcs',45,12000,10) returning id into i;
 insert into public.recipes(organization_id,menu_item_id,ingredient_id,qty) values(o,m,i,1);
 insert into public.menu_items(organization_id,category_id,name,price) values(o,c,'Es Teh Manis',6000);
 insert into public.dining_tables(organization_id,branch_id,name,area,capacity) values(o,b,'Meja 01','Indoor',4),(o,b,'Meja 02','Indoor',4),(o,b,'Meja 03','Lesehan',6);
 insert into public.suppliers(organization_id,name) values(o,'Supplier Dummy Sayuran'),(o,'Supplier Dummy Protein');
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id) values(o,u,'demo.created','demo_session',sess);
 return jsonb_build_object('session_id',sess,'organization_id',o,'branch_id',b,'share_code',code,'expires_at',(select expires_at from public.demo_sessions where id=sess));
end $$;
revoke all on function public.start_demo() from public;
grant execute on function public.start_demo() to authenticated;
