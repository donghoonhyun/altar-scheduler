import { useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button, Card, Container, Heading } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toLocalDateFromFirestore } from '@/lib/dateUtils';
import type { MassEventCalendar } from '@/types/massEvent';
import { cn } from '@/lib/utils';

dayjs.extend(utc);
dayjs.extend(timezone);

// ✅ Firestore Timestamp 타입 가드
function isFirestoreTimestamp(obj: unknown): obj is {
  _seconds?: number;
  seconds?: number;
  _nanoseconds?: number;
  nanoseconds?: number;
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (('_seconds' in obj && '_nanoseconds' in obj) || ('seconds' in obj && 'nanoseconds' in obj))
  );
}

function isDate(obj: unknown): obj is Date {
  return Object.prototype.toString.call(obj) === '[object Date]';
}

interface MassCalendarProps {
  events?: MassEventCalendar[];
  highlightServerName?: string;
  onDayClick?: (date: Date, eventId?: string) => void;
  timezone?: string; // ex) "Asia/Seoul"
}

export default function MassCalendar({
  events = [],
  highlightServerName,
  onDayClick,
  timezone = 'Asia/Seoul',
}: MassCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().tz(timezone).startOf('month'));

  const startOfMonth = currentMonth.startOf('month');
  const endOfMonth = currentMonth.endOf('month');
  const daysInMonth = endOfMonth.date();
  const startDay = startOfMonth.day();

  // ✅ 날짜별 이벤트 그룹화
  const eventsByDate: Record<string, MassEventCalendar[]> = {};
  events.forEach((event) => {
    let eventDate;
    if (isFirestoreTimestamp(event.date) || isDate(event.date) || typeof event.date === 'string') {
      eventDate = toLocalDateFromFirestore(event.date, timezone);
    } else {
      console.warn('⚠️ Unknown date format:', event);
      return;
    }
    const key = eventDate.format('YYYY-MM-DD');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  const cells: JSX.Element[] = [];
  for (let i = 0; i < startDay; i++) {
    cells.push(<div key={`empty-${i}`} className="p-3" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = eventsByDate[dateStr] || [];
    const hasEvents = dayEvents.length > 0;
    const isToday = dayjs().tz(timezone).isSame(date, 'day');
    const isSunday = date.day() === 0;
    const isSaturday = date.day() === 6;

    cells.push(
      <div
        key={dateStr}
        onClick={() => hasEvents && onDayClick?.(date.toDate())}
        className={cn(
          'border rounded-xl p-2 min-h-[90px] transition-all duration-200 flex flex-col justify-start',
          isToday && 'bg-blue-100 border-blue-300 shadow-inner',
          isSunday && 'border-red-300 dark:border-red-400',
          !isSunday && !isSaturday && hasEvents && 'hover:bg-blue-50 dark:hover:bg-gray-700',
          !hasEvents && 'bg-gray-50 dark:bg-gray-800 opacity-60 cursor-default'
        )}
      >
        {/* 날짜 숫자 */}
        <div
          className={cn(
            'text-xs font-semibold mb-1',
            isSunday
              ? 'text-red-500 font-bold'
              : isSaturday
              ? 'text-blue-500 font-bold'
              : hasEvents
              ? 'text-gray-600 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-500'
          )}
        >
          {d}
        </div>

        {/* 미사 일정 카드 */}
        <div className="flex flex-col gap-1">
          {dayEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={(e) => {
                e.stopPropagation();
                onDayClick?.(date.toDate(), ev.id);
              }}
              className="mt-1 p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 
               dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 
               flex flex-col justify-between transition-all duration-200"
            >
              {/* 🔹 상단: 미사명 + 상태 아이콘 */}
              <div className="flex justify-between items-start">
                <div className="text-xs font-normal leading-tight text-gray-900 dark:text-gray-100">
                  {ev.title}
                  {ev.required_servers ? (
                    <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                      ({ev.required_servers}명)
                    </span>
                  ) : null}
                </div>

                {/* 🔹 상태 아이콘 (예: 미확정/확정) */}
                <div className="flex items-center">
                  {ev.status === 'MASS-NOTCONFIRMED' && (
                    <i className="lucide lucide-clock text-gray-500 w-4 h-4" />
                  )}
                  {ev.status === 'MASS-CONFIRMED' && (
                    <i className="lucide lucide-lock text-blue-500 w-4 h-4" />
                  )}
                  {ev.status === 'FINAL-CONFIRMED' && (
                    <i className="lucide lucide-lock text-green-500 w-4 h-4" />
                  )}
                </div>
              </div>

              {/* 🔹 복사명 (2줄 정도) */}
              <div className="mt-1 space-y-1">
                {(ev.servers || []).map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      'px-2 py-1 text-xs rounded-md bg-gray-200 text-gray-800',
                      highlightServerName === s && 'font-bold text-blue-700 bg-blue-100'
                    )}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Container>
      <Card className="fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-4">
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

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 gap-2 mt-2">{cells}</div>
      </Card>
    </Container>
  );
}
