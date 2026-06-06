import React from 'react';
import { cn } from '../../lib/utils';

export interface FeedLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function FeedLayout({ children, header, sidebar, className, ...props }: FeedLayoutProps) {
  return (
    <div className={cn('flex w-full min-w-0 gap-6', className)} {...props}>
      <div className="flex-1 min-w-0 space-y-4 sm:space-y-5">
        {header}
        {children}
      </div>
      {sidebar && (
        <aside className="hidden lg:block w-full max-w-[var(--ui-feed-sidebar-w)] shrink-0 space-y-5">
          {sidebar}
        </aside>
      )}
    </div>
  );
}
