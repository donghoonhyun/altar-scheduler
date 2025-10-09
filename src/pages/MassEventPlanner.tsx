import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import { useMassEvents } from '@/hooks/useMassEvents';
import type { MassEventCalendar } from '@/types/massEvent';
import type { MassStatus } from '@/types/firestore';

/**
 * 🗓️ MassEventPlanner
 * ------------------------------------------------------
 * PRD-2.4.8 기준:
 *  - 특정 복사단(serverGroupId)의 미사일정을 월단위로 표시
 *  - 실시간(onSnapshot) 반영
 *  - Drawer를 통한 미사 추가/수정/삭제
 *  - MassStatus 타입 일관성 유지
 * ------------------------------------------------------
 */

const MassEventPlanner: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();

  // ✅ useMassEvents 훅은 내부에서 Firestore onSnapshot으로 실시간 데이터를 반환
  const { events } = useMassEvents(serverGroupId) as {
    events: MassEventCalendar[] & { status?: MassStatus };
  };

  // Drawer 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // ✅ 달력 날짜 클릭 → Drawer 열기
  const handleDayClick = (date: Date, eventId?: string) => {
    if (eventId) {
      // 기존 일정 수정
      setSelectedEventId(eventId);
      setSelectedDate(null);
    } else {
      // 신규 일정 등록
      setSelectedEventId(undefined);
      setSelectedDate(date);
    }
    setDrawerOpen(true);
  };

  // ✅ Drawer 닫기 (일괄 초기화)
  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedEventId(undefined);
    setSelectedDate(null);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">📅 미사 일정 관리</h2>

      {/* ✅ 실시간 미사 일정 표시 */}
      <MassCalendar
        events={events}
        onDayClick={handleDayClick}
        timezone="Asia/Seoul" // (PRD 2.4.2.3 fallback)
      />

      {/* ✅ Drawer - 일정 추가/수정 */}
      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
