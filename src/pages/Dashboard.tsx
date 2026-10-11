import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import ServerStats from './components/ServerStats';
import PlannerHero from './components/PlannerHero';
import PlannerQuickActions from './components/PlannerQuickActions';
import MassCalendar from './components/MassCalendar';
import PageSkeleton from '@/components/common/PageSkeleton';
import { useMassEvents } from '@/hooks/useMassEvents';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useState, useEffect } from 'react';

dayjs.extend(utc);
dayjs.extend(timezone);

import MassEventDrawer from './components/MassEventDrawer'; // ✅ Import Drawer

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const navigate = useNavigate();

  // ✅ 현재 월 상태 관리 (전역 세션 연동)
  const initialMonth = session.currentViewDate || dayjs().tz('Asia/Seoul').startOf('month');
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  // 세션의 날짜가 외부에서 바뀌었을 경우 동기화
  useEffect(() => {
    if (session.currentViewDate && !session.currentViewDate.isSame(currentMonth, 'month')) {
      setCurrentMonth(session.currentViewDate);
    }
  }, [session.currentViewDate]);

  // 달 변경 핸들러
  const handleMonthChange = (newMonth: dayjs.Dayjs) => {
    setCurrentMonth(newMonth);
    session.setCurrentViewDate?.(newMonth);
  };

  // ✅ Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // ✅ useMassEvents 훅 호출
  const { events, loading, error, monthStatus } = useMassEvents(serverGroupId, currentMonth);

  // ✅ 날짜 클릭 핸들러 (읽기 전용 모드로 열기)
  const handleDayClick = (date: Date, eventId?: string) => {
    setSelectedDate(date);
    setSelectedEventId(eventId);
    setIsReadOnly(true);
    setDrawerOpen(true);

    // 클릭한 날짜로 뷰 날짜 업데이트 (선택사항, 사용자 경험상 좋을 수 있음)
    // session.setCurrentViewDate?.(dayjs(date));
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedEventId(undefined);
    setSelectedDate(null);
  };

  if (!serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  if (loading) return <PageSkeleton />;
  if (error) return <div className="p-4 text-red-500">오류: {error}</div>;

  const roles = session.groupRoles[serverGroupId] || [];
  const roleLabel = roles.includes('admin') ? '어드민' : roles.includes('planner') ? '플래너' : '복사';
  const monthLabel = currentMonth.format('M월');
  // 배정 인원이 필요 인원보다 모자란 미사 수
  const shortageCount = events.filter((ev) => (ev.servers?.length || 0) < (ev.required_servers || 0)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-sky-50 to-blue-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 pb-12 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 pt-3 space-y-3 ui-stagger">
        {/* 1) 인사말 + 이번 달 진행 단계와 다음에 할 일 */}
        <PlannerHero
          userName={session.userInfo?.userName}
          baptismalName={session.userInfo?.baptismalName}
          roleLabel={roleLabel}
          monthLabel={monthLabel}
          status={monthStatus}
          seed={serverGroupId}
          onPrimary={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
        />

        {/* 2) 복사단 현황 */}
        <ServerStats
          serverGroupId={serverGroupId}
          monthKey={currentMonth.format('YYYYMM')}
          monthLabel={monthLabel}
          shortageCount={shortageCount}
        />

        {/* 3) 바로가기 */}
        <PlannerQuickActions serverGroupId={serverGroupId} />

        {/* 4) 미사 일정 달력 */}
        <MassCalendar
          events={events}
          timezone="Asia/Seoul"
          highlightServerName={session?.user?.displayName || ''}
          viewDate={currentMonth} // ✅ 달력 뷰 동기화
          onMonthChange={handleMonthChange} // 🔁 달 이동 시 자동 재로딩 및 세션 업데이트
          onDayClick={handleDayClick}
          selectedEventId={selectedEventId}
          monthStatus={monthStatus}
        />
      </div>

      {/* ✅ 미사 상세 Drawer */}
      {drawerOpen && (
        <MassEventDrawer
          serverGroupId={serverGroupId}
          eventId={selectedEventId}
          date={selectedDate}
          onClose={handleCloseDrawer}
          monthStatus={monthStatus}
          events={events}
          readOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default Dashboard;
