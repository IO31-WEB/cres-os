'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { contactSchema } from '@/lib/validations/contact'
import { parseForm, EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

export async function createContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser()
  const parsed = parseForm(contactSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const [created] = await db
    .insert(contacts)
    .values({
      firstName: d.firstName,
      lastName: orNull(d.lastName),
      email: orNull(d.email),
      phone: orNull(d.phone),
      whatsapp: orNull(d.whatsapp),
      preferredLanguage: d.preferredLanguage,
      companyId: d.companyId ? Number(d.companyId) : null,
      contactType: d.contactType,
      leadScore: d.leadScore,
      source: d.source,
      assignedToUserId: orNull(d.assignedToUserId),
      notes: orNull(d.notes),
    })
    .returning({ id: contacts.id })

  revalidatePath('/contacts')
  redirect(`/contacts/${created.id}`)
}

export async function updateContact(
  contactId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()
  const parsed = parseForm(contactSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db
    .update(contacts)
    .set({
      firstName: d.firstName,
      lastName: orNull(d.lastName),
      email: orNull(d.email),
      phone: orNull(d.phone),
      whatsapp: orNull(d.whatsapp),
      preferredLanguage: d.preferredLanguage,
      companyId: d.companyId ? Number(d.companyId) : null,
      contactType: d.contactType,
      leadScore: d.leadScore,
      source: d.source,
      assignedToUserId: orNull(d.assignedToUserId),
      notes: orNull(d.notes),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId))

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${contactId}`)
  redirect(`/contacts/${contactId}`)
}

export async function deleteContact(contactId: number): Promise<void> {
  await requireUser()
  await db.delete(contacts).where(eq(contacts.id, contactId))
  revalidatePath('/contacts')
  redirect('/contacts')
}

export async function touchLastContacted(contactId: number): Promise<void> {
  await requireUser()
  await db.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, contactId))
  revalidatePath(`/contacts/${contactId}`)
}
