import type { ReactNode } from "react";
import { BarChart3, BookOpen, ChefHat, ClipboardList, CreditCard, LayoutDashboard, Menu, Moon, Package, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings2, ShieldCheck, Sun, Table2, X } from "lucide-react";

export type AppView = "overview"|"pos"|"kitchen"|"tables"|"billing"|"inventory"|"recipes"|"production"|"finance"|"guided";
export type RoleName = "Owner"|"Manager"|"Cashier"|"Waiter"|"Kitchen";
type Props = {
 children:ReactNode; view:AppView; setView:(view:AppView)=>void; role:RoleName;
 setRole:(role:RoleName)=>void; theme:"light"|"dark"; toggleTheme:()=>void;
 sidebarCollapsed:boolean;setSidebarCollapsed:(value:boolean)=>void;
 mobileOpen:boolean;setMobileOpen:(value:boolean)=>void;
 hasSession:boolean; syncing:string; onRefresh:()=>void; busy:boolean;
};

const navigation=[
 {id:"overview",label:"Ringkasan",icon:LayoutDashboard,group:"Workspace"},
 {id:"pos",label:"Pesanan",icon:ClipboardList,group:"Operasional"},
 {id:"kitchen",label:"Dapur",icon:ChefHat,group:"Operasional"},
 {id:"tables",label:"Meja",icon:Table2,group:"Operasional"},
 {id:"billing",label:"Pembayaran",icon:CreditCard,group:"Operasional"},
 {id:"inventory",label:"Stok & Pembelian",icon:Package,group:"Pengelolaan"},
 {id:"recipes",label:"Resep & HPP",icon:BookOpen,group:"Pengelolaan"},
 {id:"production",label:"Produksi",icon:Settings2,group:"Pengelolaan"},
 {id:"finance",label:"Keuangan",icon:BarChart3,group:"Analitik"},
 {id:"guided",label:"Panduan Demo",icon:ShieldCheck,group:"Bantuan"}
] as const;
const roleLabels:Record<RoleName,string>={Owner:"Owner",Manager:"Manager",Cashier:"Kasir",Waiter:"Pramusaji",Kitchen:"Dapur"};
const sectionNames:Record<AppView,string>={overview:"Ringkasan usaha",pos:"Pesanan",kitchen:"Kitchen Display",tables:"Manajemen meja",billing:"Pembayaran & tagihan",inventory:"Stok & pembelian",recipes:"Resep & HPP",production:"Produksi",finance:"Keuangan & analitik",guided:"Panduan demo"};
export function AppShell(p:Props){
 const go=(v:AppView)=>{
   const next:Record<AppView,RoleName>={overview:"Owner",pos:"Waiter",kitchen:"Kitchen",tables:"Waiter",billing:"Cashier",inventory:"Manager",recipes:"Manager",production:"Manager",finance:"Owner",guided:p.role};
   p.setRole(next[v]);p.setView(v);p.setMobileOpen(false);
 };
 const nav=()=>navigation.map((n,i)=><div key={n.id} className="nav-group-item">
   {(i===0||n.group!==navigation[i-1].group)&&<div className="nav-group-label">{n.group}</div>}
   <button type="button" className={"nav-item"+(p.view===n.id?" is-selected":"")} onClick={()=>go(n.id as AppView)} aria-current={p.view===n.id?"page":undefined} title={n.label}>
    <n.icon size={19} strokeWidth={1.85}/><span className="nav-label">{n.label}</span>
   </button>
 </div>);
 const dock=[navigation[0],navigation[1],navigation[2],navigation[4]];
 return <div className={"app-layout "+(p.sidebarCollapsed?"sidebar-collapsed":"")} data-theme={p.theme}>
   {p.mobileOpen&&<button className="mobile-scrim" type="button" aria-label="Tutup navigasi" onClick={()=>p.setMobileOpen(false)}/>}
   <aside className={"app-sidebar "+(p.mobileOpen?"mobile-open":"")} aria-label="Menu utama">
     <div className="brand-row"><div className="brand-mark"><span>s</span></div><div className="brand-text"><strong>sajiva</strong><small>Restaurant workspace</small></div>
       <button type="button" className="icon-button sidebar-close-mobile" aria-label="Tutup menu" onClick={()=>p.setMobileOpen(false)}><X size={20}/></button>
     </div>
     <div className="sidebar-nav">{nav()}</div>
     <div className="sidebar-bottom">
       <div className="sidebar-demo"><span className="demo-dot"/> Demo workspace <small>Data simulasi</small></div>
       <button type="button" className="icon-button sidebar-collapse-button" title={p.sidebarCollapsed?"Perluas sidebar":"Ciutkan sidebar"} aria-label={p.sidebarCollapsed?"Perluas sidebar":"Ciutkan sidebar"} onClick={()=>p.setSidebarCollapsed(!p.sidebarCollapsed)}>{p.sidebarCollapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
     </div>
   </aside>
   <div className="app-main">
     <header className="app-topbar">
       <div className="topbar-left"><button type="button" className="icon-button mobile-menu-button" onClick={()=>p.setMobileOpen(true)} aria-label="Buka menu"><Menu size={21}/></button>
        <div><div className="breadcrumb">SAJIVA / WORKSPACE</div><h1>{sectionNames[p.view]}</h1></div>
       </div>
       <div className="topbar-right">
         <span className={"connection-chip "+(p.hasSession?"connected":"")}><span className="connection-dot"/><span>{p.hasSession?p.syncing:"Sesi demo"}</span></span>
         <label className="role-switch-label"><span>Mode peran</span><select aria-label="Pilih peran demo" value={p.role} onChange={e=>{const next=e.target.value as RoleName;p.setRole(next);p.setView(next==="Kitchen"?"kitchen":next==="Cashier"?"billing":next==="Waiter"?"pos":next==="Manager"?"tables":"overview");}}>{(Object.keys(roleLabels) as RoleName[]).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></label>
         <button type="button" className="icon-button refresh-button" disabled={!p.hasSession||p.busy} onClick={p.onRefresh} title="Sinkronkan data" aria-label="Sinkronkan data"><RefreshCw size={18}/></button>
         <button type="button" className="icon-button theme-toggle" onClick={p.toggleTheme} title={p.theme==="light"?"Gunakan mode gelap":"Gunakan mode terang"} aria-label="Ganti tema">{p.theme==="light"?<Moon size={20}/>:<Sun size={20}/>}</button>
       </div>
     </header>
     <div className="app-content">{p.children}</div>
     <footer className="app-footer">Sajiva Workspace · Data simulasi · Tidak memproses pembayaran nyata</footer>
   </div>
   <nav className="mobile-dock" aria-label="Navigasi cepat">
     {dock.map(n=><button key={n.id} type="button" className={p.view===n.id?"is-selected":""} onClick={()=>go(n.id as AppView)}>
       <n.icon size={21} strokeWidth={1.85}/><span>{n.id==="overview"?"Home":n.id==="pos"?"Pesanan":n.id==="kitchen"?"Dapur":"Kasir"}</span>
     </button>)}
     <button type="button" onClick={()=>p.setMobileOpen(true)}><Menu size={21}/><span>Menu</span></button>
   </nav>
 </div>;
}
