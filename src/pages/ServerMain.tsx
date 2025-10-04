// src/pages/ServerMain.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import RoleBadge from './components/RoleBadge';
import MassCalendar from './components/MassCalendar';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface MassEvent {
  id: string;
  date: string;
  title: string;
  servers: string[];
}

const ServerMain: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const [events, setEvents] = useState<MassEvent[]>([]);

  useEffect(() => {
    if (!serverGroupId) return;
    const db = getFirestore();

    const fetchEvents = async () => {
      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));
      const list: MassEvent[] = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date?.toDate ? d.date.toDate().toISOString().substring(0, 10) : d.date,
          title: d.title,
          servers: d.assigned_servers || [],
        };
      });
      setEvents(list);
    };

    fetchEvents();
  }, [serverGroupId]);

  if (!serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  return (
    <div className="p-4">
      {/* ✅ 상단 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            안녕하세요, {session.user?.displayName || session.user?.email} 복사님 👋
          </h2>
          <p className="text-gray-600 mt-1">나의 미사 배정 일정을 확인하세요.</p>
        </div>
        <RoleBadge serverGroupId={serverGroupId} />
      </div>

      {/* ✅ 전체 일정 달력 + 내 일정 하이라이트 */}
      <div className="mt-6">
        <MassCalendar events={events} highlightServerName={session?.user?.displayName || ''} />
      </div>
    </div>
  );
};

export default ServerMain;
