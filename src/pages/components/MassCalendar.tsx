// src/pages/components/MassCalendar.tsx
import { useState } from 'react';
import dayjs from 'dayjs'; // npm install dayjs 필요

interface MassEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  servers: string[];
}

interface MassCalendarProps {
  events?: MassEvent[];
  highlightServerName?: string; // 본인 이름 강조용
  onDayClick?: (date: Date) => void; // ✅ 날짜 클릭 콜백 추가
}

export default function MassCalendar({
  events = [],
  highlightServerName,
  onDayClick,
}: MassCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));

  const startOfMonth = currentMonth.startOf('month');
  const endOfMonth = currentMonth.endOf('month');
  const daysInMonth = endOfMonth.date();

  // 1일의 요일 (0=일요일)
  const startDay = startOfMonth.day();

  // 해당 월 이벤트 매핑
  const eventsByDate: Record<string, MassEvent[]> = {};
  events.forEach((event) => {
    const key = dayjs(event.date).format('YYYY-MM-DD');
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  const weeks: JSX.Element[][] = [];
  let current: JSX.Element[] = [];

  // 빈칸 (앞쪽)
  for (let i = 0; i < startDay; i++) {
    current.push(<td key={`empty-${i}`} className="p-2 border" />);
  }

  // 날짜 채우기
  for (let d = 1; d <= daysInMonth; d++) {
    const date = currentMonth.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = eventsByDate[dateStr] || [];

    current.push(
      <td
        key={dateStr}
        className="p-2 border align-top text-sm bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-100"
        onClick={() => onDayClick?.(date.toDate())} // ✅ 날짜 클릭 시 콜백 실행
      >
        <div className="font-semibold">{d}</div>
        {dayEvents.map((ev) => {
          // ✅ 본인이 포함된 이벤트인지 여부
          const isMine = highlightServerName && ev.servers.includes(highlightServerName);

          return (
            <div
              key={ev.id}
              className={`mt-1 px-2 py-1 rounded text-xs ${
                isMine ? 'bg-yellow-200 border border-yellow-500' : 'bg-blue-100 dark:bg-blue-700'
              }`}
            >
              <span className="font-medium">{ev.title}</span>
              <br />
              {ev.servers.map((s, i) => (
                <span
                  key={i}
                  className={`mr-1 ${
                    highlightServerName === s
                      ? 'font-bold text-red-600 dark:text-red-300 underline'
                      : ''
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          );
        })}
      </td>
    );

    if ((startDay + d) % 7 === 0 || d === daysInMonth) {
      weeks.push(current);
      current = [];
    }
  }

  return (
    <div>
      {/* 달 이동 컨트롤 */}
      <div className="flex justify-between items-center mb-2">
        <button
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
          onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
        >
          ◀
        </button>
        <span className="font-semibold">{currentMonth.format('YYYY년 MM월')}</span>
        <button
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
          onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
        >
          ▶
        </button>
      </div>

      {/* 달력 표 */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700">
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
