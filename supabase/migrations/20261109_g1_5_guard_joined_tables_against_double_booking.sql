
create or replace function public.guard_demo_order_table_availability() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.dining_tables%rowtype;
begin
 if new.channel='dine_in' and new.table_id is not null then
   select * into t from public.dining_tables where id=new.table_id and organization_id=new.organization_id and branch_id=new.branch_id for update;
   if not found then raise exception 'Invalid dine-in table'; end if;
   if t.status<>'available' then raise exception 'Table is not available for a new independent bill'; end if;
   if exists(select 1 from public.orders where table_id=new.table_id and organization_id=new.organization_id and status not in ('completed','cancelled'))
   or exists(select 1 from public.demo_order_tables dt join public.orders o on o.id=dt.order_id
      where dt.organization_id=new.organization_id and dt.table_id=new.table_id and o.status not in ('completed','cancelled')) then
      raise exception 'Table is already in an active bill';
   end if;
 end if;
 return new;
end $$;
create trigger trg_guard_new_dinein_table before insert on public.orders
for each row execute function public.guard_demo_order_table_availability();
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='demo_order_tables')
 then alter publication supabase_realtime add table public.demo_order_tables; end if;
end $$;
