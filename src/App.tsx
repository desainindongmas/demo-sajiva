import { useEffect, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
type Role = "Owner" | "Manager" | "Cashier" | "Waiter" | "Kitchen";
type Session = { organization_id:string;branch_id:string;session_id:string;share_code:string };
type Menu = {id:string;name:string;price:number};
type Table = {id:string;name:string;status:string};
type Order = {id:string;total:number;payment_status:string;status:string};
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
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [selectedMenu,setSelectedMenu]=useState("");
 const [selectedTable,setSelectedTable]=useState("");
 const [payOrder,setPayOrder]=useState("");
 const [payAmount,setPayAmount]=useState("");
 const [captchaToken,setCaptchaToken]=useState<string|null>(null);
 const captchaRef=useRef<HCaptcha>(null);
 async function refresh(s:Session){
  if(!client)return;
  const [m,t,o]=await Promise.all([
   client.from("menu_items").select("id,name,price").eq("organization_id",s.organization_id).order("name"),
   client.from("dining_tables").select("id,name,status").eq("organization_id",s.organization_id).order("name"),
   client.from("orders").select("id,total,payment_status,status").eq("organization_id",s.organization_id).order("created_at",{ascending:false})
  ]);
  for(const x of [m,t,o]) if(x.error) throw x.error;
  setMenus((m.data||[]) as Menu[]);setTables((t.data||[]) as Table[]);setOrders((o.data||[]) as Order[]);
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
   const s=r.data as Session;setSession(s);await refresh(s);setNotice("Sesi simulasi dibuat. Seluruh data bersifat dummy.");
 })}
 async function order(){await withBusy(async()=>{
  if(!client||!session||!selectedMenu)throw Error("Pilih menu terlebih dahulu.");
  const r=await client.rpc("create_demo_order",{p_org:session.organization_id,p_branch:session.branch_id,p_table:selectedTable||null,p_items:[{menu_item_id:selectedMenu,quantity:1}],p_request_key:crypto.randomUUID()});
  if(r.error)throw r.error;await refresh(session);setNotice("Pesanan dummy berhasil dibuat.");
 })}
 async function payment(){await withBusy(async()=>{
  if(!client||!session||!payOrder)throw Error("Pilih pesanan.");
  const amount=Number(payAmount);if(!Number.isFinite(amount)||amount<=0)throw Error("Masukkan jumlah pembayaran yang valid.");
  const r=await client.rpc("pay_demo_order",{p_org:session.organization_id,p_order:payOrder,p_amount:amount,p_method:"cash",p_request_key:crypto.randomUUID()});
  if(r.error)throw r.error;await refresh(session);setNotice("Pembayaran tunai SIMULASI tercatat.");setPayAmount("");
 })}
 useEffect(()=>{if(!session||!client)return;const interval=setInterval(()=>{refresh(session).catch(()=>{})},12000);return()=>clearInterval(interval)},[session]);
 return <main><header><strong>sajiva</strong><span>DEMO · DATA DUMMY</span></header>
 <section className="hero"><p>Restaurant Operations Management</p><h1>Satu Sistem, Semua Terkendali.</h1><p>Simulasi operasional restoran. Tidak ada uang sungguhan yang diproses.</p></section>
 <section><h2>Ruang Demo</h2><p>Pilih peran publik untuk melihat alur simulasi.</p>
 <div className="roles">{roles.map(r=><button type="button" key={r} className={role===r?"active":""} onClick={()=>setRole(r)}>{r}</button>)}</div>
 <article><h3>{role}</h3>{!session?<><p>Buat sesi untuk mencoba data simulasi yang terisolasi.</p>{hcaptchaSitekey && <div className="captcha-area"><HCaptcha ref={captchaRef} sitekey={hcaptchaSitekey} onVerify={(token)=>setCaptchaToken(token)} onExpire={()=>setCaptchaToken(null)} onError={(err)=>{setCaptchaToken(null);setError("hCaptcha gagal: "+readableError(err))}}/></div>}<button type="button" disabled={busy || !captchaToken} onClick={start}>{busy?"Menyiapkan...":"Buat sesi demo"}</button></>:<>
 <p>Session: <code>{session.share_code}</code> · Dataset hanya untuk simulasi.</p>
 <div className="demo-grid"><div><h4>Menu & pesanan</h4>
 <label htmlFor="menu">Menu</label><select id="menu" value={selectedMenu} onChange={e=>setSelectedMenu(e.target.value)}><option value="">Pilih menu</option>{menus.map(m=><option key={m.id} value={m.id}>{m.name} · {rupiah(m.price)}</option>)}</select>
 <label htmlFor="table">Meja</label><select id="table" value={selectedTable} onChange={e=>setSelectedTable(e.target.value)}><option value="">Takeaway</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select>
 <button disabled={busy} onClick={order}>Buat pesanan dummy</button></div>
 <div><h4>Pembayaran dummy</h4><label htmlFor="order">Pesanan</label><select id="order" value={payOrder} onChange={e=>setPayOrder(e.target.value)}><option value="">Pilih pesanan</option>{orders.map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {rupiah(o.total)} · {o.payment_status}</option>)}</select>
 <label htmlFor="amount">Nominal simulasi (Rp)</label><input id="amount" type="number" min="1" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/><button disabled={busy} onClick={payment}>Catat tunai dummy</button></div></div>
 <h4>Pesanan simulasi</h4><ul>{orders.map(o=><li key={o.id}>{o.id.slice(0,8)} · {rupiah(o.total)} · {o.payment_status}</li>)}</ul>
 <button disabled={busy} onClick={()=>withBusy(()=>refresh(session))}>Perbarui data</button>
 </>}</article>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 </section><footer>SAJIVA · Tidak menerima pembayaran nyata · G0 Prototype</footer></main>;
}
