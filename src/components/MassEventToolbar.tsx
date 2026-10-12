// src/components/MassEventToolbar.tsx
import React from 'react';
import { Copy, Lock, Send, StopCircle, Settings, Check, Bot, Archive } from 'lucide-react';
import { Teacher, type TeacherPose } from '@/components/characters/Staff';
import { cn } from '@/lib/utils';

interface MassEventToolbarProps {
  monthStatus: string;
  isLocked: boolean;
  isCopyEnabled: boolean;
  isSurveyOpen: boolean;
  onApplyPreset: () => void;
  onConfirmMass: () => void;
  onOpenSurvey: () => void;
  onCloseSurvey: () => void;
  onAutoAssign: () => void;
  onFinalConfirm: () => void;
  onOpenMonthStatus: () => void;
  onOpenBackup: () => void;
}

/** 상태별: 지금 진행 중인 단계(0~2, 3=모두 끝남)와 안내 */
const GUIDE: Record<string, { step: number; text: string; pose: TeacherPose }> = {
  'MASS-NOTCONFIRMED': { step: 0, text: '미사 일정을 만들고 확정해 주세요', pose: 'plan' },
  'MASS-CONFIRMED': { step: 1, text: '설문을 보내고, 응답이 모이면 종료해 주세요', pose: 'announce' },
  'SURVEY-CONFIRMED': { step: 2, text: '자동 배정 후 살펴보고 최종 확정해 주세요', pose: 'point' },
  'FINAL-CONFIRMED': { step: 3, text: '이번 달 배정이 확정됐어요', pose: 'cheer' },
};

const TONES = [
  { panel: 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20', badge: 'bg-sky-500', solid: 'bg-sky-600 hover:bg-sky-700 text-white', soft: 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-slate-900 dark:text-sky-300 dark:border-sky-800' },
  { panel: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20', badge: 'bg-amber-500', solid: 'bg-amber-500 hover:bg-amber-600 text-white', soft: 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-300 dark:border-amber-800' },
  { panel: 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20', badge: 'bg-rose-500', solid: 'bg-rose-500 hover:bg-rose-600 text-white', soft: 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-slate-900 dark:text-rose-300 dark:border-rose-800' },
];

function StepButton({
  icon,
  label,
  disabled,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center justify-center gap-1 rounded-xl px-1 text-[12px] font-bold transition active:scale-95',
        'disabled:pointer-events-none disabled:border disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500',
        className
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export const MassEventToolbar: React.FC<MassEventToolbarProps> = ({
  monthStatus,
  isLocked,
  isCopyEnabled,
  isSurveyOpen,
  onApplyPreset,
  onConfirmMass,
  onOpenSurvey,
  onCloseSurvey,
  onAutoAssign,
  onFinalConfirm,
  onOpenMonthStatus,
  onOpenBackup,
}) => {
  const guide = GUIDE[monthStatus] ?? GUIDE['MASS-NOTCONFIRMED'];
  const surveyViewOnly = monthStatus === 'SURVEY-CONFIRMED' || monthStatus === 'FINAL-CONFIRMED' || isSurveyOpen;
  const iconClass = 'h-3.5 w-3.5 shrink-0';

  const steps = [
    {
      title: '일정',
      buttons: [
        { icon: <Copy className={iconClass} />, label: '프리셋 초기화', disabled: !isCopyEnabled, onClick: onApplyPreset, main: false },
        { icon: <Lock className={iconClass} />, label: '일정 확정', disabled: monthStatus !== 'MASS-NOTCONFIRMED' || isLocked, onClick: onConfirmMass, main: true },
      ],
    },
    {
      title: '설문',
      buttons: [
        { icon: <Send className={iconClass} />, label: surveyViewOnly ? '설문 보기' : '설문 발송', disabled: monthStatus === 'MASS-NOTCONFIRMED', onClick: onOpenSurvey, main: !surveyViewOnly },
        { icon: <StopCircle className={iconClass} />, label: '설문 종료', disabled: monthStatus !== 'MASS-CONFIRMED', onClick: onCloseSurvey, main: surveyViewOnly },
      ],
    },
    {
      title: '배정',
      buttons: [
        { icon: <Bot className={iconClass} />, label: '자동 배정', disabled: monthStatus !== 'SURVEY-CONFIRMED', onClick: onAutoAssign, main: false },
        {
          icon: <Check className={iconClass} />,
          label: monthStatus === 'FINAL-CONFIRMED' ? '확정 보기' : '최종 확정',
          disabled: monthStatus !== 'SURVEY-CONFIRMED' && monthStatus !== 'FINAL-CONFIRMED',
          onClick: onFinalConfirm,
          main: true,
        },
      ],
    },
  ];

  return (
    <section className="mb-3 w-full rounded-3xl border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      {/* 지금 할 일 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="w-12 shrink-0">
          <Teacher key={guide.pose} pose={guide.pose} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-300">
            {guide.step >= 3 ? '모든 단계 완료' : `지금은 ${guide.step + 1}단계`}
          </p>
          <p key={monthStatus} className="ui-pop-once font-display text-lg leading-snug text-gray-900 dark:text-gray-50 break-keep">
            {guide.text}
          </p>
        </div>
        {/* 유틸리티 */}
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onOpenMonthStatus}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-200 active:scale-95 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            <Settings className="h-3 w-3" /> 월 상태
          </button>
          <button
            type="button"
            onClick={onOpenBackup}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-200 active:scale-95 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            <Archive className="h-3 w-3" /> 백업
          </button>
        </div>
      </div>

      {/* 세 단계 */}
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, i) => {
          const tone = TONES[i];
          const done = i < guide.step;
          const current = i === guide.step;
          return (
            <div
              key={step.title}
              className={cn(
                'flex flex-col gap-1.5 rounded-2xl border p-2 transition-colors',
                current ? tone.panel : 'border-gray-100 bg-gray-50/70 dark:border-slate-800 dark:bg-slate-800/40'
              )}
            >
              <div className="flex items-center gap-1.5 px-0.5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                    done ? 'bg-emerald-500' : current ? tone.badge : 'bg-gray-300 dark:bg-slate-600'
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
                </span>
                <span className={cn('font-display text-base', current ? 'text-gray-900 dark:text-gray-50' : 'text-gray-500 dark:text-gray-400')}>
                  {step.title}
                </span>
              </div>
              {step.buttons.map((b) => (
                <StepButton
                  key={b.label}
                  icon={b.icon}
                  label={b.label}
                  disabled={b.disabled}
                  onClick={b.onClick}
                  className={b.main && current ? tone.solid : tone.soft}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
};
