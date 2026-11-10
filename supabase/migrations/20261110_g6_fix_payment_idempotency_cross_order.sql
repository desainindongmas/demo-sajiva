create or replace function public.complete_demo_payment(p_org uuid,p_order uuid,p_amount numeric,p_method text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype;v_paid numeric(14,2);v_payment uuid;v_prior public.payments%rowtype;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if p_request_key is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_method not in ('cash','qris_dummy','transfer_dummy','cod_dummy') then
   raise exception 'Invalid simulated payment';end if;
 select * into v_order from public.orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception 'Order not found';end if;
 select * into v_prior from public.payments where request_key=p_request_key and organization_id=p_org;
 if found then
   if v_prior.order_id<>p_order or v_prior.amount<>p_amount or v_prior.method<>p_method or v_prior.status<>'simulated' then
     raise exception 'Payment request key reused with different order, amount or method';
   end if;
   return v_prior.id;
 end if;
 if v_order.status='cancelled' or v_order.status='completed' then raise exception 'Closed orders cannot be paid';end if;
 select coalesce(sum(amount),0) into v_paid from public.payments
 where order_id=p_order and organization_id=p_org and status='simulated';
 if v_paid+p_amount>v_order.total then raise exception 'Payment exceeds outstanding balance';end if;
 insert into public.payments(organization_id,order_id,amount,method,request_key)
 values(p_org,p_order,p_amount,p_method,p_request_key) returning id into v_payment;
 update public.orders set payment_status=case when v_paid+p_amount=v_order.total then 'paid' else 'partial' end,
 status=case when v_paid+p_amount=v_order.total and v_order.status='served' then 'completed' else v_order.status end
 where id=p_order and organization_id=p_org;
 if v_paid+p_amount=v_order.total and v_order.table_id is not null then
  update public.dining_tables set status=case when v_order.status='served' then 'cleaning' else 'payment' end
  where id=v_order.table_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'demo.payment','payment',v_payment,jsonb_build_object('amount',p_amount,'method',p_method));
 return v_payment;
end $$;
revoke all on function public.complete_demo_payment(uuid,uuid,numeric,text,uuid) from public;
grant execute on function public.complete_demo_payment(uuid,uuid,numeric,text,uuid) to authenticated;