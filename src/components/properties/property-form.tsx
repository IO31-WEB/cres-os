'use client'

import { useActionState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, LISTING_STATUSES, LISTING_STATUS_LABELS } from '@/lib/validations/property'
import { BUSINESS_PROFILE_LIST } from '@/lib/business-profiles'
import type { Property, Contact, User } from '@/lib/db/schema'

interface PropertyFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  property?: Property
  contacts: Contact[]
  users: User[]
}

export function PropertyForm({ action, property, contacts, users }: PropertyFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  // Prefer whatever the person just typed (if a submission failed
  // validation) over the original record, so a single bad field doesn't
  // wipe everything else they entered.
  const field = (name: string, fallback: string | null | undefined = '') =>
    state.values?.[name] ?? fallback ?? ''

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="Address"
        htmlFor="address"
        error={state.errors.address?.[0]}
        hint="We'll geocode this automatically for the property page and scorecard."
      >
        <Input id="address" name="address" defaultValue={field('address', property?.address)} required placeholder="1234 Dale Mabry Hwy, Tampa, FL 33607" />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Property type" htmlFor="propertyType" error={state.errors.propertyType?.[0]}>
          <Select id="propertyType" name="propertyType" defaultValue={field('propertyType', property?.propertyType) || 'retail'}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Listing status" htmlFor="listingStatus" error={state.errors.listingStatus?.[0]}>
          <Select id="listingStatus" name="listingStatus" defaultValue={field('listingStatus', property?.listingStatus) || 'off_market'}>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LISTING_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="Default scorecard use"
        htmlFor="defaultBusinessProfile"
        error={state.errors.defaultBusinessProfile?.[0]}
        hint="Pre-selects this use when launching a scorecard from this property."
      >
        <Select id="defaultBusinessProfile" name="defaultBusinessProfile" defaultValue={field('defaultBusinessProfile', property?.defaultBusinessProfile) || 'general'}>
          {BUSINESS_PROFILE_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Square footage" htmlFor="sqft" error={state.errors.sqft?.[0]} hint="Optional">
          <Input id="sqft" name="sqft" type="number" min="0" defaultValue={field('sqft', property?.sqft?.toString())} />
        </FormField>
        <FormField label="Owner contact" htmlFor="ownerContactId" error={state.errors.ownerContactId?.[0]} hint="Optional">
          <Select id="ownerContactId" name="ownerContactId" defaultValue={field('ownerContactId', property?.ownerContactId?.toString())}>
            <option value="">No owner set</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="Assigned to"
        htmlFor="assignedToUserId"
        error={state.errors.assignedToUserId?.[0]}
        hint="Unassigned properties are only visible to owners."
      >
        <Select id="assignedToUserId" name="assignedToUserId" defaultValue={field('assignedToUserId', property?.assignedToUserId)}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={state.errors.notes?.[0]}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={field('notes', property?.notes)} />
      </FormField>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{property ? 'Save changes' : 'Create property'}</SubmitButton>
    </form>
  )
}
