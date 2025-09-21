import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "./components/Layout";
import MyInfoCard from "./components/MyInfoCard";
import ServerStats from "./components/ServerStats";
import NextMonthPlan from "./components/NextMonthPlan";
import MassCalendar from "./components/MassCalendar";
import RoleGuard from "./components/RoleGuard";
import { useSession } from "../state/session";
import { getFirestore, collection, getDocs } from "firebase/firestore";

interface MassEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  servers: string[];
}

const Dashboard: React.FC = () => {
  const { parishCode, serverGroupId } = useParams<{
    parishCode: string;
    serverGroupId: string;
  }>();
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
            : d.date, // timestamp → YYYY-MM-DD
          title: d.title,
          servers: d.assigned_servers || [], // schedules와 조합 필요시 확장
        };
      });
      setEvents(list);
    };
    fetchEvents();
  }, [serverGroupId]);

  if (!parishCode || !serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  return (
    <RoleGuard require="planner" serverGroupId={serverGroupId} parishCode={parishCode}>
      <Layout>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <MyInfoCard parishCode={parishCode} serverGroupId={serverGroupId} />
            <ServerStats parishCode={parishCode} serverGroupId={serverGroupId} />
          </div>

          <div className="flex flex-col gap-4">
            <NextMonthPlan parishCode={parishCode} serverGroupId={serverGroupId} />
          </div>

          <div className="md:col-span-2">
            <MassCalendar
              events={events}
              highlightServerName={session?.user?.displayName || ""}
            />
          </div>
        </div>
      </Layout>
    </RoleGuard>
  );
};

export default Dashboard;
