import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'bg-border/60 text-ink-muted',
      gold: 'bg-gold/15 text-gold-dim',
      green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      red: 'bg-red-500/10 text-red-700 dark:text-red-400',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
