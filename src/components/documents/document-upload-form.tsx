'use client'

import { useActionState, useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/validations/document'
import { createDocumentRecord } from '@/lib/actions/documents'

interface DocumentUploadFormProps {
  dealId?: number
  contactId?: number
  propertyId?: number
}

export function DocumentUploadForm({ dealId, contactId, propertyId }: DocumentUploadFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(createDocumentRecord, EMPTY_STATE)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<{ fileName: string; fileUrl: string } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    setUploaded(null)

    try {
      const presignRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream' }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) throw new Error(presignData.error ?? 'Could not prepare upload.')

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Upload to storage failed.')

      setUploaded({ fileName: file.name, fileUrl: presignData.fileUrl })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="File" htmlFor="file" error={uploadError ?? undefined}>
        <Input id="file" type="file" onChange={handleFileChange} required={!uploaded} />
      </FormField>

      {uploading && <p className="text-xs text-ink-muted">Uploading…</p>}
      {uploaded && <p className="text-xs text-emerald-600">Uploaded: {uploaded.fileName}</p>}

      <input type="hidden" name="fileName" value={uploaded?.fileName ?? ''} />
      <input type="hidden" name="fileUrl" value={uploaded?.fileUrl ?? ''} />
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}

      <FormField label="Document type" htmlFor="type" error={state.errors.type?.[0]}>
        <Select id="type" name="type" defaultValue="nda">
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </FormField>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton disabled={!uploaded || uploading}>Save document</SubmitButton>
    </form>
  )
}
