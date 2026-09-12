import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  jsonb,
  serial,
  integer,
  boolean,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────
// Users (synced from Clerk via /api/webhooks/clerk)
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // Clerk user id, used directly — no separate uuid
    email: text('email').notNull(),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    role: text('role').notNull().default('agent'), // 'owner' | 'agent'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    roleCheck: check('users_role_check', sql`${table.role} in ('owner', 'agent')`),
    // Enforces "only one initial owner can ever be created" at the database
    // level, independent of application logic or how many serverless
    // instances race to insert concurrently. A partial unique index on a
    // constant expression restricted to role='owner' rows means at most one
    // such row can exist — Postgres itself rejects a second one, even under
    // concurrent transactions from different Lambda/Edge instances. See
    // lib/user-provisioning.ts for the insert-and-retry logic this backs.
    singleOwnerIdx: uniqueIndex('users_single_owner_idx').on(table.role).where(sql`${table.role} = 'owner'`),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Companies
// ─────────────────────────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  website: text('website'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  // Drives per-agent visibility, same rule as contacts/properties/deals:
  // null = owners-only until assigned.
  assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────────────────────────

export const contacts = pgTable(
  'contacts',
  {
    id: serial('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    preferredLanguage: text('preferred_language').notNull().default('en'), // 'en' | 'es'

    companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),

    // 'business_buyer' | 'business_seller' | 'tenant' | 'landlord' | 'property_buyer' | 'property_seller' | 'past_client' | 'other'
    contactType: text('contact_type').notNull().default('other'),

    // 'hot' | 'warm' | 'nurture' | 'unqualified' — set/updated by AI qualification
    leadScore: text('lead_score').notNull().default('nurture'),
    leadScoreReason: text('lead_score_reason'), // short "why", shown in priorities

    source: text('source').notNull().default('manual'), // 'website' | 'email' | 'facebook' | 'whatsapp' | 'bizbuysell' | 'manual' | 'referral'

    assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),

    tags: jsonb('tags').notNull().default('[]'),

    lastContactedAt: timestamp('last_contacted_at'),
    anniversaryDate: timestamp('anniversary_date'), // for past-client relationship triggers

    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('contacts_email_idx').on(table.email),
    phoneIdx: index('contacts_phone_idx').on(table.phone),
    leadScoreIdx: index('contacts_lead_score_idx').on(table.leadScore),
    contactTypeCheck: check(
      'contacts_contact_type_check',
      sql`${table.contactType} in ('business_buyer','business_seller','tenant','landlord','property_buyer','property_seller','past_client','other')`
    ),
    leadScoreCheck: check('contacts_lead_score_check', sql`${table.leadScore} in ('hot','warm','nurture','unqualified')`),
    sourceCheck: check(
      'contacts_source_check',
      sql`${table.source} in ('website','email','facebook','whatsapp','bizbuysell','manual','referral')`
    ),
    preferredLanguageCheck: check('contacts_preferred_language_check', sql`${table.preferredLanguage} in ('en','es')`),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Properties (also the anchor for Scorecard analyses and, later, geofencing)
// ─────────────────────────────────────────────────────────────────────────

export const properties = pgTable(
  'properties',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    formattedAddress: text('formatted_address').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    county: text('county'),

    // 'retail' | 'office' | 'industrial' | 'land' | 'multifamily' | 'business' | 'mixed_use'
    propertyType: text('property_type').notNull().default('retail'),

    // default business-profile used when launching a scorecard from this property
    defaultBusinessProfile: text('default_business_profile').notNull().default('general'),

    ownerContactId: integer('owner_contact_id').references(() => contacts.id, { onDelete: 'set null' }),

    // Drives per-agent visibility (see lib/visibility.ts). Null = visible
    // to owners only until assigned, same rule as contacts and deals.
    assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),

    // 'off_market' | 'active' | 'under_contract' | 'sold' | 'leased' | 'withdrawn'
    listingStatus: text('listing_status').notNull().default('off_market'),

    sqft: integer('sqft'),
    notes: text('notes'),

    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index('properties_location_idx').on(table.lat, table.lng),
    propertyTypeCheck: check(
      'properties_property_type_check',
      sql`${table.propertyType} in ('retail','office','industrial','land','multifamily','business','mixed_use')`
    ),
    listingStatusCheck: check(
      'properties_listing_status_check',
      sql`${table.listingStatus} in ('off_market','active','under_contract','sold','leased','withdrawn')`
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Listings (a property currently being marketed — sale, lease, or business sale)
// ─────────────────────────────────────────────────────────────────────────

export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    propertyId: integer('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    // 'sale' | 'lease' | 'business_sale'
    listingType: text('listing_type').notNull(),

    askingPrice: doublePrecision('asking_price'),
    pricePerSqft: doublePrecision('price_per_sqft'),

    // 'active' | 'pending' | 'sold' | 'leased' | 'withdrawn' | 'expired'
    status: text('status').notNull().default('active'),

    exclusivityNotes: text('exclusivity_notes'),
    listedAt: timestamp('listed_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),

    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    listingTypeCheck: check('listings_listing_type_check', sql`${table.listingType} in ('sale','lease','business_sale')`),
    statusCheck: check(
      'listings_status_check',
      sql`${table.status} in ('active','pending','sold','leased','withdrawn','expired')`
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Deals (one of five pipelines — see lib/pipelines.ts for stage config)
// ─────────────────────────────────────────────────────────────────────────

export const deals = pgTable(
  'deals',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),

    // 'business_brokerage' | 'tenant_rep' | 'landlord_rep' | 'seller_rep' | 'buyer_rep'
    pipeline: text('pipeline').notNull(),
    // validated against lib/pipelines.ts stage list for the given pipeline
    stage: text('stage').notNull(),

    // Deleting a linked contact/company/property/listing unlinks rather
    // than blocks — the deal itself is the record of value and shouldn't
    // become undeletable-adjacent (or get deleted itself) just because a
    // secondary reference went away.
    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
    propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),

    value: doublePrecision('value'),
    probability: integer('probability'), // 0-100, informs priority dashboard

    // 'nda_required' | 'nda_sent' | 'nda_signed' | 'not_applicable'
    ndaStatus: text('nda_status').notNull().default('not_applicable'),

    expectedCloseDate: timestamp('expected_close_date'),

    assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),

    // 'open' | 'won' | 'lost'
    status: text('status').notNull().default('open'),
    lostReason: text('lost_reason'),

    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pipelineStageIdx: index('deals_pipeline_stage_idx').on(table.pipeline, table.stage),
    statusIdx: index('deals_status_idx').on(table.status),
    lastActivityIdx: index('deals_last_activity_idx').on(table.lastActivityAt),
    pipelineCheck: check(
      'deals_pipeline_check',
      sql`${table.pipeline} in ('business_brokerage','tenant_rep','landlord_rep','seller_rep','buyer_rep')`
    ),
    statusCheck: check('deals_status_check', sql`${table.status} in ('open','won','lost')`),
    ndaStatusCheck: check(
      'deals_nda_status_check',
      sql`${table.ndaStatus} in ('nda_required','nda_sent','nda_signed','not_applicable')`
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Deal collaborators — per-deal helper access for agents who aren't the
// primary assignee (e.g. Susie's deal, but she adds Chad to help). This is
// the one sharing mechanism in V1: deliberate and per-deal, not a blanket
// team-wide visibility toggle. See lib/visibility.ts for how this is used.
// ─────────────────────────────────────────────────────────────────────────

export const dealCollaborators = pgTable(
  'deal_collaborators',
  {
    id: serial('id').primaryKey(),
    dealId: integer('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    // NOT NULL — a collaborator row means nothing without a user, so it's
    // cascaded (not set-null'd like the "who did this" columns elsewhere).
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedByUserId: text('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dealUserIdx: uniqueIndex('deal_collaborators_deal_user_idx').on(table.dealId, table.userId),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Documents (NDAs, LOIs, PSAs, leases, financials, etc.)
// ─────────────────────────────────────────────────────────────────────────

export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),

    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'set null' }),
    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),

    // 'nda' | 'loi' | 'psa' | 'lease' | 'financials' | 'other'
    type: text('type').notNull(),

    fileName: text('file_name').notNull(),
    objectKey: text('object_key').notNull().unique(), // R2 object key — private bucket, never a public URL
    fileSizeBytes: integer('file_size_bytes'),
    contentType: text('content_type'),

    // 'draft' | 'sent' | 'viewed' | 'signed' | 'expired'
    status: text('status').notNull().default('draft'),

    requestedAt: timestamp('requested_at'),
    sentAt: timestamp('sent_at'),
    signedAt: timestamp('signed_at'),

    uploadedByUserId: text('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    typeCheck: check('documents_type_check', sql`${table.type} in ('nda','loi','psa','lease','financials','other')`),
    statusCheck: check(
      'documents_status_check',
      sql`${table.status} in ('draft','sent','viewed','signed','expired')`
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Tasks & Notes (kept separate: tasks are actionable/due, notes are a log)
// ─────────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),

    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }),

    // 'low' | 'medium' | 'high'
    priority: text('priority').notNull().default('medium'),

    assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),

    dueAt: timestamp('due_at'),
    completedAt: timestamp('completed_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dueAtIdx: index('tasks_due_at_idx').on(table.dueAt),
    priorityCheck: check('tasks_priority_check', sql`${table.priority} in ('low','medium','high')`),
  })
)

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),

  dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }),

  authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Communications (inbound/outbound message log across channels)
