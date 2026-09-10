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
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────────────────────────
// Users (synced from Clerk via /api/webhooks/clerk)
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user id, used directly — no separate uuid
  email: text('email').notNull(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  role: text('role').notNull().default('agent'), // 'owner' | 'agent'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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
  createdByUserId: text('created_by_user_id').references(() => users.id),
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

    companyId: integer('company_id').references(() => companies.id),

    // 'business_buyer' | 'business_seller' | 'tenant' | 'landlord' | 'property_buyer' | 'property_seller' | 'past_client' | 'other'
    contactType: text('contact_type').notNull().default('other'),

    // 'hot' | 'warm' | 'nurture' | 'unqualified' — set/updated by AI qualification
    leadScore: text('lead_score').notNull().default('nurture'),
    leadScoreReason: text('lead_score_reason'), // short "why", shown in priorities

    source: text('source').notNull().default('manual'), // 'website' | 'email' | 'facebook' | 'whatsapp' | 'bizbuysell' | 'manual' | 'referral'

    assignedToUserId: text('assigned_to_user_id').references(() => users.id),

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

    ownerContactId: integer('owner_contact_id').references(() => contacts.id),

    // Drives per-agent visibility (see lib/visibility.ts). Null = visible
    // to owners only until assigned, same rule as contacts and deals.
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),

    // 'off_market' | 'active' | 'under_contract' | 'sold' | 'leased' | 'withdrawn'
    listingStatus: text('listing_status').notNull().default('off_market'),

    sqft: integer('sqft'),
    notes: text('notes'),

    createdByUserId: text('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index('properties_location_idx').on(table.lat, table.lng),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Listings (a property currently being marketed — sale, lease, or business sale)
// ─────────────────────────────────────────────────────────────────────────

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id')
    .notNull()
    .references(() => properties.id),

  // 'sale' | 'lease' | 'business_sale'
  listingType: text('listing_type').notNull(),

  askingPrice: doublePrecision('asking_price'),
  pricePerSqft: doublePrecision('price_per_sqft'),

  // 'active' | 'pending' | 'sold' | 'leased' | 'withdrawn' | 'expired'
  status: text('status').notNull().default('active'),

  exclusivityNotes: text('exclusivity_notes'),
  listedAt: timestamp('listed_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),

  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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

    contactId: integer('contact_id').references(() => contacts.id),
    companyId: integer('company_id').references(() => companies.id),
    propertyId: integer('property_id').references(() => properties.id),
    listingId: integer('listing_id').references(() => listings.id),

    value: doublePrecision('value'),
    probability: integer('probability'), // 0-100, informs priority dashboard

    // 'nda_required' | 'nda_sent' | 'nda_signed' | 'not_applicable'
    ndaStatus: text('nda_status').notNull().default('not_applicable'),

    expectedCloseDate: timestamp('expected_close_date'),

    assignedToUserId: text('assigned_to_user_id').references(() => users.id),

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
      .references(() => deals.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    addedByUserId: text('added_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dealUserIdx: uniqueIndex('deal_collaborators_deal_user_idx').on(table.dealId, table.userId),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Documents (NDAs, LOIs, PSAs, leases, financials, etc.)
// ─────────────────────────────────────────────────────────────────────────

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),

  dealId: integer('deal_id').references(() => deals.id),
  contactId: integer('contact_id').references(() => contacts.id),
  propertyId: integer('property_id').references(() => properties.id),

  // 'nda' | 'loi' | 'psa' | 'lease' | 'financials' | 'other'
  type: text('type').notNull(),

  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(), // Cloudflare R2 object URL

  // 'draft' | 'sent' | 'viewed' | 'signed' | 'expired'
  status: text('status').notNull().default('draft'),

  requestedAt: timestamp('requested_at'),
  sentAt: timestamp('sent_at'),
  signedAt: timestamp('signed_at'),

  uploadedByUserId: text('uploaded_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Tasks & Notes (kept separate: tasks are actionable/due, notes are a log)
// ─────────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),

    dealId: integer('deal_id').references(() => deals.id),
    contactId: integer('contact_id').references(() => contacts.id),
    propertyId: integer('property_id').references(() => properties.id),

    // 'low' | 'medium' | 'high'
    priority: text('priority').notNull().default('medium'),

    assignedToUserId: text('assigned_to_user_id').references(() => users.id),

    dueAt: timestamp('due_at'),
    completedAt: timestamp('completed_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dueAtIdx: index('tasks_due_at_idx').on(table.dueAt),
  })
)

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),

  dealId: integer('deal_id').references(() => deals.id),
  contactId: integer('contact_id').references(() => contacts.id),
  propertyId: integer('property_id').references(() => properties.id),

  authorUserId: text('author_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Communications (inbound/outbound message log across channels)
// ─────────────────────────────────────────────────────────────────────────

export const communications = pgTable(
  'communications',
  {
    id: serial('id').primaryKey(),
    contactId: integer('contact_id').references(() => contacts.id),
    dealId: integer('deal_id').references(() => deals.id),

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
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Lead intake (raw inbound events, pre-dedup, pre-qualification)
// ─────────────────────────────────────────────────────────────────────────

export const leadIntakes = pgTable('lead_intakes', {
  id: serial('id').primaryKey(),

  // 'website' | 'email' | 'facebook' | 'whatsapp' | 'bizbuysell' | 'manual'
  source: text('source').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),

  dedupedContactId: integer('deduped_contact_id').references(() => contacts.id),

  // 'new' | 'processing' | 'converted' | 'discarded'
  status: text('status').notNull().default('new'),

  // { leadType, leadScore, reasoning, language, confidence }
  aiClassification: jsonb('ai_classification'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Commissions
// ─────────────────────────────────────────────────────────────────────────

export const commissions = pgTable('commissions', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id')
    .notNull()
    .references(() => deals.id),

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
})

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

    propertyId: integer('property_id').references(() => properties.id),
    dealId: integer('deal_id').references(() => deals.id),

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

    createdByUserId: text('created_by_user_id').references(() => users.id),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // cache TTL, default +60d
  },
  (table) => ({
    locationIdx: index('scorecard_location_idx').on(table.latRounded, table.lngRounded, table.businessProfile),
    propertyIdx: index('scorecard_property_idx').on(table.propertyId),
  })
)

// ─────────────────────────────────────────────────────────────────────────
// Rate limiting — unchanged from the existing tool
// ─────────────────────────────────────────────────────────────────────────

export const rateLimits = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  ip: text('ip').notNull(),
  day: text('day').notNull(), // 'YYYY-MM-DD'
  count: integer('count').default(1).notNull(),
  blocked: boolean('blocked').default(false).notNull(),
})

// ─────────────────────────────────────────────────────────────────────────
// Daily priorities cache (written by the cron job, read by the dashboard)
// ─────────────────────────────────────────────────────────────────────────

export const dailyPriorities = pgTable(
  'daily_priorities',
  {
    id: serial('id').primaryKey(),
    forUserId: text('for_user_id')
      .notNull()
      .references(() => users.id),
    day: text('day').notNull(), // 'YYYY-MM-DD'

    // 'hot_opportunity' | 'call_today' | 'deal_going_cold' | 'nda_outstanding' | 'commission_due' | 'past_client_followup'
    category: text('category').notNull(),
    reason: text('reason').notNull(), // short "why" shown on the card

    contactId: integer('contact_id').references(() => contacts.id),
    dealId: integer('deal_id').references(() => deals.id),
    documentId: integer('document_id').references(() => documents.id),
    commissionId: integer('commission_id').references(() => commissions.id),

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
