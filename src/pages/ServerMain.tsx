// ServerMain.tsx
import { useEffect, useState } from 'react';
import { useSession } from '@/state/session';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dayjs, { Dayjs } from 'dayjs';

import { useNavigate } from 'react-router-dom';

import ServerGroupSelector from './components/ServerGroupSelector';
import MyMembersPanel from './components/MyMembersPanel';
import MassEventMiniDrawer from '@/components/MassEventMiniDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';

import type { MassEventDoc, MassStatus, MemberDoc } from '@/types/firestore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type MemberItem = MemberDoc & { memberId: string; active?: boolean };

export default function ServerMain() {
  const session = useSession();
  const navigate = useNavigate();

  const serverGroupId = session.currentServerGroupId ?? undefined;

  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [monthStatus, setMonthStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');

  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerDate, setDrawerDate] = useState<Dayjs | null>(null);
  const [drawerEvents, setDrawerEvents] = useState<MassEventDoc[]>([]);

  // 1) server_group 정보
  useEffect(() => {
    if (!serverGroupId) return;
    const ref = doc(db, 'server_groups', serverGroupId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setGroupName(snap.data().name || '');
      else setGroupName('');
    });
    return () => unsub();
  }, [serverGroupId]);

  // 2) 내 members
  useEffect(() => {
    if (!serverGroupId || !session.user) return;

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
    if (!serverGroupId) return;

    const yyyymm = currentMonth.format('YYYYMM');
    const ref = doc(db, 'server_groups', serverGroupId, 'month_status', yyyymm);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setMonthStatus(snap.data().status as MassStatus);
      else setMonthStatus('MASS-NOTCONFIRMED');
    });

    return () => unsub();
  }, [serverGroupId, currentMonth]);

  // members 변경 시 checkedMemberIds 동기화 (기본 모두 체크)
  useEffect(() => {
    const activeIds = members.filter((m) => m.active).map((m) => m.memberId);
    setCheckedMemberIds(activeIds);
  }, [members]);

  const handleToggleMember = (memberId: string) => {
    setCheckedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  // 4) mass_events
  useEffect(() => {
    if (!serverGroupId) return;

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
  }, [serverGroupId, currentMonth]);

  // 날짜 클릭 → Drawer
  const handleDayClick = (day: number) => {
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
    <div className="p-4">
      {/* 1) 복사단 선택 */}
      <ServerGroupSelector />

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
            className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
          >
            + 복사 추가하기
          </button>
        </div>
      )}

      {/* 🔥 4) 복사 없으면 달력 렌더링 중지 */}
      {members.length === 0 && null}

      {/* 🔥 members.length ≥ 1 일 때만 달력 렌더링 */}
      {members.length > 0 && (
        <>
          {/* 달력 상단 */}
          <div className="flex justify-between items-center mb-3">
            <div className="text-lg font-semibold">{groupName}</div>

            <div className="flex gap-2 items-center">
              <button onClick={() => setCurrentMonth((m) => m.subtract(1, 'month'))}>
                <ChevronLeft />
              </button>

              <span className="font-semibold">{currentMonth.format('YYYY년 M월')}</span>

              <button onClick={() => setCurrentMonth((m) => m.add(1, 'month'))}>
                <ChevronRight />
              </button>
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

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-14 flex items-center justify-center rounded cursor-pointer transition
                    ${mine ? 'bg-blue-600 text-white font-bold' : ''}
                    ${!mine && any ? 'bg-rose-100 text-rose-700' : ''}
                    ${!any ? 'text-gray-300' : ''}
                  `}
                >
                  <span>{day}</span>
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
  );
}
