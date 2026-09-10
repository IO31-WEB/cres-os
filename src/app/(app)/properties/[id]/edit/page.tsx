import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { properties, contacts, users } from '@/lib/db/schema'
import { PropertyForm } from '@/components/properties/property-form'
import { updateProperty, deleteProperty } from '@/lib/actions/properties'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { canViewProperty } from '@/lib/visibility'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const propertyId = Number(id)
  if (Number.isNaN(propertyId)) notFound()

  const user = await requireUser()
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
  if (!property || !canViewProperty(user, property)) notFound()

  const [allContacts, allUsers] = await Promise.all([
    db.select().from(contacts).orderBy(contacts.firstName),
    db.select().from(users).orderBy(users.name),
  ])

  const boundUpdate = updateProperty.bind(null, propertyId)
  const boundDelete = deleteProperty.bind(null, propertyId)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit property</h2>
      <PropertyForm action={boundUpdate} property={property} contacts={allContacts} users={allUsers} />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete property
        </Button>
      </form>
    </div>
  )
}
