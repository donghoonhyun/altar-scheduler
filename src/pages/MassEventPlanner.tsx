import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import type { MassEventDB, MassEventCalendar } from '../types/massEvent';

// ✅ Firestore에서 member_ids를 이름으로 변환하는 유틸
async function getMemberNamesByIds(serverGroupId: string, memberIds: string[]): Promise<string[]> {
  const db = getFirestore();
  const names: string[] = [];

  if (!memberIds || memberIds.length === 0) return [];

  await Promise.all(
    memberIds.map(async (id) => {
      const ref = doc(db, `server_groups/${serverGroupId}/members/${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const fullName = data.baptismal_name
          ? `${data.name_kor} ${data.baptismal_name}`
          : data.name_kor;
        names.push(fullName);
      }
    })
  );

  return names;
}

const MassEventPlanner: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const db = getFirestore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<MassEventCalendar[]>([]);

  // ✅ Firestore에서 미사 일정 + 복사 이름 조인
  const fetchEvents = useCallback(async () => {
    if (!serverGroupId) return;

    const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));
    const list: MassEventCalendar[] = [];

    for (const docSnap of snap.docs) {
      const d = docSnap.data();

      // member_ids가 있는 경우 이름 조회
      const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
      const servers =
        memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

      list.push({
        id: docSnap.id,
        date: d.date, // Firestore Timestamp 그대로 유지
        title: d.title,
        required_servers: d.required_servers,
        servers, // ✅ 이름 배열
      });
    }

    setEvents(list);
  }, [db, serverGroupId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDayClick = (date: Date, eventId?: string) => {
    if (eventId) {
      setSelectedEventId(eventId);
      setSelectedDate(null);
    } else {
      setSelectedEventId(undefined);
      setSelectedDate(date);
    }
    setDrawerOpen(true);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">미사 일정 관리</h2>

      {/* ✅ 복사 이름이 포함된 events 전달 */}
      <MassCalendar events={events} onDayClick={handleDayClick} />

      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={() => {
            setDrawerOpen(false);
            fetchEvents(); // Drawer 닫을 때 다시 로드
          }}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
