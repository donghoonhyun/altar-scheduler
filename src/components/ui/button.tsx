// src/components/ui/button.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'edit' | 'link' | 'toolbar' | 'unit';
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
    'inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-transparent',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    outline: 'border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50',
    ghost: 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm border-transparent',
    edit: 'bg-white border text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-slate-800 dark:border-blue-900',
    link: 'text-blue-600 underline-offset-4 hover:underline dark:text-blue-400',
    // 🛠️ 툴바 전용 (내장 크기: h-7 px-2 py-1 text-[12px])
    toolbar: 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 h-7 px-2 py-1 text-[12px] shadow-none rounded-xl',
    // 🛠️ 단위기능 전용 (내장 크기: h-7 px-2.5 text-[11px]) - 드로어 내부 기능 버튼 등
    unit: 'border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50 h-7 px-2.5 py-0 text-[11px] rounded-xl shadow-none font-medium',
  };

  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-8 text-base',
    icon: 'h-10 w-10',
  };

  // toolbar, unit variant have their own size baked in — skip the sizes map to avoid override
  const sizeClass = (variant === 'toolbar' || variant === 'unit') ? '' : sizes[size as keyof typeof sizes];

  return (
    <button className={cn(base, variants[variant as keyof typeof variants], sizeClass, className)} {...props}>
      {children}
    </button>
  );
};
