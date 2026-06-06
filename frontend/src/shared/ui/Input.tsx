import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, wrapperClassName, ...props }, ref) => {
    return (
      <label className={cn('t-input-wrap block w-full', error && 'is-error', wrapperClassName)}>
        <input
          ref={ref}
          {...props}
          aria-invalid={error ? true : props['aria-invalid']}
          className={cn(
            't-input h-9 w-full rounded-md border border-border bg-background px-3 text-[0.84rem] font-bold text-foreground outline-none placeholder:text-muted-foreground transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-primary/20',
            error && 'is-error is-shaking border-destructive focus:border-destructive focus:ring-destructive/10',
            className
          )}
        />
        {error && (
          <span className="t-error-msg mt-1 block text-xs font-bold text-destructive" aria-live="polite">
            {error}
          </span>
        )}
      </label>
    );
  }
);

Input.displayName = 'Input';
