import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { scorecardAnalyses, properties } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { geocodeAddress } from '@/lib/data-sources/geocode'
import { getTractDemographics } from '@/lib/data-sources/census'
import { getNearbyRetailers } from '@/lib/data-sources/places'
import { getNearbyTrafficCounts } from '@/lib/data-sources/fdot-traffic'
import { getFloodZone } from '@/lib/data-sources/fema-flood'
import { getCrimeContext } from '@/lib/data-sources/fbi-crime'
import { estimateTradeAreaSpend } from '@/lib/data-sources/spend-estimate'
import {
  redistributeWeights,
  computeOverallScore,
  scoreToGrade,
  scoreTraffic,
  scoreConsumerSpend,
  scoreDemographics,
  scoreRetailSynergy,
  scoreCompetitiveSaturation,
  scoreFloodRisk,
  scoreCrimeContext,
  generateGradeNarrative,
  getBusinessProfile,
  weightsForProfile,
  BUSINESS_PROFILES,
  type GradeWeights,
  type BusinessProfileId,
} from '@/lib/grader'

const CACHE_DAYS = 60
const COORD_PRECISION = 4 // ~11m — same building, different phrasing of the address

const requestSchema = z.object({
  address: z.string().min(5).max(200),
  businessProfile: z
    .enum(Object.keys(BUSINESS_PROFILES) as [BusinessProfileId, ...BusinessProfileId[]])
    .optional()
    .default('general'),
  // Optional linkage — set when launched from a Property or Deal page so
  // the analysis shows up in that record's history.
  propertyId: z.coerce.number().int().positive().optional(),
  dealId: z.coerce.number().int().positive().optional(),
})

function round(n: number): number {
  const factor = 10 ** COORD_PRECISION
  return Math.round(n * factor) / factor
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null)
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Provide a valid street address.' }, { status: 400 })
  }

  if (parsed.propertyId) {
    const [property] = await db.select({ id: properties.id }).from(properties).where(eq(properties.id, parsed.propertyId)).limit(1)
    if (!property) {
      return NextResponse.json({ error: 'That property no longer exists.' }, { status: 404 })
    }
  }

  let geo
  try {
    geo = await geocodeAddress(parsed.address)
  } catch {
    return NextResponse.json(
      { error: "Couldn't locate that address. Try including city and state." },
      { status: 422 }
    )
  }

  const latRounded = round(geo.lat)
  const lngRounded = round(geo.lng)
  const profile = getBusinessProfile(parsed.businessProfile)

  // Serve from cache if we've already built this exact report (same address
  // AND same business profile) recently. If this run is linked to a
  // property/deal that the cached row isn't linked to yet, backfill the
  // link rather than creating a duplicate row.
  const cached = await db.query.scorecardAnalyses.findFirst({
    where: and(
      eq(scorecardAnalyses.latRounded, latRounded),
      eq(scorecardAnalyses.lngRounded, lngRounded),
      eq(scorecardAnalyses.businessProfile, profile.id),
      gte(scorecardAnalyses.expiresAt, new Date())
    ),
  })
  if (cached) {
    if ((parsed.propertyId && !cached.propertyId) || (parsed.dealId && !cached.dealId)) {
      await db
        .update(scorecardAnalyses)
        .set({
          propertyId: cached.propertyId ?? parsed.propertyId ?? null,
          dealId: cached.dealId ?? parsed.dealId ?? null,
        })
        .where(eq(scorecardAnalyses.id, cached.id))
    }
    return NextResponse.json({ reportId: cached.id, cached: true, ...serialize(cached) })
  }

  // Fan out to every free data source in parallel. Each is wrapped so one
  // source going down doesn't take out the whole report — missing data
  // gets redistributed in the scoring weights instead.
  const [demographics, retailers, trafficCounts, flood, crime] = await Promise.all([
    geo.tractFips && geo.stateFips && geo.countyFips
      ? getTractDemographics(geo).catch(() => null)
      : Promise.resolve(null),
    getNearbyRetailers(geo.lat, geo.lng).catch(() => []),
    getNearbyTrafficCounts(geo.lat, geo.lng).catch(() => []),
    getFloodZone(geo.lat, geo.lng).catch(() => null),
    geo.countyFips ? getCrimeContext(geo.countyFips).catch(() => null) : Promise.resolve(null),
  ])

  const spendEstimate = demographics
    ? estimateTradeAreaSpend(demographics.medianHouseholdIncome, demographics.population)
    : null

  const traffic = scoreTraffic(trafficCounts)
  const spend = scoreConsumerSpend(spendEstimate)
  const demo = scoreDemographics(demographics)
  const synergy = scoreRetailSynergy(retailers, profile)
  const saturation = scoreCompetitiveSaturation(retailers, profile)
  const flood_ = scoreFloodRisk(flood)
  const crime_ = scoreCrimeContext(crime)

  const categoryScores: Record<keyof GradeWeights, number> = {
    traffic: traffic.score,
    consumerSpend: spend.score,
    demographics: demo.score,
    retailSynergy: synergy.score,
    competitiveSaturation: saturation.score,
    floodRisk: flood_.score,
    crime: crime_.score,
  }

  const missing = (Object.entries({
    traffic: traffic.hasData, consumerSpend: spend.hasData, demographics: demo.hasData,
    retailSynergy: synergy.hasData, competitiveSaturation: saturation.hasData,
    floodRisk: flood_.hasData, crime: crime_.hasData,
  })
    .filter(([, hasData]) => !hasData)
    .map(([key]) => key)) as Array<keyof GradeWeights>

  const weights = redistributeWeights(weightsForProfile(profile), missing)
  const overallScore = computeOverallScore(categoryScores, weights)
  const overallGrade = scoreToGrade(overallScore)

  const rawData = {
    demographics,
    trafficCounts,
    synergyAnchors: synergy.anchors,
    saturationAnchors: saturation.anchors,
    saturationScored: saturation.hasData,
    flood,
    crime,
    spendEstimate,
  }

  const narrative = await generateGradeNarrative({
    address: geo.formattedAddress,
    businessProfile: profile,
    overallGrade,
    overallScore,
    categoryScores,
    synergyAnchors: synergy.anchors,
    saturationAnchors: saturation.anchors,
    demographics,
    trafficCounts,
    flood,
    crime,
    spendEstimate,
  }).catch(() => null)

  const [inserted] = await db
    .insert(scorecardAnalyses)
    .values({
      propertyId: parsed.propertyId ?? null,
      dealId: parsed.dealId ?? null,
      inputAddress: parsed.address,
      formattedAddress: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
      latRounded,
      lngRounded,
      county: geo.countyName || null,
      stateFips: geo.stateFips || null,
      countyFips: geo.countyFips || null,
      tractFips: geo.tractFips || null,
      businessProfile: profile.id,
      overallScore,
      overallGrade,
      categoryScores,
      rawData,
      narrative,
      createdByUserId: user.id,
      expiresAt: new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning()

  return NextResponse.json({ reportId: inserted.id, cached: false, ...serialize(inserted) })
}

function serialize(report: typeof scorecardAnalyses.$inferSelect) {
  return {
    formattedAddress: report.formattedAddress,
    businessProfile: report.businessProfile,
    overallScore: report.overallScore,
    overallGrade: report.overallGrade,
    categoryScores: report.categoryScores,
    rawData: report.rawData,
    narrative: report.narrative,
  }
}
