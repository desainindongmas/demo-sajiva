
create table public.demo_operating_expenses(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid not null references public.branches(id),
 category text not null check(category in ('rent','payroll','utilities','marketing','logistics','maintenance','other')),
 description text not null check(length(trim(description)) between 3 and 300),
 amount numeric(14,2) not null check(amount>0),
 expense_date date not null default current_date,
 actor_uid uuid,
 request_key uuid not null,
 created_at timestamptz not null default now(),
 unique(organization_id,request_key)
);
alter table public.demo_operating_expenses enable row level security;
create policy demo_read on public.demo_operating_expenses for select to authenticated using(public.is_demo_member(organization_id));

create or replace function public.record_demo_operating_expense(
 p_org uuid,p_branch uuid,p_category text,p_description text,p_amount numeric,p_expense_date date,p_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_previous public.demo_operating_expenses%rowtype;
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if not exists(select 1 from public.branches where id=p_branch and organization_id=p_org) then raise exception 'Invalid branch';end if;
 if p_key is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_category not in ('rent','payroll','utilities','marketing','logistics','maintenance','other')
 or length(trim(coalesce(p_description,''))) not between 3 and 300
 or p_expense_date is null or p_expense_date>current_date+1 or p_expense_date<current_date-365 then raise exception 'Invalid expense fields';end if;
 select * into v_previous from public.demo_operating_expenses where organization_id=p_org and request_key=p_key;
 if found then
   if v_previous.branch_id<>p_branch or v_previous.category<>p_category or v_previous.description<>trim(p_description)
   or v_previous.amount<>p_amount or v_previous.expense_date<>p_expense_date then raise exception 'Expense request key reused with changed fields';end if;
   return v_previous.id;
 end if;
 insert into public.demo_operating_expenses(organization_id,branch_id,category,description,amount,expense_date,actor_uid,request_key)
 values(p_org,p_branch,p_category,trim(p_description),p_amount,p_expense_date,auth.uid(),p_key) returning id into v_id;
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id,payload)
 values(p_org,auth.uid(),'expense.recorded','operating_expense',v_id,jsonb_build_object('category',p_category,'amount',p_amount));
 return v_id;
end $$;
revoke all on function public.record_demo_operating_expense(uuid,uuid,text,text,numeric,date,uuid) from public;
grant execute on function public.record_demo_operating_expense(uuid,uuid,text,text,numeric,date,uuid) to authenticated;

create or replace view public.demo_owner_profit_daily with (security_invoker=true) as
select k.organization_id,k.branch_id,k.report_date,
 k.order_count,k.billed_revenue,k.received_dummy,k.estimated_cogs,k.estimated_gross_margin,
 coalesce(e.operating_expenses,0)::numeric(14,2) as operating_expenses,
 (k.estimated_gross_margin-coalesce(e.operating_expenses,0))::numeric(14,2) as estimated_operating_result
from public.demo_owner_daily_kpis k
left join lateral(
 select sum(amount) as operating_expenses from public.demo_operating_expenses e
 where e.organization_id=k.organization_id and e.branch_id=k.branch_id and e.expense_date=k.report_date
) e on true;
grant select on public.demo_owner_profit_daily to authenticated;

do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='demo_operating_expenses')
then alter publication supabase_realtime add table public.demo_operating_expenses;end if;end $$;
