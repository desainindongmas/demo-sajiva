# Sajiva G0 — Environment setup

Status: initial multi-tenant database migrations deployed to project `mgavtltxnsneacdquabl`.

## Supabase
1. Project: `sajiva-demo` (Singapore). Never use Enzy Snack's project ID.
2. Authentication > Providers: enable **Anonymous Sign-Ins** for the public isolated demo. This must be enabled explicitly; the app's `start_demo()` RPC requires `auth.uid()`.
3. Add protections against abuse: CAPTCHA/rate limits before broad public distribution.
4. Use the project's **publishable** key, not the service role key.

## Local frontend
Copy `.env.example` to `.env.local` and fill:
- `VITE_SUPABASE_URL=https://mgavtltxnsneacdquabl.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<Supabase publishable key>`

Never commit credentials, service-role keys, or private signing keys.

## Cloudflare Pages
Connect GitHub `desainindongmas/demo-sajiva`, branch `main`. Build command `npm run build`; output `dist`.
Set environment values `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Pages build settings. Both are intentionally public-client configuration; do not use secret admin keys.
Use the temporary `pages.dev` hostname. Custom `.my.id` domain comes later.

## Current limitations
- The first seed only includes sample items and 3 tables: it is not the final 30-day demo dataset.
- Anonymous session registration and complete payment/order flow are not yet end-to-end tested.
- Public role switcher is a demonstration of views, not authorization.
- No real money or production data must be entered.
- No production-grade cash accounting or final stock consumption yet.
- Demo self-service session cleanup and sharing are not yet implemented.

## Gate G0 acceptance evidence pending
- Frontend build CI.
- Anonymous sign-in enabled and exercised.
- Tenant isolation cross-account test.
- Concurrent orders and idempotency tests.
- Public hosting deploy / verified integration.

## hCaptcha
1. hCaptcha website: copy your **Sitekey** (public) and your **Secret** (private).
2. Supabase Authentication > Attack Protection: enable CAPTCHA, provider hCaptcha, enter secret there, and save.
3. Supabase Authentication > Providers: enable Anonymous Sign-Ins.
4. In local env and Cloudflare Pages build variables set `VITE_HCAPTCHA_SITEKEY` to the public sitekey only.
5. Never commit the hCaptcha secret to frontend code, environment prefixed `VITE_`, or GitHub.
6. Ensure the actual Cloudflare Pages domain is registered as an allowed hostname in hCaptcha site settings.
7. Anonymous sign-in uses the CAPTCHA token. The public demo is not ready until this is end-to-end tested.
