import React from 'react';
import { Card } from './Card';

export interface SidebarBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
}

export function SidebarBlock({ children, title, icon: Icon, action, ...props }: SidebarBlockProps) {
  return (
    <Card variant="surface" padding="md" className="space-y-3" {...props}>
      {(title || Icon || action) && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-primary" />}
            {title && <h3 className="text-sm font-black tracking-tight text-foreground">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </Card>
  );
}
