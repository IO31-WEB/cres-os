'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { contactSchema } from '@/lib/validations/contact'
import { parseForm, fieldError, type ActionState } from '@/lib/actions/form-state'
import { canViewContact, resolveAssignment } from '@/lib/visibility'
import { assertCompanyLinkable, assertUserExists } from '@/lib/actions/link-guard'
import { logAuditBestEffort } from '@/lib/audit'

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
  const companyId = d.companyId ? Number(d.companyId) : null
  const companyError = await assertCompanyLinkable(user, companyId)
  if (companyError) return fieldError('companyId', companyError)

  // Never trust assignedToUserId from the client — resolveAssignment
  // enforces "agents can only assign to themselves"; owners may assign to
  // anyone. See lib/visibility.ts.
  const assignment = resolveAssignment(user, orNull(d.assignedToUserId))
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  const [created] = await db
    .insert(contacts)
    .values({
      firstName: d.firstName,
      lastName: orNull(d.lastName),
      email: orNull(d.email),
      phone: orNull(d.phone),
      whatsapp: orNull(d.whatsapp),
      preferredLanguage: d.preferredLanguage,
      companyId,
      contactType: d.contactType,
      leadScore: d.leadScore,
      source: d.source,
      assignedToUserId: assignment.value,
      notes: orNull(d.notes),
    })
    .returning({ id: contacts.id })

  await logAuditBestEffort({ user, action: 'contact.create', entityType: 'contact', entityId: created.id })

  revalidatePath('/contacts')
  redirect(`/contacts/${created.id}`)
}

export async function updateContact(
  contactId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const existing = await assertCanEditContact(user, contactId)

  const parsed = parseForm(contactSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const companyId = d.companyId ? Number(d.companyId) : null
  const companyError = await assertCompanyLinkable(user, companyId)
  if (companyError) return fieldError('companyId', companyError)

  const assignment = resolveAssignment(user, orNull(d.assignedToUserId), existing.assignedToUserId)
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  await db
    .update(contacts)
    .set({
      firstName: d.firstName,
      lastName: orNull(d.lastName),
      email: orNull(d.email),
      phone: orNull(d.phone),
      whatsapp: orNull(d.whatsapp),
      preferredLanguage: d.preferredLanguage,
      companyId,
      contactType: d.contactType,
      leadScore: d.leadScore,
      source: d.source,
      assignedToUserId: assignment.value,
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
  await logAuditBestEffort({ user, action: 'contact.delete', entityType: 'contact', entityId: contactId })
  revalidatePath('/contacts')
  redirect('/contacts')
}

export async function touchLastContacted(contactId: number): Promise<void> {
  const user = await requireUser()
  await assertCanEditContact(user, contactId)

  await db.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, contactId))
  revalidatePath(`/contacts/${contactId}`)
}
