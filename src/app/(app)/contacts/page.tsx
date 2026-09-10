import Link from 'next/link'
import { Users, Plus, Inbox } from 'lucide-react'
import { desc, eq, and, ne, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts, companies, leadIntakes } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LeadScoreBadge } from '@/components/contacts/lead-score-badge'
import { CONTACT_TYPE_LABELS } from '@/lib/validations/contact'
import type { CONTACT_TYPES, LEAD_SCORES } from '@/lib/validations/contact'
import { requireUser, isOwner } from '@/lib/auth'
import { contactsVisibleTo } from '@/lib/visibility'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ leadScore?: string }>
}) {
  const { leadScore } = await searchParams
  const user = await requireUser()

  const filters: SQL[] = []
  if (leadScore) filters.push(eq(contacts.leadScore, leadScore))
  const visibility = contactsVisibleTo(user, contacts)
  if (visibility) filters.push(visibility)

  const rows = await db
    .select({ contact: contacts, companyName: companies.name })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(contacts.updatedAt))

  const scores: (typeof LEAD_SCORES)[number][] = ['hot', 'warm', 'nurture', 'unqualified']

  // Pending leads are unassigned by definition, so — same rule as any
  // other unassigned record — only owners see the inbox count/link.
  const pendingCount = isOwner(user)
    ? (await db.select({ id: leadIntakes.id }).from(leadIntakes).where(ne(leadIntakes.status, 'converted'))).length
    : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Contacts</h2>
          <p className="text-sm text-ink-muted">{rows.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link href="/leads">
                <Inbox className="h-4 w-4" /> {pendingCount} pending
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/contacts/new">
              <Plus className="h-4 w-4" /> New contact
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/contacts"
          className={`rounded px-3 py-1 text-xs font-medium ${!leadScore ? 'bg-navy text-white' : 'bg-surface text-ink-muted border border-border'}`}
        >
          All
        </Link>
        {scores.map((s) => (
          <Link
            key={s}
            href={`/contacts?leadScore=${s}`}
            className={`rounded px-3 py-1 text-xs font-medium capitalize ${leadScore === s ? 'bg-navy text-white' : 'bg-surface text-ink-muted border border-border'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add your first contact, or connect lead intake to have them appear here automatically."
          actionHref="/contacts/new"
          actionLabel="New contact"
        />
      ) : (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Company</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Type</th>
                <th className="px-4 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ contact, companyName }) => (
                <tr key={contact.id} className="hover:bg-surface">
                  <td className="px-4 py-2.5">
                    <Link href={`/contacts/${contact.id}`} className="font-medium text-ink hover:underline">
                      {contact.firstName} {contact.lastName}
                    </Link>
                    <div className="text-xs text-ink-muted">{contact.email || contact.phone || '—'}</div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-ink-muted sm:table-cell">{companyName ?? '—'}</td>
                  <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">
                    {CONTACT_TYPE_LABELS[contact.contactType as (typeof CONTACT_TYPES)[number]] ?? contact.contactType}
                  </td>
                  <td className="px-4 py-2.5">
                    <LeadScoreBadge score={contact.leadScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
