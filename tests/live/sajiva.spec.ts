import { test, expect } from "@playwright/test";

const baseURL = process.env.SAJIVA_LIVE_URL || "https://demo-sajiva.pages.dev";

test("Sajiva live serves the expected G5 build and role selector", async ({ page }) => {
  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Versi situs: G5", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Waiter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kitchen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manager" })).toBeVisible();
});

test("Sajiva never exposes a Super Admin role in public demo", async ({ page }) => {
  await page.goto(baseURL);
  await expect(page.getByRole("button", { name: "Super Admin" })).toHaveCount(0);
});

test("Sajiva role navigation renders initial role view", async ({ page }) => {
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Waiter" }).click();
  await expect(page.getByRole("heading", { name: "Waiter" })).toBeVisible();
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByRole("heading", { name: "Kitchen" })).toBeVisible();
});

// CAPTCHA, sign-in, payments, and real backend mutations are intentionally
// excluded from public smoke tests. They need a dedicated authorized test
// environment and isolated fixture credentials.
