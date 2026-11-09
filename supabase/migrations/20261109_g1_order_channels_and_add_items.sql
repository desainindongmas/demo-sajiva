
-- G1 expansion: channel-aware order placement, notes, and safe incremental item additions.
create or replace function public.create_demo_order_v2(
 p_org uuid,p_branch uuid,p_table uuid,p_items jsonb,p_channel text,p_notes text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order uuid; v_existing public.orders%rowtype;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_channel not in ('dine_in','takeaway','delivery') then raise exception 'Invalid channel'; end if;
 if (p_channel='dine_in') <> (p_table is not null) then raise exception 'Dine-in requires a table, takeaway/delivery cannot have a table'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Notes too long'; end if;
 select * into v_existing from public.orders where organization_id=p_org and request_key=p_request_key;
 if found then
   if v_existing.channel<>p_channel or v_existing.table_id is distinct from p_table then raise exception 'Request key reused with different order parameters'; end if;
   return v_existing.id;
 end if;
 v_order:=public.create_demo_order(p_org,p_branch,p_table,p_items,p_request_key);
 update public.orders set channel=p_channel,notes=nullif(trim(p_notes),'') where id=v_order and organization_id=p_org;
 return v_order;
end $$;
revoke all on function public.create_demo_order_v2(uuid,uuid,uuid,jsonb,text,text,uuid) from public;
grant execute on function public.create_demo_order_v2(uuid,uuid,uuid,jsonb,text,text,uuid) to authenticated;

create or replace function public.add_demo_order_item(p_org uuid,p_order uuid,p_menu uuid,p_qty integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_menu public.menu_items%rowtype; v_id uuid; rec record; v_cost numeric(14,2):=0;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_qty is null or p_qty not between 1 and 50 then raise exception 'Quantity must be 1-50'; end if;
 select * into v_order from public.orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status in ('cancelled','completed','served') or v_order.payment_status<>'unpaid'
 then raise exception 'Additional items require an active unpaid order'; end if;
 select * into v_menu from public.menu_items where id=p_menu and organization_id=p_org and available for share;
 if not found then raise exception 'Menu unavailable'; end if;
 for rec in select r.ingredient_id,r.qty,i.avg_cost from public.recipes r
   join public.ingredients i on i.id=r.ingredient_id and i.organization_id=p_org
   where r.organization_id=p_org and r.menu_item_id=p_menu order by r.ingredient_id
 loop
   update public.ingredients set reserved=reserved+rec.qty*p_qty
     where id=rec.ingredient_id and organization_id=p_org and on_hand-reserved>=rec.qty*p_qty;
   if not found then raise exception 'Insufficient stock'; end if;
   v_cost:=v_cost+rec.qty*rec.avg_cost;
 end loop;
 insert into public.order_items(organization_id,order_id,menu_item_id,quantity,unit_price,cost_snapshot)
 values(p_org,p_order,p_menu,p_qty,v_menu.price,v_cost) returning id into v_id;
 for rec in select r.ingredient_id,r.qty,i.avg_cost from public.recipes r
   join public.ingredients i on i.id=r.ingredient_id and i.organization_id=p_org
   where r.organization_id=p_org and r.menu_item_id=p_menu order by r.ingredient_id
 loop
   insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,reference_id,cost_snapshot)
   values(p_org,rec.ingredient_id,'reserve',rec.qty*p_qty,v_order.id,rec.avg_cost);
 end loop;
 update public.orders set subtotal=subtotal+v_menu.price*p_qty,total=total+v_menu.price*p_qty,
 status=case when status='ready' then 'preparing' else status end
 where id=p_order and organization_id=p_org;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'order.item_added','order_item',v_id,jsonb_build_object('quantity',p_qty,'menu',v_menu.name));
 return v_id;
end $$;
revoke all on function public.add_demo_order_item(uuid,uuid,uuid,integer) from public;
grant execute on function public.add_demo_order_item(uuid,uuid,uuid,integer) to authenticated;
