import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          'flex h-9 w-full rounded border border-border bg-surface px-3 py-1 text-sm text-ink placeholder:text-ink-muted',
          'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-red-500',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
