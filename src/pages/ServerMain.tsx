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

import ServerHero, { type ServerHeroState } from './components/ServerHero';
import ServerMonthCalendar from './components/ServerMonthCalendar';

import MassEventMiniDrawer from '@/components/MassEventMiniDrawer';

import type { MassEventDoc, MassStatus, MemberDoc } from '@/types/firestore';
import { ChevronRight, ClipboardCheck } from 'lucide-react';

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
      responses: Record<string, any>;
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
            responses: snap.data().responses || {},
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

  const isMyEvent = (ev: MassEventDoc) =>
    ev.member_ids?.some((mid: string) => checkedMemberIds.includes(mid));

  // ── 상단 카드에서 캐릭터가 알려 줄 내용 ─────────────────────────────────────
  const roleLabel = (() => {
    const roles = (serverGroupId && session.groupRoles[serverGroupId]) || [];
    if (roles.includes('admin')) return '어드민';
    if (roles.includes('planner')) return '플래너';
    return '복사';
  })();

  const heroState: ServerHeroState = (() => {
    const monthLabel = currentMonth.format('M월');
    const activeMembers = members.filter((m) => m.active);
    const pendingMembers = members.filter((m) => m.active === false && m.request_confirmed === false);
    const selected = members.find((m) => m.memberId === checkedMemberIds[0]);
    const seed = selected?.memberId || members[0]?.memberId || session.user?.uid || 'altar';

    if (members.length === 0) {
      return {
        kind: 'info',
        seed,
        pose: 'wave',
        title: '복사를 등록해 주세요',
        description: '자녀나 본인을 복사로 등록하면 미사 일정을 볼 수 있어요.',
        action: { label: '+ 복사 추가하기', onClick: () => navigate(`/add-member?sg=${serverGroupId}`) },
      };
    }
    if (activeMembers.length === 0 && pendingMembers.length > 0) {
      return {
        kind: 'info',
        seed: pendingMembers[0].memberId,
        pose: 'wait',
        tone: 'amber',
        title: '승인을 기다리고 있어요',
        description: `${pendingMembers[0].name_kor} 복사의 신청을 플래너가 확인하고 있어요. 승인되면 알려드릴게요.`,
      };
    }
    if (activeMembers.length === 0 || !selected) {
      return {
        kind: 'info',
        seed,
        pose: 'rest',
        tone: 'slate',
        title: '지금은 쉬고 있어요',
        description: '활동을 다시 시작하려면 플래너에게 알려 주세요.',
      };
    }

    if (monthStatus === 'FINAL-CONFIRMED') {
      const today = dayjs().startOf('day');
      const myEvents = events
        .filter(isMyEvent)
        .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title, 'ko'));
      const next = myEvents.find((ev) => !dayjs(ev.event_date, 'YYYYMMDD').isBefore(today, 'day'));

      if (next) {
        const date = dayjs(next.event_date, 'YYYYMMDD');
        const diff = date.startOf('day').diff(today, 'day');
        return {
          kind: 'next',
          seed,
          memberName: selected.name_kor,
          dday: diff === 0 ? '오늘이에요!' : diff === 1 ? '내일이에요' : `D-${diff}`,
          dateLabel: `${date.format('M월 D일')} (${'일월화수목금토'[date.day()]})`,
          title: next.title,
          isMain: next.main_member_id === selected.memberId,
          monthCount: myEvents.length,
          monthLabel,
          onOpen: () => handleDayClick(date.date()),
        };
      }
      if (myEvents.length > 0) {
        return {
          kind: 'info',
          seed,
          pose: 'cheer',
          title: `${monthLabel} 복사를 모두 마쳤어요`,
          description: `${selected.name_kor} 복사가 ${myEvents.length}번 봉사했어요. 수고했어요!`,
        };
      }
      return {
        kind: 'info',
        seed,
        pose: 'pray',
        title: `${monthLabel}에는 배정이 없어요`,
        description: '다음 달 일정을 기다려 주세요.',
      };
    }

    if (monthStatus === 'SURVEY-CONFIRMED') {
      return {
        kind: 'info',
        seed,
        pose: 'pray',
        title: `${monthLabel} 배정을 정리하고 있어요`,
        description: '배정이 확정되면 여기에서 알려드릴게요.',
      };
    }
    if (monthStatus === 'MASS-CONFIRMED') {
      return {
        kind: 'info',
        seed,
        pose: 'bell',
        title: `${monthLabel} 미사 일정이 정해졌어요`,
        description: '설문이 열리면 못 오는 날을 알려 주세요.',
      };
    }
    return {
      kind: 'info',
      seed,
      pose: 'candle',
      title: `${monthLabel} 일정을 준비하고 있어요`,
      description: '일정이 정해지면 달력에 나타나요.',
    };
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-sky-50 to-emerald-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 pb-12 transition-colors duration-300">
      <div className="max-w-lg md:max-w-6xl mx-auto px-4 pt-3 space-y-3 ui-stagger">
        {/* 1) 인사말 + 캐릭터가 알려 주는 다음 배정/현재 상황 */}
        <ServerHero
          userName={session.userInfo?.userName}
          baptismalName={session.userInfo?.baptismalName}
          roleLabel={roleLabel}
          state={heroState}
        />

        {/* 2) 내 복사 목록 */}
        {serverGroupId && session.user && members.length > 0 && (
          <MyMembersPanel
            members={members}
            userUid={session.user.uid}
            serverGroupId={serverGroupId}
            checkedMemberIds={checkedMemberIds}
            onToggle={handleToggleMember}
          />
        )}

        {/* 2.5) 설문 알림 - 기간 체크 포함 */}
        {surveyInfo &&
         checkedMemberIds.length === 1 &&
         surveyInfo.targetMemberIds.includes(checkedMemberIds[0]) &&
         serverGroupId &&
         // Check if today is within survey period (inclusive)
         !dayjs().isBefore(dayjs(surveyInfo.startDate?.toDate()), 'day') &&
         !dayjs().isAfter(dayjs(surveyInfo.endDate?.toDate()), 'day') && (() => {
          const alreadyResponded = !!surveyInfo.responses[checkedMemberIds[0]];
          return (
            <div
              onClick={() => {
                  const targetId = checkedMemberIds[0];
                  navigate(`/survey/${serverGroupId}/${surveyInfo.month}?memberId=${targetId}`);
              }}
              className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-sky-500 to-violet-500 p-4 text-white shadow-md cursor-pointer transition active:scale-[0.98]"
            >
              <ClipboardCheck size={30} className="shrink-0" />
              <div className="flex-1 min-w-0">
                 <h3 className="font-display text-lg leading-snug">
                   {alreadyResponded
                     ? '설문에 참여했어요'
                     : `${dayjs(surveyInfo.month, 'YYYYMM').format('M월')} 설문에 참여해 주세요`}
                 </h3>
                 <p className="text-sm text-white/85">
                   {alreadyResponded ? '마감 전까지 고칠 수 있어요' : '못 오는 날만 알려 주면 돼요'}
                 </p>
              </div>
              <ChevronRight className="shrink-0" size={20} />
            </div>
          );
        })()}

        {/* 3) 달력 — 등록된 복사가 있을 때만 */}
        {serverGroupId && members.length > 0 && (
          <ServerMonthCalendar
            currentMonth={currentMonth}
            events={events}
            monthStatus={monthStatus}
            isMyEvent={isMyEvent}
            avatarSeed={checkedMemberIds[0]}
            selectedDate={drawerOpen ? drawerDate : null}
            onDayClick={handleDayClick}
            // ✅ 세션 상태 업데이트 함수 사용
            onPrevMonth={() => session.setCurrentViewDate?.(currentMonth.subtract(1, 'month'))}
            onNextMonth={() => session.setCurrentViewDate?.(currentMonth.add(1, 'month'))}
            onToday={() => session.setCurrentViewDate?.(dayjs())}
          />
        )}
      </div>

      {/* Drawer */}
      {serverGroupId && members.length > 0 && (
        <MassEventMiniDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          events={drawerEvents}
          date={drawerDate}
          serverGroupId={serverGroupId}
          monthStatus={monthStatus}
          currentUserId={checkedMemberIds[0]}
        />
      )}
    </div>
  );
}
