import { useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import { Container, Card, Heading, UserRoleIcon } from '@/components/ui';
import ServerStats from './components/ServerStats';
import NextMonthPlan from './components/NextMonthPlan';
import MassCalendar from './components/MassCalendar';
import RoleBadge from './components/RoleBadge';
import PageSkeleton from '@/components/common/PageSkeleton';
import { useMassEvents } from '@/hooks/useMassEvents';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

import MassEventDrawer from './components/MassEventDrawer'; // ✅ Import Drawer

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();

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

  const userName = session.user?.displayName || session.user?.email;

  if (loading) return <PageSkeleton />;
  if (error) return <div className="p-4 text-red-500">오류: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-200 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300">
      <Container className="py-6 transition-all duration-300">
        {/* 👋 상단 인사말 */}
        <div className="mb-6 mt-1 flex flex-col items-center">
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 text-center relative inline-block">
            플래너 Dashboard
            <span className="absolute -bottom-2 left-0 w-full h-1.5 bg-blue-500/30 dark:bg-blue-400/30 rounded-full"></span>
          </Heading>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            <span className="text-blue-600 dark:text-blue-400 font-extrabold inline-flex items-center justify-center gap-1">
              <UserRoleIcon category={session.userInfo?.userCategory} size={18} />
              {session.userInfo?.userName} {session.userInfo?.baptismalName && `${session.userInfo.baptismalName} `}
            </span>
            {serverGroupId && (() => {
              const roles = session.groupRoles[serverGroupId] || [];
              if (roles.includes('admin')) return '어드민';
              if (roles.includes('planner')) return '플래너';
              return '복사';
            })()}님 반갑습니다.
          </h2>
        </div>

        {/* ✅ 주요 카드 */}
        <div className="grid gap-6 md:grid-cols-2 mb-6 ui-stagger">
          <Card className="fade-in">
            <NextMonthPlan serverGroupId={serverGroupId} />
          </Card>
          <Card className="fade-in">
            <ServerStats 
              parishCode={session.serverGroups[serverGroupId]?.parishCode || ''} 
              serverGroupId={serverGroupId} 
            />
          </Card>
        </div>

        {/* ✅ 미사 일정 달력 */}
        <Card className="md:col-span-2 fade-in">
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
        </Card>

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
      </Container>
    </div>
  );
};

export default Dashboard;
