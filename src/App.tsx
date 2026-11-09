import { useEffect, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
type Role = "Owner" | "Manager" | "Cashier" | "Waiter" | "Kitchen";
type Session = { organization_id:string;branch_id:string;session_id:string;share_code:string };
type Menu = {id:string;name:string;price:number};
type Table = {id:string;name:string;status:string};
type Order = {id:string;total:number;payment_status:string;status:string;table_id:string|null};
type Item = {id:string;order_id:string;menu_item_id:string;quantity:number;unit_price:number;status:string};
type Payment = {id:string;order_id:string;amount:number;status:string};
type CancelRequest = {id:string;order_item_id:string;reason:string;status:string;created_at:string};
type JoinedTable = {id:string;order_id:string;table_id:string};
type ItemAllocation = {id:string;order_id:string;order_item_id:string;quantity:number;amount:number;payment_id:string};
type IngredientStock = {id:string;name:string;unit:string;on_hand:number;reserved:number;avg_cost:number;reorder_point:number;inventory_stage:string};
type Supplier = {id:string;name:string};
type Purchase = {id:string;total:number;status:string;created_at:string};
type MenuHpp = {menu_item_id:string;menu_name:string;sale_price:number;estimated_hpp:number;gross_margin:number;recipe_components:number};
type RecipeLine = {id:string;menu_item_id:string;ingredient_id:string;qty:number};
type InventoryEvent = {id:string;ingredient_id:string;event_type:string;quantity_change:number;reason:string;created_at:string};
type ProductionRecipe = {id:string;output_ingredient_id:string;input_ingredient_id:string;input_qty:number;output_qty:number};
type ProductionRun = {id:string;output_ingredient_id:string;output_qty:number;total_input_cost:number;created_at:string};
type Financial = {order_id:string;billed_revenue:number;received_dummy:number;receivable_dummy:number;cost_snapshot_total:number;estimated_gross_margin:number;channel:string};
type DailyKpi = {report_date:string;order_count:number;cancelled_orders:number;billed_revenue:number;received_dummy:number;receivable_dummy:number;estimated_cogs:number;estimated_gross_margin:number};
type ProfitDaily = {report_date:string;order_count:number;billed_revenue:number;received_dummy:number;estimated_cogs:number;estimated_gross_margin:number;operating_expenses:number;estimated_operating_result:number};
const roles:Role[]=["Owner","Manager","Cashier","Waiter","Kitchen"];
const url=import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const hcaptchaSitekey=import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined;
const client:SupabaseClient | null = url && key ? createClient(url,key) : null;
const rupiah=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function readableError(e:unknown):string {
 if(e instanceof Error) return e.message;
 if(typeof e==="string") return e;
 if(e && typeof e==="object"){
  const v=e as Record<string,unknown>;
  const msg=[v.message,v.error_description,v.details,v.hint,v.code].filter(x=>typeof x==="string" && x!=="").join(" · ");
  return msg || "Kesalahan tidak dikenal. Periksa koneksi Supabase dan konfigurasi hCaptcha.";
 }
 return String(e);
}
export default function App(){
 const [role,setRole]=useState<Role>("Owner");
 const [session,setSession]=useState<Session|null>(null);
 const [menus,setMenus]=useState<Menu[]>([]);
 const [tables,setTables]=useState<Table[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [cancelRequests,setCancelRequests]=useState<CancelRequest[]>([]);
 const [joinedTables,setJoinedTables]=useState<JoinedTable[]>([]);
 const [joinOrderId,setJoinOrderId]=useState("");
 const [joinTableId,setJoinTableId]=useState("");
 const [billOrderId,setBillOrderId]=useState("");
 const [allocations,setAllocations]=useState<ItemAllocation[]>([]);
 const [stocks,setStocks]=useState<IngredientStock[]>([]);
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [purchases,setPurchases]=useState<Purchase[]>([]);
 const [menuHpp,setMenuHpp]=useState<MenuHpp[]>([]);
 const [recipeLines,setRecipeLines]=useState<RecipeLine[]>([]);
 const [inventoryEvents,setInventoryEvents]=useState<InventoryEvent[]>([]);
 const [productionRecipes,setProductionRecipes]=useState<ProductionRecipe[]>([]);
 const [productionRuns,setProductionRuns]=useState<ProductionRun[]>([]);
 const [financials,setFinancials]=useState<Financial[]>([]);
 const [dailyKpis,setDailyKpis]=useState<DailyKpi[]>([]);
 const [profitDaily,setProfitDaily]=useState<ProfitDaily[]>([]);
 const [expenseCategory,setExpenseCategory]=useState("utilities");
 const [expenseDescription,setExpenseDescription]=useState("");
 const [expenseAmount,setExpenseAmount]=useState("100000");
 const expenseKey=useRef<string|null>(null);
 const [guidedStep,setGuidedStep]=useState(0);
 const [skuName,setSkuName]=useState("");
 const [skuUnit,setSkuUnit]=useState("porsi");
 const [skuStage,setSkuStage]=useState("wip");
 const [productionOutput,setProductionOutput]=useState("");
 const [productionInput,setProductionInput]=useState("");
 const [productionInputQty,setProductionInputQty]=useState("1");
 const [productionOutputBasis,setProductionOutputBasis]=useState("1");
 const [productionQty,setProductionQty]=useState("1");
 const productionKey=useRef<string|null>(null);
 const [recipeMenu,setRecipeMenu]=useState("");
 const [recipeIngredient,setRecipeIngredient]=useState("");
 const [recipeQty,setRecipeQty]=useState("1");
 const [stockIngredient,setStockIngredient]=useState("");
 const [stockAction,setStockAction]=useState("waste");
 const [stockQuantity,setStockQuantity]=useState("");
 const [stockReason,setStockReason]=useState("");
 const stockRequestKey=useRef<string|null>(null);
 const [purchaseIngredient,setPurchaseIngredient]=useState("");
 const [purchaseSupplier,setPurchaseSupplier]=useState("");
 const [purchaseQty,setPurchaseQty]=useState("10");
 const [purchaseUnitCost,setPurchaseUnitCost]=useState("12000");
 const purchaseKey=useRef<string|null>(null);
 const [splitOrderId,setSplitOrderId]=useState("");
 const [splitItemId,setSplitItemId]=useState("");
 const [splitQty,setSplitQty]=useState(1);
 const [splitMethod,setSplitMethod]=useState("cash");
 const splitRequestKey=useRef<string|null>(null);
 const [moveOrderId,setMoveOrderId]=useState("");
 const [moveTableId,setMoveTableId]=useState("");
 const [cancelReason,setCancelReason]=useState("");
 const [quantity,setQuantity]=useState(1);
 const [channel,setChannel]=useState("dine_in");
 const [orderNotes,setOrderNotes]=useState("");
 const [targetOrder,setTargetOrder]=useState("");
 const [payMethod,setPayMethod]=useState("cash");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [selectedMenu,setSelectedMenu]=useState("");
 const [selectedTable,setSelectedTable]=useState("");
 const [payOrder,setPayOrder]=useState("");
 const [payAmount,setPayAmount]=useState("");
 const [captchaToken,setCaptchaToken]=useState<string|null>(null);
 const captchaRef=useRef<HCaptcha>(null);
 const orderRequestKey=useRef<string|null>(null);
 const paymentRequestKey=useRef<string|null>(null);
 const [syncStatus,setSyncStatus]=useState("Menyiapkan koneksi...");
 async function refresh(s:Session){
  if(!client)return;
  const [m,t,o,oi,p,cr,jt,al,ing,sup,pur,hpp,rec,ev,pr,run,fin,kpi,profit]=await Promise.all([
   client.from("menu_items").select("id,name,price").eq("organization_id",s.organization_id).order("name"),
   client.from("dining_tables").select("id,name,status").eq("organization_id",s.organization_id).order("name"),
   client.from("orders").select("id,total,payment_status,status,table_id").eq("organization_id",s.organization_id).order("created_at",{ascending:false}),
   client.from("order_items").select("id,order_id,menu_item_id,quantity,unit_price,status").eq("organization_id",s.organization_id),
   client.from("payments").select("id,order_id,amount,status").eq("organization_id",s.organization_id),
   client.from("demo_cancel_requests").select("id,order_item_id,reason,status,created_at").eq("organization_id",s.organization_id).order("created_at",{ascending:false}),
   client.from("demo_order_tables").select("id,order_id,table_id").eq("organization_id",s.organization_id),
   client.from("demo_item_payment_allocations").select("id,order_id,order_item_id,quantity,amount,payment_id").eq("organization_id",s.organization_id),
   client.from("ingredients").select("id,name,unit,on_hand,reserved,avg_cost,reorder_point,inventory_stage").eq("organization_id",s.organization_id).order("name"),
   client.from("suppliers").select("id,name").eq("organization_id",s.organization_id).order("name"),
   client.from("purchases").select("id,total,status,created_at").eq("organization_id",s.organization_id).order("created_at",{ascending:false}).limit(20),
   client.from("demo_menu_hpp").select("menu_item_id,menu_name,sale_price,estimated_hpp,gross_margin,recipe_components").eq("organization_id",s.organization_id),
   client.from("recipes").select("id,menu_item_id,ingredient_id,qty").eq("organization_id",s.organization_id),
   client.from("demo_inventory_events").select("id,ingredient_id,event_type,quantity_change,reason,created_at").eq("organization_id",s.organization_id).order("created_at",{ascending:false}).limit(20),
   client.from("demo_production_recipes").select("id,output_ingredient_id,input_ingredient_id,input_qty,output_qty").eq("organization_id",s.organization_id),
   client.from("demo_production_runs").select("id,output_ingredient_id,output_qty,total_input_cost,created_at").eq("organization_id",s.organization_id).order("created_at",{ascending:false}).limit(10),
   client.from("demo_order_financials").select("order_id,billed_revenue,received_dummy,receivable_dummy,cost_snapshot_total,estimated_gross_margin,channel").eq("organization_id",s.organization_id).limit(300),
   client.from("demo_owner_daily_kpis").select("report_date,order_count,cancelled_orders,billed_revenue,received_dummy,receivable_dummy,estimated_cogs,estimated_gross_margin").eq("organization_id",s.organization_id).order("report_date",{ascending:false}).limit(30),
   client.from("demo_owner_profit_daily").select("report_date,order_count,billed_revenue,received_dummy,estimated_cogs,estimated_gross_margin,operating_expenses,estimated_operating_result").eq("organization_id",s.organization_id).order("report_date",{ascending:false}).limit(30)
  ]);
  for(const x of [m,t,o,oi,p,cr,jt,al,ing,sup,pur,hpp,rec,ev,pr,run,fin,kpi,profit]) if(x.error) throw x.error;
  setMenus((m.data||[]) as Menu[]);setTables((t.data||[]) as Table[]);setOrders((o.data||[]) as Order[]);setItems((oi.data||[]) as Item[]);setPayments((p.data||[]) as Payment[]);setCancelRequests((cr.data||[]) as CancelRequest[]);setJoinedTables((jt.data||[]) as JoinedTable[]);setAllocations((al.data||[]) as ItemAllocation[]);setStocks((ing.data||[]) as IngredientStock[]);setSuppliers((sup.data||[]) as Supplier[]);setPurchases((pur.data||[]) as Purchase[]);setMenuHpp((hpp.data||[]) as MenuHpp[]);setRecipeLines((rec.data||[]) as RecipeLine[]);setInventoryEvents((ev.data||[]) as InventoryEvent[]);setProductionRecipes((pr.data||[]) as ProductionRecipe[]);setProductionRuns((run.data||[]) as ProductionRun[]);setFinancials((fin.data||[]) as Financial[]);setDailyKpis((kpi.data||[]) as DailyKpi[]);setProfitDaily((profit.data||[]) as ProfitDaily[]);
 }
 async function withBusy(op:()=>Promise<void>){setBusy(true);setError("");setNotice("");try{await op()}catch(e){setError(readableError(e))}finally{setBusy(false)}}
 async function start(){await withBusy(async()=>{
   if(!client)throw Error("Konfigurasi Supabase belum diisi pada environment Cloudflare atau .env.local.");
   const {data:sessionInfo,error:sessionError}=await client.auth.getSession();
   if(sessionError) throw sessionError;
   if(!sessionInfo.session){
     if(!hcaptchaSitekey) throw Error("hCaptcha Sitekey belum dikonfigurasi.");
     if(!captchaToken) throw Error("Selesaikan hCaptcha terlebih dahulu.");
     const auth=await client.auth.signInAnonymously({options:{captchaToken}});
     setCaptchaToken(null);
     captchaRef.current?.resetCaptcha();
     if(auth.error)throw auth.error;
   }
   const r=await client.rpc("start_demo");if(r.error)throw r.error;
   const s=r.data as Session;setSession(s);sessionStorage.setItem("sajiva_demo_session",JSON.stringify(s));await refresh(s);setNotice("Sesi simulasi dibuat. Seluruh data bersifat dummy.");
 })}
 async function order(){await withBusy(async()=>{
  if(!client||!session||!selectedMenu)throw Error("Pilih menu terlebih dahulu.");
  if(channel==="dine_in"&&!selectedTable)throw Error("Untuk dine-in, pilih meja terlebih dahulu.");
  if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw Error("Jumlah porsi harus 1 sampai 50.");
  if(!orderRequestKey.current)orderRequestKey.current=crypto.randomUUID();
  const r=await client.rpc("create_demo_order_v2",{p_org:session.organization_id,p_branch:session.branch_id,p_table:channel==="dine_in"?selectedTable:null,p_channel:channel,p_notes:orderNotes,p_items:[{menu_item_id:selectedMenu,quantity}],p_request_key:orderRequestKey.current});
  if(r.error)throw r.error;orderRequestKey.current=null;await refresh(session);setNotice("Pesanan dummy berhasil dibuat.");
 })}
 async function payment(){await withBusy(async()=>{
  if(!client||!session||!payOrder)throw Error("Pilih pesanan.");
  const amount=Number(payAmount);if(!Number.isFinite(amount)||amount<=0)throw Error("Masukkan jumlah pembayaran yang valid.");
  if(!paymentRequestKey.current)paymentRequestKey.current=crypto.randomUUID();
  const r=await client.rpc("complete_demo_payment",{p_org:session.organization_id,p_order:payOrder,p_amount:amount,p_method:payMethod,p_request_key:paymentRequestKey.current});
  if(r.error)throw r.error;paymentRequestKey.current=null;await refresh(session);setNotice("Pembayaran SIMULASI tercatat.");setPayAmount("");
 })}
 async function addItem(){await withBusy(async()=>{
  if(!client||!session||!targetOrder||!selectedMenu)throw Error("Pilih pesanan dan menu untuk penambahan.");
  if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw Error("Jumlah porsi tidak valid.");
  const result=await client.rpc("add_demo_order_item",{p_org:session.organization_id,p_order:targetOrder,p_menu:selectedMenu,p_qty:quantity});
  if(result.error)throw result.error;
  await refresh(session);
  setNotice("Menu berhasil ditambahkan ke pesanan aktif.");
 })}
 async function kitchen(item:Item,next:string){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi tidak tersedia");
  const result=await client.rpc("advance_demo_kitchen_item",{p_org:session.organization_id,p_item:item.id,p_next:next});
  if(result.error)throw result.error;await refresh(session);setNotice("Status dapur diperbarui.");
 })}
 async function clean(tableId:string){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi tidak tersedia");
  const result=await client.rpc("mark_demo_table_clean",{p_org:session.organization_id,p_table:tableId});
  if(result.error)throw result.error;await refresh(session);setNotice("Meja sudah tersedia.");
 })}
 async function recordExpense(){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi demo tidak aktif.");
  if(!expenseDescription.trim()||Number(expenseAmount)<=0)throw Error("Isi deskripsi dan nominal biaya.");
  if(!expenseKey.current)expenseKey.current=crypto.randomUUID();
  const r=await client.rpc("record_demo_operating_expense",{p_org:session.organization_id,p_branch:session.branch_id,p_category:expenseCategory,p_description:expenseDescription,p_amount:Number(expenseAmount),p_expense_date:new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Jakarta"}),p_key:expenseKey.current});
  if(r.error)throw r.error;expenseKey.current=null;setExpenseDescription("");await refresh(session);setNotice("Biaya operasional dummy berhasil dicatat.");
 })}
 async function createSku(){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi demo tidak aktif.");
  const r=await client.rpc("create_demo_inventory_sku",{p_org:session.organization_id,p_name:skuName,p_unit:skuUnit,p_stage:skuStage});
  if(r.error)throw r.error;setSkuName("");await refresh(session);setNotice("Master stok baru berhasil dibuat.");
 })}
 async function configureProduction(){await withBusy(async()=>{
  if(!client||!session||!productionOutput||!productionInput)throw Error("Pilih bahan input dan output.");
  const r=await client.rpc("set_demo_production_recipe",{p_org:session.organization_id,p_output:productionOutput,p_input:productionInput,p_input_qty:Number(productionInputQty),p_output_qty:Number(productionOutputBasis)});
  if(r.error)throw r.error;await refresh(session);setNotice("Resep produksi disimpan.");
 })}
 async function produceBatch(){await withBusy(async()=>{
  if(!client||!session||!productionOutput)throw Error("Pilih output WIP/barang jadi.");
  if(!productionKey.current)productionKey.current=crypto.randomUUID();
  const r=await client.rpc("run_demo_production",{p_org:session.organization_id,p_output:productionOutput,p_qty:Number(productionQty),p_request_key:productionKey.current});
  if(r.error)throw r.error;productionKey.current=null;await refresh(session);setNotice("Batch produksi dummy tersimpan beserta perpindahan biaya bahan.");
 })}
 async function saveRecipe(){await withBusy(async()=>{
  if(!client||!session||!recipeMenu||!recipeIngredient)throw Error("Pilih menu dan bahan resep.");
  const qty=Number(recipeQty);if(!Number.isFinite(qty)||qty<=0||Math.round(qty*1000)!==qty*1000)throw Error("Jumlah resep wajib positif, maksimal 3 desimal.");
  const r=await client.rpc("set_demo_recipe_line",{p_org:session.organization_id,p_menu:recipeMenu,p_ingredient:recipeIngredient,p_qty:qty});
  if(r.error)throw r.error;await refresh(session);setNotice("Resep dan estimasi HPP diperbarui.");
 })}
 async function removeRecipe(ingredientId:string){await withBusy(async()=>{
  if(!client||!session||!recipeMenu)throw Error("Pilih menu.");
  const r=await client.rpc("remove_demo_recipe_line",{p_org:session.organization_id,p_menu:recipeMenu,p_ingredient:ingredientId});
  if(r.error)throw r.error;await refresh(session);setNotice("Komponen resep dihapus.");
 })}
 async function updateStock(){await withBusy(async()=>{
  if(!client||!session||!stockIngredient)throw Error("Pilih bahan baku.");
  const qty=Number(stockQuantity);
  if(!Number.isFinite(qty)||qty<0||Math.abs(Math.round(qty*1000)-qty*1000)>1e-7)throw Error("Jumlah stok harus nonnegatif, maksimal 3 desimal.");
  if(!stockRequestKey.current)stockRequestKey.current=crypto.randomUUID();
  const r=await client.rpc("record_demo_inventory_event",{p_org:session.organization_id,p_ingredient:stockIngredient,p_type:stockAction,p_quantity:qty,p_reason:stockReason,p_request_key:stockRequestKey.current});
  if(r.error)throw r.error;stockRequestKey.current=null;setStockQuantity("");setStockReason("");await refresh(session);setNotice("Penyesuaian stok tercatat dalam ledger dan audit.");
 })}
 async function receivePurchase(){await withBusy(async()=>{
  if(!client||!session||!purchaseIngredient)throw Error("Pilih bahan baku.");
  const qty=Number(purchaseQty),cost=Number(purchaseUnitCost);
  if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(cost)||cost<0)throw Error("Jumlah dan harga beli tidak valid.");
  if(!purchaseKey.current)purchaseKey.current=crypto.randomUUID();
  const r=await client.rpc("receive_demo_purchase",{p_org:session.organization_id,p_branch:session.branch_id,p_supplier:purchaseSupplier||null,p_lines:[{ingredient_id:purchaseIngredient,quantity:qty,unit_cost:cost}],p_request_key:purchaseKey.current});
  if(r.error)throw r.error;purchaseKey.current=null;await refresh(session);setNotice("Pembelian bahan dummy diterima. Stok dan HPP rata-rata diperbarui.");
 })}
 async function paySplitItem(){await withBusy(async()=>{
   if(!client||!session||!splitOrderId||!splitItemId)throw Error("Pilih tagihan dan item.");
   if(!Number.isInteger(splitQty)||splitQty<1)throw Error("Jumlah porsi pembayaran tidak valid.");
   if(!splitRequestKey.current)splitRequestKey.current=crypto.randomUUID();
   const r=await client.rpc("pay_demo_order_items",{p_org:session.organization_id,p_order:splitOrderId,p_item:splitItemId,p_qty:splitQty,p_method:splitMethod,p_request_key:splitRequestKey.current});
   if(r.error)throw r.error;
   splitRequestKey.current=null;setSplitItemId("");setSplitQty(1);
   await refresh(session);setNotice("Pembayaran item berhasil dicatat (dummy).");
 })}
 async function joinTable(){await withBusy(async()=>{
  if(!client||!session||!joinOrderId||!joinTableId)throw Error("Pilih tagihan induk dan meja tambahan.");
  const r=await client.rpc("attach_demo_table",{p_org:session.organization_id,p_order:joinOrderId,p_table:joinTableId});
  if(r.error)throw r.error;
  setJoinTableId("");await refresh(session);setNotice("Meja tambahan menggunakan tagihan yang sama.");
 })}
 async function moveTable(){await withBusy(async()=>{
  if(!client||!session||!moveOrderId||!moveTableId)throw Error("Pilih pesanan dan meja tujuan.");
  const r=await client.rpc("move_demo_order_table",{p_org:session.organization_id,p_order:moveOrderId,p_new_table:moveTableId});
  if(r.error)throw r.error;
  setMoveOrderId("");setMoveTableId("");await refresh(session);setNotice("Pesanan berhasil dipindahkan ke meja tujuan.");
 })}
 async function requestCancel(itemId:string){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi tidak tersedia.");
  if(cancelReason.trim().length<4)throw Error("Tuliskan alasan minimal 4 karakter.");
  const r=await client.rpc("request_demo_item_cancellation",{p_org:session.organization_id,p_item:itemId,p_reason:cancelReason.trim()});
  if(r.error)throw r.error;
  setCancelReason("");await refresh(session);setNotice("Permintaan pembatalan dikirim untuk persetujuan.");
 })}
 async function decideCancel(requestId:string,approve:boolean){await withBusy(async()=>{
  if(!client||!session)throw Error("Sesi tidak tersedia.");
  const r=await client.rpc("decide_demo_item_cancellation",{p_org:session.organization_id,p_request:requestId,p_approve:approve});
  if(r.error)throw r.error;
  await refresh(session);setNotice(approve?"Pembatalan disetujui (simulasi).":"Pembatalan ditolak (simulasi).");
 })}
 const paid=(id:string)=>payments.filter(p=>p.order_id===id&&p.status==="simulated").reduce((sum,p)=>sum+Number(p.amount),0);
 const labels:Record<string,string>={waiting:"Menunggu",preparing:"Memasak",ready:"Siap",served:"Disajikan",available:"Tersedia",occupied:"Terisi",payment:"Menunggu bayar",cleaning:"Perlu dibersihkan"};
 useEffect(()=>{
  if(!client)return;
  const raw=sessionStorage.getItem("sajiva_demo_session");
  if(!raw)return;
  let prior:Session;
  try{prior=JSON.parse(raw) as Session;}catch{sessionStorage.removeItem("sajiva_demo_session");return;}
  let active=true;
  (async()=>{
    const current=await client.auth.getSession();
    if(!current.data.session){sessionStorage.removeItem("sajiva_demo_session");return;}
    const check=await client.from("demo_sessions").select("id,organization_id,expires_at").eq("id",prior.session_id).eq("organization_id",prior.organization_id).maybeSingle();
    if(!active)return;
    if(check.error||!check.data||new Date(check.data.expires_at).getTime()<Date.now()){sessionStorage.removeItem("sajiva_demo_session");return;}
    setSession(prior);
    await refresh(prior);
  })().catch(e=>{if(active)setError(readableError(e));});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!session||!client)return;
  const supabase=client;
  let active=true;
  let refreshPending=false;
  const sync=()=>{
    if(!active||refreshPending)return;
    refreshPending=true;
    refresh(session).catch(e=>{if(active)setError(readableError(e));}).finally(()=>{refreshPending=false;});
  };
  const channel=supabase.channel("sajiva-operations-"+session.organization_id);
  for(const table of ["orders","order_items","dining_tables","payments","demo_cancel_requests","demo_order_tables","demo_item_payment_allocations","ingredients","purchases","recipes","demo_inventory_events"]){
    channel.on("postgres_changes",{event:"*",schema:"public",table,filter:"organization_id=eq."+session.organization_id},()=>sync());
  }
  channel.subscribe((status)=>{
    if(!active)return;
    if(status==="SUBSCRIBED"){setSyncStatus("Realtime aktif");sync();}
    else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")setSyncStatus("Sinkronisasi berkala");
  });
  const interval=setInterval(sync,20000);
  const foreground=()=>{if(document.visibilityState==="visible")sync();};
  document.addEventListener("visibilitychange",foreground);
  return()=>{active=false;clearInterval(interval);document.removeEventListener("visibilitychange",foreground);void supabase.removeChannel(channel);};
 },[session]);
 return <main><header><strong>sajiva</strong><span>DEMO · DATA DUMMY</span></header>
 <section className="hero"><p>Restaurant Operations Management</p><h1>Satu Sistem, Semua Terkendali.</h1><p>Simulasi operasional restoran. Tidak ada uang sungguhan yang diproses.</p></section>
 <section><h2>Ruang Demo</h2><p>Pilih peran publik untuk melihat alur simulasi.</p>
 <div className="roles">{roles.map(r=><button type="button" key={r} className={role===r?"active":""} onClick={()=>setRole(r)}>{r}</button>)}</div>
 <article><h3>{role}</h3>{session&&role==="Owner"&&<p className="feature-help">Untuk mencoba Delivery, Catatan Pesanan, dan Tambah ke Pesanan Aktif, pilih role <button type="button" onClick={()=>setRole("Waiter")}>Waiter</button> atau Manager/Cashier.</p>}{!session?<><p>Buat sesi untuk mencoba data simulasi yang terisolasi.</p>{hcaptchaSitekey && <div className="captcha-area"><HCaptcha ref={captchaRef} sitekey={hcaptchaSitekey} onVerify={(token)=>setCaptchaToken(token)} onExpire={()=>setCaptchaToken(null)} onError={(err)=>{setCaptchaToken(null);setError("hCaptcha gagal: "+readableError(err))}}/></div>}<button type="button" disabled={busy || !captchaToken} onClick={start}>{busy?"Menyiapkan...":"Buat sesi demo"}</button></>:<>
 <p>Session: <code>{session.share_code}</code> · Dataset hanya untuk simulasi. <span className="sync-status" role="status">{syncStatus}</span></p>
 {(role==="Waiter"||role==="Cashier"||role==="Manager")&&<div className="demo-grid"><div><h4>Pesanan · Dine-in / Takeaway / Delivery</h4><p className="feature-help">Pilih jenis pesanan, isi catatan, atau tambah menu ke pesanan yang belum dibayar.</p>
 <label htmlFor="menu">Menu</label><select id="menu" value={selectedMenu} onChange={e=>setSelectedMenu(e.target.value)}><option value="">Pilih menu</option>{menus.map(m=><option key={m.id} value={m.id}>{m.name} · {rupiah(m.price)}</option>)}</select>
 <label htmlFor="channel">Jenis pesanan</label><select id="channel" value={channel} onChange={e=>{setChannel(e.target.value);setSelectedTable("");}}><option value="dine_in">Makan di tempat</option><option value="takeaway">Bungkus / Takeaway</option><option value="delivery">Pesan antar (manual)</option></select>
 {channel==="dine_in"&&<><label htmlFor="table">Meja</label><select id="table" value={selectedTable} onChange={e=>setSelectedTable(e.target.value)}><option value="">Pilih meja</option>{tables.filter(t=>t.status==="available"||t.status==="occupied").map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select></>}
 <label htmlFor="order-notes">Catatan pesanan</label><input id="order-notes" maxLength={500} value={orderNotes} placeholder="Contoh: tidak pedas" onChange={e=>setOrderNotes(e.target.value)}/>
 <label htmlFor="qty">Jumlah porsi</label><input id="qty" type="number" min="1" max="50" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/><button disabled={busy||!selectedMenu||(channel==="dine_in"&&!selectedTable)} onClick={order}>Buat pesanan dummy</button>
 <label htmlFor="add-order">Tambah menu ke pesanan yang belum dibayar</label><select id="add-order" value={targetOrder} onChange={e=>setTargetOrder(e.target.value)}><option value="">Pilih pesanan aktif</option>{orders.filter(o=>o.payment_status==="unpaid"&&!["cancelled","completed","served"].includes(o.status)).map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {rupiah(Number(o.total))}</option>)}</select>
 <button disabled={busy||!selectedMenu||!targetOrder} onClick={addItem}>Tambah ke pesanan</button></div>
 {(role==="Cashier"||role==="Manager")&&<div><h4>Pembayaran dummy</h4><label htmlFor="order">Pesanan</label><select id="order" value={payOrder} onChange={e=>setPayOrder(e.target.value)}><option value="">Pilih pesanan</option>{orders.filter(o=>o.status!=="cancelled"&&Number(o.total)>paid(o.id)).map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · Sisa {rupiah(Number(o.total)-paid(o.id))}</option>)}</select>
 <label htmlFor="method">Metode</label><select id="method" value={payMethod} onChange={e=>setPayMethod(e.target.value)}><option value="cash">Tunai dummy</option><option value="qris_dummy">QRIS dummy</option><option value="transfer_dummy">Transfer dummy</option><option value="cod_dummy">COD dummy</option></select><label htmlFor="amount">Nominal simulasi (Rp)</label><input id="amount" type="number" min="1" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/><button disabled={busy} onClick={payment}>Catat pembayaran dummy</button></div>}</div>}
 {(role==="Kitchen"||role==="Manager")&&<div className="kitchen"><h4>Kitchen Display · Antrean</h4>{items.filter(i=>!["served","cancelled"].includes(i.status)).length===0&&<p>Belum ada antrean</p>}{items.filter(i=>!["served","cancelled"].includes(i.status)).map(i=><div className="kitchen-ticket" key={i.id}><strong>{i.quantity}× {menus.find(m=>m.id===i.menu_item_id)?.name||"Menu"}</strong><span> · {labels[i.status]||i.status}</span><button disabled={busy} onClick={()=>kitchen(i,i.status==="waiting"?"preparing":i.status==="preparing"?"ready":"served")}>Lanjutkan status</button>{i.status==="waiting"&&<button disabled={busy} onClick={()=>kitchen(i,"cancelled")}>Batal sebelum dimasak</button>}</div>)}</div>}
 {(role==="Waiter"||role==="Cashier"||role==="Manager")&&<div className="kitchen"><h4>Status meja</h4>{tables.map(t=><div className="kitchen-ticket" key={t.id}><strong>{t.name}</strong><span> · {labels[t.status]||t.status}</span>{t.status==="cleaning"&&<button disabled={busy} onClick={()=>clean(t.id)}>Selesai dibersihkan</button>}</div>)}</div>}
 {(role==="Waiter"||role==="Manager")&&<div className="kitchen"><h4>G1.5 · Gabung meja dalam satu tagihan</h4><p className="feature-help">Tambahkan meja kosong ke pesanan dine-in yang aktif. Semua meja akan memakai satu nomor tagihan. Meja yang sudah memiliki tagihan aktif belum dapat digabung pada versi ini.</p>
 <label htmlFor="join-order">Tagihan induk</label><select id="join-order" value={joinOrderId} onChange={e=>setJoinOrderId(e.target.value)}><option value="">Pilih tagihan aktif</option>{orders.filter(o=>o.table_id&&!["completed","cancelled"].includes(o.status)).map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {tables.find(t=>t.id===o.table_id)?.name||"Meja"}</option>)}</select>
 <label htmlFor="join-table">Meja tambahan</label><select id="join-table" value={joinTableId} onChange={e=>setJoinTableId(e.target.value)}><option value="">Pilih meja tersedia</option>{tables.filter(t=>t.status==="available").map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 <button disabled={busy||!joinOrderId||!joinTableId} onClick={joinTable}>Gabungkan meja pada tagihan</button>
 {joinedTables.filter(x=>x.order_id===joinOrderId).length>0&&<p className="feature-help">Meja gabungan: {joinedTables.filter(x=>x.order_id===joinOrderId).map(x=>tables.find(t=>t.id===x.table_id)?.name).join(", ")}</p>}
 </div>}
 {(role==="Cashier"||role==="Manager")&&<div className="kitchen bill-panel"><h4>G1.6 · Split Bill berdasarkan item/porsi</h4>
 <p className="feature-help">Bayar satu atau beberapa porsi secara terpisah. Semua pembayaran tetap tercatat pada satu tagihan utama. Hanya berlaku untuk pesanan yang belum memiliki pembayaran umum dan tanpa pajak/diskon tingkat order.</p>
 <label htmlFor="split-order">Tagihan belum lunas</label><select id="split-order" value={splitOrderId} onChange={e=>{setSplitOrderId(e.target.value);setSplitItemId("");splitRequestKey.current=null;}}><option value="">Pilih pesanan</option>{orders.filter(o=>!["cancelled","completed"].includes(o.status)&&o.payment_status!=="paid"&&(!payments.some(p=>p.order_id===o.id)||allocations.some(a=>a.order_id===o.id))).map(o=><option key={o.id} value={o.id}>#{o.id.slice(0,8)} · Sisa {rupiah(Number(o.total)-paid(o.id))}</option>)}</select>
 <label htmlFor="split-item">Item yang akan dibayar</label><select id="split-item" value={splitItemId} onChange={e=>{setSplitItemId(e.target.value);setSplitQty(1);splitRequestKey.current=null;}}><option value="">Pilih item</option>{items.filter(i=>i.order_id===splitOrderId&&i.status!=="cancelled"&&i.quantity>allocations.filter(a=>a.order_item_id===i.id).reduce((n,a)=>n+a.quantity,0)).map(i=><option key={i.id} value={i.id}>{menus.find(m=>m.id===i.menu_item_id)?.name||"Menu"} · {i.quantity-allocations.filter(a=>a.order_item_id===i.id).reduce((n,a)=>n+a.quantity,0)} porsi tersedia</option>)}</select>
 <label htmlFor="split-qty">Jumlah porsi</label><input id="split-qty" type="number" min="1" max={Math.max(1,(items.find(i=>i.id===splitItemId)?.quantity||1)-allocations.filter(a=>a.order_item_id===splitItemId).reduce((n,a)=>n+a.quantity,0))} value={splitQty} onChange={e=>{setSplitQty(Number(e.target.value));splitRequestKey.current=null;}}/>
 <label htmlFor="split-method">Metode pembayaran dummy</label><select id="split-method" value={splitMethod} onChange={e=>{setSplitMethod(e.target.value);splitRequestKey.current=null;}}><option value="cash">Tunai</option><option value="qris_dummy">QRIS</option><option value="transfer_dummy">Transfer</option><option value="cod_dummy">COD</option></select>
 {splitItemId&&<p className="feature-help">Nominal otomatis: <strong>{rupiah(Number(items.find(i=>i.id===splitItemId)?.unit_price||0)*splitQty)}</strong></p>}
 <button disabled={busy||!splitOrderId||!splitItemId||splitQty<1||!Number.isInteger(splitQty)||splitQty>(items.find(i=>i.id===splitItemId)?.quantity||0)-allocations.filter(a=>a.order_item_id===splitItemId).reduce((n,a)=>n+a.quantity,0)} onClick={paySplitItem}>Catat pembayaran item dummy</button>
 </div>}
 {(role==="Cashier"||role==="Manager"||role==="Owner")&&<div className="kitchen bill-panel"><h4>G1.5 · Rincian tagihan simulasi</h4>
 <label htmlFor="bill-order">Nomor pesanan / tagihan</label><select id="bill-order" value={billOrderId} onChange={e=>setBillOrderId(e.target.value)}><option value="">Pilih tagihan</option>{orders.map(o=><option key={o.id} value={o.id}>#{o.id.slice(0,8)} · {rupiah(Number(o.total))}</option>)}</select>
 {orders.filter(o=>o.id===billOrderId).map(o=><div className="bill-details" key={o.id}>
 <p><strong>Tagihan #{o.id.slice(0,8)}</strong> · Meja: {[tables.find(t=>t.id===o.table_id)?.name||"Takeaway",...joinedTables.filter(x=>x.order_id===o.id).map(x=>tables.find(t=>t.id===x.table_id)?.name||"Meja")].join(" + ")}</p>
 {items.filter(i=>i.order_id===o.id&&i.status!=="cancelled").map(i=><div className="bill-line" key={i.id}><span>{i.quantity}× {menus.find(m=>m.id===i.menu_item_id)?.name||"Menu"}</span><strong>{rupiah(Number(i.quantity)*Number(i.unit_price))}</strong></div>)}
 <div className="bill-line"><strong>Total tagihan</strong><strong>{rupiah(Number(o.total))}</strong></div>
 <div className="bill-line"><span>Sudah dibayar (dummy)</span><strong>{rupiah(paid(o.id))}</strong></div>
 <div className="bill-line"><strong>Sisa pembayaran</strong><strong>{rupiah(Math.max(0,Number(o.total)-paid(o.id)))}</strong></div>
 <p className="feature-help">Pembayaran sebagian dan beberapa metode tercatat pada satu tagihan. Split bill per item akan dikembangkan terpisah.</p></div>)}
 </div>}
 {(role==="Waiter"||role==="Manager")&&<div className="kitchen"><h4>G1.4 · Pindah meja</h4><p className="feature-help">Memindahkan satu pesanan dine-in ke meja yang masih tersedia. Tagihan tetap pada pesanan yang sama.</p>
 <label htmlFor="move-order">Pesanan aktif</label><select id="move-order" value={moveOrderId} onChange={e=>setMoveOrderId(e.target.value)}><option value="">Pilih pesanan</option>{orders.filter(o=>o.table_id&&!["completed","cancelled"].includes(o.status)).map(o=><option value={o.id} key={o.id}>{o.id.slice(0,8)} · {tables.find(t=>t.id===o.table_id)?.name||"Meja"}</option>)}</select>
 <label htmlFor="move-table">Meja tujuan</label><select id="move-table" value={moveTableId} onChange={e=>setMoveTableId(e.target.value)}><option value="">Pilih meja tersedia</option>{tables.filter(t=>t.status==="available").map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select>
 <button disabled={busy||!moveOrderId||!moveTableId} onClick={moveTable}>Pindahkan pesanan</button></div>}
 {(role==="Kitchen"||role==="Manager")&&<div className="kitchen"><h4>G1.4 · Pembatalan dengan persetujuan</h4><p className="feature-help">Item yang sudah diproses harus melalui persetujuan manajer. Bahan yang sudah dimasak tidak otomatis dikembalikan ke stok.</p>
 {role==="Kitchen"&&<><label htmlFor="cancel-reason">Alasan pembatalan</label><input id="cancel-reason" value={cancelReason} maxLength={500} onChange={e=>setCancelReason(e.target.value)} placeholder="Contoh: pelanggan mengganti pesanan"/>{items.filter(i=>["preparing","ready"].includes(i.status)&&!cancelRequests.some(r=>r.order_item_id===i.id&&r.status==="pending")).map(i=><div className="kitchen-ticket" key={i.id}><span>{i.quantity}× {menus.find(m=>m.id===i.menu_item_id)?.name||"Menu"}</span><button disabled={busy||cancelReason.trim().length<4} onClick={()=>requestCancel(i.id)}>Minta persetujuan</button></div>)}</>}
 {role==="Manager"&&<><p className="feature-help">Pada demo publik, persetujuan menggunakan identitas sesi Owner yang terautentikasi. Role Switcher bukan autentikasi karyawan.</p>{cancelRequests.filter(r=>r.status==="pending").map(r=><div className="kitchen-ticket" key={r.id}><span>{menus.find(m=>m.id===items.find(i=>i.id===r.order_item_id)?.menu_item_id)?.name||"Item"} · {r.reason}</span><button disabled={busy} onClick={()=>decideCancel(r.id,true)}>Setujui</button><button disabled={busy} onClick={()=>decideCancel(r.id,false)}>Tolak</button></div>)}</>}
 {cancelRequests.filter(r=>r.status==="pending").length===0&&<p className="feature-help">Belum ada permintaan yang menunggu.</p>}</div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>G2.3 · Produksi WIP & Barang Jadi</h4><p className="feature-help">Simulasi konversi stok: bahan input berkurang, output bertambah, dan biaya rata-rata output diperbarui. Output harus ditandai WIP/barang jadi dalam master data.</p>
 <h4>Tambah master stok</h4><label htmlFor="sku-name">Nama produk/bahan</label><input id="sku-name" value={skuName} onChange={e=>setSkuName(e.target.value)} placeholder="Contoh: Ayam ungkep siap masak"/>
 <label htmlFor="sku-unit">Satuan</label><input id="sku-unit" value={skuUnit} onChange={e=>setSkuUnit(e.target.value)}/>
 <label htmlFor="sku-stage">Tahap bahan</label><select id="sku-stage" value={skuStage} onChange={e=>setSkuStage(e.target.value)}><option value="raw">Mentah</option><option value="wip">Setengah jadi / WIP</option><option value="finished">Barang jadi</option></select><button disabled={busy||skuName.trim().length<2} onClick={createSku}>Tambah master stok</button>
 <label htmlFor="production-output">Output WIP/barang jadi</label><select id="production-output" value={productionOutput} onChange={e=>{setProductionOutput(e.target.value);productionKey.current=null;}}><option value="">Pilih output</option>{stocks.filter(i=>i.inventory_stage==="wip"||i.inventory_stage==="finished").map(i=><option key={i.id} value={i.id}>{i.name} · {i.inventory_stage}</option>)}</select>
 {stocks.every(i=>i.inventory_stage==="raw")&&<p className="feature-help">Belum ada stok WIP/barang jadi pada dataset. Penambahan master output akan diselesaikan pada penyempurnaan G2.3.</p>}
 <label htmlFor="production-input">Input bahan</label><select id="production-input" value={productionInput} onChange={e=>setProductionInput(e.target.value)}><option value="">Pilih input</option>{stocks.filter(i=>i.id!==productionOutput).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
 <label htmlFor="production-input-qty">Jumlah input</label><input id="production-input-qty" type="number" min="0.001" step="0.001" value={productionInputQty} onChange={e=>setProductionInputQty(e.target.value)}/>
 <label htmlFor="production-output-basis">Untuk jumlah output</label><input id="production-output-basis" type="number" min="0.001" step="0.001" value={productionOutputBasis} onChange={e=>setProductionOutputBasis(e.target.value)}/>
 <button disabled={busy||!productionOutput||!productionInput} onClick={configureProduction}>Simpan formula produksi</button>
 <label htmlFor="production-run-qty">Jumlah output batch</label><input id="production-run-qty" type="number" min="0.001" step="0.001" value={productionQty} onChange={e=>{setProductionQty(e.target.value);productionKey.current=null;}}/>
 <button disabled={busy||!productionOutput} onClick={produceBatch}>Proses produksi dummy</button>
 {productionRecipes.filter(r=>r.output_ingredient_id===productionOutput).map(r=><p className="feature-help" key={r.id}>{stocks.find(i=>i.id===r.input_ingredient_id)?.name}: {r.input_qty} → output {r.output_qty}</p>)}
 <h4>Batch produksi terbaru</h4>{productionRuns.map(r=><div key={r.id} className="bill-line"><span>{stocks.find(i=>i.id===r.output_ingredient_id)?.name||"Output"} · {r.output_qty}</span><strong>{rupiah(Number(r.total_input_cost))}</strong></div>)}
 </div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>G2.2 · Resep, Stock Opname & Waste</h4><p className="feature-help">Setiap perubahan masuk ke audit. Pengeditan resep ditahan jika ada antrean dapur yang masih mereservasi bahannya.</p>
 <div className="demo-grid"><div><h4>Pengelolaan resep</h4>
 <label htmlFor="recipe-menu">Menu</label><select id="recipe-menu" value={recipeMenu} onChange={e=>setRecipeMenu(e.target.value)}><option value="">Pilih menu</option>{menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
 <label htmlFor="recipe-ingredient">Bahan</label><select id="recipe-ingredient" value={recipeIngredient} onChange={e=>setRecipeIngredient(e.target.value)}><option value="">Pilih bahan</option>{stocks.map(x=><option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}</select>
 <label htmlFor="recipe-qty">Kebutuhan per 1 porsi</label><input id="recipe-qty" type="number" min="0.001" step="0.001" value={recipeQty} onChange={e=>setRecipeQty(e.target.value)}/>
 <button disabled={busy||!recipeMenu||!recipeIngredient} onClick={saveRecipe}>Simpan komponen resep</button>
 {recipeLines.filter(x=>x.menu_item_id===recipeMenu).map(x=><div className="bill-line" key={x.id}><span>{stocks.find(i=>i.id===x.ingredient_id)?.name||"Bahan"} · {x.qty} {stocks.find(i=>i.id===x.ingredient_id)?.unit}</span><button disabled={busy} onClick={()=>removeRecipe(x.ingredient_id)}>Hapus</button></div>)}
 </div><div><h4>Waste / Stock opname</h4>
 <label htmlFor="stock-type">Jenis penyesuaian</label><select id="stock-type" value={stockAction} onChange={e=>{setStockAction(e.target.value);stockRequestKey.current=null;}}><option value="waste">Bahan terbuang / rusak</option><option value="opname">Stock opname (hasil hitung fisik)</option></select>
 <label htmlFor="stock-ingredient">Bahan baku</label><select id="stock-ingredient" value={stockIngredient} onChange={e=>{setStockIngredient(e.target.value);stockRequestKey.current=null;}}><option value="">Pilih bahan</option>{stocks.map(x=><option key={x.id} value={x.id}>{x.name} · fisik {x.on_hand} · reserved {x.reserved}</option>)}</select>
 <label htmlFor="stock-qty">{stockAction==="waste"?"Jumlah terbuang":"Jumlah fisik hasil hitung"}</label><input id="stock-qty" type="number" min="0" step="0.001" value={stockQuantity} onChange={e=>{setStockQuantity(e.target.value);stockRequestKey.current=null;}}/>
 <label htmlFor="stock-reason">Alasan (wajib)</label><input id="stock-reason" maxLength={500} placeholder="Minimal 4 karakter" value={stockReason} onChange={e=>{setStockReason(e.target.value);stockRequestKey.current=null;}}/>
 <button disabled={busy||!stockIngredient||!stockQuantity||stockReason.trim().length<4} onClick={updateStock}>Catat penyesuaian dummy</button>
 </div></div>
 <h4>Riwayat penyesuaian</h4>{inventoryEvents.length===0?<p className="feature-help">Belum ada waste atau opname.</p>:inventoryEvents.map(x=><div className="bill-line" key={x.id}><span>{stocks.find(i=>i.id===x.ingredient_id)?.name||"Bahan"} · {x.event_type==="waste"?"Waste":"Opname"} · {x.reason}</span><strong>{Number(x.quantity_change)>0?"+":""}{Number(x.quantity_change)}</strong></div>)}
 </div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>G2.1 · Inventory, Purchasing & HPP</h4><p className="feature-help">Penerimaan pembelian dummy menambah stok fisik dan memperbarui harga rata-rata tertimbang. Angka HPP adalah estimasi biaya bahan berdasarkan resep saat ini, bukan laba bersih.</p>
 <div className="demo-grid"><div><h4>Terima pembelian bahan</h4>
 <label htmlFor="purchase-supplier">Supplier</label><select id="purchase-supplier" value={purchaseSupplier} onChange={e=>{setPurchaseSupplier(e.target.value);purchaseKey.current=null;}}><option value="">Tanpa supplier</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
 <label htmlFor="purchase-ingredient">Bahan baku</label><select id="purchase-ingredient" value={purchaseIngredient} onChange={e=>{setPurchaseIngredient(e.target.value);purchaseKey.current=null;}}><option value="">Pilih bahan</option>{stocks.map(x=><option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}</select>
 <label htmlFor="purchase-qty">Jumlah diterima</label><input id="purchase-qty" type="number" min="0.0001" step="any" value={purchaseQty} onChange={e=>{setPurchaseQty(e.target.value);purchaseKey.current=null;}}/>
 <label htmlFor="purchase-cost">Harga beli per unit (Rp)</label><input id="purchase-cost" type="number" min="0" step="any" value={purchaseUnitCost} onChange={e=>{setPurchaseUnitCost(e.target.value);purchaseKey.current=null;}}/>
 <button disabled={busy||!purchaseIngredient} onClick={receivePurchase}>Terima pembelian dummy</button>
 </div><div><h4>Stok bahan tersedia</h4>{stocks.map(x=><div className="bill-line" key={x.id}><span><strong>{x.name}</strong> · {Number(x.on_hand)} {x.unit} (reservasi {Number(x.reserved)})</span><span>Rata-rata {rupiah(Number(x.avg_cost))}</span></div>)}</div></div>
 <h4>Estimasi HPP menu</h4>{menuHpp.map(x=><div className="bill-line" key={x.menu_item_id}><span>{x.menu_name}{x.recipe_components===0?" · resep belum lengkap":""}</span><span>HPP {rupiah(Number(x.estimated_hpp))} · Margin kotor {rupiah(Number(x.gross_margin))}</span></div>)}
 <p className="feature-help">Pembelian dummy terakhir: {purchases.length} · Total pembelian simulasi {rupiah(purchases.reduce((n,p)=>n+Number(p.total),0))} (maksimal 20 transaksi terbaru).</p>
 </div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>G3–G4 · Keuangan Simulasi & Owner Analytics</h4><p className="feature-help">Seluruh transaksi adalah dummy. Margin di bawah merupakan estimasi berbasis cost snapshot bahan pada waktu order, belum memperhitungkan gaji, sewa, utilitas, penyusutan, atau biaya lain; bukan laba bersih.</p>
 <div className="demo-grid">
 <div><strong>Total tagihan</strong><h3>{rupiah(financials.reduce((n,x)=>n+Number(x.billed_revenue),0))}</h3></div>
 <div><strong>Pembayaran simulasi</strong><h3>{rupiah(financials.reduce((n,x)=>n+Number(x.received_dummy),0))}</h3></div>
 <div><strong>Piutang simulasi</strong><h3>{rupiah(financials.reduce((n,x)=>n+Number(x.receivable_dummy),0))}</h3></div>
 <div><strong>Estimasi margin kotor</strong><h3>{rupiah(financials.reduce((n,x)=>n+Number(x.estimated_gross_margin),0))}</h3></div>
 </div>
 <h4>Catat biaya operasional dummy</h4><label htmlFor="expense-category">Kategori</label><select id="expense-category" value={expenseCategory} onChange={e=>{setExpenseCategory(e.target.value);expenseKey.current=null;}}><option value="rent">Sewa</option><option value="payroll">Gaji</option><option value="utilities">Listrik, air, utilitas</option><option value="marketing">Pemasaran</option><option value="logistics">Logistik</option><option value="maintenance">Pemeliharaan</option><option value="other">Lain-lain</option></select>
 <label htmlFor="expense-description">Keterangan</label><input id="expense-description" value={expenseDescription} onChange={e=>{setExpenseDescription(e.target.value);expenseKey.current=null;}} placeholder="Contoh: biaya listrik dummy"/>
 <label htmlFor="expense-amount">Jumlah (Rp)</label><input id="expense-amount" type="number" min="1" value={expenseAmount} onChange={e=>{setExpenseAmount(e.target.value);expenseKey.current=null;}}/>
 <button disabled={busy||expenseDescription.trim().length<3} onClick={recordExpense}>Catat biaya dummy</button>
 <h4>Hasil operasional terestimasi</h4>{profitDaily.map(d=><div key={d.report_date} className="bill-line"><span>{d.report_date}: margin kotor {rupiah(Number(d.estimated_gross_margin))} − biaya {rupiah(Number(d.operating_expenses))}</span><strong>{rupiah(Number(d.estimated_operating_result))}</strong></div>)}
 <p className="feature-help">Estimasi ini bukan pembukuan akuntansi lengkap atau laba bersih yang sudah diaudit; angka biaya hanya yang dicatat dalam simulasi.</p>
 <h4>Kinerja per tanggal (maks. 30 hari transaksi)</h4>
 {dailyKpis.map(d=><div className="bill-line" key={d.report_date}><span><strong>{d.report_date}</strong> · {d.order_count} pesanan · {d.cancelled_orders} dibatalkan</span><span>Terima {rupiah(Number(d.received_dummy))} · Margin indikatif {rupiah(Number(d.estimated_gross_margin))}</span></div>)}
 <h4>Ringkasan kanal</h4>{["dine_in","takeaway","delivery"].map(c=><div className="bill-line" key={c}><span>{c==="dine_in"?"Dine-in":c==="takeaway"?"Takeaway":"Delivery"}</span><strong>{financials.filter(f=>f.channel===c).length} pesanan · {rupiah(financials.filter(f=>f.channel===c).reduce((n,f)=>n+Number(f.billed_revenue),0))}</strong></div>)}
 </div>}
 {session&&<div className="kitchen"><h4>G5 · Guided Demo Sajiva</h4><p className="feature-help">Panduan demonstrasi satu alur restoran. Gunakan tombol berikut untuk melihat peran dan modul yang relevan.</p>
 {(()=>{const steps:[Role,string,string][]=[["Owner","Dashboard","Lihat ringkasan Owner, persediaan, estimasi HPP, dan hasil usaha dummy."],["Waiter","Buat Pesanan","Buat pesanan dine-in, takeaway, atau delivery dengan menu dan catatan."],["Kitchen","Proses Dapur","Terima tiket dan ubah status dari menunggu, memasak, siap, hingga disajikan."],["Cashier","Pembayaran","Catat pembayaran dummy, split bill, dan cek sisa tagihan."],["Manager","Kontrol Operasional","Cek perpindahan meja, approval pembatalan, opname, dan produksi."]];const step=steps[guidedStep]||steps[0];return <><p><strong>{guidedStep+1} / {steps.length}: {step[1]}</strong></p><p>{step[2]}</p><div className="roles"><button disabled={guidedStep===0} onClick={()=>{const n=Math.max(0,guidedStep-1);setGuidedStep(n);setRole(steps[n][0]);}}>Sebelumnya</button><button onClick={()=>{const n=(guidedStep+1)%steps.length;setGuidedStep(n);setRole(steps[n][0]);}}>{guidedStep===steps.length-1?"Ulangi demo":"Lanjut langkah"}</button><button onClick={()=>setRole(step[0])}>Buka role {step[0]}</button></div></>})()}
 </div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>Ringkasan bisnis simulasi</h4><p>Pesanan: {orders.length} · Item dapur aktif: {items.filter(i=>!["served","cancelled"].includes(i.status)).length}</p><p>Pembayaran dummy diterima: {rupiah(payments.filter(p=>p.status==="simulated").reduce((s,p)=>s+Number(p.amount),0))}</p></div>}
 <h4>Pesanan simulasi</h4><ul>{orders.map(o=><li key={o.id}>{o.id.slice(0,8)} · {rupiah(o.total)} · {o.payment_status}</li>)}</ul>
 <button disabled={busy} onClick={()=>withBusy(()=>refresh(session))}>Perbarui data</button>
 </>}</article>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 </section><footer>SAJIVA · Tidak menerima pembayaran nyata · G5 · Produksi / Financial Analytics / Guided Demo</footer></main>;
}
