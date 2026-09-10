import type { ZodSchema } from 'zod'

export interface ActionState {
  errors: Record<string, string[]>
  message?: string
  // What the person actually typed, keyed by field name. Only populated on
  // a failed submission, so forms can re-fill themselves with the attempted
  // values instead of falling back to the original record.
  values?: Record<string, string>
}

export const EMPTY_STATE: ActionState = { errors: {} }

/**
 * Parses FormData against a zod schema and returns a discriminated result.
 * Every mutating server action follows this same shape so <FormField> can
 * read errors[fieldName] regardless of which entity it's rendering.
 */
export function parseForm<T>(
  schema: ZodSchema<T>,
  formData: FormData
): { success: true; data: T } | { success: false; state: ActionState } {
  const raw = Object.fromEntries(formData.entries())
  const result = schema.safeParse(raw)

  if (!result.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      errors[key] = [...(errors[key] ?? []), issue.message]
    }
    // Only keep string entries (skip Files) so re-filling the form can't
    // choke on a non-serializable value.
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') values[key] = value
    }
    return { success: false, state: { errors, message: 'Check the highlighted fields.', values } }
  }

  return { success: true, data: result.data }
}
