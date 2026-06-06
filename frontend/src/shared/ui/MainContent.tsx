import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const mainContentVariants = cva(
  'w-full mx-auto min-w-0 flex flex-col gap-4 sm:gap-5',
  {
    variants: {
      variant: {
        compact: 'max-w-[var(--ui-page-max-w-compact)]',
        feed: 'max-w-[var(--ui-page-max-w-feed)]',
        default: 'max-w-[var(--ui-page-max-w-default)]',
        profile: 'max-w-[var(--ui-page-max-w-profile)]',
        admin: 'max-w-[var(--ui-page-max-w-admin)]',
        full: 'max-w-full',
      },
      padding: {
        none: '',
        sm: 'p-3 sm:p-4',
        md: 'p-3 sm:p-5 lg:p-6',
        lg: 'p-4 sm:p-6 lg:p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

export type MainContentVariant = NonNullable<VariantProps<typeof mainContentVariants>['variant']>;

export interface MainContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof mainContentVariants> {
  as?: keyof React.JSX.IntrinsicElements;
}

export const MainContent = React.forwardRef<HTMLDivElement, MainContentProps>(
  ({ className, variant, padding, as, ...props }, ref) => {
    const Tag = (as ?? 'div') as React.ElementType;
    return (
      <Tag
        ref={ref}
        className={cn(mainContentVariants({ variant, padding }), className)}
        {...props}
      />
    );
  }
);

MainContent.displayName = 'MainContent';
