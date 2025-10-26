// ✅ src/pages/ServerMain.tsx (최종 수정 버전)
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dayjs from 'dayjs';
import { Card, Heading, Container, Button } from '@/components/ui';
import { toast } from 'sonner';
import { useSession } from '@/state/session';
import { ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import type { MassEventDoc } from '@/types/firestore';
import MassEventMiniDrawer from '@/components/MassEventMiniDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { MassStatus } from '@/types/firestore';

/**
 * ✅ ServerMain.tsx (복사 메인)
 * --------------------------------------------------------
 * - 성당명 + 복사명 표시
 * - 미사 달력 (실시간 반응)
 * - 월 상태 실시간 반영 (onSnapshot)
 * - 나의 배정 일정 강조 표시
 * --------------------------------------------------------
 */
export default function ServerMain() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const [groupName, setGroupName] = useState<string>('');
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [monthStatus, setMonthStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [userName, setUserName] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ Drawer 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<MassEventDoc[]>([]);

  // ✅ 로그인 복사 이름 / 세례명 가져오기
  useEffect(() => {
    const loadMemberInfo = async () => {
      if (!session.user?.uid || !serverGroupId) return;
      try {
        const ref = doc(db, `server_groups/${serverGroupId}/members/${session.user.uid}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setUserName(data.name_kor || '');
          setBaptismalName(data.baptismal_name || '');
        } else {
          setUserName(session.user.displayName || '');
        }
      } catch (err) {
        console.error(err);
        toast.error('복사 정보 불러오기 오류');
      }
    };
    loadMemberInfo();
  }, [session.user?.uid, serverGroupId]);

  // ✅ 성당명 가져오기
  useEffect(() => {
    if (!serverGroupId) return;
    const fetchGroup = async () => {
      try {
        const ref = doc(db, 'server_groups', serverGroupId);
        const snap = await getDoc(ref);
        if (snap.exists()) setGroupName(snap.data().name || '');
      } catch (err) {
        console.error(err);
        toast.error('성당 정보 불러오기 오류');
      }
    };
    fetchGroup();
  }, [serverGroupId]);

  // ✅ 월 상태 실시간 구독
  useEffect(() => {
    if (!serverGroupId) return;
    const yyyymm = currentMonth.format('YYYYMM');
    const ref = doc(db, `server_groups/${serverGroupId}/month_status/${yyyymm}`);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMonthStatus(data.status || 'MASS-NOTCONFIRMED');
        } else {
          setMonthStatus('MASS-NOTCONFIRMED');
        }
      },
      (err) => console.error('❌ month_status 구독 오류:', err)
    );

    return () => unsubscribe();
  }, [serverGroupId, currentMonth]);

  // ✅ 미사 일정 실시간 구독 (event_date 기준)
  useEffect(() => {
    if (!serverGroupId) return;

    const start = currentMonth.startOf('month').format('YYYYMMDD');
    const end = currentMonth.endOf('month').format('YYYYMMDD');

    const q = query(
      collection(db, 'server_groups', serverGroupId, 'mass_events'),
      where('event_date', '>=', start),
      where('event_date', '<=', end),
      orderBy('event_date', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MassEventDoc));
        setEvents(list);
      },
      (err) => {
        console.error('❌ 실시간 미사 일정 구독 오류:', err);
        toast.error('미사 일정 구독 중 오류가 발생했습니다.');
      }
    );

    return () => unsubscribe();
  }, [serverGroupId, currentMonth]);

  // ✅ 월 이동
  const handlePrevMonth = () => setCurrentMonth((prev) => prev.subtract(1, 'month'));
  const handleNextMonth = () => setCurrentMonth((prev) => prev.add(1, 'month'));

  // 🔄 새로고침
  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.info('페이지를 새로 고치는 중입니다...');
    setTimeout(() => window.location.reload(), 300);
  };

  // ✅ 설문 페이지 이동
  const handleGoSurvey = () => {
    navigate(`/survey/${serverGroupId}/${currentMonth.format('YYYYMM')}`);
  };

  // ✅ 날짜 클릭 시 Drawer 열기
  const handleDayClick = (dateNum: number | null) => {
    if (!dateNum || monthStatus === 'MASS-NOTCONFIRMED') return;
    const date = currentMonth.date(dateNum);
    const dayEvents = events.filter((ev) => dayjs(ev.event_date, 'YYYYMMDD').isSame(date, 'day'));
    setSelectedDate(date);
    setSelectedEvents(dayEvents);
    setDrawerOpen(true);
  };

  // ✅ 달력 데이터 구성
  const isUnconfirmed = monthStatus === 'MASS-NOTCONFIRMED';
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf('month').day();
  const daysArray = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );

  return (
    <Container className="py-6 fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <Heading size="md" className="text-blue-700">
            ✝️ {groupName}
          </Heading>
          <p className="text-sm text-gray-600 mt-0.5">
            {userName
              ? `${userName}${baptismalName ? ` (${baptismalName})` : ''} 복사님`
              : '복사님 정보를 불러오는 중입니다...'}
          </p>
        </div>

        {/* 새로고침 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="새로고침"
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
        >
          <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 상태 카드 */}
      <Card className="p-4 mb-5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-semibold text-gray-800">
              {currentMonth.format('YYYY년 M월')}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="cursor-pointer">
            <StatusBadge status={monthStatus} size="md" />
          </div>
        </div>

        {monthStatus === 'MASS-CONFIRMED' && (
          <div className="text-center mt-2">
            <p className="text-sm text-gray-600 mb-2">이번 달 설문에 참여해주세요.</p>
            <Button variant="primary" size="md" onClick={handleGoSurvey}>
              ✉️ 설문 페이지로 이동
            </Button>
          </div>
        )}

        {monthStatus === 'SURVEY-CONFIRMED' && (
          <p className="text-center text-sm text-gray-600 mt-2">
            📋 설문이 마감되었습니다. 자동 배정 결과를 기다려주세요.
          </p>
        )}

        {monthStatus === 'FINAL-CONFIRMED' && (
          <p className="text-center text-sm text-gray-600 mt-2">
            아래 달력에서 본인 배정 일자를 확인하세요 🙏
          </p>
        )}
      </Card>

      {/* ✅ 미니 달력 */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm mb-8">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="font-semibold text-gray-600 py-1">
            {d}
          </div>
        ))}

        {daysArray.map((day, idx) => {
          if (day === null) return <div key={idx} className="h-14" />;

          const dateObj = currentMonth.date(day);
          const dayEvents = events.filter((ev) =>
            dayjs(ev.event_date, 'YYYYMMDD').isSame(dateObj, 'day')
          );
          const userId = session.user?.uid;
          const isMyMass = !!userId && dayEvents.some((ev) => ev.member_ids?.includes(userId));
          const dots = Array.from({ length: Math.min(dayEvents.length, 3) });

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(day)}
              className={`relative h-14 flex flex-col items-center justify-center rounded-md cursor-pointer transition
                ${
                  !isUnconfirmed
                    ? isMyMass
                      ? 'bg-blue-500 border border-blue-600 text-white font-bold shadow-md'
                      : dayEvents.length > 0
                      ? 'bg-rose-100 border border-rose-200 text-rose-800 font-semibold'
                      : 'text-gray-300'
                    : 'text-gray-300'
                }
                hover:scale-[1.03] hover:shadow-sm
              `}
            >
              <span>{day}</span>
              {!isUnconfirmed && dayEvents.length > 0 && (
                <div className="absolute bottom-1 flex gap-0.5">
                  {dots.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isMyMass ? 'bg-white' : 'bg-rose-500'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ✅ 복사용 Mini Drawer */}
      <MassEventMiniDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        events={selectedEvents}
        date={selectedDate}
        serverGroupId={serverGroupId}
      />
    </Container>
  );
}
