import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { properties } from '@/lib/db/schema'
import { ScorecardLauncher } from '@/components/scorecard/scorecard-launcher'
import type { BusinessProfileId } from '@/lib/business-profiles'

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { propertyId } = await searchParams
  const id = propertyId ? Number(propertyId) : undefined

  const property = id
    ? (await db.select().from(properties).where(eq(properties.id, id)).limit(1))[0]
    : undefined

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">Site Quality Scorecard</h2>
        <p className="text-sm text-ink-muted">
          {property
            ? `Running a new analysis for ${property.formattedAddress}.`
            : 'Enter a Florida commercial address to generate a scored analysis and PDF report.'}
        </p>
      </div>
      <ScorecardLauncher
        propertyId={property?.id}
        defaultAddress={property?.formattedAddress}
        defaultBusinessProfile={property?.defaultBusinessProfile as BusinessProfileId | undefined}
      />
    </div>
  )
}
