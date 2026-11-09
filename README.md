# Sajiva — Interactive Restaurant Demo

Restaurant Operations Management System with Profit Analytics.

> DEMO ONLY. All restaurant, inventory, employee, financial, and payment data must be fictional. Never enter real payments or personal data.

## Project principles
- Demo-first, production requirements validated after restaurant feedback.
- React + TypeScript + Vite; Cloudflare Pages frontend.
- Supabase PostgreSQL planned for isolated demo sessions; no production credentials in source control.
- Single branch operationally, multi-branch-ready schema.
- Public demo roles: Owner, Manager, Cashier, Waiter, Kitchen. Super Admin is **not** available in public role switching.
- No real payment gateway, AI API, or automatic payment capture.
- Financial and stock figures must be derived from underlying simulated events, never hardcoded dashboard results.

## Gates
G0 Foundation → G1 Operations → G2 Inventory → G3 Finance → G4 Intelligence → G5 Demo Scenarios → G6 Quality & Release.

## Status
G0 in progress. This repository is **not yet a runnable restaurant POS**.

## Development
```bash
npm install
npm run dev
```

Create a local `.env.local` only when the Supabase demo project is ready; never commit secret keys.

## Deployment
Cloudflare Pages: build command `npm run build`, output directory `dist`.
