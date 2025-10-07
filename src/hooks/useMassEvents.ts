import { useEffect, useState, useCallback } from 'react';
import { getFirestore, getDocs, collection } from 'firebase/firestore';
import { getMemberNamesByIds } from '@/lib/firestore';
import type { MassEventCalendar } from '@/types/massEvent';

/**
 * ✅ 공용 훅: 특정 serverGroupId의 미사일정 + 복사명 로드
 * 사용처: Dashboard / MassEventPlanner
 */
export function useMassEvents(serverGroupId?: string) {
  const db = getFirestore();
  const [events, setEvents] = useState<MassEventCalendar[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMassEvents = useCallback(async () => {
    if (!serverGroupId) return;

    try {
      setLoading(true);
      setError(null);

      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));
      const list: MassEventCalendar[] = [];

      for (const docSnap of snap.docs) {
        const d = docSnap.data();

        const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
        const servers =
          memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

        list.push({
          id: docSnap.id,
          date: d.date, // ✅ Firestore Timestamp 그대로
          title: d.title,
          required_servers: d.required_servers,
          servers,
          status: d.status || 'MASS-NOTCONFIRMED',
        });
      }

      setEvents(list);
    } catch (err: unknown) {
      console.error('🔥 useMassEvents Error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('데이터를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [db, serverGroupId]);

  useEffect(() => {
    fetchMassEvents();
  }, [fetchMassEvents]);

  return { events, loading, error, refetch: fetchMassEvents };
}
