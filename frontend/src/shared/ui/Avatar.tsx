import React, { useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const avatarVariants = cva(
  'flex shrink-0 items-center justify-center overflow-hidden font-black transition-all bg-primary/10 text-primary',
  {
    variants: {
      size: {
        sm: 'h-7 w-7 text-xs',
        md: 'h-9 w-9 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-16 w-16 text-lg',
      },
      shape: {
        square: 'rounded-lg',
        circle: 'rounded-full',
      },
    },
    defaultVariants: {
      size: 'md',
      shape: 'square',
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  name?: string;
}

export function Avatar({ src, name, size, shape, className, ...props }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <div className={cn(avatarVariants({ size, shape }), className)} {...props}>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover animate-in fade-in duration-200"
          onError={() => setErrored(true)}
        />
      ) : (
        (name || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}
