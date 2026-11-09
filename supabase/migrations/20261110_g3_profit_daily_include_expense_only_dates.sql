
create or replace view public.demo_owner_profit_daily with (security_invoker=true) as
with exp_daily as (
 select organization_id,branch_id,expense_date as report_date,sum(amount)::numeric(14,2) as operating_expenses
 from public.demo_operating_expenses
 group by organization_id,branch_id,expense_date
),
date_keys as (
 select organization_id,branch_id,report_date from public.demo_owner_daily_kpis
 union
 select organization_id,branch_id,report_date from exp_daily
)
select d.organization_id,d.branch_id,d.report_date,
 coalesce(k.order_count,0)::integer as order_count,
 coalesce(k.billed_revenue,0)::numeric(14,2) as billed_revenue,
 coalesce(k.received_dummy,0)::numeric(14,2) as received_dummy,
 coalesce(k.estimated_cogs,0)::numeric(14,2) as estimated_cogs,
 coalesce(k.estimated_gross_margin,0)::numeric(14,2) as estimated_gross_margin,
 coalesce(e.operating_expenses,0)::numeric(14,2) as operating_expenses,
 (coalesce(k.estimated_gross_margin,0)-coalesce(e.operating_expenses,0))::numeric(14,2) as estimated_operating_result
from date_keys d
left join public.demo_owner_daily_kpis k using(organization_id,branch_id,report_date)
left join exp_daily e using(organization_id,branch_id,report_date);
grant select on public.demo_owner_profit_daily to authenticated;
