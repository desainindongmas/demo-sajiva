alter table public.demo_inventory_events add column if not exists payload_hash text;
create or replace function public.record_demo_inventory_event(
 p_org uuid,p_ingredient uuid,p_type text,p_quantity numeric,p_reason text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_stock public.ingredients%rowtype; v_delta numeric(14,3); v_record uuid; v_hash text; v_prev_hash text;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_request_key is null then raise exception 'Request key required'; end if;
 if p_type not in ('waste','opname') then raise exception 'Unsupported inventory event'; end if;
 if p_quantity is null or p_quantity<0 or p_quantity<>round(p_quantity,3) or p_quantity>1000000 then raise exception 'Invalid stock quantity precision'; end if;
 if length(trim(coalesce(p_reason,''))) not between 4 and 500 then raise exception 'Reason must be 4-500 characters'; end if;
 v_hash:=md5(p_ingredient::text||'|'||p_type||'|'||p_quantity::text||'|'||trim(p_reason));
 select * into v_stock from public.ingredients where id=p_ingredient and organization_id=p_org for update;
 if not found then raise exception 'Ingredient not found in demo'; end if;
 select id,payload_hash into v_record,v_prev_hash from public.demo_inventory_events where organization_id=p_org and request_key=p_request_key;
 if found then
   if v_prev_hash is distinct from v_hash then raise exception 'Request key reused with different inventory event'; end if;
   return v_record;
 end if;
 if p_type='waste' then
  if p_quantity<=0 then raise exception 'Waste quantity must be positive'; end if;
  if p_quantity>v_stock.on_hand-v_stock.reserved then raise exception 'Waste exceeds unreserved physical stock'; end if;
  v_delta:=-p_quantity;
 else
  if p_quantity<v_stock.reserved then raise exception 'Stock count is less than quantity already reserved for kitchen'; end if;
  v_delta:=p_quantity-v_stock.on_hand;
 end if;
 update public.ingredients set on_hand=on_hand+v_delta where id=p_ingredient and organization_id=p_org;
 insert into public.demo_inventory_events(organization_id,ingredient_id,event_type,quantity_change,counted_quantity,reason,cost_snapshot,actor_uid,request_key,payload_hash)
 values(p_org,p_ingredient,p_type,v_delta,case when p_type='opname' then p_quantity else null end,trim(p_reason),v_stock.avg_cost,auth.uid(),p_request_key,v_hash)
 returning id into v_record;
 insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
 values(p_org,p_ingredient,case when p_type='waste' then 'waste' else 'adjust' end,v_delta,v_stock.avg_cost,v_record);
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'inventory.'||p_type,'ingredient',p_ingredient,jsonb_build_object('delta',v_delta,'reason',trim(p_reason),'inventory_event_id',v_record));
 return v_record;
end $$;