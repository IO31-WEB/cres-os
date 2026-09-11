'use client'

import { useActionState, useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/validations/document'
import { createDocumentRecord } from '@/lib/actions/documents'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@/lib/r2'

interface DocumentUploadFormProps {
  dealId?: number
  contactId?: number
  propertyId?: number
}

interface UploadedFile {
  fileName: string
  objectKey: string
  contentType: string
  fileSize: number
}

export function DocumentUploadForm({ dealId, contactId, propertyId }: DocumentUploadFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(createDocumentRecord, EMPTY_STATE)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    setUploaded(null)

    // Check type/size up front so an obviously-invalid file never even
    // reaches the presign request — the server re-validates both anyway,
    // this is just a faster no-round-trip rejection for the common case.
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      setUploadError('That file type is not allowed (PDF, Word, Excel, or common images only).')
      setUploading(false)
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadError(`File is too large (max ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024}MB).`)
      setUploading(false)
      return
    }

    try {
      const presignRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) throw new Error(presignData.error ?? 'Could not prepare upload.')

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error('Upload to storage failed.')

      setUploaded({ fileName: file.name, objectKey: presignData.key, contentType: file.type, fileSize: file.size })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="File"
        htmlFor="file"
        error={uploadError ?? undefined}
        hint="PDF, Word, Excel, or images — up to 25MB"
      >
        <Input
          id="file"
          type="file"
          accept={ALLOWED_DOCUMENT_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          required={!uploaded}
        />
      </FormField>

      {uploading && <p className="text-xs text-ink-muted">Uploading…</p>}
      {uploaded && <p className="text-xs text-emerald-600">Uploaded: {uploaded.fileName}</p>}

      <input type="hidden" name="fileName" value={uploaded?.fileName ?? ''} />
      <input type="hidden" name="objectKey" value={uploaded?.objectKey ?? ''} />
      <input type="hidden" name="contentType" value={uploaded?.contentType ?? ''} />
      <input type="hidden" name="fileSize" value={uploaded?.fileSize ?? ''} />
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
