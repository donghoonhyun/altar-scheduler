import { useState } from 'react';
import { useParams } from 'react-router-dom';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import { useMassEvents } from '@/hooks/useMassEvents';

const MassEventPlanner: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const { events, refetch } = useMassEvents(serverGroupId);

  // ✅ Drawer 상태 관리
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // ✅ 날짜 클릭 핸들러
  const handleDayClick = (date: Date, eventId?: string) => {
    if (eventId) {
      // 기존 이벤트 클릭 → 수정 모드
      setSelectedEventId(eventId);
      setSelectedDate(null);
    } else {
      // 빈 날짜 클릭 → 새 미사 등록 모드
      setSelectedEventId(undefined);
      setSelectedDate(date);
    }
    setDrawerOpen(true);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">미사 일정 관리</h2>

      {/* ✅ 달력 */}
      <MassCalendar events={events} onDayClick={handleDayClick} />

      {/* ✅ Drawer */}
      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={() => {
            setDrawerOpen(false);
            refetch(); // ✅ 데이터 새로고침
          }}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
