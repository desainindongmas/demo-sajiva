import { useEffect, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
type Role = "Owner" | "Manager" | "Cashier" | "Waiter" | "Kitchen";
type Session = { organization_id:string;branch_id:string;session_id:string;share_code:string };
type Menu = {id:string;name:string;price:number};
type Table = {id:string;name:string;status:string};
type Order = {id:string;total:number;payment_status:string;status:string;table_id:string|null};
type Item = {id:string;order_id:string;menu_item_id:string;quantity:number;status:string};
type Payment = {id:string;order_id:string;amount:number;status:string};
type CancelRequest = {id:string;order_item_id:string;reason:string;status:string;created_at:string};
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
  const [m,t,o,oi,p,cr]=await Promise.all([
   client.from("menu_items").select("id,name,price").eq("organization_id",s.organization_id).order("name"),
   client.from("dining_tables").select("id,name,status").eq("organization_id",s.organization_id).order("name"),
   client.from("orders").select("id,total,payment_status,status,table_id").eq("organization_id",s.organization_id).order("created_at",{ascending:false}),
   client.from("order_items").select("id,order_id,menu_item_id,quantity,status").eq("organization_id",s.organization_id),
   client.from("payments").select("id,order_id,amount,status").eq("organization_id",s.organization_id),
   client.from("demo_cancel_requests").select("id,order_item_id,reason,status,created_at").eq("organization_id",s.organization_id).order("created_at",{ascending:false})
  ]);
  for(const x of [m,t,o,oi,p,cr]) if(x.error) throw x.error;
  setMenus((m.data||[]) as Menu[]);setTables((t.data||[]) as Table[]);setOrders((o.data||[]) as Order[]);setItems((oi.data||[]) as Item[]);setPayments((p.data||[]) as Payment[]);setCancelRequests((cr.data||[]) as CancelRequest[]);
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
  for(const table of ["orders","order_items","dining_tables","payments"]){
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
 {(role==="Waiter"||role==="Manager")&&<div className="kitchen"><h4>G1.4 · Pindah meja</h4><p className="feature-help">Memindahkan satu pesanan dine-in ke meja yang masih tersedia. Tagihan tetap pada pesanan yang sama.</p>
 <label htmlFor="move-order">Pesanan aktif</label><select id="move-order" value={moveOrderId} onChange={e=>setMoveOrderId(e.target.value)}><option value="">Pilih pesanan</option>{orders.filter(o=>o.table_id&&!["completed","cancelled"].includes(o.status)).map(o=><option value={o.id} key={o.id}>{o.id.slice(0,8)} · {tables.find(t=>t.id===o.table_id)?.name||"Meja"}</option>)}</select>
 <label htmlFor="move-table">Meja tujuan</label><select id="move-table" value={moveTableId} onChange={e=>setMoveTableId(e.target.value)}><option value="">Pilih meja tersedia</option>{tables.filter(t=>t.status==="available").map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select>
 <button disabled={busy||!moveOrderId||!moveTableId} onClick={moveTable}>Pindahkan pesanan</button></div>}
 {(role==="Kitchen"||role==="Manager")&&<div className="kitchen"><h4>G1.4 · Pembatalan dengan persetujuan</h4><p className="feature-help">Item yang sudah diproses harus melalui persetujuan manajer. Bahan yang sudah dimasak tidak otomatis dikembalikan ke stok.</p>
 {role==="Kitchen"&&<><label htmlFor="cancel-reason">Alasan pembatalan</label><input id="cancel-reason" value={cancelReason} maxLength={500} onChange={e=>setCancelReason(e.target.value)} placeholder="Contoh: pelanggan mengganti pesanan"/>{items.filter(i=>["preparing","ready"].includes(i.status)&&!cancelRequests.some(r=>r.order_item_id===i.id&&r.status==="pending")).map(i=><div className="kitchen-ticket" key={i.id}><span>{i.quantity}× {menus.find(m=>m.id===i.menu_item_id)?.name||"Menu"}</span><button disabled={busy||cancelReason.trim().length<4} onClick={()=>requestCancel(i.id)}>Minta persetujuan</button></div>)}</>}
 {role==="Manager"&&<><p className="feature-help">Pada demo publik, persetujuan menggunakan identitas sesi Owner yang terautentikasi. Role Switcher bukan autentikasi karyawan.</p>{cancelRequests.filter(r=>r.status==="pending").map(r=><div className="kitchen-ticket" key={r.id}><span>{menus.find(m=>m.id===items.find(i=>i.id===r.order_item_id)?.menu_item_id)?.name||"Item"} · {r.reason}</span><button disabled={busy} onClick={()=>decideCancel(r.id,true)}>Setujui</button><button disabled={busy} onClick={()=>decideCancel(r.id,false)}>Tolak</button></div>)}</>}
 {cancelRequests.filter(r=>r.status==="pending").length===0&&<p className="feature-help">Belum ada permintaan yang menunggu.</p>}</div>}
 {(role==="Owner"||role==="Manager")&&<div className="kitchen"><h4>Ringkasan bisnis simulasi</h4><p>Pesanan: {orders.length} · Item dapur aktif: {items.filter(i=>!["served","cancelled"].includes(i.status)).length}</p><p>Pembayaran dummy diterima: {rupiah(payments.filter(p=>p.status==="simulated").reduce((s,p)=>s+Number(p.amount),0))}</p></div>}
 <h4>Pesanan simulasi</h4><ul>{orders.map(o=><li key={o.id}>{o.id.slice(0,8)} · {rupiah(o.total)} · {o.payment_status}</li>)}</ul>
 <button disabled={busy} onClick={()=>withBusy(()=>refresh(session))}>Perbarui data</button>
 </>}</article>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 </section><footer>SAJIVA · Tidak menerima pembayaran nyata · G1.4 · Pindah meja & approval pembatalan · Data dummy</footer></main>;
}
