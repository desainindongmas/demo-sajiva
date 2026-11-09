CREATE OR REPLACE FUNCTION public.advance_demo_kitchen_item(p_org uuid, p_item uuid, p_next text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare it public.order_items%rowtype; ord public.orders%rowtype; ing record; v_status text; v_count integer;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 select * into it from public.order_items where id=p_item and organization_id=p_org for update;
 if not found then raise exception 'Item does not belong to your demo'; end if;
 select * into ord from public.orders where id=it.order_id and organization_id=p_org for update;
 if ord.status in ('cancelled','completed') then raise exception 'Order already closed'; end if;
 if not ((it.status='waiting' and p_next in ('preparing','cancelled')) or
         (it.status='preparing' and p_next='ready') or
         (it.status='ready' and p_next='served')) then
   raise exception 'Invalid kitchen transition: % to %',it.status,p_next;
 end if;
 if p_next='cancelled' and exists(select 1 from public.payments where order_id=ord.id and organization_id=p_org and status='simulated') then
   raise exception 'Refund approval required before cancelling paid items';
 end if;
 if it.status='waiting' then
   for ing in
    select r.ingredient_id,r.qty * it.quantity as qty,i.avg_cost
    from public.recipes r join public.ingredients i on i.id=r.ingredient_id
      and i.organization_id=p_org
    where r.organization_id=p_org and r.menu_item_id=it.menu_item_id
    order by r.ingredient_id
   loop
     if p_next='preparing' then
       update public.ingredients
         set reserved=reserved-ing.qty, on_hand=on_hand-ing.qty
       where id=ing.ingredient_id and organization_id=p_org
         and reserved>=ing.qty and on_hand>=ing.qty;
       if not found then raise exception 'Reserved stock mismatch'; end if;
       insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
         values (p_org,ing.ingredient_id,'consume',ing.qty,ing.avg_cost,it.id);
     else
       update public.ingredients set reserved=reserved-ing.qty
       where id=ing.ingredient_id and organization_id=p_org and reserved>=ing.qty;
       if not found then raise exception 'Reserved stock mismatch'; end if;
       insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
         values (p_org,ing.ingredient_id,'release',ing.qty,ing.avg_cost,it.id);
     end if;
   end loop;
 end if;
 update public.order_items set status=p_next where id=p_item;
 if p_next='cancelled' then
   update public.orders set subtotal=greatest(0,subtotal-it.unit_price*it.quantity),
     total=greatest(0,total-it.unit_price*it.quantity) where id=ord.id;
 end if;
 if not exists(select 1 from public.order_items where order_id=ord.id and status<>'cancelled') then
   v_status:='cancelled';
 elsif not exists(select 1 from public.order_items where order_id=ord.id and status not in ('served','cancelled')) then
   if ord.payment_status='paid' then v_status:='completed'; else v_status:='served'; end if;
 elsif exists(select 1 from public.order_items where order_id=ord.id and status='preparing') then
   v_status:='preparing';
 elsif exists(select 1 from public.order_items where order_id=ord.id and status='ready') then
   v_status:='ready';
 else
   v_status:='open';
 end if;
 update public.orders set status=v_status where id=ord.id;
 if v_status='cancelled' and ord.table_id is not null then
   update public.dining_tables set status='available'
   where id=ord.table_id and organization_id=p_org;
 end if;
 if v_status='completed' and ord.table_id is not null then
   update public.dining_tables set status='cleaning'
   where id=ord.table_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'kitchen.status','order_item',p_item,jsonb_build_object('from',it.status,'to',p_next));
 return v_status;
end $function$
