import { useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { MassEventCalendar } from '../../types/massEvent';
import { toLocalDateFromFirestore } from '../../lib/firestore';

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

// ✅ Date 객체 타입 가드
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

  // ✅ 날짜별 이벤트 그룹화 (timezone 반영)
  const eventsByDate: Record<string, MassEventCalendar[]> = {};
  events.forEach((event) => {
    // console.log('📅 event:', event.id, event.date);
    let eventDate;

    if (isFirestoreTimestamp(event.date)) {
      eventDate = toLocalDateFromFirestore(event.date, timezone);
    } else if (typeof event.date === 'string') {
      eventDate = toLocalDateFromFirestore(event.date, timezone);
    } else if (isDate(event.date)) {
      eventDate = toLocalDateFromFirestore(event.date, timezone);
    } else {
      console.warn('⚠️ Unknown date format in event:', event);
      return;
    }

    const key = eventDate.format('YYYY-MM-DD');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  const weeks: JSX.Element[][] = [];
  let current: JSX.Element[] = [];

  // ✅ 앞쪽 빈칸
  for (let i = 0; i < startDay; i++) {
    current.push(<td key={`empty-${i}`} className="p-2 border" />);
  }

  // ✅ 날짜 채우기
  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = eventsByDate[dateStr] || [];

    current.push(
      <td
        key={dateStr}
        className="p-2 border align-top text-sm bg-white hover:bg-gray-100 cursor-pointer"
        onClick={() => onDayClick?.(date.toDate())}
      >
        <div className="font-semibold">{d}</div>
        {dayEvents.map((ev) => (
          <div
            key={ev.id}
            className="mt-1 px-2 py-1 rounded text-xs bg-blue-100 hover:bg-blue-200"
            onClick={(e) => {
              e.stopPropagation();
              onDayClick?.(date.toDate(), ev.id);
            }}
          >
            <span className="font-medium">
              {ev.title}{' '}
              {ev.required_servers ? (
                <span className="text-gray-600 text-[11px] font-normal">
                  ({ev.required_servers}명)
                </span>
              ) : null}
            </span>
            <br />
            {(ev.servers || []).map((s, i) => (
              <span
                key={i}
                className={`mr-1 ${
                  highlightServerName === s ? 'font-bold text-red-600 underline' : ''
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        ))}
      </td>
    );

    if ((startDay + d) % 7 === 0 || d === daysInMonth) {
      weeks.push(current);
      current = [];
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <button
          className="px-2 py-1 rounded bg-gray-200"
          onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
        >
          ◀
        </button>
        <span className="font-semibold">{currentMonth.format('YYYY년 MM월')}</span>
        <button
          className="px-2 py-1 rounded bg-gray-200"
          onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
        >
          ▶
        </button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <th key={d} className="p-2 border text-center text-sm font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>{week}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
