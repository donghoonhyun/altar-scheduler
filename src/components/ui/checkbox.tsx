import * as React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, ...props }) => (
  <input
    type="checkbox"
    className="w-4 h-4 accent-blue-600 cursor-pointer"
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
);
