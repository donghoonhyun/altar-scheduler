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
import { Button } from '@/components/ui/button';
import { Copy, Lock, Send, StopCircle, Repeat, Settings } from 'lucide-react';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import MonthStatusDrawer from './components/MonthStatusDrawer';
import CopyPrevMonthDrawer from './components/CopyPrevMonthDrawer';
import ConfirmMassDrawer from './components/ConfirmMassDrawer';
import SendSurveyDrawer from './components/SendSurveyDrawer';
import CloseSurveyDrawer from './components/CloseSurveyDrawer';
import AutoAssignDrawer from './components/AutoAssignDrawer';
import { useMassEvents } from '@/hooks/useMassEvents';
import { useMonthStatus } from '@/hooks/useMonthStatus';
import { fromLocalDateToFirestore, toLocalDateFromFirestore } from '@/lib/dateUtils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { MassEventCalendar } from '@/types/massEvent';
import LoadingSpinner from '@/components/common/LoadingSpinner';

dayjs.extend(weekOfYear);

const MassEventPlanner: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const db = getFirestore();

  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const monthKey = currentMonth.format('YYYYMM');

  // ✅ 월 상태 (month_status/{yyyymm})
  const {
    status: monthStatus,
    lock: isLocked,
    updateStatus,
    loading: statusLoading,
  } = useMonthStatus(serverGroupId, monthKey);

  // ✅ 실시간 미사 일정
  const { events } = useMassEvents(serverGroupId) as {
    events: MassEventCalendar[];
  };

  // ✅ Drawer 상태
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

  /** ✅ 날짜 클릭 → Drawer 열기 */
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
  const handleCloseMonthDrawer = () => setMonthStatusDrawerOpen(false);

  /** 🔹 전월 미사일정 복사 */
  const handleCopyPrevMonth = async () => {
    if (!serverGroupId) return;
    try {
      setLoading(true);
      const tz = 'Asia/Seoul';
      const prevMonth = currentMonth.subtract(1, 'month');

      // 현재 월 일정 삭제
      const currQuery = query(
        collection(db, `server_groups/${serverGroupId}/mass_events`),
        where('date', '>=', fromLocalDateToFirestore(currentMonth.startOf('month'), tz)),
        where('date', '<=', fromLocalDateToFirestore(currentMonth.endOf('month'), tz))
      );
      const currSnap = await getDocs(currQuery);
      const batch = writeBatch(db);
      currSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      // 전월 일정 조회
      const prevQuery = query(
        collection(db, `server_groups/${serverGroupId}/mass_events`),
        where('date', '>=', fromLocalDateToFirestore(prevMonth.startOf('month'), tz)),
        where('date', '<=', fromLocalDateToFirestore(prevMonth.endOf('month'), tz))
      );
      const prevSnap = await getDocs(prevQuery);
      if (prevSnap.empty) {
        toast.warning('⚠️ 전월 미사일정이 존재하지 않습니다.');
        setLoading(false);
        return;
      }

      // 복사 로직
      prevSnap.forEach((snap) => {
        const ev = snap.data();
        const prevDate = toLocalDateFromFirestore(ev.date, tz);
        const newDate = currentMonth
          .startOf('month')
          .add(prevDate.week() - prevMonth.startOf('month').week(), 'week')
          .day(prevDate.day());
        batch.set(doc(collection(db, `server_groups/${serverGroupId}/mass_events`)), {
          title: ev.title,
          date: fromLocalDateToFirestore(newDate, tz),
          required_servers: ev.required_servers,
          member_ids: [],
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
      await batch.commit();
      toast.success('✅ 전월 미사일정이 복사되었습니다.');
    } catch {
      toast.error('전월 미사일정 복사 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /** 🔹 미사 일정 확정 */
  const handleConfirmMass = async () => {
    await updateStatus('MASS-CONFIRMED', 'planner@test.com');
    toast.success('📘 미사 일정이 확정되었습니다.');
  };

  /** 🔹 설문 종료 */
  const handleCloseSurvey = async () => {
    await updateStatus('SURVEY-CONFIRMED', 'planner@test.com');
    toast.success('📊 설문이 종료되었습니다.');
  };

  /** 🔹 자동 배정 (최종 확정) */
  const handleAutoAssign = async () => {
    await updateStatus('FINAL-CONFIRMED', 'planner@test.com');
    toast.success('✅ 자동배정이 완료되고 최종 확정되었습니다.');
  };

  /** 🔹 버튼 활성화 조건 */
  const isCopyEnabled =
    currentMonth.isSame(dayjs(), 'month') || currentMonth.isSame(dayjs().add(1, 'month'), 'month');

  if (statusLoading) return <LoadingSpinner label="월 상태 로딩 중..." />;

  return (
    <div className="p-4">
      {/* ✅ 상단 헤더 : 제목은 왼쪽, 상태/년월은 중앙 쪽 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">📅 미사 일정 관리</h2>

        {/* 상태+년월 카드 — 가운데 정렬 느낌으로 살짝 안쪽으로 */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-5 py-2 shadow-sm">
          <StatusBadge status={monthStatus} size="lg" />
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            {currentMonth.format('YYYY년 M월')}
          </span>
        </div>
      </div>

      {/* ✅ Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={!isCopyEnabled}
          onClick={() => setCopyDrawerOpen(true)}
        >
          <Copy className="w-4 h-4 mr-1" /> 전월 미사일정 복사
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={monthStatus !== 'MASS-NOTCONFIRMED' || isLocked}
          onClick={() => setConfirmDrawerOpen(true)}
        >
          <Lock className="w-4 h-4 mr-1" /> 미사 일정 확정
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={monthStatus !== 'MASS-CONFIRMED'}
          onClick={() => setSurveyDrawerOpen(true)}
        >
          <Send className="w-4 h-4 mr-1" /> 설문 링크 보내기
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={monthStatus !== 'MASS-CONFIRMED'}
          onClick={() => setCloseSurveyDrawerOpen(true)}
        >
          <StopCircle className="w-4 h-4 mr-1" /> 설문 종료
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={monthStatus !== 'SURVEY-CONFIRMED'}
          onClick={() => setAutoAssignDrawerOpen(true)}
        >
          <Repeat className="w-4 h-4 mr-1" /> 자동 배정 (최종 확정)
        </Button>

        <Button variant="outline" size="sm" onClick={() => setMonthStatusDrawerOpen(true)}>
          <Settings className="w-4 h-4 mr-1" /> 월 상태변경
        </Button>
      </div>

      {loading && <LoadingSpinner label="전월 데이터 복사 중..." />}

      {/* ✅ 달력 */}
      <MassCalendar
        events={events}
        onDayClick={handleDayClick}
        timezone="Asia/Seoul"
        onMonthChange={(newMonth) => setCurrentMonth(newMonth)}
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
      />
      <ConfirmMassDrawer
        open={confirmDrawerOpen}
        onClose={() => setConfirmDrawerOpen(false)}
        onConfirm={handleConfirmMass}
      />
      <SendSurveyDrawer
        open={surveyDrawerOpen}
        onClose={() => setSurveyDrawerOpen(false)}
        surveyUrl={`${window.location.origin}/survey/${serverGroupId}/${monthKey}`}
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
          onClose={handleCloseMonthDrawer}
          serverGroupId={serverGroupId!}
          currentMonth={currentMonth}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
