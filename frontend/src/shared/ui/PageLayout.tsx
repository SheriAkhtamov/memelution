import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const pageLayoutVariants = cva(
  'w-full mx-auto min-w-0 transition-all duration-150',
  {
    variants: {
      variant: {
        compact: 'max-w-[var(--ui-page-max-w-compact)] p-3 sm:p-5 lg:p-6',
        feed: 'max-w-[var(--ui-page-max-w-feed)] p-3 sm:p-5 lg:p-6',
        default: 'max-w-[var(--ui-page-max-w-default)] p-3 sm:p-5 lg:p-6',
        profile: 'max-w-[var(--ui-page-max-w-profile)] px-3 pb-6 sm:p-4 sm:pb-6',
        full: 'max-w-full p-3 sm:p-5 lg:p-6',
        admin: 'max-w-[var(--ui-page-max-w-admin)] p-4 sm:p-6 lg:p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface PageLayoutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageLayoutVariants> {}

export const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(pageLayoutVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

PageLayout.displayName = 'PageLayout';
