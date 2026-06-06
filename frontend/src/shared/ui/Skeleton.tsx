import React from 'react';
import { cn } from '../../lib/utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('motion-skeleton rounded-xl bg-muted animate-pulse', className)}
      {...props}
    />
  );
}
