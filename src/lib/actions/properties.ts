'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { properties } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { propertySchema } from '@/lib/validations/property'
import { parseForm, type ActionState } from '@/lib/actions/form-state'
import { geocodeAddress } from '@/lib/data-sources/geocode'
import { canViewProperty, defaultAssignee } from '@/lib/visibility'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

async function assertCanEditProperty(user: Awaited<ReturnType<typeof requireUser>>, propertyId: number) {
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
  if (!property || !canViewProperty(user, property)) notFound()
  return property
}

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(propertySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data

  // Best-effort geocode so the property page can show a map pin and the
  // scorecard launcher can skip re-typing the address. A failed geocode
  // doesn't block saving — the address text is still useful on its own.
  const geo = await geocodeAddress(d.address).catch(() => null)

  const [created] = await db
    .insert(properties)
    .values({
      address: d.address,
      formattedAddress: geo?.formattedAddress ?? d.address,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      county: geo?.countyName ?? null,
      propertyType: d.propertyType,
      defaultBusinessProfile: d.defaultBusinessProfile,
      listingStatus: d.listingStatus,
      ownerContactId: d.ownerContactId ? Number(d.ownerContactId) : null,
      // Agents default to themselves so their own new property doesn't
      // vanish behind the owners-only unassigned rule.
      assignedToUserId: defaultAssignee(user, orNull(d.assignedToUserId)),
      sqft: d.sqft ? Number(d.sqft) : null,
      notes: orNull(d.notes),
      createdByUserId: user.id,
    })
    .returning({ id: properties.id })

  revalidatePath('/properties')
  redirect(`/properties/${created.id}`)
}

export async function updateProperty(
  propertyId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const existing = await assertCanEditProperty(user, propertyId)

  const parsed = parseForm(propertySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data

  // Only re-geocode if the address text actually changed — avoids burning
  // a geocode call on every unrelated edit (e.g. just updating notes).
  const geo =
    existing.address !== d.address ? await geocodeAddress(d.address).catch(() => null) : null

  await db
    .update(properties)
    .set({
      address: d.address,
      ...(geo
        ? { formattedAddress: geo.formattedAddress, lat: geo.lat, lng: geo.lng, county: geo.countyName ?? null }
        : {}),
      propertyType: d.propertyType,
      defaultBusinessProfile: d.defaultBusinessProfile,
      listingStatus: d.listingStatus,
      ownerContactId: d.ownerContactId ? Number(d.ownerContactId) : null,
      assignedToUserId: orNull(d.assignedToUserId),
      sqft: d.sqft ? Number(d.sqft) : null,
      notes: orNull(d.notes),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId))

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}

export async function deleteProperty(propertyId: number): Promise<void> {
  const user = await requireUser()
  await assertCanEditProperty(user, propertyId)

  await db.delete(properties).where(eq(properties.id, propertyId))
  revalidatePath('/properties')
  redirect('/properties')
}
