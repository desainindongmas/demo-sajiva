
create table public.demo_order_tables(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 table_id uuid not null references public.dining_tables(id),
 attached_by uuid,
 attached_at timestamptz not null default now(),
 unique(order_id,table_id)
);
create index idx_demo_order_tables_tenant on public.demo_order_tables(organization_id,order_id);
create index idx_demo_order_tables_table on public.demo_order_tables(table_id);
alter table public.demo_order_tables enable row level security;
create policy demo_read on public.demo_order_tables for select to authenticated using(public.is_demo_member(organization_id));

create or replace function public.attach_demo_table(p_org uuid,p_order uuid,p_table uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.orders%rowtype; tab public.dining_tables%rowtype; attached uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 select * into ord from public.orders where id=p_order and organization_id=p_org for update;
 if not found or ord.channel<>'dine_in' or ord.table_id is null or ord.status in ('completed','cancelled') then
  raise exception 'Only active dine-in orders support joining tables';
 end if;
 if p_table=ord.table_id then raise exception 'Table already primary'; end if;
 select * into tab from public.dining_tables where id=p_table and organization_id=p_org and branch_id=ord.branch_id for update;
 if not found then raise exception 'Table not found in this branch'; end if;
 select id into attached from public.demo_order_tables where order_id=p_order and table_id=p_table;
 if found then return attached; end if;
 if tab.status<>'available' then raise exception 'Only an available table can join this bill'; end if;
 if exists(select 1 from public.orders o where o.organization_id=p_org and o.table_id=p_table and o.status not in ('completed','cancelled'))
   or exists(select 1 from public.demo_order_tables ot join public.orders o on o.id=ot.order_id
     where ot.organization_id=p_org and ot.table_id=p_table and o.status not in ('completed','cancelled')) then
  raise exception 'Table already belongs to an active bill';
 end if;
 insert into public.demo_order_tables(organization_id,order_id,table_id,attached_by)
 values(p_org,p_order,p_table,auth.uid()) returning id into attached;
 update public.dining_tables set status=case when ord.payment_status='paid' then 'payment' else 'occupied' end
 where id=p_table and organization_id=p_org;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'order.table_joined','order',p_order,jsonb_build_object('additional_table',p_table));
 return attached;
end $$;
revoke all on function public.attach_demo_table(uuid,uuid,uuid) from public;
grant execute on function public.attach_demo_table(uuid,uuid,uuid) to authenticated;

create or replace function public.sync_demo_joined_table_states() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then
   if new.status in ('completed','cancelled') then
     update public.dining_tables t set status='cleaning'
       from public.demo_order_tables l where l.table_id=t.id and l.order_id=new.id and l.organization_id=new.organization_id;
   elsif new.payment_status='paid' then
     update public.dining_tables t set status='payment'
       from public.demo_order_tables l where l.table_id=t.id and l.order_id=new.id and l.organization_id=new.organization_id;
   end if;
 end if;
 return new;
end $$;
create trigger trg_joined_tables_order_status after update of status,payment_status on public.orders
for each row execute function public.sync_demo_joined_table_states();

-- Avoid moving the primary table out from underneath a multi-table bill.
create or replace function public.prevent_move_joined_primary() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if old.table_id is distinct from new.table_id and exists(select 1 from public.demo_order_tables where order_id=old.id)
 then raise exception 'Detach joined tables before moving a multi-table bill'; end if;
 return new;
end $$;
create trigger trg_protect_joined_table_bill before update of table_id on public.orders
for each row execute function public.prevent_move_joined_primary();
