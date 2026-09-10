import Link from 'next/link'
import { MapPin, Plus } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { properties } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { PROPERTY_TYPE_LABELS, LISTING_STATUS_LABELS } from '@/lib/validations/property'
import type { PROPERTY_TYPES, LISTING_STATUSES } from '@/lib/validations/property'
import { requireUser } from '@/lib/auth'
import { propertiesVisibleTo } from '@/lib/visibility'

export default async function PropertiesPage() {
  const user = await requireUser()
  const visibility = propertiesVisibleTo(user, properties)
  const rows = await db.select().from(properties).where(visibility).orderBy(desc(properties.updatedAt))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Properties</h2>
          <p className="text-sm text-ink-muted">{rows.length} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/properties/new">
            <Plus className="h-4 w-4" /> New property
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No properties yet"
          description="Add a property to track listings, deals, and its Site Quality Scorecard history."
          actionHref="/properties/new"
          actionLabel="New property"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="rounded border border-border p-4 hover:bg-surface"
            >
              <p className="text-sm font-medium text-ink">{property.formattedAddress}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="neutral">
                  {PROPERTY_TYPE_LABELS[property.propertyType as (typeof PROPERTY_TYPES)[number]] ?? property.propertyType}
                </Badge>
                <Badge variant={property.listingStatus === 'active' ? 'green' : 'neutral'}>
                  {LISTING_STATUS_LABELS[property.listingStatus as (typeof LISTING_STATUSES)[number]] ?? property.listingStatus}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
