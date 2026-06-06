import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const iconContainerVariants = cva(
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
  {
    variants: {
      tone: {
        orange: 'from-primary to-orange-400 shadow-orange-500/20 dark:shadow-orange-950/20',
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/20 dark:shadow-blue-950/20',
        emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20 dark:shadow-emerald-950/20',
        amber: 'from-amber-500 to-orange-500 shadow-amber-500/20 dark:shadow-amber-950/20',
        red: 'from-red-500 to-rose-600 shadow-red-500/20 dark:shadow-red-950/20',
        purple: 'from-purple-500 to-violet-600 shadow-purple-500/20 dark:shadow-purple-950/20',
        cyan: 'from-cyan-500 to-sky-600 shadow-cyan-500/20 dark:shadow-cyan-950/20',
        violet: 'from-violet-500 to-fuchsia-600 shadow-violet-500/20 dark:shadow-violet-950/20',
      },
    },
    defaultVariants: {
      tone: 'orange',
    },
  }
);

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof iconContainerVariants> {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
  tone,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6', className)} {...props}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? (
          <div className={iconContainerVariants({ tone })}>
            <Icon size={22} />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight text-foreground">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="truncate text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
