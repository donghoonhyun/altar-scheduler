import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import MassCalendar from './components/MassCalendar';
import MassEventDrawer from './components/MassEventDrawer';
import type { MassEventDB, MassEventCalendar } from '../types/massEvent';

const MassEventPlanner: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const db = getFirestore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<MassEventDB[]>([]);

  // ✅ Firestore에서 미사 일정 불러오기
  const fetchEvents = useCallback(async () => {
    if (!serverGroupId) return;
    const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));
    const list: MassEventDB[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date, // ✅ Timestamp 그대로 전달
        title: d.title,
        required_servers: d.required_servers,
      };
    });
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

  const calendarEvents: MassEventCalendar[] = events.map((ev) => ({
    id: ev.id,
    date: ev.date,
    title: ev.title,
    required_servers: ev.required_servers,
    servers: [],
  }));

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">미사 일정 관리</h2>
      <MassCalendar events={calendarEvents} onDayClick={handleDayClick} />
      {drawerOpen && serverGroupId && (
        <MassEventDrawer
          eventId={selectedEventId}
          date={selectedDate}
          serverGroupId={serverGroupId}
          onClose={() => {
            setDrawerOpen(false);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
};

export default MassEventPlanner;
