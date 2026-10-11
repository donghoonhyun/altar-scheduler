// src/pages/components/PlannerQuickActions.tsx
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, Settings2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  serverGroupId: string;
}

/** 플래너가 자주 가는 화면 바로가기 */
export default function PlannerQuickActions({ serverGroupId }: Props) {
  const navigate = useNavigate();
  const base = `/server-groups/${serverGroupId}`;

  const actions = [
    { label: '미사 일정', icon: CalendarDays, to: `${base}/mass-events`, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
    { label: '설문 관리', icon: ClipboardList, to: `${base}/surveys`, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
    { label: '복사단원', icon: Users, to: `${base}/servers`, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
    { label: '배정 현황', icon: BarChart3, to: `${base}/assignment-status`, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
    { label: '프리셋', icon: Settings2, to: `${base}/presets`, tone: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' },
  ];

  return (
    <nav className="grid grid-cols-5 gap-1 rounded-3xl border border-white/70 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      {actions.map(({ label, icon: Icon, to, tone }) => (
        <button
          key={to}
          type="button"
          onClick={() => navigate(to)}
          className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition hover:bg-violet-50 active:scale-95 dark:hover:bg-slate-800"
        >
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone)}>
            <Icon size={20} />
          </span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  );
}