// ─────────────────────────────────────────────────────────────────────────

export const communications = pgTable(
  'communications',
  {
    id: serial('id').primaryKey(),
    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),

    // 'email' | 'sms' | 'whatsapp' | 'facebook' | 'manual' | 'call'
    channel: text('channel').notNull(),
    // 'inbound' | 'outbound'
    direction: text('direction').notNull(),

    body: text('body').notNull(),
    language: text('language').notNull().default('en'),

    aiSummary: text('ai_summary'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    contactIdx: index('communications_contact_idx').on(table.contactId),
    channelCheck: check(
      'communications_channel_check',
      sql`${table.channel} in ('email','sms','whatsapp','facebook','manual','call')`
    ),
    directionCheck: check('communications_direction_check', sql`${table.direction} in ('inbound','outbound')`),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Lead intake (raw inbound events, pre-dedup, pre-qualification)
// ─────────────────────────────────────────────────────────────────────────

export const leadIntakes = pgTable(
  'lead_intakes',
  {
    id: serial('id').primaryKey(),

    // 'website' | 'email' | 'facebook' | 'whatsapp' | 'bizbuysell' | 'manual'
    source: text('source').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),

    dedupedContactId: integer('deduped_contact_id').references(() => contacts.id, { onDelete: 'set null' }),

    // 'new' | 'processing' | 'converted' | 'discarded'
    status: text('status').notNull().default('new'),

    // { leadType, leadScore, reasoning, language, confidence }
    aiClassification: jsonb('ai_classification'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    statusCheck: check('lead_intakes_status_check', sql`${table.status} in ('new','processing','converted','discarded')`),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Commissions
// ─────────────────────────────────────────────────────────────────────────

export const commissions = pgTable(
  'commissions',
  {
    id: serial('id').primaryKey(),
    // Deliberately NOT cascaded: a commission is a financial record, and a
    // deal with money attached to it shouldn't be able to silently take
    // that record with it on delete. deleteDeal() checks for this and
    // returns a friendly error instead of a raw FK-violation crash.
    dealId: integer('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'restrict' }),

    expectedAmount: doublePrecision('expected_amount').notNull(),
    invoicedAmount: doublePrecision('invoiced_amount'),
    collectedAmount: doublePrecision('collected_amount'),

    // splits e.g. [{ userId, percentage }] or [{ party: 'referral', percentage }]
    splitDetails: jsonb('split_details').notNull().default('[]'),

    // 'expected' | 'invoiced' | 'overdue' | 'collected'
    status: text('status').notNull().default('expected'),

    dueDate: timestamp('due_date'),
    invoicedAt: timestamp('invoiced_at'),
    collectedAt: timestamp('collected_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusCheck: check(
      'commissions_status_check',
      sql`${table.status} in ('expected','invoiced','overdue','collected')`
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Scorecard analyses — this is the existing `reports` table, renamed and
// now linked to a Property. Kept field-for-field compatible with the
// existing /api/analyze and /api/report/[id]/pdf routes; only the added
// columns (propertyId, dealId, createdByUserId) are new.
// ─────────────────────────────────────────────────────────────────────────

export const scorecardAnalyses = pgTable(
  'scorecard_analyses',
  {
    id: serial('id').primaryKey(),

    propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'set null' }),

    inputAddress: text('input_address').notNull(),
    formattedAddress: text('formatted_address').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    latRounded: doublePrecision('lat_rounded').notNull(),
    lngRounded: doublePrecision('lng_rounded').notNull(),
    county: text('county'),
    stateFips: text('state_fips'),
    countyFips: text('county_fips'),
    tractFips: text('tract_fips'),

    businessProfile: text('business_profile').notNull().default('general'),

    overallScore: doublePrecision('overall_score').notNull(),
    overallGrade: text('overall_grade').notNull(),

    categoryScores: jsonb('category_scores').notNull(),
    rawData: jsonb('raw_data').notNull(),
    narrative: jsonb('narrative'),

    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // cache TTL, default +60d
  },
  (table) => ({
    locationIdx: index('scorecard_location_idx').on(table.latRounded, table.lngRounded, table.businessProfile),
    propertyIdx: index('scorecard_property_idx').on(table.propertyId),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────

export const rateLimits = pgTable(
  'rate_limits',
  {
    id: serial('id').primaryKey(),
    ip: text('ip').notNull(),
    day: text('day').notNull(), // 'YYYY-MM-DD'
    count: integer('count').default(1).notNull(),
    blocked: boolean('blocked').default(false).notNull(),
  },
  (table) => ({
    // Required for the atomic `INSERT ... ON CONFLICT (ip, day) DO UPDATE`
    // in lib/rate-limit.ts — without this, concurrent requests can each
    // insert their own row (or each read-then-write the same row) and the
    // cap becomes advisory instead of enforced. See that file for the race
    // this closes.
    ipDayIdx: uniqueIndex('rate_limits_ip_day_idx').on(table.ip, table.day),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Pending document uploads — bridges "server issued a presigned PUT URL"
// and "client says they uploaded something", so createDocumentRecord never
// has to trust a bare client-supplied object key. See lib/actions/documents.ts.
// ─────────────────────────────────────────────────────────────────────────

export const pendingUploads = pgTable(
  'pending_uploads',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull().unique(),
    declaredFileName: text('declared_file_name').notNull(),
    declaredContentType: text('declared_content_type').notNull(),
    declaredSizeBytes: integer('declared_size_bytes').notNull(),

    // The parent entity this upload is destined for, checked again at
    // finalize time in case the user's access to it changed in between.
    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }),

    // 'pending' | 'finalized' | 'expired'
    status: text('status').notNull().default('pending'),

    expiresAt: timestamp('expires_at').notNull(),
    finalizedAt: timestamp('finalized_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('pending_uploads_user_idx').on(table.userId),
    statusCheck: check('pending_uploads_status_check', sql`${table.status} in ('pending','finalized','expired')`),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Audit log — append-only record of security-sensitive actions. Never
// stores secrets, tokens, signed URLs, or document contents — see
// lib/audit.ts for what's captured and the redaction rule.
// ─────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    // Preserved even if the user row is later deleted, so the trail
    // doesn't go blank — the FK above is best-effort linkage, this is
    // the durable record of who.
    actorLabel: text('actor_label').notNull(),

    action: text('action').notNull(), // e.g. 'document.download', 'deal.delete', 'user.role_change'
    entityType: text('entity_type').notNull(), // e.g. 'document', 'deal', 'user'
    entityId: text('entity_id'), // stored as text since ids span serial ints and Clerk's text user id

    metadata: jsonb('metadata'), // small, non-sensitive context only — see lib/audit.ts

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    userIdx: index('audit_logs_user_idx').on(table.userId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Daily priorities cache (written by the cron job, read by the dashboard)
// ─────────────────────────────────────────────────────────────────────────

export const dailyPriorities = pgTable(
  'daily_priorities',
  {
    id: serial('id').primaryKey(),
    // Purely a derived/disposable cache regenerated daily by the cron job —
    // cascading here (rather than set-null) is intentional: a priority
    // card about a since-deleted user/contact/deal has nothing left to
    // show and is safe to disappear rather than linger with a dangling ref.
    forUserId: text('for_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(), // 'YYYY-MM-DD'

    // 'hot_opportunity' | 'call_today' | 'deal_going_cold' | 'nda_outstanding' | 'commission_due' | 'past_client_followup'
    category: text('category').notNull(),
    reason: text('reason').notNull(), // short "why" shown on the card

    contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
    documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }),
    commissionId: integer('commission_id').references(() => commissions.id, { onDelete: 'cascade' }),

    // Populated only for 'deal_going_cold' items — an AI-drafted
    // re-engagement message the owner can review and send as-is or edit.
    draftMessage: text('draft_message'),

    dismissed: boolean('dismissed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userDayIdx: uniqueIndex('daily_priorities_user_day_category_idx').on(
      table.forUserId,
      table.day,
      table.category,
      table.contactId,
      table.dealId
    ),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert

export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert

export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert

export type Deal = typeof deals.$inferSelect
export type NewDeal = typeof deals.$inferInsert

export type DealCollaborator = typeof dealCollaborators.$inferSelect
export type NewDealCollaborator = typeof dealCollaborators.$inferInsert

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert

export type Communication = typeof communications.$inferSelect
export type NewCommunication = typeof communications.$inferInsert

export type LeadIntake = typeof leadIntakes.$inferSelect
export type NewLeadIntake = typeof leadIntakes.$inferInsert

export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert

export type ScorecardAnalysis = typeof scorecardAnalyses.$inferSelect
export type NewScorecardAnalysis = typeof scorecardAnalyses.$inferInsert

export type DailyPriority = typeof dailyPriorities.$inferSelect
export type NewDailyPriority = typeof dailyPriorities.$inferInsert

export type PendingUpload = typeof pendingUploads.$inferSelect
export type NewPendingUpload = typeof pendingUploads.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
