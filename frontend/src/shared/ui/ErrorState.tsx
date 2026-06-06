import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../i18n';
import { Button } from './Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title: _title, description, onRetry, className, ...props }: ErrorStateProps) {
  const { t } = useTranslation();
  const title = _title ?? t('error.state_title');

  return (
    <div
      className={cn(
        't-input is-shaking rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center text-destructive',
        className
      )}
      {...props}
    >
      <AlertTriangle className="mx-auto mb-2 text-destructive" />
      <p className="font-black">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" className="mt-4 border-destructive/20 hover:bg-destructive/10 text-destructive" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
