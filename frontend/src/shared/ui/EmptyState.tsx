import React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  emoji?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  emoji,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        't-stagger is-shown flex flex-col items-center rounded-lg border border-dashed border-border bg-gradient-to-b from-card to-muted/20 p-6 text-center',
        className
      )}
      {...props}
    >
      {emoji ? (
        <span className="t-stagger-line t-stagger-line--1 mb-2 text-3xl">{emoji}</span>
      ) : icon ? (
        <div className="t-stagger-line t-stagger-line--1 mb-2 text-muted-foreground">{icon}</div>
      ) : (
        <span className="t-stagger-line t-stagger-line--1 mb-2 text-3xl">🤷</span>
      )}
      <p className="t-stagger-line t-stagger-line--2 text-base font-black text-foreground">{title}</p>
      {description ? (
        <p className="t-stagger-line t-stagger-line--3 mt-1.5 max-w-xs text-[0.82rem] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="t-stagger-line t-stagger-line--4 mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
