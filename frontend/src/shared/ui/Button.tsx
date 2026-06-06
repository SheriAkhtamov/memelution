import React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'motion-control inline-flex items-center justify-center gap-1.5 font-black leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:brightness-105 active:scale-98 shadow-md shadow-primary/20',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-105 active:scale-98 shadow-md shadow-secondary/20',
        outline: 'border border-border bg-background text-foreground hover:bg-muted active:scale-98',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground active:scale-98',
        danger: 'bg-destructive text-destructive-foreground hover:brightness-105 active:scale-98 shadow-md shadow-destructive/20',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-[0.78rem]',
        md: 'h-9 rounded-md px-3.5 text-[0.82rem]',
        lg: 'h-11 rounded-xl px-5 text-sm',
        icon: 'h-9 w-9 rounded-md p-0',
        'icon-lg': 'h-11 w-11 rounded-xl p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, children, variant = 'ghost', size = 'icon', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        title={label}
        className={className}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
