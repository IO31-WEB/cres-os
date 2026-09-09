import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { properties, contacts } from '@/lib/db/schema'
import { PropertyForm } from '@/components/properties/property-form'
import { updateProperty, deleteProperty } from '@/lib/actions/properties'
import { Button } from '@/components/ui/button'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const propertyId = Number(id)
  if (Number.isNaN(propertyId)) notFound()

  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
  if (!property) notFound()

  const allContacts = await db.select().from(contacts).orderBy(contacts.firstName)

  const boundUpdate = updateProperty.bind(null, propertyId)
  const boundDelete = deleteProperty.bind(null, propertyId)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit property</h2>
      <PropertyForm action={boundUpdate} property={property} contacts={allContacts} />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete property
        </Button>
      </form>
    </div>
  )
}
