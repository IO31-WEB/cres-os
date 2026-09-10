import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { Pencil, Mail, Phone, MessageCircle } from 'lucide-react'
import { db } from '@/lib/db'
import { contacts, companies, deals } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { LeadScoreBadge } from '@/components/contacts/lead-score-badge'
import { CONTACT_TYPE_LABELS } from '@/lib/validations/contact'
import type { CONTACT_TYPES } from '@/lib/validations/contact'
import { NotesSection } from '@/components/notes/notes-section'
import { requireUser } from '@/lib/auth'
import { canViewContact, dealsVisibleTo } from '@/lib/visibility'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contactId = Number(id)
  if (Number.isNaN(contactId)) notFound()

  const user = await requireUser()

  const [row] = await db
    .select({ contact: contacts, companyName: companies.name })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(eq(contacts.id, contactId))
    .limit(1)

  if (!row) notFound()
  const { contact, companyName } = row
  if (!canViewContact(user, contact)) notFound()

  const dealVisibility = dealsVisibleTo(user)
  const relatedDeals = await db
    .select()
    .from(deals)
    .where(dealVisibility ? and(eq(deals.contactId, contactId), dealVisibility) : eq(deals.contactId, contactId))

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">
              {contact.firstName} {contact.lastName}
            </h2>
            <LeadScoreBadge score={contact.leadScore} />
          </div>
          <p className="text-sm text-ink-muted">
            {CONTACT_TYPE_LABELS[contact.contactType as (typeof CONTACT_TYPES)[number]] ?? contact.contactType}
            {companyName && ` · ${companyName}`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/contacts/${contact.id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      {contact.leadScoreReason && (
        <div className="mb-6 rounded border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-ink">
          <span className="font-medium">Why: </span>
          {contact.leadScoreReason}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 rounded border border-border p-3 text-sm text-ink hover:bg-surface">
            <Mail className="h-4 w-4 text-ink-muted" /> {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 rounded border border-border p-3 text-sm text-ink hover:bg-surface">
            <Phone className="h-4 w-4 text-ink-muted" /> {contact.phone}
          </a>
        )}
        {contact.whatsapp && (
          <a
            href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded border border-border p-3 text-sm text-ink hover:bg-surface"
          >
            <MessageCircle className="h-4 w-4 text-ink-muted" /> WhatsApp
          </a>
        )}
      </div>

      {contact.notes && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-medium text-ink">Notes</h3>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-ink">Deals</h3>
        {relatedDeals.length === 0 ? (
          <p className="text-sm text-ink-muted">No deals linked to this contact yet.</p>
        ) : (
          <ul className="space-y-1">
            {relatedDeals.map((deal) => (
              <li key={deal.id}>
                <Link href={`/deals/${deal.id}`} className="text-sm text-navy hover:underline dark:text-white">
                  {deal.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NotesSection contactId={contact.id} revalidate={`/contacts/${contact.id}`} />
    </div>
  )
}
