/**
 * 🔥 Firestore Access Layer (TypeScript Strict-safe 버전)
 *
 * 목적:
 *   - Firestore 초기화 및 공용 접근 함수 집합
 *   - 모든 페이지에서 동일한 DB 접근 규칙 유지
 *   - PRD-2.4.2.1 Firestore Access Layer 섹션 반영
 *
 * 특징:
 *   - noImplicitAny 대응
 *   - Timestamp/Date/string 타입 변환 명시
 *   - 모든 Firestore 결과 타입 안전하게 처리
 */

import {
  getFirestore,
  getDoc,
  getDocs,
  doc,
  collection,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { MassEventCalendar } from '@/types/massEvent';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import type { Dayjs } from 'dayjs';

export const db = getFirestore(); // ✅ export 추가 (전역 접근용)

// ---------------------------------------------------------------------------
// 🧩 1. Timestamp 유틸 (Firestore <-> dayjs 변환)
// ---------------------------------------------------------------------------

/**
 * ✅ Firestore Timestamp 객체 생성 (쓰기용)
 * @param date - string, Date, or dayjs 객체
 * @param tz - timezone, 기본값 'Asia/Seoul'
 */
export function makeFirestoreTimestamp(date: string | Date | Dayjs, tz = 'Asia/Seoul'): Timestamp {
  return Timestamp.fromDate(fromLocalDateToFirestore(date, tz));
}

/**
 * ✅ Firestore Timestamp → ISO 문자열 변환 (읽기용)
 * @param timestamp - Firestore Timestamp, Date, or string
 * @returns ISO yyyy-MM-dd 문자열
 */
export function toISOStringFromFirestore(timestamp?: Timestamp | Date | string): string {
  if (!timestamp) return '';

  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString().substring(0, 10);
  }

  if (timestamp instanceof Date) {
    return timestamp.toISOString().substring(0, 10);
  }

  if (typeof timestamp === 'string') {
    return timestamp.substring(0, 10);
  }

  return '';
}

// ---------------------------------------------------------------------------
// 👥 2. Member 관련 헬퍼
// ---------------------------------------------------------------------------

/**
 * ✅ member_ids → 이름 목록 변환
 * 사용처: Dashboard / MassEventPlanner
 */
export async function getMemberNamesByIds(
  serverGroupId: string,
  memberIds: string[]
): Promise<string[]> {
  if (!memberIds || memberIds.length === 0) return [];

  const results = await Promise.all(
    memberIds.map(async (id) => {
      const ref = doc(db, `server_groups/${serverGroupId}/members/${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as DocumentData;
        // ✅ Active check: Only return name if member is active
        if (data.active === false) return null;

        return data.baptismal_name
          ? `${data.name_kor} ${data.baptismal_name}`
          : data.name_kor;
      }
      return null;
    })
  );

  return results.filter((n): n is string => n !== null);
}

/**
 * ✅ 복사단(server_group) 기본정보 조회
 * @returns Firestore 문서 데이터 or null
 */
export async function getServerGroupById(serverGroupId: string): Promise<DocumentData | null> {
  const ref = doc(db, 'server_groups', serverGroupId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as DocumentData) : null;
}

// ---------------------------------------------------------------------------
// 🕊️ 3. MassEvent 관련 쿼리
// ---------------------------------------------------------------------------

/**
 * ✅ 특정 복사단(server_group)의 미사 일정 목록 조회
 * Firestore 문서 → UI용 MassEventCalendar[] 변환
 */
export async function getMassEvents(serverGroupId: string): Promise<MassEventCalendar[]> {
  const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'mass_events'));

  const list: MassEventCalendar[] = [];

  const promises: Promise<void>[] = snap.docs.map(
    async (docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const d = docSnap.data();
      const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
      const servers =
        memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

      list.push({
        id: docSnap.id,
        event_date: d.event_date || d.date, // 호환성 고려
        title: d.title,
        required_servers: d.required_servers,
        servers,
        status: d.status || 'MASS-NOTCONFIRMED',
      });
    }
  );

  await Promise.all(promises);

  return list;
}

/**
 * ✅ 개별 미사 일정 문서 조회
 */
export async function getMassEventById(
  serverGroupId: string,
  eventId: string
): Promise<MassEventCalendar | null> {
  const ref = doc(db, `server_groups/${serverGroupId}/mass_events/${eventId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const d = snap.data() as DocumentData;
  const memberIds: string[] = Array.isArray(d.member_ids) ? d.member_ids : [];
  const servers = memberIds.length > 0 ? await getMemberNamesByIds(serverGroupId, memberIds) : [];

  return {
    id: eventId,
    event_date: d.event_date || d.date, // 호환성 고려
    title: d.title,
    required_servers: d.required_servers,
    servers,
    status: d.status || 'MASS-NOTCONFIRMED',
  };
}
