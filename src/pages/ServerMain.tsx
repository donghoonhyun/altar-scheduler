// src/pages/ServerMain.tsx
import { useEffect, useState } from 'react';
import { useSession } from '@/state/session';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dayjs, { Dayjs } from 'dayjs';
import { toast } from 'sonner';

import { useNavigate, useParams } from 'react-router-dom';

import MyMembersPanel from './components/MyMembersPanel';
import UpdateUserProfileDialog from './components/UpdateUserProfileDialog';
import MassEventMiniDrawer from '@/components/MassEventMiniDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';

import type { MassEventDoc, MassStatus, MemberDoc } from '@/types/firestore';
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type MemberItem = MemberDoc & { memberId: string; active?: boolean };

export default function ServerMain() {
  const session = useSession();
  const navigate = useNavigate();
  
  // URL에서 ServerGroup ID 획득 (Source of Truth)
  const { serverGroupId } = useParams<{ serverGroupId: string }>();

  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [monthStatus, setMonthStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');

  // ✅ [수정] 로컬 State 대신 전역 Session State 사용
  // session.currentViewDate가 있으면 그것을, 없으면 오늘을 사용
  const currentMonth = session.currentViewDate || dayjs();

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerDate, setDrawerDate] = useState<Dayjs | null>(null);
  const [drawerEvents, setDrawerEvents] = useState<MassEventDoc[]>([]);

  // 1) server_group 정보
  useEffect(() => {
    if (!serverGroupId) {
      setGroupName('');
      return;
    }
    const ref = doc(db, 'server_groups', serverGroupId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setGroupName(snap.data().name || '');
      else setGroupName('');
    });
    return () => unsub();
  }, [serverGroupId]);

  // 2) 내 members
  useEffect(() => {
    if (!serverGroupId || !session.user) {
      setMembers([]);
      return;
    }

    const q = query(
      collection(db, 'server_groups', serverGroupId, 'members'),
      where('parent_uid', '==', session.user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: MemberItem[] = snap.docs.map((d) => ({
        memberId: d.id,
        ...(d.data() as MemberDoc),
      }));
      setMembers(list);
    });

    return () => unsub();
  }, [serverGroupId, session.user]);

  const [checkedMemberIds, setCheckedMemberIds] = useState<string[]>([]);
  
  // 3) month_status
  useEffect(() => {
    if (!serverGroupId) {
      setMonthStatus('MASS-NOTCONFIRMED');
      return;
    }
    // ✅ [수정] 의존성을 문자열로 변경하여 무한 루프 방지
    const yyyymm = currentMonth.format('YYYYMM');
    const ref = doc(db, 'server_groups', serverGroupId, 'month_status', yyyymm);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setMonthStatus(snap.data().status as MassStatus);
      else setMonthStatus('MASS-NOTCONFIRMED');
    });

    return () => unsub();
  }, [serverGroupId, currentMonth.format('YYYYMM')]); // Stable Dependency

  // 3.5) 설문 진행 중인 달 조회 (Survey Status='OPEN') - Realtime
  const [surveyNoticeMonth, setSurveyNoticeMonth] = useState<string | null>(null);
  
  useEffect(() => {
    if (!serverGroupId) {
      setSurveyNoticeMonth(null);
      return;
    }

    // ✅ [수정] 의존성을 문자열로 변경
    const yyyymm = currentMonth.format('YYYYMM');
    const surveyRef = doc(db, 'server_groups', serverGroupId, 'availability_surveys', yyyymm);

    const unsub = onSnapshot(surveyRef, (snap) => {
      if (snap.exists() && snap.data().status === 'OPEN') {
        setSurveyNoticeMonth(yyyymm);
      } else {
        setSurveyNoticeMonth(null);
      }
    });

    return () => unsub();
  }, [serverGroupId, currentMonth.format('YYYYMM')]); // Stable Dependency

  // members 변경 시 checkedMemberIds 동기화 (기본: 세션 스토리지 값 -> 없으면 첫 번째)
  useEffect(() => {
    const activeIds = members.filter((m) => m.active).map((m) => m.memberId);
    
    // 1. Session Storage에서 마지막 선택값 확인
    if (serverGroupId) {
        const storageKey = `altar_last_member_${serverGroupId}`;
        const storedId = sessionStorage.getItem(storageKey);

        if (storedId && activeIds.includes(storedId)) {
            setCheckedMemberIds([storedId]);
            return;
        }
    }

    // 2. 없으면 첫 번째 복사 선택
    if (activeIds.length > 0) {
      setCheckedMemberIds([activeIds[0]]);
    } else {
      setCheckedMemberIds([]);
    }
  }, [members, serverGroupId]);

  const handleToggleMember = (memberId: string) => {
    // 라디오 버튼 방식: 클릭 시 해당 멤버 무조건 선택
    setCheckedMemberIds([memberId]);
    
    // 선택 상태 세션 스토리지에 저장 (페이지 복귀 시 유지를 위해)
    if (serverGroupId) {
        sessionStorage.setItem(`altar_last_member_${serverGroupId}`, memberId);
    }
  };

  // 4) mass_events
  useEffect(() => {
    if (!serverGroupId) {
      setEvents([]);
      return;
    }

    const start = currentMonth.startOf('month').format('YYYYMMDD');
    const end = currentMonth.endOf('month').format('YYYYMMDD');

    const q = query(
      collection(db, 'server_groups', serverGroupId, 'mass_events'),
      where('event_date', '>=', start),
      where('event_date', '<=', end),
      orderBy('event_date')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: MassEventDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return { ...data, id: d.id } as MassEventDoc;
      });
      setEvents(list);
    });

    return () => unsub();
  }, [serverGroupId, currentMonth.format('YYYYMM')]); // Stable Dependency

  // 날짜 클릭 → Drawer
  const handleDayClick = (day: number) => {
    // 유효한 복사가 선택되지 않았으면 클릭 무시
    if (checkedMemberIds.length === 0) {
      toast.warning('확인할 복사를 선택해주세요.');
      return;
    }

    // 미확정 상태면 클릭 무시
    if (monthStatus === 'MASS-NOTCONFIRMED') return;

    const date = currentMonth.date(day);
    const filtered = events.filter((ev) => dayjs(ev.event_date, 'YYYYMMDD').isSame(date, 'day'));

    setDrawerDate(date);
    setDrawerEvents(filtered);
    setDrawerOpen(true);
  };

  // 달력 계산
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf('month').day();
  const daysArray: (number | null)[] = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );

  const isMyEvent = (ev: MassEventDoc) =>
    ev.member_ids?.some((mid: string) => checkedMemberIds.includes(mid));

  // 📝 사용자 프로필 정보 누락 체크
  const [showProfileUpdate, setShowProfileUpdate] = useState<boolean>(false);

  useEffect(() => {
    // 이미 건너 뛰었으면 다시 안 띄움 (세션 스토리지 체크)
    const skipped = sessionStorage.getItem('profile_skip');
    if (skipped) {
      setShowProfileUpdate(false);
      return;
    }

    // 세션 로딩이 끝났고(userInfo 체크 가능), 로그인 상태일 때
    if (!session.loading && session.user) {
      // userInfo가 아예 없거나, userName이 비어있으면 팝업
      if (!session.userInfo || !session.userInfo.userName) {
        setShowProfileUpdate(true);
      } else {
        // 정보가 있거나 로드되면 팝업을 닫음
        setShowProfileUpdate(false);
      }
    }
  }, [session.loading, session.user, session.userInfo]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-emerald-200 pb-12">
      <div className="max-w-lg mx-auto px-4">
        {/* 👋 상단 인사말 */}
        <div className="mb-4 mt-1 px-1">
          <h2 className="text-xl font-bold text-gray-800">
            <span className="text-emerald-600 font-extrabold">
              {session.userInfo?.userName} {session.userInfo?.baptismalName && `${session.userInfo.baptismalName} `}
            </span>
            {serverGroupId && (
              (() => {
                const roles = session.groupRoles[serverGroupId] || [];
                if (roles.includes('admin')) return '어드민';
                if (roles.includes('planner')) return '플래너';
                return '복사';
              })()
            )}님 반갑습니다.
          </h2>
        </div>

        {/* 사용자 프로필 누락 시 다이얼로그 띄움 */}
        {showProfileUpdate && session.user && (
          <UpdateUserProfileDialog
            uid={session.user.uid}
            currentName={session.userInfo?.userName}
            currentBaptismalName={session.userInfo?.baptismalName}
            onClose={() => {
              // "나중에 하기" 또는 닫기 시 이번 세션에서는 다시 안 띄움
              sessionStorage.setItem('profile_skip', 'true');
              setShowProfileUpdate(false);
            }}
          />
        )}

        {/* 2) 내 복사 목록 */}
        {serverGroupId && session.user && (
          <MyMembersPanel
            members={members}
            userUid={session.user.uid}
            serverGroupId={serverGroupId}
            checkedMemberIds={checkedMemberIds}
            onToggle={handleToggleMember}
          />
        )}

        {/* 2.5) 설문 알림 (Callout) */}
        {surveyNoticeMonth && serverGroupId && (
          <div 
            onClick={() => {
                if (checkedMemberIds.length !== 1) {
                    toast.error("설문을 진행할 복사를 한 명만 선택해주세요.");
                    return;
                }
                const targetId = checkedMemberIds[0];
                navigate(`/survey/${serverGroupId}/${surveyNoticeMonth}?memberId=${targetId}`);
            }}
            className="mt-4 mb-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-yellow-100 transition shadow-sm fade-in"
          >
            <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
               <ClipboardCheck size={24} />
            </div>
            <div className="flex-1">
               <h3 className="text-sm font-bold text-yellow-900">미사일정 설문이 시작되었습니다</h3>
               <p className="text-xs text-yellow-700 mt-1">
                 {dayjs(surveyNoticeMonth, 'YYYYMM').format('YYYY년 M월')} 미사 배정 설문에 참여해주세요.
               </p>
            </div>
            <ChevronRight className="text-yellow-400" size={20} />
          </div>
        )}

        {/* 🔥 3) 복사 0명일 때 안내 카드 */}
        {members.length === 0 && (
          <div className="mt-4 p-4 bg-white rounded-xl shadow text-center">
            <p className="text-gray-700 mb-3">
              복사 정보가 없습니다.
              <br />
              복사 정보를 등록해주세요.
            </p>

            <button
              onClick={() => navigate(`/add-member?sg=${serverGroupId}`)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow"
            >
              + 복사 추가하기
            </button>
          </div>
        )}

        {/* 🔥 4) 복사 없으면 달력 렌더링 중지 */}
        {members.length === 0 && null}

        {/* 🔥 members.length ≥ 1 일 때만 달력 렌더링 */}
        {serverGroupId && members.length > 0 && (
          <>
            {/* 달력 상단 */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-2 items-center">
                {/* ✅ [수정] 세션 상태 업데이트 함수 사용 */}
                <button 
                  onClick={() => session.setCurrentViewDate?.(currentMonth.subtract(1, 'month'))}
                  className="p-1 hover:bg-emerald-100 rounded-full transition-colors"
                  title="이전 달"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="font-bold text-lg text-gray-800 tracking-tight">
                  {currentMonth.format('M월')}
                </span>

                <button 
                  onClick={() => session.setCurrentViewDate?.(currentMonth.add(1, 'month'))}
                  className="p-1 hover:bg-emerald-100 rounded-full transition-colors"
                  title="다음 달"
                >
                  <ChevronRight size={20} />
                </button>

                <button
                  onClick={() => session.setCurrentViewDate?.(dayjs())}
                  className="ml-1 text-xs px-2.5 py-1 bg-white border border-gray-200 hover:bg-emerald-50 text-gray-600 rounded-lg shadow-sm transition-colors font-medium"
                >
                  오늘
                </button>

                <div className="ml-2 flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
                   <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                   나의 배정
                </div>
              </div>

              <StatusBadge status={monthStatus} />
            </div>

            {/* 달력 */}
            <div className="grid grid-cols-7 gap-1 text-sm mb-4">
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} className="text-center font-semibold text-gray-600 py-1">
                  {d}
                </div>
              ))}

              {daysArray.map((day, idx) => {
                if (!day) return <div key={idx} className="h-14" />;

                const dateObj = currentMonth.date(day);
                const evts = events.filter((ev) =>
                  dayjs(ev.event_date, 'YYYYMMDD').isSame(dateObj, 'day')
                );

                const mine = evts.some(isMyEvent);
                const any = evts.length > 0;

                const isToday = dayjs().isSame(dateObj, 'day');
                // MASS-NOTCONFIRMED가 아니면 점으로 표시
                const showDots = monthStatus !== 'MASS-NOTCONFIRMED';
                const isSelected = drawerOpen && drawerDate?.isSame(dateObj, 'day');

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-14 flex flex-col items-center justify-start pt-1 rounded transition border relative",
                      // 미확정(showDots=false)이면 클릭 비활성(cursor-default), 확정이면 pointer + hover효과
                      !showDots ? "cursor-default" : "cursor-pointer hover:bg-emerald-50/50",
                      isToday ? "border-emerald-500 ring-1 ring-emerald-500 z-10" : "border-transparent",
                      !showDots && mine && "bg-rose-600 text-white font-bold hover:bg-rose-700",
                      !showDots && !mine && any && "bg-gray-200 text-gray-600 hover:bg-gray-300",
                      !showDots && !any && "text-gray-300",
                      
                      // Confirmed: Assigned (mine)
                      showDots && !isSelected && mine && "bg-rose-100 border-rose-300",
                      // Confirmed: Not Assigned
                      showDots && !isSelected && !mine && "bg-white",

                      // Selected (Override)
                      // If mine is true, keep rose bg but add yellow ring
                      isSelected && mine && "bg-rose-100 border-yellow-400 ring-2 ring-yellow-400 z-20",
                      isSelected && !mine && "bg-white border-yellow-400 ring-1 ring-yellow-400 z-20"
                    )}
                  >
                    <span className={cn(
                      "text-sm", 
                      isToday && "font-bold text-emerald-600",
                      !showDots && mine && "text-white"
                    )}>{day}</span>
                  
                  {showDots && (
                    <div className="flex gap-0.5 flex-wrap justify-center px-1 mt-1">
                      {evts.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isMyEvent(ev) 
                              ? "bg-rose-500" // Assigned -> Red
                              : "bg-gray-300"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>



          {/* Drawer */}
          <MassEventMiniDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            events={drawerEvents}
            date={drawerDate}
            serverGroupId={serverGroupId}
            monthStatus={monthStatus}
          />
        </>
      )}
      </div>
    </div>
  );
}
