'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { companySchema } from '@/lib/validations/company'
import { parseForm, type ActionState } from '@/lib/actions/form-state'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

export async function createCompany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(companySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const [created] = await db
    .insert(companies)
    .values({
      name: d.name,
      industry: orNull(d.industry),
      website: orNull(d.website),
      phone: orNull(d.phone),
      address: orNull(d.address),
      notes: orNull(d.notes),
      createdByUserId: user.id,
    })
    .returning({ id: companies.id })

  revalidatePath('/companies')
  redirect(`/companies/${created.id}`)
}

export async function updateCompany(
  companyId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()
  const parsed = parseForm(companySchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db
    .update(companies)
    .set({
      name: d.name,
      industry: orNull(d.industry),
      website: orNull(d.website),
      phone: orNull(d.phone),
      address: orNull(d.address),
      notes: orNull(d.notes),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))

  revalidatePath('/companies')
  revalidatePath(`/companies/${companyId}`)
  redirect(`/companies/${companyId}`)
}

export async function deleteCompany(companyId: number): Promise<void> {
  await requireUser()
  await db.delete(companies).where(eq(companies.id, companyId))
  revalidatePath('/companies')
  redirect('/companies')
}
