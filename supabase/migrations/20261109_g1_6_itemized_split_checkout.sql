
create table public.demo_item_payment_allocations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 order_id uuid not null references public.orders(id),
 order_item_id uuid not null references public.order_items(id),
 payment_id uuid not null references public.payments(id),
 quantity integer not null check(quantity>0),
 amount numeric(14,2) not null check(amount>0),
 created_at timestamptz not null default now(),
 unique(payment_id,order_item_id)
);
create index idx_demo_item_payments_order on public.demo_item_payment_allocations(organization_id,order_id);
create index idx_demo_item_payments_item on public.demo_item_payment_allocations(order_item_id);
alter table public.demo_item_payment_allocations enable row level security;
create policy demo_read on public.demo_item_payment_allocations
for select to authenticated using(public.is_demo_member(organization_id));

-- Any order that has item allocations must be paid only through the itemized endpoint.
create or replace function public.guard_demo_mixed_billing() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.demo_item_payment_allocations a
    where a.organization_id=new.organization_id and a.order_id=new.order_id)
    and current_setting('sajiva.itemized_payment',true) is distinct from 'allowed'
 then raise exception 'Use itemized checkout for this split bill'; end if;
 return new;
end $$;
create trigger trg_guard_demo_mixed_billing before insert on public.payments
for each row execute function public.guard_demo_mixed_billing();

create or replace function public.pay_demo_order_items(
 p_org uuid,p_order uuid,p_item uuid,p_qty integer,p_method text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 ord public.orders%rowtype; it public.order_items%rowtype;
 v_allocated integer; v_paid numeric(14,2); v_amount numeric(14,2);
 v_payment uuid; v_existing public.payments%rowtype;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_request_key is null then raise exception 'Request key required'; end if;
 if p_method not in ('cash','qris_dummy','transfer_dummy','cod_dummy') then raise exception 'Invalid dummy payment method'; end if;
 if p_qty is null or p_qty<1 then raise exception 'Invalid item quantity'; end if;
 select * into ord from public.orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception 'Order not found'; end if;
 if ord.status in ('cancelled','completed') then raise exception 'Closed order'; end if;
 select * into v_existing from public.payments where request_key=p_request_key and organization_id=p_org;
 if found then
   if v_existing.order_id<>p_order or v_existing.method<>p_method or not exists(
     select 1 from public.demo_item_payment_allocations
     where organization_id=p_org and order_id=p_order and payment_id=v_existing.id
       and order_item_id=p_item and quantity=p_qty
   ) then raise exception 'Idempotency key reused with different item details'; end if;
   return v_existing.id;
 end if;
 select * into it from public.order_items where id=p_item and order_id=p_order and organization_id=p_org for update;
 if not found or it.status='cancelled' then raise exception 'Item unavailable for split payment'; end if;
 if ord.discount<>0 or ord.tax<>0 or ord.service_charge<>0 then
   raise exception 'Itemized split not available with order-level adjustments yet';
 end if;
 -- Any existing non-itemized payment makes the balance allocation ambiguous.
 if exists(select 1 from public.payments p where p.order_id=p_order and p.organization_id=p_org and p.status='simulated'
  and not exists(select 1 from public.demo_item_payment_allocations a where a.payment_id=p.id))
 then raise exception 'This order already has a general partial payment; use regular checkout'; end if;
 select coalesce(sum(quantity),0) into v_allocated
 from public.demo_item_payment_allocations where organization_id=p_org and order_item_id=p_item;
 if v_allocated+p_qty>it.quantity then raise exception 'Quantity exceeds unpaid item balance'; end if;
 v_amount:=round(it.unit_price*p_qty,2);
 if v_amount<=0 then raise exception 'Only positive-price items can use this split checkout'; end if;
 select coalesce(sum(amount),0) into v_paid from public.payments
 where organization_id=p_org and order_id=p_order and status='simulated';
 if v_paid+v_amount>ord.total then raise exception 'Payment exceeds order total'; end if;
 -- No external user can set this flag through a trusted RPC: each caller is checked above.
 perform set_config('sajiva.itemized_payment','allowed',true);
 insert into public.payments(organization_id,order_id,amount,method,request_key)
 values(p_org,p_order,v_amount,p_method,p_request_key) returning id into v_payment;
 perform set_config('sajiva.itemized_payment','',true);
 insert into public.demo_item_payment_allocations(organization_id,order_id,order_item_id,payment_id,quantity,amount)
 values(p_org,p_order,p_item,v_payment,p_qty,v_amount);
 update public.orders set payment_status=case when v_paid+v_amount=ord.total then 'paid' else 'partial' end,
 status=case when v_paid+v_amount=ord.total and ord.status='served' then 'completed' else ord.status end
 where id=p_order and organization_id=p_org;
 if v_paid+v_amount=ord.total and ord.table_id is not null then
   update public.dining_tables set status=case when ord.status='served' then 'cleaning' else 'payment' end
   where id=ord.table_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'payment.itemized','payment',v_payment,jsonb_build_object('order_item_id',p_item,'quantity',p_qty,'amount',v_amount,'method',p_method));
 return v_payment;
end $$;
revoke all on function public.pay_demo_order_items(uuid,uuid,uuid,integer,text,uuid) from public;
grant execute on function public.pay_demo_order_items(uuid,uuid,uuid,integer,text,uuid) to authenticated;

do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='demo_item_payment_allocations')
 then alter publication supabase_realtime add table public.demo_item_payment_allocations; end if;
end $$;
