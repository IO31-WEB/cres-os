import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { Pencil } from 'lucide-react'
import { db } from '@/lib/db'
import { properties, contacts, deals } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PROPERTY_TYPE_LABELS, LISTING_STATUS_LABELS } from '@/lib/validations/property'
import type { PROPERTY_TYPES, LISTING_STATUSES } from '@/lib/validations/property'
import { ScorecardHistory } from '@/components/properties/scorecard-history'
import { NotesSection } from '@/components/notes/notes-section'
import { requireUser } from '@/lib/auth'
import { canViewProperty, dealsVisibleTo } from '@/lib/visibility'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const propertyId = Number(id)
  if (Number.isNaN(propertyId)) notFound()

  const user = await requireUser()

  const [row] = await db
    .select({ property: properties, ownerName: contacts.firstName, ownerLastName: contacts.lastName })
    .from(properties)
    .leftJoin(contacts, eq(properties.ownerContactId, contacts.id))
    .where(eq(properties.id, propertyId))
    .limit(1)

  if (!row) notFound()
  const { property, ownerName, ownerLastName } = row
  if (!canViewProperty(user, property)) notFound()

  const dealVisibility = dealsVisibleTo(user)
  const relatedDeals = await db
    .select()
    .from(deals)
    .where(dealVisibility ? and(eq(deals.propertyId, propertyId), dealVisibility) : eq(deals.propertyId, propertyId))

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{property.formattedAddress}</h2>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="neutral">
              {PROPERTY_TYPE_LABELS[property.propertyType as (typeof PROPERTY_TYPES)[number]] ?? property.propertyType}
            </Badge>
            <Badge variant={property.listingStatus === 'active' ? 'green' : 'neutral'}>
              {LISTING_STATUS_LABELS[property.listingStatus as (typeof LISTING_STATUSES)[number]] ?? property.listingStatus}
            </Badge>
            {property.sqft && <Badge variant="neutral">{property.sqft.toLocaleString()} sqft</Badge>}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/properties/${property.id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      {ownerName && (
        <p className="mb-6 text-sm text-ink-muted">
          Owner:{' '}
          <Link href={`/contacts/${property.ownerContactId}`} className="text-navy hover:underline dark:text-white">
            {ownerName} {ownerLastName}
          </Link>
        </p>
      )}

      {property.notes && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-medium text-ink">Notes</h3>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-ink">Deals</h3>
        {relatedDeals.length === 0 ? (
          <p className="text-sm text-ink-muted">No deals linked to this property yet.</p>
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

      <div className="mb-6">
        <ScorecardHistory propertyId={property.id} />
      </div>

      <NotesSection propertyId={property.id} revalidate={`/properties/${property.id}`} />
    </div>
  )
}
