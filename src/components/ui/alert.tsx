import * as React from 'react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'warning' | 'error' | 'success';
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const color =
    variant === 'warning'
      ? 'bg-amber-50 border-amber-300 text-amber-700'
      : variant === 'error'
      ? 'bg-red-50 border-red-300 text-red-700'
      : variant === 'success'
      ? 'bg-green-50 border-green-300 text-green-700'
      : 'bg-gray-50 border-gray-200 text-gray-700';

  return (
    <div role="alert" className={`rounded-md border p-3 text-sm ${color} ${className}`} {...props}>
      {children}
    </div>
  );
};
