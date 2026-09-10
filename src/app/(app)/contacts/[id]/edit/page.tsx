import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts, companies, users } from '@/lib/db/schema'
import { ContactForm } from '@/components/contacts/contact-form'
import { updateContact, deleteContact } from '@/lib/actions/contacts'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { canViewContact } from '@/lib/visibility'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contactId = Number(id)
  if (Number.isNaN(contactId)) notFound()

  const user = await requireUser()
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact || !canViewContact(user, contact)) notFound()

  const [allCompanies, allUsers] = await Promise.all([
    db.select().from(companies).orderBy(companies.name),
    db.select().from(users).orderBy(users.name),
  ])

  const boundUpdate = updateContact.bind(null, contactId)
  const boundDelete = deleteContact.bind(null, contactId)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit contact</h2>
      <ContactForm action={boundUpdate} contact={contact} companies={allCompanies} users={allUsers} />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete contact
        </Button>
      </form>
    </div>
  )
}
