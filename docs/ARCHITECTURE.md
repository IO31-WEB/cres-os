# CRES Solutions OS — Architecture & Build Plan

Stack: Next.js 15 (App Router) + TypeScript, Drizzle + Neon Postgres, Clerk, Tailwind + shadcn/ui, Resend, Cloudflare R2 (docs), existing scorecard data-source libs carried over as-is.

Single-tenant internal tool for Mari's firm — no org/multi-tenancy table. Clerk users map 1:1 to the `users` table (role: owner | agent).

## Folder structure

```
src/
  app/
    (auth)/
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
    (app)/                          # authenticated shell, layout.tsx has sidebar+topbar
      layout.tsx
      dashboard/
        page.tsx                    # "Mari's Priorities"
      contacts/
        page.tsx                    # table/list, filters by leadScore/type
        [id]/page.tsx               # contact detail: comm history, deals, docs
      companies/
        page.tsx
        [id]/page.tsx
      properties/
        page.tsx
        [id]/page.tsx               # property detail + scorecard history + "run new scorecard"
      deals/
        page.tsx                    # kanban board, ?pipeline=business_brokerage etc
        [id]/page.tsx               # deal detail: stage, docs, commission, activity
      scorecard/
        page.tsx                    # standalone launcher (legacy entry point preserved)
        [id]/page.tsx               # report view (reuses existing render + PDF download)
      documents/
        page.tsx
      commissions/
        page.tsx
      settings/
        page.tsx
    api/
      analyze/route.ts              # EXISTING — scorecard generation, unchanged
      report/[id]/pdf/route.ts      # EXISTING — unchanged
      leads/inbound/route.ts        # NEW — webhook intake (web form/email/FB/WA/BizBuySell)
      leads/[id]/qualify/route.ts   # NEW — AI classification + scoring
      contacts/route.ts
      contacts/[id]/route.ts
      deals/route.ts
      deals/[id]/route.ts
      deals/[id]/stage/route.ts
      documents/route.ts
      documents/[id]/route.ts
      commissions/route.ts
      cron/daily-priorities/route.ts # Vercel cron — builds dashboard cache, drafts re-engagement
      webhooks/clerk/route.ts        # syncs Clerk users -> `users` table
  components/
    shell/ (sidebar.tsx, topbar.tsx, command-palette.tsx)
    dashboard/ (priority-card.tsx, priority-list.tsx)
    contacts/ (contact-table.tsx, contact-form.tsx, lead-score-badge.tsx)
    deals/ (pipeline-board.tsx, deal-card.tsx, stage-column.tsx)
    properties/ (property-card.tsx, scorecard-history.tsx)
    scorecard/ (moved out of the old single-page app/page.tsx: address-form.tsx, score-report.tsx, category-breakdown.tsx)
    documents/ (doc-list.tsx, nda-status-badge.tsx)
    ui/ (shadcn primitives)
  lib/
    db/
      schema.ts                     # see below
      index.ts                      # EXISTING — unchanged
    ai/
      lead-classifier.ts            # first-message -> leadType + score + language
      priority-engine.ts            # builds "Mari's Priorities" with "why" reasons
      reengagement-drafts.ts        # cold-deal detection + draft follow-up
    data-sources/                   # EXISTING — census, fbi-crime, fdot-traffic, fema-flood, geocode, places, spend-estimate — unchanged
    business-profiles.ts            # EXISTING — unchanged
    grader.ts / grader-types.ts     # EXISTING — unchanged
    pdf-template.ts                 # EXISTING — unchanged
    pipelines.ts                    # NEW — pipeline + stage config (source of truth, not DB rows)
    auth.ts                         # Clerk helpers, current-user lookup
    validations/                    # zod schemas per entity (contact, deal, document, etc.)
  emails/                           # Resend templates (nda-request, re-engagement, etc.)
drizzle/
  0000_init.sql ... 0001_business_profile.sql   # EXISTING
  0002_crm_core.sql                              # NEW — generated from schema.ts below
```

## Why pipelines/stages aren't DB tables

The five pipelines (Business Brokerage, Tenant Rep, Landlord Rep, Seller Rep, Buyer Rep) and their stages are fixed and known at build time. Modeling them as config in `lib/pipelines.ts` (a typed const, not a table) keeps the kanban board's stage logic simple and avoids a stage-ordering migration every time a workflow tweaks. `deals.pipeline` and `deals.stage` are just validated text columns checked against that config in the Zod layer.

## Build order (module-by-module, next messages)

1. **Schema + migration** (this message) — `schema.ts`, generate `0002_crm_core.sql`
2. Core shell: Clerk auth wiring, sidebar/topbar layout, `users` sync webhook
3. Contacts + Companies (CRUD, list, detail)
4. Properties + migrate the scorecard module to live under a Property (keep `/api/analyze` and `/api/report/[id]/pdf` untouched, just add `propertyId` linkage and a "new scorecard" launcher on the property page)
5. Deals: pipeline config + kanban board + deal detail
6. Documents + NDA workflow state machine
7. Commissions
8. Lead intake + AI qualification (`leads/inbound`, `leads/[id]/qualify`)
9. Daily Priorities dashboard + cron job
10. Polish pass: empty/loading/error states, mobile, dark mode, README

## Integration point for cressvisitor (geofencing)

`properties.id` is the anchor. The geofencing tool already keys location intelligence off property coordinates — a future `location_intelligence_runs` table (same shape as `scorecard_analyses`) can link to `properties.id` the same way, and its results can surface on the property detail page as a second tab next to Scorecard History. No schema changes needed now, just keeping `properties` as the stable join point.
