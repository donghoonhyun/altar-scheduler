import React from 'react';
import { cn } from '@/lib/utils';

export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('max-w-5xl mx-auto px-4 sm:px-6 lg:px-8', className)} {...props}>
    {children}
  </div>
);
