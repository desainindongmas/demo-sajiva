
-- Sajiva G2.2: recipes, controlled waste, stock opname.
create table public.demo_inventory_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id),
 event_type text not null check(event_type in ('waste','opname')),
 quantity_change numeric(14,3) not null,
 counted_quantity numeric(14,3),
 reason text not null check(length(trim(reason)) between 4 and 500),
 cost_snapshot numeric(14,2) not null,
 actor_uid uuid,
 request_key uuid not null,
 created_at timestamptz not null default now(),
 unique(organization_id,request_key)
);
create index idx_demo_inventory_events_org on public.demo_inventory_events(organization_id,created_at desc);
alter table public.demo_inventory_events enable row level security;
create policy demo_read on public.demo_inventory_events for select to authenticated using(public.is_demo_member(organization_id));
create or replace function public.set_demo_recipe_line(p_org uuid,p_menu uuid,p_ingredient uuid,p_qty numeric)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_qty is null or p_qty<=0 or p_qty>10000 or p_qty<>round(p_qty,3) then raise exception 'Recipe quantity must be positive with max 3 decimals'; end if;
 if not exists(select 1 from public.menu_items where id=p_menu and organization_id=p_org) then raise exception 'Menu not found'; end if;
 if not exists(select 1 from public.ingredients where id=p_ingredient and organization_id=p_org) then raise exception 'Ingredient not found'; end if;
 -- Prevent retroactive reservation mismatch while any unstarted order uses this menu.
 if exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
 where oi.organization_id=p_org and oi.menu_item_id=p_menu and oi.status='waiting'
 and o.status not in ('completed','cancelled')) then raise exception 'Finish or cancel waiting kitchen items before changing this recipe'; end if;
 insert into public.recipes(organization_id,menu_item_id,ingredient_id,qty)
 values(p_org,p_menu,p_ingredient,p_qty)
 on conflict(menu_item_id,ingredient_id) do update set qty=excluded.qty
 returning id into v_id;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'recipe.updated','menu_item',p_menu,jsonb_build_object('ingredient_id',p_ingredient,'qty',p_qty));
 return v_id;
end $$;
revoke all on function public.set_demo_recipe_line(uuid,uuid,uuid,numeric) from public;
grant execute on function public.set_demo_recipe_line(uuid,uuid,uuid,numeric) to authenticated;

create or replace function public.remove_demo_recipe_line(p_org uuid,p_menu uuid,p_ingredient uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
 where oi.organization_id=p_org and oi.menu_item_id=p_menu and oi.status='waiting'
 and o.status not in ('completed','cancelled')) then raise exception 'Cannot change recipe while waiting orders reserve its ingredients'; end if;
 delete from public.recipes where organization_id=p_org and menu_item_id=p_menu and ingredient_id=p_ingredient;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'recipe.line_removed','menu_item',p_menu,jsonb_build_object('ingredient_id',p_ingredient));
end $$;
revoke all on function public.remove_demo_recipe_line(uuid,uuid,uuid) from public;
grant execute on function public.remove_demo_recipe_line(uuid,uuid,uuid) to authenticated;

create or replace function public.record_demo_inventory_event(
 p_org uuid,p_ingredient uuid,p_type text,p_quantity numeric,p_reason text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_stock public.ingredients%rowtype; v_delta numeric(14,3); v_record uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_request_key is null then raise exception 'Request key required'; end if;
 if p_type not in ('waste','opname') then raise exception 'Unsupported inventory event'; end if;
 if p_quantity is null or p_quantity<0 or p_quantity<>round(p_quantity,3) or p_quantity>1000000 then raise exception 'Invalid stock quantity precision'; end if;
 if length(trim(coalesce(p_reason,''))) not between 4 and 500 then raise exception 'Reason must be 4-500 characters'; end if;
 select * into v_stock from public.ingredients where id=p_ingredient and organization_id=p_org for update;
 if not found then raise exception 'Ingredient not found in demo'; end if;
 select id into v_record from public.demo_inventory_events where organization_id=p_org and request_key=p_request_key;
 if found then return v_record; end if;
 if p_type='waste' then
  if p_quantity<=0 then raise exception 'Waste quantity must be positive'; end if;
  if p_quantity>v_stock.on_hand-v_stock.reserved then raise exception 'Waste exceeds unreserved physical stock'; end if;
  v_delta:=-p_quantity;
 else
  if p_quantity<v_stock.reserved then raise exception 'Stock count is less than quantity already reserved for kitchen'; end if;
  v_delta:=p_quantity-v_stock.on_hand;
 end if;
 update public.ingredients set on_hand=on_hand+v_delta where id=p_ingredient and organization_id=p_org;
 insert into public.demo_inventory_events(organization_id,ingredient_id,event_type,quantity_change,counted_quantity,reason,cost_snapshot,actor_uid,request_key)
 values(p_org,p_ingredient,p_type,v_delta,case when p_type='opname' then p_quantity else null end,trim(p_reason),v_stock.avg_cost,auth.uid(),p_request_key)
 returning id into v_record;
 insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
 values(p_org,p_ingredient,case when p_type='waste' then 'waste' else 'adjust' end,v_delta,v_stock.avg_cost,v_record);
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'inventory.'||p_type,'ingredient',p_ingredient,jsonb_build_object('delta',v_delta,'reason',trim(p_reason),'inventory_event_id',v_record));
 return v_record;
end $$;
revoke all on function public.record_demo_inventory_event(uuid,uuid,text,numeric,text,uuid) from public;
grant execute on function public.record_demo_inventory_event(uuid,uuid,text,numeric,text,uuid) to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='demo_inventory_events') then
   alter publication supabase_realtime add table public.demo_inventory_events;
 end if;
end $$;
