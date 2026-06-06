import React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

const loadingStateVariants = cva(
  'flex flex-col items-center justify-center text-center p-6',
  {
    variants: {
      variant: {
        default: 'min-h-[150px]',
        fullscreen: 'fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm',
        inline: 'py-2 min-h-0',
        skeleton: 'w-full space-y-3 items-start text-left',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface LoadingStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingStateVariants> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  variant,
  label = 'Загрузка...',
  size = 'md',
  className,
  ...props
}: LoadingStateProps) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 36,
  };

  if (variant === 'skeleton') {
    return (
      <div className={cn(loadingStateVariants({ variant }), className)} {...props}>
        <div className="flex items-center gap-3 w-full">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[40%]" />
            <Skeleton className="h-3 w-[20%]" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg mt-3" />
      </div>
    );
  }

  return (
    <div className={cn(loadingStateVariants({ variant }), className)} {...props}>
      <Loader2
        size={sizeMap[size]}
        className="animate-spin text-primary"
      />
      {label && (
        <p className="mt-2 text-xs font-bold text-muted-foreground animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}
