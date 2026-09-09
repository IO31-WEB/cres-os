'use client'

import { useActionState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPTY_STATE, type ActionState } from '@/lib/actions/form-state'
import { COMMISSION_STATUSES } from '@/lib/validations/commission'
import type { Commission, Deal } from '@/lib/db/schema'

interface CommissionFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  commission?: Commission
  deal: Deal
}

export function CommissionForm({ action, commission, deal }: CommissionFormProps) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="dealId" value={deal.id} />
      <p className="text-sm text-ink-muted">
        For deal: <span className="font-medium text-ink">{deal.name}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Expected ($)" htmlFor="expectedAmount" error={state.errors.expectedAmount?.[0]}>
          <Input
            id="expectedAmount"
            name="expectedAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={commission?.expectedAmount ?? ''}
            required
          />
        </FormField>
        <FormField label="Invoiced ($)" htmlFor="invoicedAmount" error={state.errors.invoicedAmount?.[0]} hint="Optional">
          <Input id="invoicedAmount" name="invoicedAmount" type="number" min="0" step="0.01" defaultValue={commission?.invoicedAmount ?? ''} />
        </FormField>
        <FormField label="Collected ($)" htmlFor="collectedAmount" error={state.errors.collectedAmount?.[0]} hint="Optional">
          <Input id="collectedAmount" name="collectedAmount" type="number" min="0" step="0.01" defaultValue={commission?.collectedAmount ?? ''} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Status" htmlFor="status" error={state.errors.status?.[0]}>
          <Select id="status" name="status" defaultValue={commission?.status ?? 'expected'}>
            {COMMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due date" htmlFor="dueDate" error={state.errors.dueDate?.[0]} hint="Optional">
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={commission?.dueDate ? new Date(commission.dueDate).toISOString().slice(0, 10) : ''}
          />
        </FormField>
      </div>

      {state.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>{commission ? 'Save changes' : 'Add commission'}</SubmitButton>
    </form>
  )
}
