create or replace function public.receive_demo_purchase(
 p_org uuid,p_branch uuid,p_supplier uuid,p_lines jsonb,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_purchase uuid; v_existing public.purchases%rowtype; v_supplier uuid;
 v_line jsonb; v_ingredient uuid; v_qty numeric; v_unit_cost numeric;
 v_old public.ingredients%rowtype; v_total numeric(14,2):=0; v_cost numeric(14,2);
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if p_request_key is null then raise exception 'Request key required'; end if;
 if not exists(select 1 from public.branches where id=p_branch and organization_id=p_org) then raise exception 'Invalid branch'; end if;
 if p_supplier is not null and not exists(select 1 from public.suppliers where id=p_supplier and organization_id=p_org) then raise exception 'Invalid supplier'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
  raise exception 'Provide 1 to 30 purchase lines'; end if;
 select * into v_existing from public.purchases where organization_id=p_org and request_key=p_request_key for update;
 if found then
  if v_existing.branch_id<>p_branch or v_existing.supplier_id is distinct from p_supplier
  then raise exception 'Request key reused for another supplier or branch'; end if;
  return v_existing.id;
 end if;
 -- Preflight: all lines validated before performing inserts. Enforce unique ingredients.
 if (select count(*) from jsonb_array_elements(p_lines) x) <>
    (select count(distinct x->>'ingredient_id') from jsonb_array_elements(p_lines) x) then raise exception 'Duplicate ingredient in receipt'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   begin
     v_ingredient:=(v_line->>'ingredient_id')::uuid;
     v_qty:=(v_line->>'quantity')::numeric;
     v_unit_cost:=(v_line->>'unit_cost')::numeric;
   exception when others then raise exception 'Invalid purchase line values'; end;
   if v_qty is null or v_qty<=0 or v_qty>100000 or v_qty<>round(v_qty,3) or v_unit_cost is null or v_unit_cost<0 or v_unit_cost>100000000 or v_unit_cost<>round(v_unit_cost,2) then
      raise exception 'Invalid quantity or unit cost'; end if;
   if not exists(select 1 from public.ingredients where id=v_ingredient and organization_id=p_org) then raise exception 'Ingredient outside this tenant'; end if;
   v_total:=v_total+round(v_qty*v_unit_cost,2);
 end loop;
 insert into public.purchases(organization_id,branch_id,supplier_id,status,total,paid,request_key)
 values(p_org,p_branch,p_supplier,'received',v_total,0,p_request_key) returning id into v_purchase;
 -- Deterministic row lock ordering on ingredients to reduce deadlocks.
 for v_old in select i.* from public.ingredients i
   where i.organization_id=p_org and i.id in
    (select (x->>'ingredient_id')::uuid from jsonb_array_elements(p_lines) x)
   order by i.id for update
 loop
   select value into v_line from jsonb_array_elements(p_lines)
   where value->>'ingredient_id'=v_old.id::text;
   v_qty:=(v_line->>'quantity')::numeric;
   v_unit_cost:=(v_line->>'unit_cost')::numeric;
   v_cost:=case when v_old.on_hand+v_qty>0
     then round((v_old.on_hand*v_old.avg_cost+v_qty*v_unit_cost)/(v_old.on_hand+v_qty),2)
     else v_unit_cost end;
   update public.ingredients set on_hand=on_hand+v_qty,avg_cost=v_cost where id=v_old.id and organization_id=p_org;
   insert into public.purchase_items(organization_id,purchase_id,ingredient_id,qty,unit_cost)
   values(p_org,v_purchase,v_old.id,v_qty,v_unit_cost);
   insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
   values(p_org,v_old.id,'purchase',v_qty,v_unit_cost,v_purchase);
 end loop;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'purchase.received','purchase',v_purchase,jsonb_build_object('total',v_total,'supplier_id',p_supplier));
 return v_purchase;
end $$;
