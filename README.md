# CRES Solutions OS

Internal CRM + Site Quality Scorecard for CRESSolutions (Tampa Bay commercial
real estate + business brokerage). Single-tenant — built for Mari and her
agents, not for resale.

Stack: Next.js 15 (App Router) + TypeScript · Drizzle + Neon Postgres ·
Clerk · Tailwind · Resend (transactional email, see note below) ·
Cloudflare R2 (documents) · Anthropic Claude API · Vercel (hosting + cron).

See `docs/ARCHITECTURE.md` for the folder structure and module breakdown
this was built in.

## 1. Database

1. Open your Neon project → SQL Editor.
2. Run `drizzle/0000_init.sql`, `drizzle/0001_business_profile.sql` if you
   haven't already (these are the original scorecard tool's migrations).
3. Run `drizzle/0002_crm_core.sql`. This creates every CRM table and renames
   the old `reports` table to `scorecard_analyses` in place — your existing
   scorecard history is preserved, not lost.

## 2. Environment variables

Set all of these in Vercel → Project → Settings → Environment Variables.

### Database & AI (carried over from the scorecard tool)
```
DATABASE_URL=postgres://...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...        # Geocoding, Places, and Static Maps APIs must all be enabled
CENSUS_API_KEY=...
FBI_CRIME_API_KEY=...     # from api.data.gov
```

### Clerk (auth — see docs/MODULE_2_SETUP.md for full walkthrough)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```
Use a **separate Clerk application** from ListOps/Blancs — this product has
its own user list (just Mari + her agents).

### Cloudflare R2 (document storage — private bucket)
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_DOCUMENTS_BUCKET=cres-documents
```
Create a **new bucket** for this (`cres-documents`) rather than reusing a
ListOps bucket — NDAs, LOIs, and financials are sensitive and should sit in
their own bucket with their own access scope. **Keep public access OFF and
do not enable the bucket's r2.dev URL** — documents are only ever served
through a permission-checked, short-lived signed URL
(`/api/documents/[id]/download`), never a direct link. See
`docs/MODULE_SECURITY_SETUP.md` for the full rationale and R2 CORS policy.

### Lead intake (inbound webhook shared secret)
```
LEAD_INTAKE_SECRET=<generate a long random string>
```
Every inbound integration (see §4 below) sends this as the
`x-lead-intake-secret` header when POSTing to `/api/leads/inbound`.

### Cron (Vercel calls this automatically — see §5)
```
CRON_SECRET=<generate a long random string>
```

## 3. Deploy

Push to your GitHub repo, import into Vercel as usual. `vercel.json` already
declares the daily-priorities cron job — Vercel picks it up automatically on
deploy, no manual cron configuration needed.

## 4. Connect lead sources

All five inbound channels POST to the same endpoint:

```
POST https://<your-domain>/api/leads/inbound
Headers: x-lead-intake-secret: <LEAD_INTAKE_SECRET>
Body: {
  "name": "Jane Doe",
  "email": "jane@example.com",       // optional, but include at least one of email/phone
  "phone": "+18135551234",           // optional
  "whatsapp": "+18135551234",        // optional
  "message": "Looking to buy a QSR site in Tampa under $2M...",
  "source": "website" | "email" | "facebook" | "whatsapp" | "bizbuysell" | "manual"
}
```

The AI reads `message` to classify lead type (business buyer/seller,
tenant, landlord, property buyer/seller) and score (hot/warm/nurture/
unqualified), dedupes against existing contacts by email/phone, and creates
or updates the contact automatically. If classification fails for any
reason, the raw message is preserved and shows up under **Contacts → pending
leads** with a Retry button — nothing is ever silently dropped.

- **Website form** — point your Next.js/HTML contact form's submit handler
  at this endpoint directly, or proxy through a serverless function if you
  don't want the secret exposed client-side (recommended).
- **Email** — set up a forwarding rule or a service like Postmark/Mailgun
  inbound parsing to POST parsed emails here as `source: "email"`.
- **Facebook/Messenger** — use a Meta webhook + a small relay (or Zapier/
  Make) to reshape the payload and forward it here as `source: "facebook"`.
- **WhatsApp** — same pattern via the WhatsApp Business API or a Twilio
  WhatsApp number's webhook, `source: "whatsapp"`.
- **BizBuySell** — BizBuySell doesn't offer outbound webhooks on standard
  listings; the practical path is Zapier's BizBuySell integration (if your
  plan includes it) or manually forwarding inquiry emails through the email
  channel above with `source: "bizbuysell"`.

## 5. Daily Priorities

`vercel.json` schedules `/api/cron/daily-priorities` for 11:00 UTC (7am
Eastern during daylight saving, 6am in winter — adjust the cron expression
if you want a fixed local time year-round). It builds each user's priority
list across six categories (hot opportunities, calls due, deals going cold
with an AI-drafted re-engagement message, outstanding NDAs, commissions due,
past-client anniversaries) and the dashboard reads from that cache. The job
is idempotent — safe if Vercel retries it.

You can also trigger it manually to test:
```
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/daily-priorities
```

## 6. First login

Sign up as Mari first — the Clerk webhook automatically makes the **first
ever user** the `owner` role. Everyone who signs up after that defaults to
`agent`; promote them from **Settings** (owner-only).

## What's carried over unchanged

`src/lib/data-sources/*`, `src/lib/grader.ts`, `src/lib/business-profiles.ts`,
`src/lib/pdf-template.ts`, and the scoring logic behind `/api/analyze` and
`/api/report/[id]/pdf` are the same engine from the original scorecard tool
— only the storage table (`reports` → `scorecard_analyses`) and auth layer
changed. Every past report stays intact and viewable at `/scorecard/[id]`.

## Known V1 scope notes

- **Resend** isn't wired up yet — NDA "send" and re-engagement drafts are
  copy/paste from the UI rather than auto-emailed. Wiring `sendNdaRequest`/
  `sendReengagement` through Resend is a natural next increment once you've
  used the manual flow for a bit and know what the email should say.
- **Tasks** (the `tasks` table) exist in the schema but don't have a
  dedicated UI yet — Notes/Activity log covers the V1 "log what happened"
  need on every contact/deal/property page. A task list view is a clean
  follow-up.
- **Geofencing (cressvisitor)** isn't built — `properties.id` is kept as the
  stable anchor specifically so that module can plug in later without a
  schema change (see `docs/ARCHITECTURE.md`).
