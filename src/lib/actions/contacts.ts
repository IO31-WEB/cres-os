'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { contactSchema } from '@/lib/validations/contact'
import { parseForm, type ActionState } from '@/lib/actions/form-state'
import { canViewContact, defaultAssignee } from '@/lib/visibility'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

async function assertCanEditContact(user: Awaited<ReturnType<typeof requireUser>>, contactId: number) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact || !canViewContact(user, contact)) notFound()
  return contact
}

export async function createContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
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
      // Agents default to themselves so their own new contact doesn't
      // vanish behind the owners-only unassigned rule; owners can
      // deliberately leave it unassigned.
      assignedToUserId: defaultAssignee(user, orNull(d.assignedToUserId)),
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
  const user = await requireUser()
  await assertCanEditContact(user, contactId)

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
  const user = await requireUser()
  await assertCanEditContact(user, contactId)

  await db.delete(contacts).where(eq(contacts.id, contactId))
  revalidatePath('/contacts')
  redirect('/contacts')
}

export async function touchLastContacted(contactId: number): Promise<void> {
  const user = await requireUser()
  await assertCanEditContact(user, contactId)

  await db.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, contactId))
  revalidatePath(`/contacts/${contactId}`)
}
