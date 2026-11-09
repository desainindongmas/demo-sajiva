create or replace function public.create_demo_order(p_org uuid,p_branch uuid,p_table uuid,p_items jsonb,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; line jsonb; mid uuid; qty integer; price numeric(14,2); v_subtotal numeric(14,2):=0; cost numeric(14,2); ing record; vavailable numeric(14,3); 
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.branches where id=p_branch and organization_id=p_org) then raise exception 'Branch mismatch'; end if;
 if p_table is not null and not exists(select 1 from public.dining_tables where id=p_table and organization_id=p_org and branch_id=p_branch) then raise exception 'Table mismatch'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid items'; end if;
 select id into result from public.orders where request_key=p_request_key and organization_id=p_org;
 if found then return result; end if;
 insert into public.orders(organization_id,branch_id,table_id,channel,created_by,request_key) values (p_org,p_branch,p_table,case when p_table is null then 'takeaway' else 'dine_in' end,auth.uid(),p_request_key) returning id into result;
 for line in select value from jsonb_array_elements(p_items) loop
   mid:=(line->>'menu_item_id')::uuid; qty:=(line->>'quantity')::integer;
   if qty is null or qty<1 or qty>50 then raise exception 'Invalid quantity'; end if;
   select m.price into price from public.menu_items m where m.id=mid and m.organization_id=p_org and m.available=true;
   if not found then raise exception 'Menu not found'; end if;
   cost:=0;
   for ing in select r.ingredient_id,r.qty,i.avg_cost from public.recipes r join public.ingredients i on i.id=r.ingredient_id and i.organization_id=p_org where r.menu_item_id=mid and r.organization_id=p_org order by r.ingredient_id loop
      update public.ingredients i set reserved=i.reserved+(ing.qty*qty) where i.id=ing.ingredient_id and i.organization_id=p_org and (i.on_hand-i.reserved)>=(ing.qty*qty);
      if not found then raise exception 'Insufficient stock for menu'; end if;
      insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,reference_id,cost_snapshot) values(p_org,ing.ingredient_id,'reserve',ing.qty*qty,result,ing.avg_cost);
      cost:=cost+(ing.qty*ing.avg_cost);
   end loop;
   insert into public.order_items(organization_id,order_id,menu_item_id,quantity,unit_price,cost_snapshot) values(p_org,result,mid,qty,price,cost);
   v_subtotal:=v_subtotal+price*qty;
 end loop;
 update public.orders set subtotal=v_subtotal,total=v_subtotal where id=result;
 if p_table is not null then update public.dining_tables set status='occupied' where id=p_table and organization_id=p_org; end if;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload) values(p_org,auth.uid(),'order.created','order',result,jsonb_build_object('total',v_subtotal));
 return result;
end $$;
