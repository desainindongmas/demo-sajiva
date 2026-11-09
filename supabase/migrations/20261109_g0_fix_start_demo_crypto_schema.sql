create or replace function public.start_demo() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); o uuid; b uuid; sess uuid; c uuid; cat uuid; m uuid; i uuid; code text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if (select count(*) from public.demo_sessions where owner_uid=u and expires_at>now())>=3 then raise exception 'Demo session limit reached'; end if;
 code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
 insert into public.organizations(name,slug) values('Rumah Makan Sunda Simulasi','demo-'||replace(gen_random_uuid()::text,'-','')) returning id into o;
 insert into public.branches(organization_id,name) values(o,'Cabang Utama') returning id into b;
 insert into public.demo_sessions(organization_id,owner_uid,share_code) values(o,u,code) returning id into sess;
 insert into public.memberships(organization_id,user_uid,role) values(o,u,'owner');
 insert into public.categories(organization_id,name) values(o,'Paket Nasi') returning id into cat;
 insert into public.categories(organization_id,name) values(o,'Minuman') returning id into c;
 insert into public.menu_items(organization_id,category_id,name,price) values(o,cat,'Nasi Timbel Komplit',35000) returning id into m;
 insert into public.ingredients(organization_id,name,unit,on_hand,avg_cost,reorder_point) values(o,'Ayam ungkep','pcs',45,12000,10) returning id into i;
 insert into public.recipes(organization_id,menu_item_id,ingredient_id,qty) values(o,m,i,1);
 insert into public.menu_items(organization_id,category_id,name,price) values(o,c,'Es Teh Manis',6000);
 insert into public.dining_tables(organization_id,branch_id,name,area,capacity) values(o,b,'Meja 01','Indoor',4),(o,b,'Meja 02','Indoor',4),(o,b,'Meja 03','Lesehan',6);
 insert into public.suppliers(organization_id,name) values(o,'Supplier Dummy Sayuran'),(o,'Supplier Dummy Protein');
 insert into public.audit_events(organization_id,actor_uid,event_type,entity_type,entity_id) values(o,u,'demo.created','demo_session',sess);
 return jsonb_build_object('session_id',sess,'organization_id',o,'branch_id',b,'share_code',code,'expires_at',(select expires_at from public.demo_sessions where id=sess));
end $$;