import * as React from 'react';
import { cn } from '@/lib/utils'; // 없으면 임시로 clsx 사용 가능

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95';
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white shadow-md focus:ring-blue-300',
    secondary: 'bg-yellow-300 hover:bg-yellow-400 text-gray-800 shadow-sm focus:ring-yellow-200',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-gray-200',
    ghost: 'text-gray-600 hover:bg-gray-200 focus:ring-gray-100',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    icon: 'p-2',
  };

  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};
