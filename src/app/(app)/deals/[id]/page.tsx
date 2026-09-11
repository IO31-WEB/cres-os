import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Pencil, CheckCircle2, XCircle, ShieldCheck, Plus, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { deals, contacts, companies, properties, documents, commissions, dealCollaborators, users } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { setDealStatus } from '@/lib/actions/deals'
import { PIPELINES, type PipelineId } from '@/lib/pipelines'
import { NotesSection } from '@/components/notes/notes-section'
import { requireUser, isOwner } from '@/lib/auth'
import { canViewDeal } from '@/lib/visibility'
import { DealCollaborators } from '@/components/deals/deal-collaborators'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dealId = Number(id)
  if (Number.isNaN(dealId)) notFound()

  const user = await requireUser()
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal || !(await canViewDeal(user, deal))) notFound()

  const [contact, company, property, docs, commission, collaboratorRows, allUsers] = await Promise.all([
    deal.contactId ? (await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1))[0] : undefined,
    deal.companyId ? (await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1))[0] : undefined,
    deal.propertyId ? (await db.select().from(properties).where(eq(properties.id, deal.propertyId)).limit(1))[0] : undefined,
    db.select().from(documents).where(eq(documents.dealId, dealId)),
    (await db.select().from(commissions).where(eq(commissions.dealId, dealId)).limit(1))[0],
    db
      .select({ user: users })
      .from(dealCollaborators)
      .innerJoin(users, eq(dealCollaborators.userId, users.id))
      .where(eq(dealCollaborators.dealId, dealId)),
    db.select().from(users).orderBy(users.name),
  ])

  const hasSignedNda = docs.some((doc) => doc.type === 'nda' && doc.status === 'signed')
  const boundSetStatus = setDealStatus.bind(null, dealId)

  const collaborators = collaboratorRows.map((r) => r.user)
  const canManageCollaborators = isOwner(user) || deal.assignedToUserId === user.id
  const addableUsers = allUsers.filter(
    (u) => u.id !== deal.assignedToUserId && !collaborators.some((c) => c.id === u.id)
  )

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">{deal.name}</h2>
            <Badge variant={deal.status === 'won' ? 'green' : deal.status === 'lost' ? 'red' : 'blue'}>{deal.status}</Badge>
          </div>
          <p className="text-sm text-ink-muted">
            {PIPELINES[deal.pipeline as PipelineId]?.label ?? deal.pipeline} · {deal.stage}
          </p>
        </div>
        <div className="flex gap-2">
          {deal.status === 'open' && (
            <>
              <form action={async () => { 'use server'; await boundSetStatus('won') }}>
                <Button type="submit" variant="outline" size="sm">
                  <CheckCircle2 className="h-4 w-4" /> Won
                </Button>
              </form>
              <form action={async () => { 'use server'; await boundSetStatus('lost') }}>
                <Button type="submit" variant="outline" size="sm">
                  <XCircle className="h-4 w-4" /> Lost
                </Button>
              </form>
            </>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/deals/${deal.id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {hasSignedNda && (
        <div className="mb-6 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-ink">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          Confidential information unlocked — NDA signed.
        </div>
      )}
      {deal.ndaStatus === 'nda_required' && !hasSignedNda && (
        <div className="mb-6 rounded border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-ink">
          NDA required before sharing confidential details with this contact.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {deal.value && (
          <div className="rounded border border-border p-3">
            <p className="text-xs text-ink-muted">Value</p>
            <p className="text-sm font-medium text-ink">${Number(deal.value).toLocaleString()}</p>
          </div>
        )}
        {deal.probability != null && (
          <div className="rounded border border-border p-3">
            <p className="text-xs text-ink-muted">Probability</p>
            <p className="text-sm font-medium text-ink">{deal.probability}%</p>
          </div>
        )}
        {deal.expectedCloseDate && (
          <div className="rounded border border-border p-3">
            <p className="text-xs text-ink-muted">Expected close</p>
            <p className="text-sm font-medium text-ink">{new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Contact</p>
          {contact ? (
            <Link href={`/contacts/${contact.id}`} className="text-sm text-navy hover:underline dark:text-white">
              {contact.firstName} {contact.lastName}
            </Link>
          ) : (
            <p className="text-sm text-ink-muted">—</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Company</p>
          {company ? (
            <Link href={`/companies/${company.id}`} className="text-sm text-navy hover:underline dark:text-white">
              {company.name}
            </Link>
          ) : (
            <p className="text-sm text-ink-muted">—</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Property</p>
          {property ? (
            <Link href={`/properties/${property.id}`} className="text-sm text-navy hover:underline dark:text-white">
              {property.formattedAddress}
            </Link>
          ) : (
            <p className="text-sm text-ink-muted">—</p>
          )}
        </div>
      </div>

      <DealCollaborators
        dealId={deal.id}
        collaborators={collaborators}
        addableUsers={addableUsers}
        canManage={canManageCollaborators}
      />

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink">Documents</h3>
          <Button asChild size="sm" variant="outline">
            <Link href={`/documents/new?dealId=${deal.id}`}>
              <Plus className="h-4 w-4" /> Add document
            </Link>
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-ink-muted">No documents yet.</p>
        ) : (
          <ul className="space-y-1">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm">
                <span className="text-ink">{doc.fileName}</span>
                <Badge variant={doc.status === 'signed' ? 'green' : 'neutral'}>{doc.status}</Badge>
                <a
                  href={`/api/documents/${doc.id}/download`}
                  className="inline-flex items-center gap-1 text-xs text-navy hover:underline dark:text-white"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink">Commission</h3>
          {!commission && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/commissions/new?dealId=${deal.id}`}>
                <Plus className="h-4 w-4" /> Add commission
              </Link>
            </Button>
          )}
        </div>
        {commission ? (
          <Link href={`/commissions/${commission.id}/edit`} className="block rounded border border-border p-3 text-sm hover:bg-surface">
            <span className="text-ink">Expected: ${Number(commission.expectedAmount).toLocaleString()}</span>{' '}
            <Badge variant={commission.status === 'collected' ? 'green' : 'neutral'} className="ml-2">
              {commission.status}
            </Badge>
          </Link>
        ) : (
          <p className="text-sm text-ink-muted">No commission recorded yet.</p>
        )}
      </div>

      <NotesSection dealId={deal.id} revalidate={`/deals/${deal.id}`} />
    </div>
  )
}
