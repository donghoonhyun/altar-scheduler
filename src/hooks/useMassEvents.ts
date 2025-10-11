import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  orderBy,
} from 'firebase/firestore';
import { getMemberNamesByIds } from '@/lib/firestore';
import { toLocalDateFromFirestore, fromLocalDateToFirestore } from '@/lib/dateUtils';
import type { MassEventCalendar } from '@/types/massEvent';
import type { MassStatus } from '@/types/firestore';
import dayjs from 'dayjs';

/**
 * ✅ useMassEvents (월 단위 Firestore where 버전)
 * ---------------------------------------------------------
 * 목적:
 *  - 특정 복사단(serverGroupId)의 특정 월(currentMonth) 일정만 실시간 구독
 *  - Firestore 쿼리 최적화 (UTC-safe)
 *  - TimezoneHandling 정책 준수 (Asia/Seoul)
 * ---------------------------------------------------------
 * 반환:
 *  { events, loading, error }
 * ---------------------------------------------------------
 */
export function useMassEvents(serverGroupId?: string, currentMonth?: dayjs.Dayjs) {
  const db = getFirestore();
  const [events, setEvents] = useState<MassEventCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ 파라미터 누락 방어
    if (!serverGroupId || !currentMonth) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return; // ❗ 이 부분은 void 반환 (cleanup 아님)
    }

    const tz = 'Asia/Seoul';

    // ✅ Firestore에서 UTC-safe 범위 설정
    const start = fromLocalDateToFirestore(currentMonth.startOf('month'), tz);
    const end = fromLocalDateToFirestore(currentMonth.endOf('month').add(1, 'day'), tz);

    const colRef = collection(db, 'server_groups', serverGroupId, 'mass_events');
    const q = query(
      colRef,
      where('date', '>=', start),
      where('date', '<', end),
      orderBy('date', 'asc')
    );

    // ✅ Firestore 실시간 리스너 등록
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

              const tz = d.timezone || 'Asia/Seoul';
              const localDayjs = toLocalDateFromFirestore(d.date, tz);
              const formattedDate = localDayjs.format('YYYY-MM-DD');
              const status: MassStatus = (d.status as MassStatus) || 'MASS-NOTCONFIRMED';

              return {
                id: docSnap.id,
                title: d.title,
                date: formattedDate,
                required_servers: d.required_servers ?? 0,
                servers,
                status,
              } satisfies MassEventCalendar;
            })
          );

          setEvents(list);
          setLoading(false);
          setError(null);
          // console.log(`📆 [useMassEvents] ${currentMonth.format('YYYY-MM')} → ${list.length} docs`);
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

    // ✅ cleanup
    return () => unsubscribe();
  }, [serverGroupId, currentMonth, db]);

  return { events, loading, error };
}
