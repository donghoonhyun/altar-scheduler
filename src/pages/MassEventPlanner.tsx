// ✅ src/pages/MassEventPlanner.tsx (최종 버전)
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { toast } from 'sonner';

import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import MonthStatusDrawer from './components/MonthStatusDrawer';
import ApplyPresetDrawer from './components/ApplyPresetDrawer';
import ConfirmMassDrawer from './components/ConfirmMassDrawer';
import { SendSurveyDrawer } from '@/components/SendSurveyDrawer';
import CloseSurveyDrawer from './components/CloseSurveyDrawer';
import AutoAssignDrawer from './components/AutoAssignDrawer';
import { useMassEvents } from '@/hooks/useMassEvents';
import { useMonthStatus } from '@/hooks/useMonthStatus';
import type { MassEventCalendar } from '@/types/massEvent';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { MassEventToolbar } from '@/components/MassEventToolbar';

dayjs.extend(weekOfYear);

const MassEventPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const db = getFirestore();
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const monthKey = currentMonth.format('YYYYMM');

  const {
    status: monthStatus,
    lock: isLocked,
    updateStatus,
    loading: statusLoading,
  } = useMonthStatus(serverGroupId, monthKey);

  const { events } = useMassEvents(serverGroupId, currentMonth) as {
    events: MassEventCalendar[];
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [monthStatusDrawerOpen, setMonthStatusDrawerOpen] = useState(false);
  const [applyPresetDrawerOpen, setApplyPresetDrawerOpen] = useState(false);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [surveyDrawerOpen, setSurveyDrawerOpen] = useState(false);
  const [closeSurveyDrawerOpen, setCloseSurveyDrawerOpen] = useState(false);
  const [autoAssignDrawerOpen, setAutoAssignDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /** ✅ 날짜 클릭 시 Drawer 열기 */
  const handleDayClick = (date: Date, eventId?: string) => {
    setSelectedDate(date);  // Always set the date
    if (eventId) {
      setSelectedEventId(eventId);
    } else {
      setSelectedEventId(undefined);
    }
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    // setSelectedEventId(undefined); // 하이라이트 유지를 위해 주석 처리
    // setSelectedDate(null); // 하이라이트 유지를 위해 주석 처리
  };



  /** ✅ 상태 변경 드로어 동작 */
  const handleConfirmMass = async () => {
    await updateStatus('MASS-CONFIRMED', 'planner@test.com');
    toast.success('📘 미사 일정이 확정되었습니다.');
  };
  const handleCloseSurvey = async () => {
    await updateStatus('SURVEY-CONFIRMED', 'planner@test.com');
    toast.success('📊 설문이 종료되었습니다.');
  };
  const handleAutoAssign = async () => {
    await updateStatus('FINAL-CONFIRMED', 'planner@test.com');
    toast.success('✅ 자동배정이 완료되고 최종 확정되었습니다.');
  };

  /** ✅ 툴바 버튼 활성화 조건 */
  const isCopyEnabled =
    currentMonth.isSame(dayjs(), 'month') || currentMonth.isSame(dayjs().add(1, 'month'), 'month');

  if (statusLoading) return <LoadingSpinner label="월 상태 로딩 중..." />;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
          <ArrowLeft size={24} />
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2">📅 미사 일정 관리</h2>
      </div>

      {/* ✅ Toolbar */}
      <MassEventToolbar
        monthStatus={monthStatus}
        isLocked={isLocked}
        isCopyEnabled={isCopyEnabled}
        onApplyPreset={() => setApplyPresetDrawerOpen(true)}
        onConfirmMass={() => setConfirmDrawerOpen(true)}
        onOpenSurvey={() => setSurveyDrawerOpen(true)}
        onCloseSurvey={() => setCloseSurveyDrawerOpen(true)}
        onAutoAssign={() => setAutoAssignDrawerOpen(true)}
        onOpenMonthStatus={() => setMonthStatusDrawerOpen(true)}
      />

      {loading && <LoadingSpinner label="전월 데이터 복사 중..." />}

      {/* ✅ Calendar */}
      <MassCalendar
        events={events}
        timezone="Asia/Seoul"
        onDayClick={handleDayClick}
        onMonthChange={(newMonth) => setCurrentMonth(newMonth)}
        monthStatus={monthStatus}
        onOpenMonthStatusDrawer={() => setMonthStatusDrawerOpen(true)}
        selectedEventId={selectedEventId}
      />

      {/* ✅ Drawer 연결 */}
      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={handleCloseDrawer}
          monthStatus={monthStatus}
        />
      )}

      <ApplyPresetDrawer
        open={applyPresetDrawerOpen}
        onClose={() => setApplyPresetDrawerOpen(false)}
        onConfirm={async () => {
          // 필요시 추가 로직
          setCurrentMonth(currentMonth.clone()); // 강제 리렌더
        }}
        serverGroupId={serverGroupId!}
        currentMonth={currentMonth}
      />

      <ConfirmMassDrawer
        open={confirmDrawerOpen}
        onClose={() => setConfirmDrawerOpen(false)}
        onConfirm={handleConfirmMass}
      />

      <SendSurveyDrawer
        open={surveyDrawerOpen}
        onClose={() => setSurveyDrawerOpen(false)}
        serverGroupId={serverGroupId!}
        currentMonth={monthKey}
        monthStatus={monthStatus}
      />

      <CloseSurveyDrawer
        open={closeSurveyDrawerOpen}
        onClose={() => setCloseSurveyDrawerOpen(false)}
        onConfirm={handleCloseSurvey}
      />

      <AutoAssignDrawer
        open={autoAssignDrawerOpen}
        onClose={() => setAutoAssignDrawerOpen(false)}
        onConfirm={handleAutoAssign}
      />

      {monthStatusDrawerOpen && (
        <MonthStatusDrawer
          open={monthStatusDrawerOpen}
          onClose={() => setMonthStatusDrawerOpen(false)}
          serverGroupId={serverGroupId!}
          currentMonth={currentMonth}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
