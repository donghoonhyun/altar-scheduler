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
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

interface MemberInfo {
  name_kor?: string;
  baptismal_name?: string;
  grade?: string;
  notes?: string;
  active?: boolean;
}

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();

  // ✅ My Info Dialog State
  const [showMyInfo, setShowMyInfo] = useState(false);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!serverGroupId || !session.user) return;
      const roles = session.groupRoles[serverGroupId];
      // Only fetch if they have server role or just fetch for everyone to be safe/consistent?
      // RoleBadge fetched only if 'server' role, but Admins might want to see their data too if it exists.
      // But 'server_groups/{gid}/members/{uid}' might not exist for pure admins if they are not added as servers.
      // Safe to try fetching.
      
      const db = getFirestore();
      const ref = doc(db, 'server_groups', serverGroupId, 'members', session.user.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMemberInfo(snap.data() as MemberInfo);
        }
      } catch (e) {
        console.log("Member info fetch error", e);
      }
    };
    fetchMemberInfo();
  }, [serverGroupId, session.user]);

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
    <Container className="min-h-screen py-6 transition-all duration-300">
      {/* 👋 상단 인사말 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 
            className="text-xl font-bold text-gray-800 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowMyInfo(true)}
          >
            <span className="text-blue-500 font-extrabold">
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
      {/* ✅ 내 정보 팝업 (RoleBadge 기능 이관) */}
      <Dialog open={showMyInfo} onOpenChange={setShowMyInfo}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle>나의 정보</DialogTitle>
            <DialogDescription>
              현재 로그인된 계정의 정보입니다.
            </DialogDescription>
          </div>

          <div className="space-y-3 text-sm py-4">
            <p>
              <strong>이메일:</strong> {session.user?.email}
            </p>
            <p>
              <strong>이름:</strong>{' '}
              {session.user?.displayName || memberInfo?.name_kor || '-'}
            </p>
            <p>
              <strong>역할:</strong> {serverGroupId && (() => {
                const roles = session.groupRoles[serverGroupId] || [];
                if (roles.includes('admin')) return 'Admin';
                if (roles.includes('planner')) return 'Planner';
                return 'Server';
              })()}
            </p>
            <p>
              <strong>본당:</strong> {serverGroupId ? session.serverGroups[serverGroupId]?.parishName : '-'}
            </p>
            <p>
              <strong>복사단:</strong> {serverGroupId ? session.serverGroups[serverGroupId]?.groupName : '-'}
            </p>

            {memberInfo && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p>
                  <strong>세례명:</strong> {memberInfo.baptismal_name || '-'}
                </p>
                <p>
                  <strong>학년:</strong> {memberInfo.grade || '-'}
                </p>
                <p>
                  <strong>비고:</strong> {memberInfo.notes || '-'}
                </p>
                <p>
                  <strong>승인여부:</strong>{' '}
                  {memberInfo.active ? '승인됨' : '승인대기'}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="secondary" onClick={() => setShowMyInfo(false)}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Dashboard;
