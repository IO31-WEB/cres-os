'use client'

import { useActionState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { CONTACT_TYPES, CONTACT_TYPE_LABELS, LEAD_SCORES, CONTACT_SOURCES } from '@/lib/validations/contact'
import type { Contact, Company, User } from '@/lib/db/schema'

interface ContactFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  contact?: Contact
  companies: Company[]
  users: User[]
}

export function ContactForm({ action, contact, companies, users }: ContactFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="firstName" error={state.errors.firstName?.[0]}>
          <Input id="firstName" name="firstName" defaultValue={contact?.firstName} required />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" error={state.errors.lastName?.[0]}>
          <Input id="lastName" name="lastName" defaultValue={contact?.lastName ?? ''} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email" error={state.errors.email?.[0]}>
          <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ''} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={state.errors.phone?.[0]}>
          <Input id="phone" name="phone" type="tel" defaultValue={contact?.phone ?? ''} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="WhatsApp" htmlFor="whatsapp" error={state.errors.whatsapp?.[0]}>
          <Input id="whatsapp" name="whatsapp" defaultValue={contact?.whatsapp ?? ''} />
        </FormField>
        <FormField label="Preferred language" htmlFor="preferredLanguage" error={state.errors.preferredLanguage?.[0]}>
          <Select id="preferredLanguage" name="preferredLanguage" defaultValue={contact?.preferredLanguage ?? 'en'}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Contact type" htmlFor="contactType" error={state.errors.contactType?.[0]}>
          <Select id="contactType" name="contactType" defaultValue={contact?.contactType ?? 'other'}>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTACT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Lead score" htmlFor="leadScore" error={state.errors.leadScore?.[0]}>
          <Select id="leadScore" name="leadScore" defaultValue={contact?.leadScore ?? 'nurture'}>
            {LEAD_SCORES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Source" htmlFor="source" error={state.errors.source?.[0]}>
          <Select id="source" name="source" defaultValue={contact?.source ?? 'manual'}>
            {CONTACT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Company" htmlFor="companyId" error={state.errors.companyId?.[0]} hint="Optional">
          <Select id="companyId" name="companyId" defaultValue={contact?.companyId?.toString() ?? ''}>
            <option value="">No company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Assigned to" htmlFor="assignedToUserId" error={state.errors.assignedToUserId?.[0]} hint="Optional">
        <Select id="assignedToUserId" name="assignedToUserId" defaultValue={contact?.assignedToUserId ?? ''}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={state.errors.notes?.[0]}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={contact?.notes ?? ''} />
      </FormField>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{contact ? 'Save changes' : 'Create contact'}</SubmitButton>
    </form>
  )
}
