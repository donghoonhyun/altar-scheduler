// src/pages/components/ServerHero.tsx
import type { ReactNode } from 'react';
import { BadgeCheck } from 'lucide-react';
import { AltarServer, type ServerPose } from '@/components/characters/AltarServer';
import { cn } from '@/lib/utils';

export type ServerHeroState =
  /** 다음 복사 배정 (최종 확정된 달) */
  | {
      kind: 'next';
      seed: string;
      memberName: string;
      dday: string;
      dateLabel: string;
      title: string;
      isMain: boolean;
      monthCount: number;
      monthLabel: string;
      onOpen?: () => void;
      /** 최종 확정된 달이면 카드 위쪽에 띄울 표시 (예: "10월 배정 최종 확정") */
      confirmedLabel?: string;
    }
  /** 캐릭터가 지금 상황을 알려 준다 */
  | {
      kind: 'info';
      seed: string;
      pose: ServerPose;
      title: string;
      description: string;
      tone?: 'violet' | 'amber' | 'slate';
      action?: { label: string; onClick: () => void };
      confirmedLabel?: string;
    };

interface ServerHeroProps {
  userName?: string;
  baptismalName?: string;
  roleLabel: string;
  state: ServerHeroState;
  /** 복사 캐릭터 대신 보여 줄 캐릭터 (어드민 화면의 관리자 등) */
  character?: ReactNode;
}

const TONES = {
  violet: 'from-violet-600 via-indigo-500 to-sky-500',
  amber: 'from-amber-500 via-orange-400 to-rose-400',
  slate: 'from-slate-500 via-slate-500 to-slate-400',
};

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="w-[88px] shrink-0 rounded-3xl bg-white/90 px-1.5 pt-2 shadow-inner dark:bg-white/85">
      {children}
    </div>
  );
}

/**
 * 복사 메인 상단 카드 — 인사말과 함께, 복사 캐릭터가 다음 배정이나 지금 상황을 알려 준다.
 */
export default function ServerHero({ userName, baptismalName, roleLabel, state, character }: ServerHeroProps) {
  const tone = state.kind === 'next' ? 'violet' : (state.tone ?? 'violet');
  const clickable = state.kind === 'next' && !!state.onOpen;

  return (
    <section
      onClick={clickable ? state.onOpen : undefined}
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-gradient-to-br p-5 text-white shadow-lg shadow-indigo-500/20',
        TONES[tone],
        clickable && 'cursor-pointer transition active:scale-[0.98]'
      )}
    >
      <span className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
      <span className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />

      <p className="relative truncate text-sm text-white/85">
        <span className="font-semibold text-white">{userName || '반가운'}</span>
        {baptismalName && <span className="ml-1 text-xs text-white/75">{baptismalName}</span>}
        <span className="ml-1">{roleLabel}님, 반가워요!</span>
      </p>

      {state.confirmedLabel && (
        <p className="relative mt-2.5">
          <span
            key={state.confirmedLabel}
            className="ui-pop-once inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1.5 pr-3 text-sm font-bold text-emerald-700 shadow-md shadow-indigo-900/20"
          >
            <BadgeCheck className="h-5 w-5 fill-emerald-500 text-white" />
            {state.confirmedLabel}
            <span className="ui-twinkle text-amber-400" aria-hidden>✦</span>
          </span>
        </p>
      )}

      <div className="relative mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          {state.kind === 'next' ? (
            <>
              <p className="text-sm text-white/80">다음 복사</p>
              <p className="font-display text-4xl leading-tight">{state.dday}</p>
              <p className="mt-2 text-lg font-semibold">{state.dateLabel}</p>
              <p className="truncate text-white/90">{state.title}</p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold">
                  {state.memberName}
                  {state.isMain && ' · 주복사 ⭐'}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold">
                  {state.monthLabel} {state.monthCount}번
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl leading-snug break-keep">{state.title}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/90 break-keep">{state.description}</p>
              {state.action && (
                <button
                  type="button"
                  onClick={state.action.onClick}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow transition active:scale-95"
                >
                  {state.action.label}
                </button>
              )}
            </>
          )}
        </div>

        <Stage>
          {character ?? (
            <AltarServer
              seed={state.seed}
              pose={state.kind === 'next' ? (state.dday.startsWith('D-') ? 'candle' : 'cheer') : state.pose}
            />
          )}
        </Stage>
      </div>
    </section>
  );
}
