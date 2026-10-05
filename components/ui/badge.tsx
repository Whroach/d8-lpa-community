import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * A badge that is given an onClick is a control, so it behaves like one: it
 * can be reached with Tab, pressed with Enter or Space, and is announced as a
 * button. (Clickable badges used to be mouse-and-touch only.)
 */
function Badge({ className, variant, onClick, onKeyDown, ...props }: BadgeProps) {
  if (!onClick) {
    return <div className={cn(badgeVariants({ variant }), className)} onKeyDown={onKeyDown} {...props} />
  }
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(badgeVariants({ variant }), 'min-h-9 cursor-pointer select-none px-3 text-sm', className)}
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
