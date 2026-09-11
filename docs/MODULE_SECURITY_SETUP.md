# Security & Production-Hardening Pass

## Setup required before this deploys

### 1. Migration
Run `drizzle/0004_security_hardening.sql` in Neon's SQL Editor, after
`0003_agent_visibility.sql`. It renames `documents.file_url` to
`documents.object_key`, adds `file_size_bytes`/`content_type` to documents,
and adds `assigned_to_user_id` to companies.

### 2. Make the R2 bucket private
In Cloudflare dashboard → R2 → your `cres-documents` bucket → Settings:
- **Public access: OFF**
- **r2.dev URL: disabled** (if you'd turned it on)
- Remove `R2_DOCUMENTS_PUBLIC_URL` from Vercel's env vars — it's no longer
  used anywhere in the code.

The CORS policy from the earlier setup round (allowing `PUT` from your
Vercel domain, for direct browser uploads) is still needed — that's
unrelated to bucket-level public access and stays as-is.

### 3. Existing documents
If you uploaded any real documents before this pass, they were stored
under a full public URL. That column is now `object_key` and the migration
strips the URL down to a best-effort key, but since the bucket is about to
go private, any of those pre-migration files won't be reachable at their
old key path unless you know exactly how they were stored. Re-upload
anything that matters through the app after this deploys — cleanest way to
guarantee it's stored correctly under the new model.

---

## Files changed

**Document security**
- `src/lib/db/schema.ts` — `documents.fileUrl` → `objectKey`, plus
  `fileSizeBytes`/`contentType`; `companies.assignedToUserId` added
- `drizzle/0004_security_hardening.sql` — migration for the above
- `src/lib/r2.ts` — rewritten: no more public URL helper; adds
  `createDownloadUrl` (signed, 10-min GET), `verifyUploadedObject`
  (post-upload HEAD check against size/type before trusting it),
  `documentKey` (random UUID, not timestamp-based), `sanitizeFileName`
- `src/app/api/documents/upload-url/route.ts` — validates MIME whitelist
  and declared size before presigning
- `src/app/api/documents/[id]/download/route.ts` — **new**: the only path
  to a document's bytes; checks `canViewDocument` first, then redirects to
  a fresh signed URL
- `src/lib/validations/document.ts` — `objectKey`/`contentType`/`fileSize`
  fields, sourced from the same whitelist/cap as `r2.ts`
- `src/lib/actions/documents.ts` — `createDocumentRecord` now verifies the
  uploaded object server-side (deletes it and rejects if it fails);
  `deleteDocument` now also deletes the R2 object
- `src/components/documents/document-upload-form.tsx` — client-side
  type/size validation before upload; sends `fileSize`/`contentType`
- `src/app/(app)/documents/page.tsx`,
  `src/app/(app)/deals/[id]/page.tsx` — download links now go through
  the signed-URL route instead of a stored direct link

**Authorization / IDOR**
- `src/lib/visibility.ts` — added `companiesVisibleTo`/`canViewCompany`
  and `scorecardsVisibleTo`/`canViewScorecard`
- `src/lib/db/schema.ts` — `companies.assignedToUserId`
- `src/lib/validations/company.ts`, `src/lib/actions/companies.ts`,
  `src/components/companies/company-form.tsx`, and all 4 company pages —
  same assignment/visibility pattern as contacts/properties/deals
- `src/app/(app)/scorecard/[id]/page.tsx` — **was a straight IDOR**: any
  signed-in user could view any report by id; now checks `canViewScorecard`
- `src/app/api/report/[id]/pdf/route.ts` — same fix for the PDF export
- `src/app/(app)/scorecard/page.tsx` — the "recent analyses" list was
  showing every scorecard firm-wide to every agent; now filtered, and the
  `propertyId` query param is verified against the requester's access
  before the property's address is even shown in the launcher
- `src/app/api/analyze/route.ts` — was letting any authenticated user link
  a new scorecard to *any* property/deal id just by passing it in the
  request body; now checks `canViewProperty`/`canViewDeal` first
- `src/app/api/leads/[id]/qualify/route.ts` — was auth-only; now
  owner-gated to match the pending-leads UI, which is itself owners-only
- Company dropdowns in the contact and deal forms now list only companies
  the current user can see

**Resilience**
- `src/lib/rate-limit.ts` — **new**: simple daily-cap helper reusing the
  `rate_limits` table (previously defined in the schema but never actually
  wired up anywhere)
- `src/app/api/analyze/route.ts` — 100/day per-user cap on *fresh* (non-
  cached) scorecard runs
- `src/lib/ai/process-lead.ts` — 300/day global cap on lead classification
  (webhook-triggered, not per-user)
- `src/lib/ai/reengagement-drafts.ts` — 200/day global cap on AI-drafted
  re-engagement messages (cron-triggered)

---

## What I checked and found already fine

- No secrets are referenced in any `'use client'` file (grepped for
  `process.env` across every client component — zero hits).
- `LEAD_INTAKE_SECRET` and `CRON_SECRET` are only ever compared
  server-side inside route handlers, never sent to the client, and error
  responses return generic messages ("Unauthorized") rather than echoing
  back what was expected.
- No `NEXT_PUBLIC_*` variables are referenced directly in app code beyond
  what Clerk's SDK reads internally (publishable key, sign-in/up URLs) —
  nothing sensitive is prefixed for client exposure.
- External data-source calls in the scorecard pipeline
  (`src/lib/data-sources/*`) were already individually wrapped in
  `.catch()` so one source failing doesn't take down the whole report —
  this predates this pass, carried over from the original tool.
- AI narrative generation and lead classification already had try/catch
  around them with a fallback path (null narrative; lead intake preserved
  with the error recorded for retry) rather than crashing the request.

---

## Remaining risks for V1.1 / V2

- **File size cap isn't enforced at the storage layer itself.** The
  presigned PUT URL can't hard-block an oversized upload mid-stream — this
  pass catches it *after* the fact via a HEAD check and deletes the object
  before a document record is ever created, which closes the gap for
  anything that reaches your database, but a determined actor could still
  briefly push bytes into R2 before the post-check runs. True prevention
  needs an R2/S3 POST policy with a `content-length-range` condition
  instead of a plain presigned PUT — more setup, reasonable to defer.
- **No malware/content scanning on uploads.** MIME-type and size are
  validated, but nothing inspects file contents (e.g. a PDF with an
  embedded exploit). Consider a scanning step (e.g. via a Cloudflare
  Worker or a third-party API) before V2 if document sharing expands
  beyond your internal team.
- **Rate limits are coarse, not per-feature-tuned.** The caps I added are
  deliberately generous backstops against a runaway loop, not real usage
  throttling. If costs ever become a concern, tightening these (and adding
  visibility into current usage) is a quick follow-up.
- **No audit log.** There's no record of *who* downloaded a given document
  or *when* — useful for a brokerage handling confidential financials, and
  straightforward to add (a `document_downloads` table, written from the
  download route) if you want it.
- **Deal collaborators aren't scoped by time.** Once added as a helper,
  an agent has standing access until explicitly removed — fine for V1,
  but there's no "temporary access" or expiry concept if that ever matters.
- **Pre-existing document rows from before this migration** may not have
  a working `object_key` (see setup note above) — worth a quick manual
  check that nothing important was uploaded before this pass.
