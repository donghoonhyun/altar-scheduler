import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getMemberNamesByIds } from '@/lib/firestore';
import type { MassEventCalendar } from '@/types/massEvent';
import type { MassStatus } from '@/types/firestore';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(timezone);

/**
 * ✅ useMassEvents (월 단위 Firestore where 버전)
 * ---------------------------------------------------------
 * - Firestore mass_events.event_date(string) 기반
 * - currentMonth(YYYYMM) 범위 내 데이터만 실시간 구독
 * - Timezone: server_groups.timezone (default Asia/Seoul)
 * ---------------------------------------------------------
 */
export function useMassEvents(serverGroupId?: string, currentMonth?: dayjs.Dayjs) {
  const db = getFirestore();
  const [events, setEvents] = useState<MassEventCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverGroupId || !currentMonth) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    const tz = 'Asia/Seoul';
    const startStr = currentMonth.startOf('month').format('YYYYMMDD');
    const endStr = currentMonth.endOf('month').format('YYYYMMDD');

    const colRef = collection(db, 'server_groups', serverGroupId, 'mass_events');
    const q = query(
      colRef,
      where('event_date', '>=', startStr),
      where('event_date', '<=', endStr),
      orderBy('event_date', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          const list = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const d = docSnap.data();
              const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
              const servers =
                memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

              const status: MassStatus = (d.status as MassStatus) || 'MASS-NOTCONFIRMED';
              const eventDateStr = d.event_date as string;

              // 🔹 timezone 적용 표시용 변환 (UI label 계산용)
              const localDay = dayjs.tz(eventDateStr, 'YYYYMMDD', tz);
              const formattedLabel = localDay.format('YYYY-MM-DD');

              return {
                id: docSnap.id,
                title: d.title || '(제목없음)',
                event_date: eventDateStr, // ✅ 원본 "YYYYMMDD"
                required_servers: d.required_servers ?? 0,
                member_ids: memberIds,
                servers,
                status,
                // 🔹 UI에서 바로 날짜 정렬/표시용으로도 사용 가능
                formatted_date: formattedLabel,
              } satisfies MassEventCalendar;
            })
          );

          setEvents(list);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('🔥 useMassEvents snapshot error:', err);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ Firestore onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [serverGroupId, currentMonth, db]);

  return { events, loading, error };
}
