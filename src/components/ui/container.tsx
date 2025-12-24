import React from 'react';
import { cn } from '@/lib/utils';

export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('max-w-5xl mx-auto px-2 sm:px-3 lg:px-4', className)} {...props}>
    {children}
  </div>
);
