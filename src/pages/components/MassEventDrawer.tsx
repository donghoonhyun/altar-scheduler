import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import dayjs from 'dayjs';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import type { MemberDoc, MassStatus } from '@/types/firestore';
import type {
  CreateMassEventRequest,
  CreateMassEventResponse,
} from '../../../functions/src/massEvents/createMassEvent';
// import { MASS_STATUS_LABELS } from '@/constants/massStatusLabels';

interface MassEventDrawerProps {
  eventId?: string;
  date: Date | null;
  serverGroupId: string;
  onClose: () => void;
}

const MassEventDrawer: React.FC<MassEventDrawerProps> = ({
  eventId,
  date,
  serverGroupId,
  onClose,
}) => {
  const db = getFirestore();

  const [title, setTitle] = useState('');
  const [requiredServers, setRequiredServers] = useState<number | null>(null);
  const [status, setStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ✅ 복사단 멤버 목록
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const ref = collection(db, 'server_groups', serverGroupId, 'members');
        const snaps = await getDocs(ref);
        const list: { id: string; name: string }[] = snaps.docs
          .map((d) => d.data() as MemberDoc)
          .filter((m) => m.name_kor && m.baptismal_name)
          .map((m) => ({
            id: m.uid ?? m.id ?? crypto.randomUUID(),
            name: `${m.name_kor} ${m.baptismal_name}`,
          }));
        setMembers(list);
      } catch (err) {
        console.error('❌ members load error:', err);
      }
    };
    fetchMembers();
  }, [db, serverGroupId]);

  // ✅ 기존 이벤트 불러오기
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as DocumentData;
          setTitle(data.title || '');
          setRequiredServers(data.required_servers || null);
          setStatus((data.status as MassStatus) || 'MASS-NOTCONFIRMED');
          setMemberIds((data.member_ids as string[]) || []);
        }
      } catch (err) {
        console.error('❌ 이벤트 불러오기 오류:', err);
      }
    };
    fetchEvent();
  }, [eventId, serverGroupId, db]);

  // ✅ 저장 처리
  const handleSave = async () => {
    if (!title || !requiredServers || (!eventId && !date)) {
      setErrorMsg('모든 필드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const groupSnap = await getDoc(doc(db, 'server_groups', serverGroupId));
      const tz = (groupSnap.data()?.timezone as string) || 'Asia/Seoul';

      if (eventId) {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        await setDoc(
          ref,
          {
            title,
            required_servers: requiredServers,
            status,
            member_ids: memberIds,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`✅ MassEvent updated: ${eventId}`);
      } else {
        const functions = getFunctions();
        const createMassEvent = httpsCallable<CreateMassEventRequest, CreateMassEventResponse>(
          functions,
          'createMassEvent'
        );
        const localMidnight = fromLocalDateToFirestore(date!, tz);
        const formattedDate = dayjs(localMidnight).format('YYYY-MM-DD[T]00:00:00');
        const res = await createMassEvent({
          serverGroupId,
          title,
          date: formattedDate,
          requiredServers,
        });
        if (!res.data.success) throw new Error(res.data.error || '저장 실패');
      }

      onClose();
    } catch (err) {
      console.error('❌ 저장 오류:', err);
      setErrorMsg('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 삭제 처리
  const handleDelete = async () => {
    if (!eventId) return;
    if (!window.confirm('이 미사 일정을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
      await deleteDoc(ref);
      console.log(`🗑️ MassEvent deleted: ${eventId}`);
      onClose();
    } catch (err) {
      console.error('❌ 삭제 오류:', err);
      setErrorMsg('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-96 h-full right-0 top-0 fixed p-6 flex flex-col gap-4 overflow-visible shadow-2xl">
        <DialogTitle>{eventId ? '미사 일정 수정' : '미사 일정 등록'}</DialogTitle>
        <DialogDescription>미사 일정을 새로 등록하거나 기존 일정을 수정합니다.</DialogDescription>

        {/* 미사 제목 */}
        <label className="block">
          <span className="text-sm font-medium">미사 제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full border rounded px-2 py-1"
            placeholder="예: 주일 11시 미사"
            disabled={loading}
          />
        </label>

        {/* 필요 인원 */}
        <label className="block">
          <span className="text-sm font-medium">필요 인원</span>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
              <label key={n} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="requiredServers"
                  value={n}
                  checked={requiredServers === n}
                  onChange={() => setRequiredServers(n)}
                  disabled={loading}
                />
                {n}명
              </label>
            ))}
          </div>
        </label>

        {/* 배정 복사 */}
        <label className="block">
          <span className="text-sm font-medium">배정 복사</span>
          <select
            multiple
            className="mt-1 w-full border rounded px-2 py-1 h-28"
            value={memberIds}
            onChange={(e) => setMemberIds(Array.from(e.target.selectedOptions, (opt) => opt.value))}
            disabled={loading}
          >
            {members.map((m) => (
              <option key={`${m.id}-${m.name}`} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        {/* 상태 (radio 버튼으로 변경) */}
        <label className="block">
          <span className="text-sm font-medium">상태</span>
          <div className="flex flex-col gap-1 mt-1">
            {[
              { value: 'MASS-NOTCONFIRMED', label: '미확정' },
              { value: 'MASS-CONFIRMED', label: '미사확정' },
              { value: 'SURVEY-CONFIRMED', label: '설문종료' },
              { value: 'FINAL-CONFIRMED', label: '최종확정' },
            ].map((s) => (
              <label key={s.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="massStatus"
                  value={s.value}
                  checked={status === s.value}
                  onChange={() => setStatus(s.value as MassStatus)}
                  disabled={loading}
                />
                <StatusBadge status={s.value as MassStatus} />
                <span className="text-sm">{s.label}</span>
              </label>
            ))}
          </div>
        </label>

        {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

        {/* 하단 버튼 */}
        <div className="mt-auto flex justify-between items-center pt-2">
          {eventId && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={loading}
              className="text-red-600 border-red-400"
            >
              삭제
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>
                취소
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? '저장 중...' : eventId ? '수정' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MassEventDrawer;
