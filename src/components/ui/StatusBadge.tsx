import React from 'react';
import { cn } from '@/lib/utils';
import { getMassStatusInfo } from '@/constants/massStatusLabels';
import type { MassStatus } from '@/types/firestore';

interface StatusBadgeProps {
  status?: MassStatus;
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

/**
 * ✅ StatusBadge (공통 상태 배지 컴포넌트)
 * ----------------------------------------------------
 * - getMassStatusInfo() 기반으로 label, icon, color 일원화
 * - 모든 페이지(Dashboard / ServerMain / MonthStatusDrawer 등)에서 동일한 표현 유지
 * ----------------------------------------------------
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'MASS-NOTCONFIRMED',
  size = 'md',
  iconOnly = false,
}) => {
  const { label, icon, color, bg, border } = getMassStatusInfo(status);

  const sizeClasses =
    {
      sm: 'text-xs px-2 py-[1px] rounded-md',
      md: 'text-sm px-3 py-1 rounded-lg',
      lg: 'text-base px-4 py-1.5 rounded-xl',
    }[size] || 'text-sm px-3 py-1 rounded-lg';

  return (
    <div
      className={cn(
        'inline-flex items-center font-medium select-none border',
        color,
        bg,
        border,
        sizeClasses
      )}
    >
      <span className="mr-1">{icon}</span>
      {!iconOnly && <span>{label}</span>}
    </div>
  );
};
