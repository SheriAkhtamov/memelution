import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const typographyVariants = cva(
  'text-foreground font-sans',
  {
    variants: {
      variant: {
        h1: 'text-3xl font-black tracking-tight leading-none',
        h2: 'text-2xl font-black tracking-tight leading-tight',
        h3: 'text-xl font-bold leading-normal',
        title: 'text-lg font-black leading-snug',
        subtitle: 'text-base font-semibold text-muted-foreground leading-normal',
        body: 'text-sm font-medium leading-relaxed',
        muted: 'text-sm font-medium text-muted-foreground leading-relaxed',
        caption: 'text-xs text-muted-foreground font-bold',
      },
    },
    defaultVariants: {
      variant: 'body',
    },
  }
);

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label' | 'span';
}

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, as, ...props }, ref) => {
    const Component = as || (variant === 'h1' || variant === 'h2' || variant === 'h3' ? (variant as 'h1' | 'h2' | 'h3') : 'p');
    return (
      <Component
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        className={cn(typographyVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

Typography.displayName = 'Typography';

export const Text = Typography;
