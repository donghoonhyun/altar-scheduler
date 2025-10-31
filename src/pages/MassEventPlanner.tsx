// ✅ src/pages/MassEventPlanner.tsx (최종 버전)
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
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
import CopyPrevMonthDrawer from './components/CopyPrevMonthDrawer';
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
  const [copyDrawerOpen, setCopyDrawerOpen] = useState(false);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [surveyDrawerOpen, setSurveyDrawerOpen] = useState(false);
  const [closeSurveyDrawerOpen, setCloseSurveyDrawerOpen] = useState(false);
  const [autoAssignDrawerOpen, setAutoAssignDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  /** ✅ 날짜 클릭 시 Drawer 열기 */
  const handleDayClick = (date: Date, eventId?: string) => {
    if (eventId) {
      setSelectedEventId(eventId);
      setSelectedDate(null);
    } else {
      setSelectedEventId(undefined);
      setSelectedDate(date);
    }
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedEventId(undefined);
    setSelectedDate(null);
  };

  /** ✅ 전월 미사일정 복사 로직 (event_date 기준) */
  const handleCopyPrevMonth = async () => {
    if (!serverGroupId) return;
    try {
      setLoading(true);
      const prevMonth = currentMonth.subtract(1, 'month');

      const currMonthKey = currentMonth.format('YYYYMM');
      const prevMonthKey = prevMonth.format('YYYYMM');

      const currStart = `${currMonthKey}01`;
      const currEnd = `${currMonthKey}31`;
      const prevStart = `${prevMonthKey}01`;
      const prevEnd = `${prevMonthKey}31`;

      // ✅ 현재 월 일정 삭제
      const currQuery = query(
        collection(db, `server_groups/${serverGroupId}/mass_events`),
        where('event_date', '>=', currStart),
        where('event_date', '<=', currEnd)
      );
      const currSnap = await getDocs(currQuery);
      const batch = writeBatch(db);
      currSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      // ✅ 전월 일정 조회
      const prevQuery = query(
        collection(db, `server_groups/${serverGroupId}/mass_events`),
        where('event_date', '>=', prevStart),
        where('event_date', '<=', prevEnd)
      );
      const prevSnap = await getDocs(prevQuery);
      if (prevSnap.empty) {
        toast.warning('⚠️ 전월 미사일정이 존재하지 않습니다.');
        setLoading(false);
        return;
      }

      // ✅ 주차·요일 기준으로 복사
      prevSnap.forEach((snap) => {
        const ev = snap.data();
        const prevDate = dayjs(ev.event_date, 'YYYYMMDD');
        const newDate = currentMonth
          .startOf('month')
          .add(prevDate.week() - prevMonth.startOf('month').week(), 'week')
          .day(prevDate.day());

        const newEventDate = newDate.format('YYYYMMDD');

        batch.set(doc(collection(db, `server_groups/${serverGroupId}/mass_events`)), {
          title: ev.title,
          event_date: newEventDate,
          required_servers: ev.required_servers,
          member_ids: [],
          created_at: new Date(),
          updated_at: new Date(),
        });
      });

      await batch.commit();
      toast.success('✅ 전월 미사일정이 복사되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('전월 미사일정 복사 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
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
      <h2 className="text-xl font-bold flex items-center gap-2 mb-4">📅 미사 일정 관리</h2>

      {/* ✅ Toolbar */}
      <MassEventToolbar
        monthStatus={monthStatus}
        isLocked={isLocked}
        isCopyEnabled={isCopyEnabled}
        onCopyPrevMonth={() => setCopyDrawerOpen(true)}
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
      />

      {/* ✅ Drawer 연결 */}
      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={handleCloseDrawer}
        />
      )}

      <CopyPrevMonthDrawer
        open={copyDrawerOpen}
        onClose={() => setCopyDrawerOpen(false)}
        onConfirm={handleCopyPrevMonth}
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
