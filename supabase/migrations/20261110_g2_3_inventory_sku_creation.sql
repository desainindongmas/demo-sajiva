
create or replace function public.create_demo_inventory_sku(p_org uuid,p_name text,p_unit text,p_stage text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare out_id uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 80 or length(trim(coalesce(p_unit,''))) not between 1 and 15 then raise exception 'Invalid SKU name or unit';end if;
 if p_stage not in ('raw','wip','finished') then raise exception 'Invalid inventory stage';end if;
 if exists(select 1 from public.ingredients where organization_id=p_org and lower(name)=lower(trim(p_name))) then raise exception 'Ingredient name exists';end if;
 insert into public.ingredients(organization_id,name,unit,on_hand,reserved,avg_cost,reorder_point,inventory_stage)
 values(p_org,trim(p_name),trim(p_unit),0,0,0,0,p_stage) returning id into out_id;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'inventory.sku_created','ingredient',out_id,jsonb_build_object('stage',p_stage));
 return out_id;
end $$;
revoke all on function public.create_demo_inventory_sku(uuid,text,text,text) from public;
grant execute on function public.create_demo_inventory_sku(uuid,text,text,text) to authenticated;
