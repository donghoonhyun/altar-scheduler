// src/pages/components/PlannerHero.tsx
import { Check, ChevronRight } from 'lucide-react';
import { AltarServer, type ServerPose } from '@/components/characters/AltarServer';
import type { MassStatus } from '@/types/firestore';
import { cn } from '@/lib/utils';

interface PlannerHeroProps {
  userName?: string;
  baptismalName?: string;
  roleLabel: string;
  /** 달력에서 보고 있는 달 (예: "10월") */
  monthLabel: string;
  status: MassStatus;
  /** 캐릭터 얼굴을 정하는 값 (복사단마다 같은 얼굴) */
  seed: string;
  onPrimary: () => void;
}

const STEPS = ['일정 확정', '설문 마감', '배정', '최종 확정'];

/** 상태별: 끝난 단계 수, 안내 문구, 캐릭터 */
const GUIDE: Record<
  MassStatus,
  { done: number; title: (m: string) => string; description: string; action: string; pose: ServerPose; tone: string }
> = {
  'MASS-NOTCONFIRMED': {
    done: 0,
    title: (m) => `${m} 미사 일정을 정해 주세요`,
    description: '프리셋으로 일정을 만들고 확정하면 설문을 보낼 수 있어요.',
    action: '미사 일정 계획하기',
    pose: 'candle',
    tone: 'from-violet-600 via-indigo-500 to-sky-500',
  },
  'MASS-CONFIRMED': {
    done: 1,
    title: (m) => `${m} 설문을 받아 주세요`,
    description: '설문을 보내고, 응답이 모이면 설문을 마감해 주세요.',
    action: '설문 보내러 가기',
    pose: 'bell',
    tone: 'from-sky-500 via-indigo-500 to-violet-600',
  },
  'SURVEY-CONFIRMED': {
    done: 2,
    title: (m) => `${m} 복사를 배정해 주세요`,
    description: '자동 배정으로 채운 뒤 살펴보고 최종 확정하면 돼요.',
    action: '배정하러 가기',
    pose: 'pray',
    tone: 'from-amber-500 via-orange-400 to-rose-400',
  },
  'FINAL-CONFIRMED': {
    done: 4,
    title: (m) => `${m} 배정이 확정됐어요`,
    description: '복사들에게 일정이 공개됐어요. 수고하셨어요!',
    action: '확정된 일정 보기',
    pose: 'cheer',
    tone: 'from-emerald-500 via-teal-500 to-sky-500',
  },
};

/**
 * 플래너 대시보드 상단 카드 — 보고 있는 달이 어느 단계인지와 다음에 할 일을 캐릭터가 알려 준다.
 */
export default function PlannerHero({
  userName,
  baptismalName,
  roleLabel,
  monthLabel,
  status,
  seed,
  onPrimary,
}: PlannerHeroProps) {
  const guide = GUIDE[status] ?? GUIDE['MASS-NOTCONFIRMED'];

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-gradient-to-br p-5 text-white shadow-lg shadow-indigo-500/20',
        guide.tone
      )}
    >
      <span className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
      <span className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />

      <p className="relative truncate text-sm text-white/85">
        <span className="font-semibold text-white">{userName || '반가운'}</span>
        {baptismalName && <span className="ml-1 text-xs text-white/75">{baptismalName}</span>}
        <span className="ml-1">{roleLabel}님, 반가워요!</span>
      </p>

      <div className="relative mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p key={`${monthLabel}${status}`} className="ui-pop-once font-display text-2xl leading-snug break-keep">
            {guide.title(monthLabel)}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/90 break-keep">{guide.description}</p>
          <button
            type="button"
            onClick={onPrimary}
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow transition active:scale-95"
          >
            {guide.action}
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="w-[88px] shrink-0 rounded-3xl bg-white/90 px-1.5 pt-2 shadow-inner dark:bg-white/85">
          <AltarServer key={status} seed={seed} pose={guide.pose} />
        </div>
      </div>

      {/* 진행 단계 */}
      <ol className="relative mt-4 grid grid-cols-4 gap-1">
        {STEPS.map((label, i) => {
          const done = i < guide.done;
          const current = i === guide.done;
          return (
            <li key={label} className="flex flex-col items-center gap-1">
              <div className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || current ? 'bg-white/80' : 'bg-white/25')} />
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    done && 'bg-white text-violet-700',
                    current && 'bg-white/25 text-white ring-2 ring-white',
                    !done && !current && 'bg-white/20 text-white/70'
                  )}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('h-0.5 flex-1', i === STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-white/80' : 'bg-white/25')} />
              </div>
              <span className={cn('text-[11px]', done || current ? 'font-semibold text-white' : 'text-white/70')}>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
