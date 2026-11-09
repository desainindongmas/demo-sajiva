-- G1.3: Publish only operational demo tables. All are RLS-protected.
do $$
declare t text;
begin
  foreach t in array array['orders','order_items','dining_tables','payments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;