import { DocumentUploadForm } from '@/components/documents/document-upload-form'

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; contactId?: string; propertyId?: string }>
}) {
  const { dealId, contactId, propertyId } = await searchParams

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
