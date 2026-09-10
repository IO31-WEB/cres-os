import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals, contacts, properties } from '@/lib/db/schema'
import { DocumentUploadForm } from '@/components/documents/document-upload-form'
import { requireUser } from '@/lib/auth'
import { canViewDeal, canViewContact, canViewProperty } from '@/lib/visibility'

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; contactId?: string; propertyId?: string }>
}) {
  const { dealId, contactId, propertyId } = await searchParams
  const user = await requireUser()

  if (dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, Number(dealId))).limit(1)
    if (!deal || !(await canViewDeal(user, deal))) notFound()
  }
  if (contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, Number(contactId))).limit(1)
    if (!contact || !canViewContact(user, contact)) notFound()
  }
  if (propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, Number(propertyId))).limit(1)
    if (!property || !canViewProperty(user, property)) notFound()
  }

  return (
    <div className="max-w-md">
      <h2 className="mb-6 text-lg font-semibold text-ink">New document</h2>
      <DocumentUploadForm
        dealId={dealId ? Number(dealId) : undefined}
        contactId={contactId ? Number(contactId) : undefined}
        propertyId={propertyId ? Number(propertyId) : undefined}
      />
    </div>
  )
}
