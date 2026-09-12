'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { companySchema } from '@/lib/validations/company'
import { parseForm, fieldError, type ActionState } from '@/lib/actions/form-state'
import { canViewCompany, resolveAssignment } from '@/lib/visibility'
import { assertUserExists } from '@/lib/actions/link-guard'
import { logAuditBestEffort } from '@/lib/audit'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

async function assertCanEditCompany(user: Awaited<ReturnType<typeof requireUser>>, companyId: number) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company || !canViewCompany(user, company)) notFound()
  return company
}

export async function createCompany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(companySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const assignment = resolveAssignment(user, orNull(d.assignedToUserId))
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  const [created] = await db
    .insert(companies)
    .values({
      name: d.name,
      industry: orNull(d.industry),
      website: orNull(d.website),
      phone: orNull(d.phone),
      address: orNull(d.address),
      notes: orNull(d.notes),
      assignedToUserId: assignment.value,
      createdByUserId: user.id,
    })
    .returning({ id: companies.id })

  await logAuditBestEffort({ user, action: 'company.create', entityType: 'company', entityId: created.id })

  revalidatePath('/companies')
  redirect(`/companies/${created.id}`)
}

export async function updateCompany(
  companyId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const existing = await assertCanEditCompany(user, companyId)

  const parsed = parseForm(companySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const assignment = resolveAssignment(user, orNull(d.assignedToUserId), existing.assignedToUserId)
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  await db
    .update(companies)
    .set({
      name: d.name,
      industry: orNull(d.industry),
      website: orNull(d.website),
      phone: orNull(d.phone),
      address: orNull(d.address),
      notes: orNull(d.notes),
      assignedToUserId: assignment.value,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))

  revalidatePath('/companies')
  revalidatePath(`/companies/${companyId}`)
  redirect(`/companies/${companyId}`)
}

export async function deleteCompany(companyId: number): Promise<void> {
  const user = await requireUser()
  await assertCanEditCompany(user, companyId)

  await db.delete(companies).where(eq(companies.id, companyId))
  await logAuditBestEffort({ user, action: 'company.delete', entityType: 'company', entityId: companyId })
  revalidatePath('/companies')
  redirect('/companies')
}
