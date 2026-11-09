
create table public.demo_cancel_requests(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 order_item_id uuid not null references public.order_items(id),
 requested_by uuid not null,
 reason text not null check(length(trim(reason)) between 4 and 500),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index demo_cancel_one_pending on public.demo_cancel_requests(order_item_id) where status='pending';
create index demo_cancel_org_status on public.demo_cancel_requests(organization_id,status,created_at);
alter table public.demo_cancel_requests enable row level security;
create policy demo_read on public.demo_cancel_requests for select to authenticated using(public.is_demo_member(organization_id));

create or replace function public.move_demo_order_table(p_org uuid,p_order uuid,p_new_table uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_target public.dining_tables%rowtype; v_old uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 select * into v_order from public.orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.channel<>'dine_in' or v_order.status in ('completed','cancelled') then raise exception 'Only active dine-in orders can move tables'; end if;
 if p_new_table is null or p_new_table=v_order.table_id then raise exception 'Choose a different table'; end if;
 select * into v_target from public.dining_tables where id=p_new_table and organization_id=p_org and branch_id=v_order.branch_id for update;
 if not found or v_target.status<>'available' then raise exception 'Destination table must be available in the same branch'; end if;
 v_old:=v_order.table_id;
 update public.orders set table_id=p_new_table where id=p_order and organization_id=p_org;
 update public.dining_tables set status=case when v_order.payment_status='paid' then 'payment' else 'occupied' end where id=p_new_table and organization_id=p_org;
 if v_old is not null and not exists(select 1 from public.orders where organization_id=p_org and table_id=v_old and status not in ('completed','cancelled')) then
  update public.dining_tables set status='available' where id=v_old and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'order.table_moved','order',p_order,jsonb_build_object('from',v_old,'to',p_new_table));
end $$;
revoke all on function public.move_demo_order_table(uuid,uuid,uuid) from public;
grant execute on function public.move_demo_order_table(uuid,uuid,uuid) to authenticated;

create or replace function public.request_demo_item_cancellation(p_org uuid,p_item uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.order_items%rowtype; v_order public.orders%rowtype; v_id uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if length(trim(coalesce(p_reason,''))) not between 4 and 500 then raise exception 'Reason must be 4-500 characters'; end if;
 select * into v_item from public.order_items where id=p_item and organization_id=p_org;
 if not found then raise exception 'Item not found'; end if;
 select * into v_order from public.orders where id=v_item.order_id and organization_id=p_org;
 if v_item.status not in ('preparing','ready') or v_order.status in ('cancelled','completed') then raise exception 'Item is not eligible for manager cancellation'; end if;
 if exists(select 1 from public.payments where organization_id=p_org and order_id=v_order.id and status='simulated') then raise exception 'Paid or partly paid orders require refund workflow'; end if;
 insert into public.demo_cancel_requests(organization_id,order_item_id,requested_by,reason)
 values(p_org,p_item,auth.uid(),trim(p_reason)) returning id into v_id;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'item.cancel_requested','order_item',p_item,jsonb_build_object('request_id',v_id));
 return v_id;
end $$;
revoke all on function public.request_demo_item_cancellation(uuid,uuid,text) from public;
grant execute on function public.request_demo_item_cancellation(uuid,uuid,text) to authenticated;

create or replace function public.decide_demo_item_cancellation(p_org uuid,p_request uuid,p_approve boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.demo_cancel_requests%rowtype; it public.order_items%rowtype; ord public.orders%rowtype; v_status text;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.memberships m where m.organization_id=p_org and m.user_uid=auth.uid() and m.role in ('owner','manager')) then raise exception 'Owner or manager authorization required'; end if;
 select * into req from public.demo_cancel_requests where id=p_request and organization_id=p_org for update;
 if not found or req.status<>'pending' then raise exception 'Request is not pending'; end if;
 select * into it from public.order_items where id=req.order_item_id and organization_id=p_org for update;
 select * into ord from public.orders where id=it.order_id and organization_id=p_org for update;
 if p_approve then
   if it.status not in ('preparing','ready') or ord.status in ('cancelled','completed') then raise exception 'Order state changed; review again'; end if;
   if exists(select 1 from public.payments where organization_id=p_org and order_id=ord.id and status='simulated') then raise exception 'Refund procedure required'; end if;
   update public.order_items set status='cancelled' where id=it.id and organization_id=p_org;
   update public.orders set subtotal=greatest(0,subtotal-it.quantity*it.unit_price),total=greatest(0,total-it.quantity*it.unit_price) where id=ord.id and organization_id=p_org;
   if not exists(select 1 from public.order_items where order_id=ord.id and status<>'cancelled') then v_status:='cancelled';
   elsif exists(select 1 from public.order_items where order_id=ord.id and status='preparing') then v_status:='preparing';
   elsif exists(select 1 from public.order_items where order_id=ord.id and status='waiting') then v_status:='open';
   elsif exists(select 1 from public.order_items where order_id=ord.id and status='ready') then v_status:='ready';
   else v_status:='served'; end if;
   update public.orders set status=v_status where id=ord.id and organization_id=p_org;
   if v_status='cancelled' and ord.table_id is not null then
      update public.dining_tables set status='cleaning' where id=ord.table_id and organization_id=p_org;
   end if;
 end if;
 update public.demo_cancel_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where id=req.id;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'item.cancel_decided','order_item',it.id,jsonb_build_object('approved',p_approve,'request_id',req.id,'ingredients_restored',false));
 return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.decide_demo_item_cancellation(uuid,uuid,boolean) from public;
grant execute on function public.decide_demo_item_cancellation(uuid,uuid,boolean) to authenticated;
