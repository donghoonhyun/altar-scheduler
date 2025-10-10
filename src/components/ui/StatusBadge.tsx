import React from 'react';
import { cn } from '@/lib/utils';
import type { MassStatus } from '@/types/firestore';

interface StatusBadgeProps {
  status?: MassStatus;
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'MASS-NOTCONFIRMED',
  size = 'md',
  iconOnly = false,
}) => {
  const statusMap: Record<MassStatus, { label: string; icon: string; text: string; bg: string }> = {
    'MASS-NOTCONFIRMED': {
      label: '미확정',
      icon: '⏱️',
      text: 'text-gray-500',
      bg: 'bg-gray-100 dark:bg-gray-700/50',
    },
    'MASS-CONFIRMED': {
      label: '확정됨',
      icon: '🔒',
      text: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
    },
    'SURVEY-CONFIRMED': {
      label: '설문마감',
      icon: '🗳️',
      text: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
    },
    'FINAL-CONFIRMED': {
      label: '최종확정',
      icon: '🛡️',
      text: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/30',
    },
  };

  const { label, icon, text, bg } = statusMap[status];

  const sizeClasses = {
    sm: 'text-xs px-2 py-[1px] rounded-md',
    md: 'text-sm px-3 py-1 rounded-lg',
    lg: 'text-base px-4 py-1.5 rounded-xl',
  }[size];

  return (
    <div className={cn('inline-flex items-center font-medium select-none', text, bg, sizeClasses)}>
      <span className="mr-1">{icon}</span>
      {!iconOnly && <span>{label}</span>}
    </div>
  );
};
