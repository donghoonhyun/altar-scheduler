import { Lock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status?: string;
  size?: 'sm' | 'md' | 'lg'; // ✅ lg 추가
  iconOnly?: boolean;
  className?: string;
}

/**
 * ✅ StatusBadge
 * 상태(status)에 따라 색상, 아이콘, Tooltip을 일관되게 표시하는 컴포넌트.
 * - PRD-2.13 8.5 Status & Badge Design System 기반
 */
export const StatusBadge = ({
  status = 'MASS-NOTCONFIRMED',
  size = 'sm',
  iconOnly = false,
  className,
}: StatusBadgeProps) => {
  const styles: Record<
    string,
    { bg: string; text: string; icon: JSX.Element; tooltip: string; label: string }
  > = {
    'MASS-NOTCONFIRMED': {
      bg: 'bg-gray-100',
      text: 'text-gray-500',
      icon: <Clock size={14} className="text-gray-400" />, // ⏳ 아이콘
      tooltip: '미확정',
      label: '미확정',
    },
    'MASS-CONFIRMED': {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: <Lock size={14} className="text-blue-500" />,
      tooltip: '미사일정이 확정됨',
      label: '미사확정',
    },
    'SURVEY-CONFIRMED': {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: <Lock size={14} className="text-amber-500" />,
      tooltip: '복사설문이 마감됨',
      label: '설문마감',
    },
    'FINAL-CONFIRMED': {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: <Lock size={14} className="text-green-500" />,
      tooltip: '최종 확정됨',
      label: '최종확정',
    },
  };

  const current = styles[status] || styles['MASS-NOTCONFIRMED'];

  // ✅ size별 스타일 정의
  const sizeStyle =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'md'
      ? 'px-2.5 py-1 text-sm'
      : 'px-3.5 py-1.5 text-base'; // ✅ lg는 약간 크게

  return (
    <div
      title={current.tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        sizeStyle,
        current.bg,
        current.text,
        className
      )}
    >
      {current.icon}
      {!iconOnly && <span>{current.label}</span>}
    </div>
  );
};
