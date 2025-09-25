import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MyInfoCard from "./components/MyInfoCard";
import ServerStats from "./components/ServerStats";
import NextMonthPlan from "./components/NextMonthPlan";
import MassCalendar from "./components/MassCalendar";
import RoleGuard from "./components/RoleGuard";
import { useSession } from "../state/session";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

  useEffect(() => {
    if (!serverGroupId) return;
    const db = getFirestore();
    const fetchEvents = async () => {
      const snap = await getDocs(
        collection(db, "server_groups", serverGroupId, "mass_events")
      );
      const list: MassEvent[] = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date?.toDate
            ? d.date.toDate().toISOString().substring(0, 10)
            : d.date,
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
    <RoleGuard require="planner" serverGroupId={serverGroupId}>
      <div className="mb-6">
        <h2 className="text-xl font-bold">
          안녕하세요, {session.user?.displayName} 플래너님 👋
        </h2>
        <p className="text-gray-600 mt-1">이번 달 배정 일정을 확인하세요.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <MyInfoCard parishCode="" serverGroupId={serverGroupId} />
          <ServerStats parishCode="" serverGroupId={serverGroupId} />
        </div>

        <div className="flex flex-col gap-4">
          <NextMonthPlan parishCode="" serverGroupId={serverGroupId} />
        </div>

        <div className="md:col-span-2">
          <MassCalendar
            events={events}
            highlightServerName={session?.user?.displayName || ""}
          />
        </div>
      </div>
    </RoleGuard>
  );
};

export default Dashboard;
