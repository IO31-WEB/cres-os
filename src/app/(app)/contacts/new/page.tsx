import { db } from '@/lib/db'
import { companies, users } from '@/lib/db/schema'
import { ContactForm } from '@/components/contacts/contact-form'
import { createContact } from '@/lib/actions/contacts'

export default async function NewContactPage() {
  const [allCompanies, allUsers] = await Promise.all([
    db.select().from(companies).orderBy(companies.name),
    db.select().from(users).orderBy(users.name),
  ])

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">New contact</h2>
      <ContactForm action={createContact} companies={allCompanies} users={allUsers} />
    </div>
  )
}
