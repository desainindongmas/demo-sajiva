import {test,expect} from "@playwright/test";
const url=process.env.SAJIVA_LIVE_URL||"https://demo-sajiva.pages.dev";
test("Sajiva new shell, release and navigation render",async({page})=>{
 const response=await page.goto(url,{waitUntil:"domcontentloaded"});
 expect(response?.status()).toBe(200);
 await expect(page.locator('meta[name="sajiva-release"]')).toHaveAttribute("content","g6-ux-responsive-20261110");
 await expect(page.getByRole("heading",{name:"Ringkasan usaha"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Navigasi cepat"})).toBeHidden();
 await expect(page.getByRole("complementary",{name:"Menu utama"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Pesanan",exact:true})).toBeVisible();
 await expect(page.getByLabel("Pilih peran demo")).toBeVisible();
});
test("Dark mode changes app theme and persists on reload",async({page})=>{
 await page.goto(url);
 await expect(page.locator(".app-layout")).toHaveAttribute("data-theme","light");
 await page.getByRole("button",{name:"Ganti tema"}).click();
 await expect(page.locator(".app-layout")).toHaveAttribute("data-theme","dark");
 await page.reload();
 await expect(page.locator(".app-layout")).toHaveAttribute("data-theme","dark");
});
test("Desktop sidebar can collapse",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(url);
 await page.getByRole("button",{name:"Ciutkan sidebar"}).click();
 await expect(page.locator(".app-layout")).toHaveClass(/sidebar-collapsed/);
 await page.getByRole("button",{name:"Perluas sidebar"}).click();
 await expect(page.locator(".app-layout")).not.toHaveClass(/sidebar-collapsed/);
});
test("Mobile layout has bottom dock and drawer",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(url);
 await expect(page.getByRole("navigation",{name:"Navigasi cepat"})).toBeVisible();
 await page.getByRole("button",{name:"Buka menu"}).click();
 await expect(page.getByRole("complementary",{name:"Menu utama"})).toHaveClass(/mobile-open/);
 await page.getByRole("button",{name:"Tutup menu"}).last().click();
 await expect(page.getByRole("complementary",{name:"Menu utama"})).not.toHaveClass(/mobile-open/);
});
test("No Super Admin exposed on demo",async({page})=>{
 await page.goto(url);
 await expect(page.getByLabel("Pilih peran demo")).not.toContainText("Super Admin");
});
// Transactions, hCaptcha and authorized multitenant E2E require staging credentials.

test("Navigation remains usable on tablet",async({page})=>{
 await page.setViewportSize({width:820,height:1100});
 await page.goto(url);
 await page.getByRole("complementary",{name:"Menu utama"}).getByRole("button",{name:"Pesanan"}).click();
 await expect(page.getByRole("heading",{name:"Pesanan",exact:true})).toBeVisible();
 await page.getByRole("complementary",{name:"Menu utama"}).getByRole("button",{name:"Stok & Pembelian"}).click();
 await expect(page.getByRole("heading",{name:"Stok & pembelian"})).toBeVisible();
});
test("Mobile 390px layout does not overflow viewport",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(url);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 expect(overflow).toBe(false);
});
