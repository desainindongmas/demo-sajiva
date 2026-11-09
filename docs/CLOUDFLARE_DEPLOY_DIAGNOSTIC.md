# Cloudflare deployment diagnostic

- Source repository: `desainindongmas/demo-sajiva`
- Branch: `main`
- Cloudflare Pages project: `demo-sajiva`
- Build command: `npm run build`
- Build output: `dist`
- Expected site: `https://demo-sajiva.pages.dev`

## Troubleshooting stale Cloudflare builds
A **retry** runs the old commit again. It does not fetch the latest HEAD.
A new push to `main` should trigger a new production deployment if Git integration is enabled.
Check Cloudflare Pages > project > Settings > Builds & deployments:
- Git repository is correct and production branch is `main`.
- Automatic deployments are enabled (not paused).
- Build/watch path filters do not exclude the changed paths.
- Deployment history shows the latest new commit SHA.

If Git triggers are broken, create a fresh deployment using the provider's production deployment action or reconnect Git integration. Do not delete the application, domain, or secret variables just to troubleshoot.

## Expected feature marker
At the bottom of the site: `G1.2 · Build 2026-11-09 · Delivery + Catatan + Tambah Menu`.
The extra order controls are visible under Waiter, Cashier, and Manager roles; not Owner.

Diagnostic marker: G1-deploy-check-2026-11-09-2305.
