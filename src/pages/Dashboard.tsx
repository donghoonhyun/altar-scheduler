// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ServerStats from './components/ServerStats';
import NextMonthPlan from './components/NextMonthPlan';
import MassCalendar from './components/MassCalendar';
import { useSession } from '../state/session';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import RoleBadge from './components/RoleBadge';

interface MassEvent {
  id: string;
  date: string;
  title: string;
  servers: string[];
}

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const [events, setEvents] = useState<MassEvent[]>([]);
  const [parishCode, setParishCode] = useState<string>('');

  useEffect(() => {
    if (!serverGroupId) return;
    const db = getFirestore();

    const fetchServerGroup = async () => {
      const sgRef = doc(db, 'server_groups', serverGroupId);
      const sgSnap = await getDoc(sgRef);
      if (sgSnap.exists()) {
        setParishCode(sgSnap.data().parish_code || '');
      }
    };

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

    fetchServerGroup();
    fetchEvents();
  }, [serverGroupId]);

  if (!serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  return (
    <div>
      {/* ✅ 상단 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            안녕하세요, {session.user?.displayName || session.user?.email} 플래너님 👋
          </h2>
          <p className="text-gray-600 mt-1">이번 달 배정 일정을 확인하세요.</p>
        </div>
        <RoleBadge serverGroupId={serverGroupId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {/* ✅ MyInfoCard 제거 */}
          <ServerStats parishCode={parishCode} serverGroupId={serverGroupId} />
        </div>

        <div className="flex flex-col gap-4">
          <NextMonthPlan serverGroupId={serverGroupId} />
        </div>

        <div className="md:col-span-2">
          <MassCalendar events={events} highlightServerName={session?.user?.displayName || ''} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
