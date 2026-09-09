'use client'

import { useActionState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import type { Company } from '@/lib/db/schema'

interface CompanyFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  company?: Company
}

export function CompanyForm({ action, company }: CompanyFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Company name" htmlFor="name" error={state.errors.name?.[0]}>
        <Input id="name" name="name" defaultValue={company?.name} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Industry" htmlFor="industry" error={state.errors.industry?.[0]}>
          <Input id="industry" name="industry" defaultValue={company?.industry ?? ''} />
        </FormField>
        <FormField label="Website" htmlFor="website" error={state.errors.website?.[0]} hint="Include https://">
          <Input id="website" name="website" defaultValue={company?.website ?? ''} />
        </FormField>
      </div>

      <FormField label="Phone" htmlFor="phone" error={state.errors.phone?.[0]}>
        <Input id="phone" name="phone" type="tel" defaultValue={company?.phone ?? ''} />
      </FormField>

      <FormField label="Address" htmlFor="address" error={state.errors.address?.[0]}>
        <Textarea id="address" name="address" rows={2} defaultValue={company?.address ?? ''} />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={state.errors.notes?.[0]}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={company?.notes ?? ''} />
      </FormField>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{company ? 'Save changes' : 'Create company'}</SubmitButton>
    </form>
  )
}
