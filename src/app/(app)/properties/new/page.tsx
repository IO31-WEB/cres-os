import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { PropertyForm } from '@/components/properties/property-form'
import { createProperty } from '@/lib/actions/properties'

export default async function NewPropertyPage() {
  const [allContacts, allUsers] = await Promise.all([
    db.select().from(contacts).orderBy(contacts.firstName),
    db.select().from(users).orderBy(users.name),
  ])

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">New property</h2>
      <PropertyForm action={createProperty} contacts={allContacts} users={allUsers} />
    </div>
  )
}
