import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

interface MassCalendarProps {
  parishId: string;
  readOnly?: boolean; // 복사 페이지에서는 true
  onSelectEvent?: (eventId: string) => void; // ✅ 날짜 클릭 시 이벤트 선택
}

interface MassEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string; // 미사명
  servers: string[]; // 배정된 복사 이름 리스트
  status:
    | "MASS-NOTCONFIRMED"
    | "MASS-CONFIRMED"
    | "SURVEY-CONFIRMED"
    | "FINAL-CONFIRMED";
  month?: number;
}

export default function MassCalendar({
  parishId,
  readOnly,
  onSelectEvent,
}: MassCalendarProps) {
  const [events, setEvents] = useState<MassEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    async function fetchEvents() {
      const q = query(
        collection(db, "parishes", parishId, "mass_events"),
        where("month", "==", currentMonth.getMonth() + 1)
      );
      const snap = await getDocs(q);
      const data: MassEvent[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MassEvent[];
      setEvents(data);
    }
    fetchEvents();
  }, [parishId, currentMonth]);

  // === 달력 계산 ===
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0)
    weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  function getEventsForDay(day: number | null) {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    return events.filter((ev) => ev.date === dateStr);
  }

  function statusColor(status: MassEvent["status"]) {
    switch (status) {
      case "MASS-NOTCONFIRMED":
        return "bg-blue-200 dark:bg-blue-700 dark:text-white";
      case "MASS-CONFIRMED":
        return "bg-orange-200 dark:bg-orange-700 dark:text-white";
      case "SURVEY-CONFIRMED":
        return "bg-sky-200 dark:bg-sky-700 dark:text-white";
      case "FINAL-CONFIRMED":
        return "bg-green-200 dark:bg-green-700 dark:text-white";
      default:
        return "bg-gray-100 dark:bg-gray-700 dark:text-white";
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 dark:text-gray-100">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded"
        >
          ◀
        </button>
        <h2 className="text-lg font-semibold">
          {year}년 {month + 1}월
        </h2>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded"
        >
          ▶
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-2 text-center font-medium">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-2 mt-2">
        {weeks.flat().map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={idx}
              className={`border rounded p-1 text-xs relative transition 
                ${
                  day
                    ? "bg-white dark:bg-gray-800"
                    : "bg-gray-50 dark:bg-gray-700"
                } 
                ${
                  !readOnly && day
                    ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    : ""
                }
                h-20 sm:h-24 md:h-28 lg:h-32
              `}
              onClick={() => {
                if (!day || readOnly) return;
                if (dayEvents.length > 0) {
                  // ✅ 이벤트가 있으면 첫번째 이벤트 선택
                  onSelectEvent?.(dayEvents[0].id);
                }
              }}
            >
              <div className="text-right font-semibold">{day || ""}</div>
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`mt-1 rounded px-1 truncate ${statusColor(
                    ev.status
                  )}`}
                >
                  <div>{ev.title}</div>
                  <div className="text-[10px] truncate">
                    {ev.servers?.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
