import React from 'react';
import { cn } from '@/lib/utils';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Heading: React.FC<HeadingProps> = ({ size = 'md', className, children, ...props }) => {
  const sizes = {
    sm: 'text-lg font-semibold',
    md: 'text-2xl font-bold',
    lg: 'text-3xl font-extrabold',
  };
  return (
    <h2 className={cn(sizes[size], 'text-gray-800 dark:text-gray-100', className)} {...props}>
      {children}
    </h2>
  );
};
