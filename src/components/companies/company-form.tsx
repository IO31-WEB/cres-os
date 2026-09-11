'use client'

import { useActionState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import type { Company, User } from '@/lib/db/schema'

interface CompanyFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  company?: Company
  users: User[]
}

export function CompanyForm({ action, company, users }: CompanyFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  // Prefer whatever the person just typed (if a submission failed
  // validation) over the original record, so a single bad field doesn't
  // wipe everything else they entered.
  const field = (name: string, fallback: string | null | undefined = '') =>
    state.values?.[name] ?? fallback ?? ''

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Company name" htmlFor="name" error={state.errors.name?.[0]}>
        <Input id="name" name="name" defaultValue={field('name', company?.name)} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Industry" htmlFor="industry" error={state.errors.industry?.[0]}>
          <Input id="industry" name="industry" defaultValue={field('industry', company?.industry)} />
        </FormField>
        <FormField label="Website" htmlFor="website" error={state.errors.website?.[0]} hint="e.g. example.com — https:// gets added automatically">
          <Input id="website" name="website" defaultValue={field('website', company?.website)} />
        </FormField>
      </div>

      <FormField label="Phone" htmlFor="phone" error={state.errors.phone?.[0]}>
        <Input id="phone" name="phone" type="tel" defaultValue={field('phone', company?.phone)} />
      </FormField>

      <FormField label="Address" htmlFor="address" error={state.errors.address?.[0]}>
        <Textarea id="address" name="address" rows={2} defaultValue={field('address', company?.address)} />
      </FormField>

      <FormField
        label="Assigned to"
        htmlFor="assignedToUserId"
        error={state.errors.assignedToUserId?.[0]}
        hint="Unassigned companies are only visible to owners."
      >
        <Select id="assignedToUserId" name="assignedToUserId" defaultValue={field('assignedToUserId', company?.assignedToUserId)}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={state.errors.notes?.[0]}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={field('notes', company?.notes)} />
      </FormField>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{company ? 'Save changes' : 'Create company'}</SubmitButton>
    </form>
  )
}
