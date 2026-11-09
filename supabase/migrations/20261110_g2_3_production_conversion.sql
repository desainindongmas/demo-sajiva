
-- G2.3 production conversion: inventory items may be raw, WIP, or finished.
alter table public.ingredients add column if not exists inventory_stage text not null default 'raw'
 check(inventory_stage in ('raw','wip','finished'));
create table public.demo_production_recipes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 output_ingredient_id uuid not null references public.ingredients(id),
 input_ingredient_id uuid not null references public.ingredients(id),
 input_qty numeric(14,3) not null check(input_qty>0),
 output_qty numeric(14,3) not null default 1 check(output_qty>0),
 unique(output_ingredient_id,input_ingredient_id),
 check(output_ingredient_id<>input_ingredient_id)
);
alter table public.demo_production_recipes enable row level security;
create policy demo_read on public.demo_production_recipes for select to authenticated using(public.is_demo_member(organization_id));
create table public.demo_production_runs(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 output_ingredient_id uuid not null references public.ingredients(id),
 output_qty numeric(14,3) not null check(output_qty>0),
 total_input_cost numeric(14,2) not null,
 actor_uid uuid,
 request_key uuid not null,
 created_at timestamptz not null default now(),
 unique(organization_id,request_key)
);
alter table public.demo_production_runs enable row level security;
create policy demo_read on public.demo_production_runs for select to authenticated using(public.is_demo_member(organization_id));
create or replace function public.set_demo_production_recipe(p_org uuid,p_output uuid,p_input uuid,p_input_qty numeric,p_output_qty numeric)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if p_output=p_input then raise exception 'Output and input must differ';end if;
 if p_input_qty is null or p_input_qty<=0 or p_input_qty<>round(p_input_qty,3) or p_output_qty is null or p_output_qty<=0 or p_output_qty<>round(p_output_qty,3) then raise exception 'Invalid recipe quantities';end if;
 if not exists(select 1 from public.ingredients where id=p_output and organization_id=p_org and inventory_stage in ('wip','finished')) then raise exception 'Output must be WIP or finished';end if;
 if not exists(select 1 from public.ingredients where id=p_input and organization_id=p_org) then raise exception 'Input not found';end if;
 insert into public.demo_production_recipes(organization_id,output_ingredient_id,input_ingredient_id,input_qty,output_qty)
 values(p_org,p_output,p_input,p_input_qty,p_output_qty)
 on conflict(output_ingredient_id,input_ingredient_id) do update set input_qty=excluded.input_qty,output_qty=excluded.output_qty
 returning id into rid;
 return rid;
end $$;
revoke all on function public.set_demo_production_recipe(uuid,uuid,uuid,numeric,numeric) from public;
grant execute on function public.set_demo_production_recipe(uuid,uuid,uuid,numeric,numeric) to authenticated;

create or replace function public.run_demo_production(p_org uuid,p_output uuid,p_qty numeric,p_request_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare output_stock public.ingredients%rowtype; inp public.ingredients%rowtype; recipe record;
  run_id uuid; total_cost numeric(14,2):=0; cost_per numeric(14,2); req_qty numeric(14,3);
  old_qty numeric(14,3); old_avg numeric(14,2);
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if p_request_key is null or p_qty is null or p_qty<=0 or p_qty<>round(p_qty,3) then raise exception 'Invalid production request';end if;
 select * into output_stock from public.ingredients where id=p_output and organization_id=p_org for update;
 if not found or output_stock.inventory_stage not in ('wip','finished') then raise exception 'Output not configured';end if;
 select id into run_id from public.demo_production_runs where organization_id=p_org and request_key=p_request_key;
 if found then
  if not exists(select 1 from public.demo_production_runs where id=run_id and output_ingredient_id=p_output and output_qty=p_qty) then raise exception 'Request key reused with different production';end if;
  return run_id;
 end if;
 if not exists(select 1 from public.demo_production_recipes where organization_id=p_org and output_ingredient_id=p_output) then raise exception 'Production recipe is empty';end if;
 for inp in select i.* from public.ingredients i
 where i.organization_id=p_org and i.id in (select input_ingredient_id from public.demo_production_recipes where organization_id=p_org and output_ingredient_id=p_output)
 order by i.id for update loop
    select * into recipe from public.demo_production_recipes where organization_id=p_org and output_ingredient_id=p_output and input_ingredient_id=inp.id;
    req_qty:=round(recipe.input_qty*p_qty/recipe.output_qty,3);
    if req_qty<=0 or inp.on_hand-inp.reserved<req_qty then raise exception 'Not enough free ingredient: %',inp.name;end if;
    total_cost:=total_cost+round(req_qty*inp.avg_cost,2);
 end loop;
 old_qty:=output_stock.on_hand;old_avg:=output_stock.avg_cost;
 insert into public.demo_production_runs(organization_id,output_ingredient_id,output_qty,total_input_cost,actor_uid,request_key)
 values(p_org,p_output,p_qty,total_cost,auth.uid(),p_request_key) returning id into run_id;
 for inp in select i.* from public.ingredients i
 where i.organization_id=p_org and i.id in (select input_ingredient_id from public.demo_production_recipes where organization_id=p_org and output_ingredient_id=p_output)
 order by i.id for update loop
    select * into recipe from public.demo_production_recipes where organization_id=p_org and output_ingredient_id=p_output and input_ingredient_id=inp.id;
    req_qty:=round(recipe.input_qty*p_qty/recipe.output_qty,3);
    update public.ingredients set on_hand=on_hand-req_qty where id=inp.id;
    insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
    values(p_org,inp.id,'consume',-req_qty,inp.avg_cost,run_id);
 end loop;
 cost_per:=round(total_cost/p_qty,2);
 update public.ingredients
 set on_hand=on_hand+p_qty,avg_cost=round((old_qty*old_avg+total_cost)/(old_qty+p_qty),2)
 where id=p_output and organization_id=p_org;
 insert into public.stock_movements(organization_id,ingredient_id,movement_type,quantity,cost_snapshot,reference_id)
 values(p_org,p_output,'produce',p_qty,cost_per,run_id);
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'inventory.produced','ingredient',p_output,jsonb_build_object('production_run',run_id,'output_qty',p_qty,'total_input_cost',total_cost));
 return run_id;
end $$;
revoke all on function public.run_demo_production(uuid,uuid,numeric,uuid) from public;
grant execute on function public.run_demo_production(uuid,uuid,numeric,uuid) to authenticated;
