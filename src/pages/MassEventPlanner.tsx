// src/pages/MassEventPlanner.tsx
import React, { useState } from 'react';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';

const MassEventPlanner: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 날짜 클릭 시 Drawer 열기
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDrawerOpen(true);
  };

  return (
    <div className="p-4">
      {/* 제목 */}
      <h2 className="text-xl font-bold mb-4">미사 일정 관리</h2>

      {/* 버튼 영역 */}
      <div className="space-x-2 mb-4">
        <button className="px-3 py-1 bg-gray-300 rounded">전월 복사</button>
        <button className="px-3 py-1 bg-green-500 text-white rounded">일정 확정</button>
        <button className="px-3 py-1 bg-red-500 text-white rounded">확정 취소</button>
        <button className="px-3 py-1 bg-blue-500 text-white rounded">설문링크 복사</button>
        <button className="px-3 py-1 bg-purple-500 text-white rounded">자동 배정</button>
      </div>

      {/* 달력 */}
      <MassCalendar
        onDayClick={handleDayClick} // 📌 날짜 클릭 이벤트 연결
      />

      {/* Drawer */}
      {drawerOpen && <MassEventDrawer date={selectedDate} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
};

export default MassEventPlanner;
