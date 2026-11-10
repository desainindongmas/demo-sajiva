-- One atomic request for a group of independent dummy bills.
create or replace function public.complete_demo_payments_batch(p_org uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare line jsonb; payment_id uuid; ids jsonb:='[]'::jsonb; seen uuid[]:=array[]::uuid[];
begin
 if not public.is_demo_member(p_org) then raise exception 'Access denied';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 20 then raise exception 'Select 1-20 orders per batch';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
   if (line->>'order_id')::uuid=any(seen) then raise exception 'Duplicate order inside batch';end if;
   seen:=array_append(seen,(line->>'order_id')::uuid);
   payment_id:=public.complete_demo_payment(p_org,(line->>'order_id')::uuid,(line->>'amount')::numeric,line->>'method',(line->>'request_key')::uuid);
   ids:=ids||to_jsonb(payment_id);
 end loop;
 return ids;
end $$;
revoke all on function public.complete_demo_payments_batch(uuid,jsonb) from public;
grant execute on function public.complete_demo_payments_batch(uuid,jsonb) to authenticated;