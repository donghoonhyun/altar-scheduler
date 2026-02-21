// src/pages/ServerMain.tsx
import { useEffect, useState } from 'react';
import { useSession } from '@/state/session';
import {
  collection,
  doc,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  where,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/collections';
import { db } from '@/lib/firebase';
import dayjs, { Dayjs } from 'dayjs';
import { toast } from 'sonner';

import { useNavigate, useParams } from 'react-router-dom';

import MyMembersPanel from './components/MyMembersPanel';

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
    const ref = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId);
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

    const membersCol = collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members');

    const mergeUniqueDocs = (
      first: QueryDocumentSnapshot<DocumentData>[],
      second: QueryDocumentSnapshot<DocumentData>[]
    ) => {
      const merged = [...first];
      const seen = new Set(first.map((d) => d.ref.path));
      second.forEach((d) => {
        if (!seen.has(d.ref.path)) merged.push(d);
      });
      return merged;
    };

    const applyMemberDocs = (docs: QueryDocumentSnapshot<DocumentData>[]) => {
      const list: MemberItem[] = docs.map((d) => ({
        memberId: d.id,
        ...(d.data() as MemberDoc),
      }));
      setMembers(list);
    };

    let parentSnapCache: QuerySnapshot<DocumentData> | null = null;

    const renderFiltered = () => {
      const allDocs = parentSnapCache?.docs ?? [];
      const parentDocs = allDocs.filter((d) => {
        const data = d.data() as any;
        return data?.parent_uid === session.user?.uid;
      });
      const uidDocs = allDocs.filter((d) => {
        const data = d.data() as any;
        return data?.uid === session.user?.uid;
      });
      applyMemberDocs(mergeUniqueDocs(parentDocs, uidDocs));
    };

    const syncServerOnce = () => {
      const shouldSync = parentSnapCache && parentSnapCache.metadata.fromCache;
      if (!shouldSync) return;

      void getDocsFromServer(membersCol)
        .then((serverSnap) => {
          const parentDocs = serverSnap.docs.filter((d) => {
            const data = d.data() as any;
            return data?.parent_uid === session.user?.uid;
          });
          const uidDocs = serverSnap.docs.filter((d) => {
            const data = d.data() as any;
            return data?.uid === session.user?.uid;
          });
          applyMemberDocs(mergeUniqueDocs(parentDocs, uidDocs));
        })
        .catch(() => {
          // 네트워크 불안정 시 onSnapshot 재시도를 신뢰
        });
    };

    const unsubParent = onSnapshot(membersCol, { includeMetadataChanges: true }, (snap) => {
      parentSnapCache = snap;
      renderFiltered();
      syncServerOnce();
    });

    return () => {
      unsubParent();
    };
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
    const ref = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'month_status', yyyymm);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setMonthStatus(snap.data().status as MassStatus);
      else setMonthStatus('MASS-NOTCONFIRMED');
    });

    return () => unsub();
  }, [serverGroupId, currentMonth.format('YYYYMM')]); // Stable Dependency

  // 3.5) 설문 진행 중인 달 조회 (Survey Status='OPEN') - Realtime
  const [surveyInfo, setSurveyInfo] = useState<{ 
      month: string; 
      targetMemberIds: string[]; 
      startDate: any; 
      endDate: any; 
  } | null>(null);
  
  useEffect(() => {
    if (!serverGroupId) {
      setSurveyInfo(null);
      return;
    }

    // ✅ [수정] 의존성을 문자열로 변경
    const yyyymm = currentMonth.format('YYYYMM');
    const surveyRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'availability_surveys', yyyymm);

    const unsub = onSnapshot(surveyRef, (snap) => {
      if (snap.exists() && snap.data().status === 'OPEN') {
        setSurveyInfo({
            month: yyyymm,
            targetMemberIds: snap.data().member_ids || [],
            startDate: snap.data().start_date,
            endDate: snap.data().end_date,
        });
      } else {
        setSurveyInfo(null);
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
      collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_events'),
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



  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-emerald-200 dark:from-slate-950 dark:to-slate-900 pb-12 transition-colors duration-300">
      <div className="max-w-lg md:max-w-6xl mx-auto px-4">
        {/* 👋 상단 인사말 */}
        <div className="mb-4 mt-1 px-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
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

        {/* 2.5) 설문 알림 (Callout) - 기간 체크 추가 */}
        {surveyInfo && 
         checkedMemberIds.length === 1 && 
         surveyInfo.targetMemberIds.includes(checkedMemberIds[0]) && 
         serverGroupId && 
         // Check if today is within survey period (inclusive)
         !dayjs().isBefore(dayjs(surveyInfo.startDate?.toDate()), 'day') && 
         !dayjs().isAfter(dayjs(surveyInfo.endDate?.toDate()), 'day') && (
          <div 
            onClick={() => {
                const targetId = checkedMemberIds[0];
                navigate(`/survey/${serverGroupId}/${surveyInfo.month}?memberId=${targetId}`);
            }}
            className="mt-4 mb-2 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition shadow-sm fade-in"
          >
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full text-yellow-600 dark:text-yellow-500">
               <ClipboardCheck size={24} />
            </div>
            <div className="flex-1">
               <h3 className="text-sm font-bold text-yellow-900 dark:text-yellow-200">미사일정 설문이 시작되었습니다</h3>
               <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                 {dayjs(surveyInfo.month, 'YYYYMM').format('YYYY년 M월')} 미사 배정 설문에 참여해주세요.
               </p>
            </div>
            <ChevronRight className="text-yellow-400 dark:text-yellow-600" size={20} />
          </div>
        )}

        {/* 🔥 3) 복사 0명일 때 안내 카드 */}
        {members.length === 0 && (
          <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl shadow text-center dark:border dark:border-slate-800">
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              복사 정보가 없습니다.
              <br />
              복사 정보를 등록해주세요.
            </p>

            <button
              onClick={() => navigate(`/add-member?sg=${serverGroupId}`)}
              className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-xl shadow hover:bg-emerald-700 dark:hover:bg-emerald-600"
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
                  className="p-1 hover:bg-emerald-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-800 dark:text-gray-300"
                  title="이전 달"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="font-bold text-lg text-gray-800 dark:text-gray-100 tracking-tight">
                  {currentMonth.format('M월')}
                </span>

                <button 
                  onClick={() => session.setCurrentViewDate?.(currentMonth.add(1, 'month'))}
                  className="p-1 hover:bg-emerald-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-800 dark:text-gray-300"
                  title="다음 달"
                >
                  <ChevronRight size={20} />
                </button>

                <button
                  onClick={() => session.setCurrentViewDate?.(dayjs())}
                  className="ml-1 text-xs px-2.5 py-1 bg-white border border-gray-200 hover:bg-emerald-50 text-gray-600 rounded-lg shadow-sm transition-colors font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700"
                >
                  오늘
                </button>

                <div className="ml-2 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                   <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                   나의 배정
                </div>
              </div>

              <StatusBadge status={monthStatus} />
            </div>

            {/* 달력 */}
            <div className="grid grid-cols-7 gap-1 text-sm mb-4">
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} className="text-center font-semibold text-gray-600 dark:text-gray-300 py-1">
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
                      "h-14 md:h-36 flex flex-col items-center md:items-stretch justify-start pt-1 md:p-2 rounded transition border relative",
                      // 미확정(showDots=false)이면 클릭 비활성(cursor-default), 확정이면 pointer + hover효과
                      !showDots ? "cursor-default" : "cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/30",
                      isToday ? "border-emerald-500 ring-1 ring-emerald-500 z-10 dark:border-emerald-500" : "border-transparent",
                      !showDots && mine && "bg-rose-600 text-white font-bold hover:bg-rose-700 dark:bg-rose-700",
                      !showDots && !mine && any && "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600",
                      !showDots && !any && "text-gray-300 dark:text-slate-700",
                      
                      // Confirmed: Assigned (mine)
                      showDots && !isSelected && mine && "bg-rose-100 border-rose-300 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-900/50",
                      // Confirmed: Not Assigned
                      showDots && !isSelected && !mine && "bg-white dark:bg-slate-900 dark:border-slate-800 border-gray-100 border text-gray-700 dark:text-gray-300",

                      // Selected (Override)
                      // If mine is true, keep rose bg but add yellow ring
                      isSelected && mine && "bg-rose-100 border-yellow-400 ring-2 ring-yellow-400 z-20 dark:bg-rose-900/30 dark:border-yellow-500 dark:ring-yellow-500",
                      isSelected && !mine && "bg-white border-yellow-400 ring-1 ring-yellow-400 z-20 dark:bg-slate-800 dark:border-yellow-500 dark:ring-yellow-500"
                    )}
                  >
                    <span className={cn(
                      "text-sm mb-1", 
                      isToday && "font-bold text-emerald-600 dark:text-emerald-400",
                      !showDots && mine && "text-white"
                    )}>{day}</span>
                  
                  {showDots && (
                    <>
                      {/* Mobile: Dots */}
                      <div className="flex gap-0.5 flex-wrap justify-center px-1 mt-1 md:hidden">
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

                      {/* Desktop: Event Names */}
                      <div className="hidden md:flex flex-col gap-1 w-full mt-1 overflow-y-auto custom-scrollbar">
                        {[...evts].sort((a, b) => a.title.localeCompare(b.title, 'ko')).map((ev) => {
                           const myEvent = isMyEvent(ev);
                           return (
                             <div 
                                key={ev.id} 
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1",
                                  myEvent 
                                    ? "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200 border border-rose-200 dark:border-rose-900/50" 
                                    : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 border border-transparent"
                                )}
                             >
                               <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", myEvent ? "bg-rose-500" : "bg-gray-300")}></span>
                               {ev.title}
                             </div>
                           );
                        })}
                      </div>
                    </>
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
