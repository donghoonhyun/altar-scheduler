import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button, Card, Container, Heading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { MassEventCalendar } from '@/types/massEvent';
import { toLocalDateFromFirestore } from '@/lib/dateUtils'; // ✅ 상단 import 추가
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { MassStatus } from '@/types/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

interface MassCalendarProps {
  events?: MassEventCalendar[];
  onDayClick?: (date: Date, eventId?: string) => void;
  onMonthChange?: (month: dayjs.Dayjs) => void; // ✅ 추가
  timezone?: string;
}

export default function MassCalendar({
  events = [],
  onDayClick,
  onMonthChange,
  timezone = 'Asia/Seoul',
}: MassCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().tz(timezone).startOf('month'));
  const [filterStatus, setFilterStatus] = useState<MassStatus | 'ALL'>('ALL');

  const today = dayjs().tz(timezone).format('YYYY-MM-DD');
  const startOfMonth = currentMonth.startOf('month');
  const endOfMonth = currentMonth.endOf('month');
  const daysInMonth = endOfMonth.date();
  const startDay = startOfMonth.day();

  // ✅ currentMonth 변경 시 부모에 알림
  useEffect(() => {
    if (onMonthChange) onMonthChange(currentMonth);
  }, [currentMonth, onMonthChange]);

  // ✅ 필터 적용
  const filteredEvents =
    filterStatus === 'ALL' ? events : events.filter((ev) => ev.status === filterStatus);

  // ✅ 날짜별 그룹화
  const eventsByDate: Record<string, MassEventCalendar[]> = {};
  filteredEvents.forEach((event) => {
    const eventDate = toLocalDateFromFirestore(event.date, timezone);
    const key = eventDate.format('YYYY-MM-DD');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  // ✅ 날짜 셀 생성
  const cells: JSX.Element[] = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`empty-${i}`} className="p-3" />);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = eventsByDate[dateStr] || [];
    const isSunday = date.day() === 0;
    const isSaturday = date.day() === 6;
    const isToday = dateStr === today;

    cells.push(
      <div
        key={dateStr}
        onClick={() => onDayClick?.(date.toDate())}
        className={cn(
          'border rounded-xl p-2 min-h-[90px] flex flex-col justify-start transition-all duration-200 cursor-pointer',
          'hover:shadow-md',
          isSunday
            ? 'bg-pink-50 dark:bg-pink-900/20'
            : isSaturday
            ? 'bg-sky-50 dark:bg-sky-900/20'
            : 'bg-white dark:bg-gray-800',
          isToday && '!border-blue-400 ring-2 ring-blue-300 shadow-sm'
        )}
      >
        {/* 날짜 숫자 */}
        <div
          className={cn(
            'text-xs font-semibold mb-1',
            isSunday
              ? 'text-red-500 dark:text-red-400'
              : isSaturday
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300'
          )}
        >
          {d}
        </div>

        {/* 미사 일정 카드 */}
        {dayEvents.map((ev) => (
          <div
            key={ev.id}
            onClick={(e) => {
              e.stopPropagation();
              onDayClick?.(date.toDate(), ev.id);
            }}
            className="p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 
                       dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 
                       flex flex-col gap-1 transition-all duration-200"
          >
            {/* 제목 + 상태 */}
            <div className="flex justify-between items-center">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-100">
                {ev.title}
                {ev.required_servers && (
                  <span className="ml-1 text-[10px] text-gray-500">({ev.required_servers}명)</span>
                )}
              </div>
              <StatusBadge status={ev.status || 'MASS-NOTCONFIRMED'} iconOnly size="sm" />
            </div>

            {/* 복사명 표시 */}
            {ev.servers && ev.servers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {ev.servers.slice(0, 3).map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-[1px] text-[11px] rounded-md bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100 truncate max-w-[80px]"
                    title={s}
                  >
                    {s}
                  </span>
                ))}
                {ev.servers.length > 3 && (
                  <span className="text-[10px] text-gray-500">+{ev.servers.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Container>
      <Card className="fade-in">
        {/* 📅 월 네비게이션 */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
            >
              <ChevronLeft size={18} />
            </Button>
            <Heading size="md">{currentMonth.format('YYYY년 M월')}</Heading>
            <Button variant="ghost" onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(dayjs().tz(timezone).startOf('month'))}
          >
            <CalendarDays size={16} className="mr-1" /> 오늘
          </Button>
        </div>
        {/* ✅ 상태 필터 (ToggleGroup) */}
        <div className="w-full flex justify-center mb-4">
          <ToggleGroup
            type="single"
            value={filterStatus}
            onValueChange={(val: string | undefined) => {
              if (val) setFilterStatus(val as MassStatus | 'ALL');
            }}
            className="flex gap-2 flex-wrap justify-center"
          >
            {(
              [
                { code: 'ALL', label: '전체', color: 'gray' },
                { code: 'MASS-NOTCONFIRMED', label: '미확정', color: 'gray' },
                { code: 'MASS-CONFIRMED', label: '미사확정', color: 'blue' },
                { code: 'SURVEY-CONFIRMED', label: '설문종료', color: 'amber' },
                { code: 'FINAL-CONFIRMED', label: '최종확정', color: 'green' },
              ] as const
            ).map(({ code, label, color }) => {
              const isActive = filterStatus === code;
              const baseClasses =
                'flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium shadow-sm transition-all duration-200';

              return (
                <ToggleGroupItem
                  key={code}
                  value={code}
                  aria-label={label}
                  className={cn(
                    baseClasses,
                    isActive
                      ? `bg-${color}-100 border-${color}-500 text-${color}-700`
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-300 text-gray-600',
                    'hover:scale-105 focus:ring-2 focus:ring-offset-2 focus:outline-none'
                  )}
                >
                  {code !== 'ALL' && <StatusBadge status={code as MassStatus} iconOnly size="sm" />}
                  <span>{label}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
        {/* 📅 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div
              key={d}
              className={cn(
                i === 0
                  ? 'text-red-500 dark:text-red-400'
                  : i === 6
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300'
              )}
            >
              {d}
            </div>
          ))}
        </div>
        {/* 📆 날짜 셀 */}
        <div className="grid grid-cols-7 gap-2 mt-2">{cells}</div>
      </Card>
    </Container>
  );
}
