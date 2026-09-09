# Module 2 setup — Clerk + shell

## What changed
- `middleware.ts` replaced: HTTP Basic Auth → Clerk session auth. `SITE_USERNAME`/`SITE_PASSWORD` env vars are no longer used and can be removed from Vercel once this deploys.
- New route groups: `(auth)` for sign-in/up, `(app)` for the authenticated shell.
- `/` now redirects to `/dashboard`.
- Everything under `(app)` and all API routes except `/api/webhooks/*` require a signed-in Clerk session.

## New env vars (add in Vercel → Project → Settings → Environment Variables)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Get the first two from the Clerk dashboard (Configure → API Keys) once you create the CRES Solutions OS application there — use a **separate Clerk application** from ListOps/Blancs, since this is a different product with its own user list (just Mari + her agents).

## Clerk webhook setup
1. Clerk dashboard → Configure → Webhooks → Add Endpoint
2. Endpoint URL: `https://<your-vercel-domain>/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** into `CLERK_WEBHOOK_SECRET` above

Without this webhook, Clerk sign-ins will succeed but `requireUser()` will throw ("authenticated but not yet synced") because there's no row in the local `users` table yet.

## First-run behavior
The webhook handler makes the **first user ever created** in this Clerk app the `owner` role automatically (checks if the `users` table is empty at creation time). Sign up as Mari first, before inviting any agents.

## Migration
Run the schema migration in Neon's SQL Editor (per your usual workflow) before deploying — `drizzle-kit push` locally isn't available without a terminal, so generate the SQL from `schema.ts` and paste it in, same as `0000_init.sql`/`0001_business_profile.sql` were done.

## Nothing else changes yet
`/api/analyze` and `/api/report/[id]/pdf` are untouched in this module — they'll now sit behind Clerk auth (via middleware) but their internals are identical. The old single-page scorecard UI at the root `page.tsx` has been replaced by the redirect; module 4 rebuilds the scorecard flow at `/scorecard` inside the new shell.
