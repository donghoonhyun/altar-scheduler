import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getMemberNamesByIds } from '@/lib/firestore';
import { toLocalDateFromFirestore } from '@/lib/dateUtils';
import type { MassEventCalendar } from '@/types/massEvent';
import type { MassStatus } from '@/types/firestore';

/**
 * ✅ useMassEvents (실시간 리스너 + Timezone 적용 버전)
 * ---------------------------------------------------------
 * 목적:
 *  - 특정 복사단(serverGroupId)의 미사일정을 실시간으로 구독
 *  - 각 일정의 member_ids를 이름 배열로 변환
 *  - PRD-2.4.2.3 TimezoneHandling 정책 준수
 * ---------------------------------------------------------
 * 반환:
 *  { events, loading, error }
 * ---------------------------------------------------------
 */
export function useMassEvents(serverGroupId?: string) {
  const db = getFirestore();
  const [events, setEvents] = useState<MassEventCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverGroupId) return;

    const colRef = collection(db, 'server_groups', serverGroupId, 'mass_events');

    // ✅ Firestore 실시간 리스너 등록
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          // 병렬 처리용 Promise.all
          const list = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const d = docSnap.data();
              const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
              const servers =
                memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

              // 🔹 Timezone 변환 (fallback: Asia/Seoul)
              const tz = d.timezone || 'Asia/Seoul';
              const localDayjs = toLocalDateFromFirestore(d.date, tz);
              const formattedDate = localDayjs.format('YYYY-MM-DD');

              // 🔹 MassStatus 타입 강제
              const status: MassStatus = (d.status as MassStatus) || 'MASS-NOTCONFIRMED';

              return {
                id: docSnap.id,
                title: d.title,
                date: formattedDate,
                required_servers: d.required_servers,
                servers,
                status,
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

    // ✅ cleanup: 컴포넌트 unmount 시 구독 해제
    return () => unsubscribe();
  }, [serverGroupId, db]);

  return { events, loading, error };
}
