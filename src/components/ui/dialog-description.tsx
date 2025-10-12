// src/components/ui/dialog-description.tsx
import * as React from 'react';

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

/**
 * ✅ DialogDescription
 * shadcn/ui dialog에서 접근성 경고(Missing aria-describedby)를 방지하기 위한 전역 컴포넌트.
 * 내부적으로 <p> 태그를 사용하며 aria-describedby 자동 연결용으로 사용됨.
 */
export const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className = '', children, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-gray-500 ${className}`} {...props}>
      {children}
    </p>
  )
);

DialogDescription.displayName = 'DialogDescription';
