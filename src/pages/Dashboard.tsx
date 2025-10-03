// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MyInfoCard from './components/MyInfoCard';
import ServerStats from './components/ServerStats';
import NextMonthPlan from './components/NextMonthPlan';
import MassCalendar from './components/MassCalendar';
import RoleGuard from './components/RoleGuard';
import { useSession } from '../state/session';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  Timestamp, // ✅ Firestore Timestamp 타입
} from 'firebase/firestore';
// import type { DocumentData } from 'firebase/firestore'; // ✅ 타입 전용 import

// 🔹 Firestore 원본 문서 타입
interface MassEventDoc {
  date: Timestamp;
  title: string;
  assigned_servers?: string[];
}

// 🔹 UI에서 사용할 타입
interface MassEvent {
  id: string;
  date: string;
  title: string;
  servers: string[];
}

const Dashboard: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const navigate = useNavigate();

  const [events, setEvents] = useState<MassEvent[]>([]);
  const [parishCode, setParishCode] = useState<string>('');

  useEffect(() => {
    if (!serverGroupId) return;
    const db = getFirestore();

    // 📌 복사단 정보 가져오기 (parish_code)
    const fetchServerGroup = async () => {
      const sgRef = doc(db, 'server_groups', serverGroupId);
      const sgSnap = await getDoc(sgRef);
      if (sgSnap.exists()) {
        const data = sgSnap.data() as { parish_code?: string };
        setParishCode(data.parish_code || '');
      }
    };

    // 📌 미사 이벤트 불러오기
    const fetchEvents = async () => {
      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));

      const list: MassEvent[] = snap.docs.map((docSnap) => {
        const d = docSnap.data() as MassEventDoc;
        return {
          id: docSnap.id,
          date: d.date.toDate().toISOString().substring(0, 10), // Timestamp → string 변환
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
    <RoleGuard require="planner" serverGroupId={serverGroupId}>
      <div className="mb-6">
        <h2 className="text-xl font-bold">안녕하세요, {session.user?.displayName} 플래너님 👋</h2>
        <p className="text-gray-600 mt-1">이번 달 배정 일정을 확인하세요.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <MyInfoCard serverGroupId={serverGroupId} />

          {/* 📌 복사단 현황 → 현재 그룹의 복사 명단 관리 페이지로 이동 */}
          <div
            onClick={() => navigate(`/server-groups/${serverGroupId}/servers`)}
            className="cursor-pointer"
          >
            <ServerStats parishCode={parishCode} serverGroupId={serverGroupId} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <NextMonthPlan parishCode={parishCode} serverGroupId={serverGroupId} />
        </div>

        <div className="md:col-span-2">
          <MassCalendar events={events} highlightServerName={session?.user?.displayName || ''} />
        </div>
      </div>
    </RoleGuard>
  );
};

export default Dashboard;
