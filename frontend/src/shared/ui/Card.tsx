import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const cardVariants = cva(
  'rounded-xl border transition-all duration-200',
  {
    variants: {
      variant: {
        surface: 'border-border bg-card text-card-foreground shadow-sm',
        outline: 'border-border bg-transparent text-foreground',
        ghost: 'border-transparent bg-muted/40 text-muted-foreground',
        hoverable: 'border-border bg-card text-card-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5 sm:p-6',
      },
    },
    defaultVariants: {
      variant: 'surface',
      padding: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding }), className)}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
