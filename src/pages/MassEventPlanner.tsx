// ✅ src/pages/MassEventPlanner.tsx (최종 버전)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { CalendarDays } from 'lucide-react';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  where,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { callNotificationApi, FINAL_CONFIRM_NOTI_TITLE } from '@/lib/notificationApi';

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
import { COLLECTIONS } from '@/lib/collections';
import PremiumHeader from '@/components/common/PremiumHeader';
import Fireworks from '@/components/common/Fireworks';

dayjs.extend(weekOfYear);
dayjs.extend(timezone);

const MassEventPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
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
  // 일정 확정·최종 확정 직후의 축하 폭죽
  const [celebration, setCelebration] = useState<{ id: number; message: string; subMessage: string } | null>(null);

  // ✅ 실시간 설문 상태 감지 (버튼 라벨 변경용)
  useEffect(() => {
     if (!serverGroupId || !monthKey) return;

     const surveyRef = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${monthKey}`);
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
    await updateStatus('MASS-CONFIRMED', session.user?.uid, session.user?.displayName || undefined);
    toast.success('📘 미사 일정이 확정되었습니다.');
    setCelebration({
      id: Date.now(),
      message: `${currentMonth.format('M월')} 미사 일정 확정!`,
      subMessage: '이제 복사들에게 설문을 보내 주세요',
    });
  };
  const handleCloseSurvey = async () => {
    await updateStatus('SURVEY-CONFIRMED', session.user?.uid, session.user?.displayName || undefined);

    // ✅ 설문 문서 상태도 CLOSED로 변경 (복사 메인 등에서의 감시를 위해)
    if (serverGroupId) {
        const surveyRef = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${monthKey}`);
        // merge: true로 부분 업데이트
        await setDoc(surveyRef, { status: 'CLOSED' }, { merge: true });
    }

    toast.success('📊 설문이 종료되었습니다.');
  };
  const handleAutoAssign = async () => {
    const autoAssignFn = httpsCallable(functions, 'altar_autoAssignMassEvents');
    
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
    await updateStatus('FINAL-CONFIRMED', session.user?.uid, session.user?.displayName || undefined);
    // 확정은 이미 끝났으므로, 알림 발송이 실패해도 확정을 되돌리지 않고 알려만 준다
    try {
      const data = await callNotificationApi<{ success: boolean; message?: string; queued_count?: number }>(functions, {
        action: 'enqueue_survey',
        serverGroupId,
        month: monthKey,
        type: 'FINAL_CONFIRMED',
        title: FINAL_CONFIRM_NOTI_TITLE,
      });
      if (data.success) {
        toast.success('✅ 최종 확정되었습니다.', {
          description: `복사 보호자 ${data.queued_count ?? 0}명에게 알림을 보냈어요.`,
        });
      } else {
        toast.warning('최종 확정은 되었으나 알림을 보내지 못했습니다.', { description: data.message });
      }
    } catch (notiErr) {
      console.error('Final confirm notification error:', notiErr);
      toast.warning('최종 확정은 되었으나 알림 발송 중 오류가 발생했습니다.', {
        description: notiErr instanceof Error ? notiErr.message : undefined,
      });
    }
    setCelebration({
      id: Date.now(),
      message: `${currentMonth.format('M월')} 배정 최종 확정!`,
      subMessage: '복사들이 자기 배정을 볼 수 있어요',
    });
  };

  /** ✅ 툴바 버튼 활성화 조건 */
  const isCopyEnabled =
    currentMonth.isSame(dayjs(), 'month') || currentMonth.isSame(dayjs().add(1, 'month'), 'month');

  if (statusLoading) return <LoadingSpinner label="월 상태 로딩 중..." />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-sky-50 to-blue-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 transition-colors duration-300">
      <div className="mb-3">
        <PremiumHeader
          title="미사 일정 관리"
          subtitle={`${currentMonth.format('YYYY년 M월')} 기준 일정/배정 관리`}
          icon={<CalendarDays size={18} />}
          onBack={() => navigate(-1)}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-8 ui-stagger">
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
      </div>


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

      {celebration && (
        <Fireworks
          key={celebration.id}
          message={celebration.message}
          subMessage={celebration.subMessage}
          onDone={() => setCelebration(null)}
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
