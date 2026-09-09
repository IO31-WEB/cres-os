'use client'

import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from '@/components/ui/button'

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? 'Saving…' : children}
    </Button>
  )
}
