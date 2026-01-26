// ✅ src/pages/MassEventPlanner.tsx (최종 버전)
import React, { useState, useEffect } from 'react';
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
  where,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { toast } from 'sonner';

import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import MonthStatusDrawer from './components/MonthStatusDrawer';
import ApplyPresetDrawer from './components/ApplyPresetDrawer';
import ConfirmMassDrawer from './components/ConfirmMassDrawer';
import FinalConfirmDrawer from './components/FinalConfirmDrawer';
import { SendSurveyDrawer } from '@/components/SendSurveyDrawer';
import CloseSurveyDrawer from './components/CloseSurveyDrawer';
import AutoAssignDrawer from './components/AutoAssignDrawer';
import MassBackupDrawer from './components/MassBackupDrawer';
import { useMassEvents } from '@/hooks/useMassEvents';
import { useMonthStatus } from '@/hooks/useMonthStatus';
import type { MassEventCalendar } from '@/types/massEvent';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { MassEventToolbar } from '@/components/MassEventToolbar';
import { useSession } from '@/state/session';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(weekOfYear);
dayjs.extend(timezone);

const MassEventPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const db = getFirestore();
  const session = useSession();

  // ✅ Initialize from global session or default to current month
  const initialMonth = session.currentViewDate || dayjs().tz('Asia/Seoul').startOf('month');
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(initialMonth);

  // Sync with global session changes
  useEffect(() => {
    if (session.currentViewDate && !session.currentViewDate.isSame(currentMonth, 'month')) {
      setCurrentMonth(session.currentViewDate);
    }
  }, [session.currentViewDate]);

  // Wrapper for month change to update session
  const handleMonthChange = (newMonth: Dayjs) => {
      setCurrentMonth(newMonth);
      session.setCurrentViewDate?.(newMonth);
  };

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
  const [backupDrawerOpen, setBackupDrawerOpen] = useState(false);
  const [finalConfirmDrawerOpen, setFinalConfirmDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);

  // ✅ 실시간 설문 상태 감지 (버튼 라벨 변경용)
  useEffect(() => {
     if (!serverGroupId || !monthKey) return;

     const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${monthKey}`);
     const unsub = onSnapshot(surveyRef, (snap) => {
         if (snap.exists()) {
             const data = snap.data();
             setIsSurveyOpen(data.status === 'OPEN');
         } else {
             setIsSurveyOpen(false);
         }
     });

     return () => unsub();
  }, [serverGroupId, monthKey, db]);

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

    // ✅ 설문 문서 상태도 CLOSED로 변경 (복사 메인 등에서의 감시를 위해)
    if (serverGroupId) {
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${monthKey}`);
        // merge: true로 부분 업데이트
        await setDoc(surveyRef, { status: 'CLOSED' }, { merge: true });
    }

    toast.success('📊 설문이 종료되었습니다.');
  };

  const handleAutoAssign = async () => {
    const functions = getFunctions(undefined, 'asia-northeast3');
    
    // Connect to emulator in dev
    if (import.meta.env.DEV) {
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    }

    const autoAssignFn = httpsCallable(functions, 'autoAssignMassEvents');
    
    try {
      const result = await autoAssignFn({
        serverGroupId,
        year: currentMonth.year(),
        month: currentMonth.month() + 1 // 0-indexed to 1-indexed
      });
      const data = result.data as any;
      toast.success(`✅ 자동 배정 완료 (신입기준: ${data.maxStartYear || '?'}년)`);
      // Force refresh (update currentMonth trigger or useMassEvents should pick up changes via snapshot)
      // Since useMassEvents is likely snapshot listener, it should update automatically.
    } catch (error: any) {
      console.error('Auto Assign Error:', error);
      toast.error(`자동 배정 실패: ${error.message}`);
      throw error; // Re-throw so drawer knows it failed
    }
  };
  const handleFinalConfirm = async () => {
    await updateStatus('FINAL-CONFIRMED', 'planner@test.com');
    toast.success('✅ 최종 확정되었습니다.');
  };

  /** ✅ 툴바 버튼 활성화 조건 */
  const isCopyEnabled =
    currentMonth.isSame(dayjs(), 'month') || currentMonth.isSame(dayjs().add(1, 'month'), 'month');

  if (statusLoading) return <LoadingSpinner label="월 상태 로딩 중..." />;

  return (
    <div className="p-4 bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800">
          <ArrowLeft size={24} />
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          📅 미사 일정 관리
          <span className="ml-2 text-lg font-normal text-gray-500 dark:text-gray-400">
            {currentMonth.format('YYYY년 M월')}
          </span>
        </h2>
      </div>

      {/* ✅ Toolbar */}
      <MassEventToolbar
        monthStatus={monthStatus}
        isLocked={isLocked}
        isCopyEnabled={isCopyEnabled}
        isSurveyOpen={isSurveyOpen}
        onApplyPreset={() => setApplyPresetDrawerOpen(true)}
        onConfirmMass={() => setConfirmDrawerOpen(true)}
        onOpenSurvey={() => setSurveyDrawerOpen(true)}
        onCloseSurvey={() => setCloseSurveyDrawerOpen(true)}

        onAutoAssign={() => setAutoAssignDrawerOpen(true)}
        onFinalConfirm={() => setFinalConfirmDrawerOpen(true)}
        onOpenMonthStatus={() => setMonthStatusDrawerOpen(true)}
        onOpenBackup={() => setBackupDrawerOpen(true)}
      />

      {loading && <LoadingSpinner label="전월 데이터 복사 중..." />}

      {/* ✅ Calendar */}
      <MassCalendar
        events={events}
        timezone="Asia/Seoul"
        viewDate={currentMonth} // ✅ 달력 뷰 동기화
        onDayClick={handleDayClick}
        onMonthChange={handleMonthChange}
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
          events={events}
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

      <FinalConfirmDrawer
        open={finalConfirmDrawerOpen}
        onClose={() => setFinalConfirmDrawerOpen(false)}
        onConfirm={monthStatus === 'FINAL-CONFIRMED' ? undefined : handleFinalConfirm}
        serverGroupId={serverGroupId!}
        currentMonth={currentMonth}
        events={events}
        isReadOnly={monthStatus === 'FINAL-CONFIRMED'}
      />

      {monthStatusDrawerOpen && (
        <MonthStatusDrawer
          open={monthStatusDrawerOpen}
          onClose={() => setMonthStatusDrawerOpen(false)}
          serverGroupId={serverGroupId!}
          currentMonth={currentMonth}
        />
      )}

      <MassBackupDrawer
          open={backupDrawerOpen}
          onClose={() => setBackupDrawerOpen(false)}
          serverGroupId={serverGroupId!}
          currentMonth={currentMonth}
      />
    </div>
  );
};

export default MassEventPlanner;
