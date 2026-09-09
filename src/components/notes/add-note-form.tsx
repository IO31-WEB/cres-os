'use client'

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { addNote } from '@/lib/actions/notes'

interface AddNoteFormProps {
  contactId?: number
  dealId?: number
  propertyId?: number
  revalidate: string
}

export function AddNoteForm({ contactId, dealId, propertyId, revalidate }: AddNoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    const content = String(formData.get('content') ?? '')
    await addNote({ content, contactId, dealId, propertyId, revalidate })
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
      <Textarea name="content" placeholder="Log a call, email, or note…" rows={2} required className="flex-1" />
      <Button type="submit" size="sm" className="self-end">
        Add
      </Button>
    </form>
  )
}
