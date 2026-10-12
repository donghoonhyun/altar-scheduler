// src/pages/components/ServerMonthCalendar.tsx
import dayjs, { Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ServerAvatar } from '@/components/characters/AltarServer';
import type { MassEventDoc, MassStatus } from '@/types/firestore';
import { cn } from '@/lib/utils';

interface ServerMonthCalendarProps {
  currentMonth: Dayjs;
  events: MassEventDoc[];
  monthStatus: MassStatus;
  /** 선택한 복사의 배정인지 */
  isMyEvent: (ev: MassEventDoc) => boolean | undefined;
  /** 내 배정일에 표시할 얼굴 (선택한 복사의 memberId) */
  avatarSeed?: string;
  selectedDate: Dayjs | null;
  onDayClick: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 복사 메인의 월 달력.
 * 미확정(MASS-NOTCONFIRMED)인 달은 날짜를 누를 수 없고, 그 외에는 내 배정일에 내 얼굴이 표시된다.
 */
export default function ServerMonthCalendar({
  currentMonth,
  events,
  monthStatus,
  isMyEvent,
  avatarSeed,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  onToday,
}: ServerMonthCalendarProps) {
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf('month').day();
  const daysArray: (number | null)[] = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );
  // MASS-NOTCONFIRMED가 아니면 배정을 표시
  const showDots = monthStatus !== 'MASS-NOTCONFIRMED';
  const monthKey = currentMonth.format('YYYYMM');

  return (
    <section className="rounded-3xl border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      {/* 달력 상단 */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevMonth}
            className="rounded-full p-1.5 text-gray-700 transition hover:bg-violet-100 active:scale-90 dark:text-gray-300 dark:hover:bg-slate-800"
            title="이전 달"
          >
            <ChevronLeft size={20} />
          </button>

          <span
            key={monthKey}
            className="ui-pop-once inline-block min-w-[3rem] text-center font-display text-2xl text-gray-800 dark:text-gray-100"
          >
            {currentMonth.format('M월')}
          </span>

          <button
            onClick={onNextMonth}
            className="rounded-full p-1.5 text-gray-700 transition hover:bg-violet-100 active:scale-90 dark:text-gray-300 dark:hover:bg-slate-800"
            title="다음 달"
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={onToday}
            className="ml-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-violet-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            오늘
          </button>
        </div>

        <StatusBadge status={monthStatus} size="sm" />
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'py-1 text-center text-xs font-semibold',
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 — 달이 바뀌면 다시 떠오르며 나타난다 */}
      <div key={monthKey} className="ui-rise grid grid-cols-7 gap-1 text-sm">
        {daysArray.map((day, idx) => {
          if (!day) return <div key={idx} className="h-14" />;

          const dateObj = currentMonth.date(day);
          const evts = events.filter((ev) => dayjs(ev.event_date, 'YYYYMMDD').isSame(dateObj, 'day'));
          const mine = evts.some(isMyEvent);
          const any = evts.length > 0;
          const isToday = dayjs().isSame(dateObj, 'day');
          const isSelected = !!selectedDate && selectedDate.isSame(dateObj, 'day');
          const dow = dateObj.day();

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex h-14 flex-col items-center justify-start rounded-2xl border pt-1 transition md:h-36 md:items-stretch md:p-2',
                // 미확정이면 누를 수 없다
                !showDots ? 'cursor-default' : 'cursor-pointer hover:bg-violet-50/70 active:scale-95 dark:hover:bg-violet-900/20',
                isToday ? 'z-10 border-violet-500 ring-1 ring-violet-500' : 'border-transparent',

                // 미확정
                !showDots && mine && 'bg-rose-500 font-bold text-white',
                !showDots && !mine && any && 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400',
                !showDots && !any && 'text-gray-300 dark:text-slate-600',

                // 확정: 내 배정 / 그 외
                showDots && !isSelected && mine && 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20',
                showDots && !isSelected && !mine && any && 'border-violet-200 bg-violet-100/70 text-gray-800 dark:border-violet-800/60 dark:bg-violet-900/30 dark:text-gray-100',
                showDots && !isSelected && !mine && !any && 'text-gray-400 dark:text-slate-500',

                // 선택한 날짜
                isSelected && mine && 'z-20 border-amber-400 bg-rose-50 ring-2 ring-amber-400 dark:bg-rose-900/30',
                isSelected && !mine && 'z-20 border-amber-400 bg-white ring-2 ring-amber-400 dark:bg-slate-800'
              )}
            >
              <span
                className={cn(
                  'text-sm leading-none',
                  showDots && any && 'font-bold',
                  showDots && dow === 0 && 'text-rose-500',
                  showDots && dow === 6 && 'text-sky-500',
                  isToday && 'font-bold text-violet-600 dark:text-violet-300',
                  !showDots && mine && 'text-white'
                )}
              >
                {day}
              </span>

              {showDots && (
                <>
                  {/* 모바일: 내 배정일에는 얼굴, 그 외 미사는 점 */}
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-[3px] px-1 md:hidden">
                    {mine ? (
                      <ServerAvatar seed={avatarSeed} size={24} />
                    ) : (
                      evts.map((ev) => <div key={ev.id} className="h-2 w-2 rounded-full bg-violet-500 dark:bg-violet-400" />)
                    )}
                  </div>

                  {/* 넓은 화면: 미사 이름 */}
                  <div className="custom-scrollbar mt-1 hidden w-full flex-col gap-1 overflow-y-auto md:flex">
                    {[...evts]
                      .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
                      .map((ev) => {
                        const myEvent = isMyEvent(ev);
                        return (
                          <div
                            key={ev.id}
                            className={cn(
                              'flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium',
                              myEvent
                                ? 'border border-rose-200 bg-rose-500/10 text-rose-700 dark:border-rose-900/50 dark:bg-rose-500/20 dark:text-rose-200'
                                : 'border border-transparent bg-white/80 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', myEvent ? 'bg-rose-500' : 'bg-violet-400')} />
                            {ev.title}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {showDots && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <ServerAvatar seed={avatarSeed} size={16} />
          내가 복사 서는 날
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-violet-500 dark:bg-violet-400" />
          미사 있는 날
        </p>
      )}
    </section>
  );
}
