/**
 * 📘 useMonthStatus.ts (with lock support)
 * ------------------------------------------------------
 * Firestore server_groups/{id}/month_status/{YYYYMM} 실시간 구독 훅
 * ------------------------------------------------------
 * - status + lock 필드 실시간 구독
 * - 상태 변경 시 Firestore setDoc(merge:true)
 * - Planner ↔ Drawer 실시간 동기화
 * ------------------------------------------------------
 */

import { useEffect, useState, useCallback } from 'react';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import type { MassStatus } from '@/types/firestore';
import { toast } from 'sonner';

interface UseMonthStatusResult {
  status: MassStatus;
  lock: boolean;
  loading: boolean;
  updateStatus: (newStatus: MassStatus, updatedBy?: string, updatedByName?: string) => Promise<void>;
}

export const useMonthStatus = (serverGroupId?: string, monthKey?: string): UseMonthStatusResult => {
  const db = getFirestore();

  const [status, setStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  const [lock, setLock] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  /** 🔹 Firestore 실시간 구독 */
  useEffect(() => {
    if (!serverGroupId || !monthKey) return;

    const ref = doc(db, `server_groups/${serverGroupId}/month_status/${monthKey}`);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { status?: string; lock?: boolean };
          setStatus((data.status as MassStatus) || 'MASS-NOTCONFIRMED');
          setLock(data.lock || false);
        } else {
          setStatus('MASS-NOTCONFIRMED');
          setLock(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useMonthStatus] Snapshot Error:', err);
        toast.error('월 상태 구독 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, serverGroupId, monthKey]);

  /** 🔹 상태 변경 (Firestore 업데이트) */
  const updateStatus = useCallback(
    async (newStatus: MassStatus, updatedBy = 'system', updatedByName = 'System') => {
      if (!serverGroupId || !monthKey) return;
      const ref = doc(db, `server_groups/${serverGroupId}/month_status/${monthKey}`);
      try {
        const willLock = newStatus === 'FINAL-CONFIRMED'; // ✅ 최종 확정 시 자동 잠금
        await setDoc(
          ref,
          {
            status: newStatus,
            lock: willLock,
            updated_by: updatedBy,
            updated_by_name: updatedByName,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
        setStatus(newStatus);
        setLock(willLock);
        toast.success(
          `📘 월 상태가 "${newStatus}"로 변경되었습니다${willLock ? ' (편집 잠금됨)' : ''}.`
        );
      } catch (err) {
        console.error('[useMonthStatus] Update Error:', err);
        toast.error('월 상태 변경 중 오류가 발생했습니다.');
      }
    },
    [db, serverGroupId, monthKey]
  );

  return { status, lock, loading, updateStatus };
};
