import React from 'react';
import { cn } from '@/lib/utils';
import { Cross, Sparkles, User } from 'lucide-react';

interface UserRoleIconProps {
  category?: string; // 'Father', 'Sister', 'Layman' (or undefined)
  className?: string;
  size?: number;
}

/**
 * 사용자 구분(성직자, 수도자 등)에 따른 아이콘을 표시하는 컴포넌트
 * - Father (신부님): ✝️ (Cross) - 보라색 계열
 * - Sister (수녀님): ✨ (Sparkles - 영적인 느낌) - 파란색 계열
 * - Layman (평신도): 표시 안 함 (또는 옵션)
 */
export const UserRoleIcon: React.FC<UserRoleIconProps> = ({ 
  category, 
  className,
  size = 14 
}) => {
  if (!category || category === 'Layman') return null;

  if (category === 'Father') {
    return (
      <span 
        className={cn("inline-flex items-center justify-center p-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 mr-1 align-middle", className)}
        title="신부님"
      >
        <Cross size={size} className="fill-current" />
      </span>
    );
  }

  if (category === 'Sister') {
    return (
      <span 
        className={cn("inline-flex items-center justify-center p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 mr-1 align-middle", className)}
        title="수녀님"
      >
        <Sparkles size={size} className="fill-current" />
      </span>
    );
  }

  return null;
};
