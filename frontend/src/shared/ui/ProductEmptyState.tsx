import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type EmptyStateTone = 'flame' | 'rocket' | 'search';

export function ProductEmptyState({
  title,
  description,
  icon,
  action,
  tone = 'flame',
  className,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}) {
  return (
    <section className={cn('product-empty-state', className)} data-tone={tone}>
      <div className="product-empty-visual" aria-hidden="true">
        <span className="product-empty-orbit product-empty-orbit--one" />
        <span className="product-empty-orbit product-empty-orbit--two" />
        <span className="product-empty-spark product-empty-spark--one" />
        <span className="product-empty-spark product-empty-spark--two" />
        <span className="product-empty-spark product-empty-spark--three" />
        <span className="product-empty-icon">{icon}</span>
      </div>
      <h2 className="product-empty-title">{title}</h2>
      {description ? <p className="product-empty-description">{description}</p> : null}
      {action ? <div className="product-empty-actions">{action}</div> : null}
    </section>
  );
}
