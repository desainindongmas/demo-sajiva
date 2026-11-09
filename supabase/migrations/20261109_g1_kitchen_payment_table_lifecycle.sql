
create index if not exists idx_order_items_tenant_status on public.order_items(organization_id,status,created_at);
create or replace function public.advance_demo_kitchen_item(p_org uuid,p_item uuid,p_next text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
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
 if not exists(select 1 from public.order_items where order_id=ord.id and status not in ('served','cancelled')) then
   if ord.payment_status='paid' then v_status:='completed'; else v_status:='served'; end if;
 elsif exists(select 1 from public.order_items where order_id=ord.id and status='preparing') then
   v_status:='preparing';
 elsif exists(select 1 from public.order_items where order_id=ord.id and status='ready') then
   v_status:='ready';
 else
   v_status:='open';
 end if;
 update public.orders set status=v_status where id=ord.id;
 if v_status='completed' and ord.table_id is not null then
   update public.dining_tables set status='cleaning'
   where id=ord.table_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'kitchen.status','order_item',p_item,jsonb_build_object('from',it.status,'to',p_next));
 return v_status;
end $$;
revoke all on function public.advance_demo_kitchen_item(uuid,uuid,text) from public;
grant execute on function public.advance_demo_kitchen_item(uuid,uuid,text) to authenticated;

create or replace function public.complete_demo_payment(p_org uuid,p_order uuid,p_amount numeric,p_method text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_paid numeric(14,2); v_payment uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_amount<=0 or p_amount is null or p_method not in ('cash','qris_dummy','transfer_dummy','cod_dummy') then
   raise exception 'Invalid simulated payment'; end if;
 select * into v_order from public.orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status='cancelled' then raise exception 'Cancelled orders cannot be paid'; end if;
 select id into v_payment from public.payments where request_key=p_request_key and organization_id=p_org;
 if found then return v_payment; end if;
 select coalesce(sum(amount),0) into v_paid from public.payments
 where order_id=p_order and organization_id=p_org and status='simulated';
 if v_paid+p_amount>v_order.total then raise exception 'Payment exceeds outstanding balance'; end if;
 insert into public.payments(organization_id,order_id,amount,method,request_key)
 values(p_org,p_order,p_amount,p_method,p_request_key) returning id into v_payment;
 update public.orders set payment_status=case when v_paid+p_amount=v_order.total then 'paid' else 'partial' end,
 status=case when v_paid+p_amount=v_order.total and v_order.status='served' then 'completed' else v_order.status end
 where id=p_order;
 if v_paid+p_amount=v_order.total and v_order.table_id is not null then
   update public.dining_tables
   set status=case when v_order.status='served' then 'cleaning' else 'payment' end
   where id=v_order.table_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'demo.payment','payment',v_payment,jsonb_build_object('amount',p_amount,'method',p_method));
 return v_payment;
end $$;
revoke all on function public.complete_demo_payment(uuid,uuid,numeric,text,uuid) from public;
grant execute on function public.complete_demo_payment(uuid,uuid,numeric,text,uuid) to authenticated;

create or replace function public.mark_demo_table_clean(p_org uuid,p_table uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.dining_tables where organization_id=p_org and id=p_table and status='cleaning') then
  raise exception 'Table not ready for cleaning completion';
 end if;
 if exists(select 1 from public.orders where organization_id=p_org and table_id=p_table and status not in ('completed','cancelled')) then
  raise exception 'Unfinished order on table';
 end if;
 update public.dining_tables set status='available' where id=p_table and organization_id=p_org;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id)
 values(p_org,auth.uid(),'table.cleaned','dining_table',p_table);
end $$;
revoke all on function public.mark_demo_table_clean(uuid,uuid) from public;
grant execute on function public.mark_demo_table_clean(uuid,uuid) to authenticated;
