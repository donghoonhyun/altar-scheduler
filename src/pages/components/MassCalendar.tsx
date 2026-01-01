import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button, Card, Container, Heading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { MassEventCalendar } from '@/types/massEvent';
import type { MassStatus } from '@/types/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

interface MassCalendarProps {
  events?: MassEventCalendar[];
  highlightServerName?: string;
  onDayClick?: (date: Date, eventId?: string) => void;
  onMonthChange?: (month: dayjs.Dayjs) => void;
  timezone?: string;
  monthStatus?: MassStatus;
  onOpenMonthStatusDrawer?: () => void;
  selectedEventId?: string;
  viewDate?: dayjs.Dayjs; // ✅ Controlled Prop
}

export default function MassCalendar({
  events = [],
  onDayClick,
  onMonthChange,
  timezone = 'Asia/Seoul',
  monthStatus,
  onOpenMonthStatusDrawer,
  selectedEventId,
  viewDate,
}: MassCalendarProps) {
  // Internal state for uncontrolled usage
  const [internalDate, setInternalDate] = useState(dayjs().tz(timezone).startOf('month'));
  
  // Use prop if available, otherwise internal state
  const currentMonth = viewDate || internalDate;

  const today = dayjs().tz(timezone).format('YYYY-MM-DD');
  const startOfMonth = currentMonth.startOf('month');
  const endOfMonth = currentMonth.endOf('month');
  const daysInMonth = endOfMonth.date();
  const startDay = startOfMonth.day();

  // ❌ Remove useEffect loop trigger
  // useEffect(() => {
  //   onMonthChange?.(currentMonth);
  // }, [currentMonth, onMonthChange]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const newDate = currentMonth.subtract(1, 'month');
    setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  const handleNextMonth = () => {
    const newDate = currentMonth.add(1, 'month');
    setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  const handleToday = () => {
    const newDate = dayjs().tz(timezone).startOf('month');
    setInternalDate(newDate);
    onMonthChange?.(newDate);
  };

  // ... (rest of the component)

  const eventsByDate: Record<string, MassEventCalendar[]> = {};
  events.forEach((event) => {
    const eventDate = dayjs.tz(event.event_date, 'YYYYMMDD', timezone);
    const key = eventDate.format('YYYY-MM-DD');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  const cells: JSX.Element[] = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`empty-${i}`} className="p-3" />);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = eventsByDate[dateStr] || [];
    // ✅ Sort events by title (text ascending)
    dayEvents.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const isSunday = date.day() === 0;
    const isSaturday = date.day() === 6;
    const isToday = dateStr === today;

    cells.push(
      <div
        key={dateStr}
        onClick={() => onDayClick?.(date.toDate())}
        className={cn(
          'border rounded-xl p-1 md:p-2 min-h-[70px] md:min-h-[120px] flex flex-col justify-start transition-all duration-200 cursor-pointer hover:shadow-md',
          isSunday
            ? 'bg-pink-50 dark:bg-pink-900/20'
            : isSaturday
            ? 'bg-sky-50 dark:bg-sky-900/20'
            : 'bg-white dark:bg-gray-800',
          isToday && '!border-blue-400 ring-2 ring-blue-300 shadow-sm'
        )}
      >
        {/* ... content ... */}
        <div
          className={cn(
            'text-xs font-semibold mb-1 text-center md:text-left',
            isSunday
              ? 'text-red-500 dark:text-red-400'
              : isSaturday
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300'
          )}
        >
          {d}
        </div>

        {/* [Mobile] Dot View */}
        <div className="flex md:hidden flex-wrap gap-1 justify-center content-start">
          {dayEvents.map((ev) => {
             const assignedCount = ev.servers?.length || 0;
             const requiredCount = ev.required_servers || 0;
             const isFulfilled = assignedCount === requiredCount;
             
             return (
               <div 
                 key={`mob-${ev.id}`}
                 className={cn(
                   "w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm ring-1 ring-white/50",
                   isFulfilled ? "bg-green-400" : "bg-red-400",
                   selectedEventId === ev.id && "ring-2 ring-amber-400 scale-110 z-10"
                 )}
                 onClick={(e) => {
                    e.stopPropagation();
                    onDayClick?.(date.toDate(), ev.id);
                 }}
               >
                 {requiredCount}
               </div>
             );
          })}
        </div>

        {/* [Desktop] Card View */}
        <div className="hidden md:flex flex-col gap-1 w-full">
          {dayEvents.map((ev) => {
            const assignedCount = ev.servers?.length || 0;
            const requiredCount = ev.required_servers || 0;
            const isFulfilled = assignedCount === requiredCount;

            return (
              <div
                key={ev.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick?.(date.toDate(), ev.id);
                }}
                className={cn(
                  "p-2 rounded-lg border flex flex-col gap-1 transition-all duration-200 w-full",
                  !isFulfilled 
                    ? "bg-red-200 border-red-400 hover:bg-red-300 dark:bg-red-800/60 dark:border-red-600"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600",
                  
                  selectedEventId === ev.id && 
                    "border-amber-500 ring-2 ring-amber-200 dark:border-amber-400"
                )}
              >
                <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                  {ev.title}
                  {ev.required_servers && (
                    <span className={cn("ml-1 text-[10px]", !isFulfilled ? "text-red-600 font-bold" : "text-gray-500")}>
                      ({assignedCount}/{ev.required_servers}명)
                    </span>
                  )}
                </div>

              {/* 복사명 */}
              {ev.servers && ev.servers.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {ev.servers.slice(0, 3).map((s, i) => {
                    const memberId = ev.member_ids?.[i];
                    const isMain = memberId && memberId === ev.main_member_id;

                    return (
                      <span
                        key={i}
                        className={cn(
                          "px-2 py-[1px] text-[11px] rounded-md truncate max-w-[80px]",
                          isMain 
                            ? "bg-blue-500 text-white dark:bg-blue-600" 
                            : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100"
                        )}
                        title={s}
                      >
                        {s}
                      </span>
                    );
                  })}
                  {ev.servers.length > 3 && (
                    <span className="text-[10px] text-gray-500">+{ev.servers.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Container>
      <Card className="fade-in">
        {/* ✅ 상단 헤더 : 년월 + '오늘' 버튼 + 상태배지 + 범례 */}
        <div className="flex justify-between items-center mb-3 gap-2">
          {/* 왼쪽: 년월 + 오늘 버튼 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
            >
              <ChevronLeft size={16} />
            </Button>

            <Heading size="sm" className="text-gray-800 dark:text-gray-100 whitespace-nowrap">
              <span className="md:hidden">{currentMonth.format('M월')}</span>
              <span className="hidden md:inline">{currentMonth.format('YYYY년 M월')}</span>
            </Heading>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
            >
              <ChevronRight size={16} />
            </Button>

            {/* ▶ 오늘 버튼 (작게 조정) */}
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] px-2 py-0 h-6 ml-1 whitespace-nowrap"
              onClick={handleToday}
            >
              <CalendarDays size={12} className="mr-1 hidden md:block" /> 오늘
            </Button>
          </div>

          {/* 오른쪽: 상태배지 + 범례 */}
          <div className="flex items-center gap-3">
            <div onClick={onOpenMonthStatusDrawer} className="cursor-pointer whitespace-nowrap">
              <StatusBadge status={monthStatus} size="md" />
            </div>

            <div className="hidden md:flex text-[11px] text-gray-500 gap-2">
              <span className="flex items-center gap-1">
                (⏱️ <span className="text-gray-500">미확정</span>
              </span>
              <span className="flex items-center gap-1">
                🔒 <span className="text-blue-500">확정됨</span>
              </span>
              <span className="flex items-center gap-1">
                🗳️ <span className="text-amber-500">설문마감</span>
              </span>
              <span className="flex items-center gap-1">
                🛡️ <span className="text-green-500">최종확정</span>)
              </span>
            </div>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div
              key={d}
              className={cn(
                i === 0
                  ? 'text-red-500 dark:text-red-400'
                  : i === 6
                  ? 'text-blue-500 dark:text-blue-400'
                  : ''
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 gap-2 mt-2">{cells}</div>
      </Card>
    </Container>
  );
}
