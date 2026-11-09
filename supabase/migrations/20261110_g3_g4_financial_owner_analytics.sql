
-- G3: tenant-safe financial projections; no actual money processing.
create or replace view public.demo_order_financials with (security_invoker=true) as
select o.organization_id,o.branch_id,o.id as order_id,o.channel,o.created_at,o.status,o.payment_status,
 o.total as billed_revenue,
 coalesce(p.paid_amount,0)::numeric(14,2) as received_dummy,
 greatest(0,o.total-coalesce(p.paid_amount,0))::numeric(14,2) as receivable_dummy,
 coalesce(c.estimated_cost,0)::numeric(14,2) as cost_snapshot_total,
 (o.total-coalesce(c.estimated_cost,0))::numeric(14,2) as estimated_gross_margin,
 o.discount,o.tax,o.service_charge
from public.orders o
left join lateral(
 select sum(amount) as paid_amount from public.payments p
 where p.order_id=o.id and p.organization_id=o.organization_id and p.status='simulated'
) p on true
left join lateral(
 select sum(oi.quantity*oi.cost_snapshot) as estimated_cost from public.order_items oi
 where oi.order_id=o.id and oi.organization_id=o.organization_id and oi.status<>'cancelled'
) c on true;
grant select on public.demo_order_financials to authenticated;

create or replace view public.demo_owner_daily_kpis with (security_invoker=true) as
select organization_id,branch_id,created_at::date as report_date,
 count(*)::integer as order_count,
 count(*) filter(where status='cancelled')::integer as cancelled_orders,
 sum(billed_revenue)::numeric(14,2) as billed_revenue,
 sum(received_dummy)::numeric(14,2) as received_dummy,
 sum(receivable_dummy)::numeric(14,2) as receivable_dummy,
 sum(cost_snapshot_total)::numeric(14,2) as estimated_cogs,
 sum(estimated_gross_margin)::numeric(14,2) as estimated_gross_margin
from public.demo_order_financials
group by organization_id,branch_id,created_at::date;
grant select on public.demo_owner_daily_kpis to authenticated;
