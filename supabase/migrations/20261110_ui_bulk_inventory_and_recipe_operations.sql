-- Atomic bulk inventory adjustments: all lines commit or all roll back.
create or replace function public.record_demo_inventory_batch(p_org uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare line jsonb; ids jsonb:='[]'::jsonb; ev uuid; seen uuid[]:=array[]::uuid[];
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Batch requires 1 to 100 inventory lines';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  if (line->>'request_key')::uuid=any(seen) then raise exception 'Duplicate request key in batch';end if;
  seen:=array_append(seen,(line->>'request_key')::uuid);
  ev:=public.record_demo_inventory_event(p_org,(line->>'ingredient_id')::uuid,line->>'type',(line->>'quantity')::numeric,line->>'reason',(line->>'request_key')::uuid);
  ids:=ids||to_jsonb(ev);
 end loop;
 return ids;
end $$;
revoke all on function public.record_demo_inventory_batch(uuid,jsonb) from public;
grant execute on function public.record_demo_inventory_batch(uuid,jsonb) to authenticated;

create or replace function public.set_demo_recipe_batch(p_org uuid,p_menu uuid,p_lines jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare line jsonb;qty numeric;id uuid;seen uuid[]:=array[]::uuid[];n integer:=0;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Recipe batch requires 1 to 50 lines';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  id:=(line->>'ingredient_id')::uuid;qty:=(line->>'quantity')::numeric;
  if id=any(seen) then raise exception 'Duplicate recipe ingredient';end if;
  seen:=array_append(seen,id);
  perform public.set_demo_recipe_line(p_org,p_menu,id,qty);
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.set_demo_recipe_batch(uuid,uuid,jsonb) from public;
grant execute on function public.set_demo_recipe_batch(uuid,uuid,jsonb) to authenticated;
