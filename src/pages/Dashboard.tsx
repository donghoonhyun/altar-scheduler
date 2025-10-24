import { useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import { Container, Card, Heading } from '@/components/ui';
import ServerStats from './components/ServerStats';
import NextMonthPlan from './components/NextMonthPlan';
import MassCalendar from './components/MassCalendar';
import RoleBadge from './components/RoleBadge';
import { useMassEvents } from '@/hooks/useMassEvents';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useState } from 'react';

dayjs.extend(utc);
dayjs.extend(timezone);

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();

  // ✅ 현재 월 상태 관리 (MassCalendar와 연동)
  const [currentMonth, setCurrentMonth] = useState(dayjs().tz('Asia/Seoul').startOf('month'));

  // ✅ useMassEvents 훅 호출
  const { events, loading, error } = useMassEvents(serverGroupId, currentMonth);

  if (!serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  const userName = session.user?.displayName || session.user?.email;

  if (loading) return <div className="p-4">로딩 중...</div>;
  if (error) return <div className="p-4 text-red-500">오류: {error}</div>;

  return (
    <Container className="min-h-screen py-8 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 transition-all duration-300">
      {/* ✅ 상단 인사 + 역할 배지 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <Heading size="md" className="mb-1">
            안녕하세요, <span className="text-blue-600 dark:text-blue-300">{userName}</span>{' '}
            플래너님 👋
          </Heading>
          <p className="text-gray-600 dark:text-gray-400">이번 달 복사 배정 현황을 확인하세요.</p>
        </div>
        <div className="mt-3 sm:mt-0">
          <RoleBadge serverGroupId={serverGroupId} />
        </div>
      </div>

      {/* ✅ 주요 카드 */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card className="fade-in">
          <ServerStats parishCode="SG00001" serverGroupId={serverGroupId} />
        </Card>
        <Card className="fade-in">
          <NextMonthPlan serverGroupId={serverGroupId} />
        </Card>
      </div>

      {/* ✅ 미사 일정 달력 */}
      <Card className="md:col-span-2 fade-in">
        <MassCalendar
          events={events}
          timezone="Asia/Seoul"
          highlightServerName={session?.user?.displayName || ''}
          onMonthChange={(newMonth) => setCurrentMonth(newMonth)} // 🔁 달 이동 시 자동 재로딩
        />
      </Card>
    </Container>
  );
};

export default Dashboard;
