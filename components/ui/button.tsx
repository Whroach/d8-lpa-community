import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 dark:disabled:border-border dark:disabled:bg-muted dark:disabled:text-muted-foreground dark:disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-2 border-input bg-background text-foreground hover:bg-muted',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-primary underline underline-offset-4 hover:no-underline',
      },
      size: {
        // Heights are in rem: at the default text size these are about
        // 45px / 40px / 54px, so every button is a comfortable target.
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 rounded-md px-3 text-sm',
        lg: 'min-h-12 rounded-md px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
