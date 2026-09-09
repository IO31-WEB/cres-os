'use client'

import { useActionState, useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { PIPELINES, PIPELINE_IDS, stagesFor, defaultStage, type PipelineId } from '@/lib/pipelines'
import { NDA_STATUSES } from '@/lib/validations/deal'
import type { Deal, Contact, Company, Property, User } from '@/lib/db/schema'

interface DealFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  deal?: Deal
  contacts: Contact[]
  companies: Company[]
  properties: Property[]
  users: User[]
  defaultPipeline?: PipelineId
}

export function DealForm({ action, deal, contacts, companies, properties, users, defaultPipeline }: DealFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const [pipeline, setPipeline] = useState<PipelineId>((deal?.pipeline as PipelineId) ?? defaultPipeline ?? 'business_brokerage')

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Deal name" htmlFor="name" error={state.errors.name?.[0]}>
        <Input id="name" name="name" defaultValue={deal?.name} required placeholder="e.g. Smith Family Deli — Sale" />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Pipeline" htmlFor="pipeline" error={state.errors.pipeline?.[0]}>
          <Select
            id="pipeline"
            name="pipeline"
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value as PipelineId)}
          >
            {PIPELINE_IDS.map((p) => (
              <option key={p} value={p}>
                {PIPELINES[p].label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Stage" htmlFor="stage" error={state.errors.stage?.[0]}>
          <Select id="stage" name="stage" defaultValue={deal?.stage ?? defaultStage(pipeline)} key={pipeline}>
            {stagesFor(pipeline).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Contact" htmlFor="contactId" error={state.errors.contactId?.[0]} hint="Optional">
          <Select id="contactId" name="contactId" defaultValue={deal?.contactId?.toString() ?? ''}>
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Company" htmlFor="companyId" error={state.errors.companyId?.[0]} hint="Optional">
          <Select id="companyId" name="companyId" defaultValue={deal?.companyId?.toString() ?? ''}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Property" htmlFor="propertyId" error={state.errors.propertyId?.[0]} hint="Optional">
        <Select id="propertyId" name="propertyId" defaultValue={deal?.propertyId?.toString() ?? ''}>
          <option value="">None</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.formattedAddress}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Value ($)" htmlFor="value" error={state.errors.value?.[0]} hint="Optional">
          <Input id="value" name="value" type="number" min="0" step="0.01" defaultValue={deal?.value ?? ''} />
        </FormField>
        <FormField label="Probability (%)" htmlFor="probability" error={state.errors.probability?.[0]} hint="Optional">
          <Input id="probability" name="probability" type="number" min="0" max="100" defaultValue={deal?.probability ?? ''} />
        </FormField>
        <FormField label="Expected close" htmlFor="expectedCloseDate" error={state.errors.expectedCloseDate?.[0]} hint="Optional">
          <Input
            id="expectedCloseDate"
            name="expectedCloseDate"
            type="date"
            defaultValue={deal?.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10) : ''}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="NDA status" htmlFor="ndaStatus" error={state.errors.ndaStatus?.[0]}>
          <Select id="ndaStatus" name="ndaStatus" defaultValue={deal?.ndaStatus ?? 'not_applicable'}>
            {NDA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Assigned to" htmlFor="assignedToUserId" error={state.errors.assignedToUserId?.[0]}>
          <Select id="assignedToUserId" name="assignedToUserId" defaultValue={deal?.assignedToUserId ?? ''}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{deal ? 'Save changes' : 'Create deal'}</SubmitButton>
    </form>
  )
}
