
create or replace view public.demo_owner_daily_kpis with (security_invoker=true) as
select organization_id,branch_id,(created_at at time zone 'Asia/Jakarta')::date as report_date,
 count(*)::integer as order_count,
 count(*) filter(where status='cancelled')::integer as cancelled_orders,
 sum(billed_revenue)::numeric(14,2) as billed_revenue,
 sum(received_dummy)::numeric(14,2) as received_dummy,
 sum(receivable_dummy)::numeric(14,2) as receivable_dummy,
 sum(cost_snapshot_total)::numeric(14,2) as estimated_cogs,
 sum(estimated_gross_margin)::numeric(14,2) as estimated_gross_margin
from public.demo_order_financials
group by organization_id,branch_id,(created_at at time zone 'Asia/Jakarta')::date;
grant select on public.demo_owner_daily_kpis to authenticated;
