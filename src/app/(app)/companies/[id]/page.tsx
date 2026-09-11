import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { Pencil, Globe, Phone } from 'lucide-react'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { LeadScoreBadge } from '@/components/contacts/lead-score-badge'
import { requireUser } from '@/lib/auth'
import { canViewCompany, contactsVisibleTo } from '@/lib/visibility'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = Number(id)
  if (Number.isNaN(companyId)) notFound()

  const user = await requireUser()
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company || !canViewCompany(user, company)) notFound()

  const contactVisibility = contactsVisibleTo(user, contacts)
  const relatedContacts = await db
    .select()
    .from(contacts)
    .where(contactVisibility ? and(eq(contacts.companyId, companyId), contactVisibility) : eq(contacts.companyId, companyId))

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{company.name}</h2>
          <p className="text-sm text-ink-muted">{company.industry ?? 'No industry set'}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/companies/${company.id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-ink hover:bg-surface"
          >
            <Globe className="h-4 w-4 text-ink-muted" /> {company.website}
          </a>
        )}
        {company.phone && (
          <a href={`tel:${company.phone}`} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-ink hover:bg-surface">
            <Phone className="h-4 w-4 text-ink-muted" /> {company.phone}
          </a>
        )}
      </div>

      {company.address && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-medium text-ink">Address</h3>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{company.address}</p>
        </div>
      )}

      {company.notes && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-medium text-ink">Notes</h3>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{company.notes}</p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink">Contacts</h3>
        {relatedContacts.length === 0 ? (
          <p className="text-sm text-ink-muted">No contacts linked to this company yet.</p>
        ) : (
          <ul className="space-y-1">
            {relatedContacts.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link href={`/contacts/${c.id}`} className="text-sm text-navy hover:underline dark:text-white">
                  {c.firstName} {c.lastName}
                </Link>
                <LeadScoreBadge score={c.leadScore} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
