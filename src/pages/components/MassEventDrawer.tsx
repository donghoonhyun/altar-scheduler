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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import type { MemberDoc } from '@/types/firestore';
import type {
  CreateMassEventRequest,
  CreateMassEventResponse,
} from '../../../functions/src/massEvents/createMassEvent';

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
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; grade: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ✅ 복사단 멤버 목록 불러오기
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const ref = collection(db, 'server_groups', serverGroupId, 'members');
        const snaps = await getDocs(ref);

        const list = snaps.docs
          .map((d) => d.data() as MemberDoc)
          .filter((m) => m.name_kor && m.baptismal_name)
          .map((m) => {
            const gradeStr = String(m.grade || '')
              .trim()
              .toUpperCase(); // ✅ 문자열 강제 변환
            const grade = [
              'E1',
              'E2',
              'E3',
              'E4',
              'E5',
              'E6',
              'M1',
              'M2',
              'M3',
              'H1',
              'H2',
              'H3',
            ].includes(gradeStr)
              ? gradeStr
              : '기타';

            return {
              id: m.uid ?? m.id ?? crypto.randomUUID(),
              name: `${m.name_kor} ${m.baptismal_name}`,
              grade,
            };
          })
          .sort((a, b) => {
            const order = [
              'E1',
              'E2',
              'E3',
              'E4',
              'E5',
              'E6',
              'M1',
              'M2',
              'M3',
              'H1',
              'H2',
              'H3',
              '기타',
            ];
            const idxA = order.indexOf(a.grade);
            const idxB = order.indexOf(b.grade);
            if (idxA !== idxB) return idxA - idxB;
            return a.name.localeCompare(b.name, 'ko');
          });

        setMembers(list);
        console.log(
          '✅ members loaded:',
          list.map((m) => `${m.grade}-${m.name}`)
        ); // 디버깅용 로그
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
          setMemberIds((data.member_ids as string[]) || []);
        }
      } catch (err) {
        console.error('❌ 이벤트 불러오기 오류:', err);
      }
    };
    fetchEvent();
  }, [eventId, serverGroupId, db]);

  // ✅ 복사 선택 토글
  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    if (!title || !requiredServers || (!eventId && !date)) {
      setErrorMsg('모든 필드를 입력해주세요.');
      return;
    }

    // ✅ 선택 인원 검증 (정확히 동일해야 함)
    if (memberIds.length !== requiredServers) {
      setErrorMsg(
        `필요 인원(${requiredServers}명)에 맞게 정확히 ${requiredServers}명을 선택해야 합니다. (현재 ${memberIds.length}명 선택됨)`
      );
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

  // ✅ 학년별 그룹핑
  const groupedMembers = Object.entries(
    members.reduce<Record<string, { id: string; name: string }[]>>((acc, m) => {
      const grade = m.grade || '기타';
      if (!acc[grade]) acc[grade] = [];
      acc[grade].push({ id: m.id, name: m.name });
      return acc;
    }, {})
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md h-full fixed right-0 top-0 p-6 flex flex-col bg-white shadow-2xl overflow-y-auto fade-in">
        {/* Header */}
        <DialogTitle className="text-lg font-semibold">
          {eventId ? '미사 일정 수정' : '미사 일정 등록'}
        </DialogTitle>
        <DialogDescription className="text-sm text-gray-600 mb-3">
          미사 일정을 새로 등록하거나 기존 일정을 수정합니다.
        </DialogDescription>
        <div className="border-b border-gray-200 my-3" />

        {/* Body */}
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          {/* 미사 제목 */}
          <label className="block">
            <span className="font-medium">미사 제목</span>
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
            <span className="font-medium">필요 인원</span>
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

          {/* 복사 배정 (학년별 그룹) */}
          <label className="block">
            <span className="font-medium">배정 복사 선택</span>
            <div className="mt-2 border rounded p-3 max-h-[420px] overflow-y-auto space-y-3">
              {groupedMembers.map(([grade, list]) => (
                <div key={grade} className="space-y-1">
                  {/* 학년 헤더 */}
                  <div className="text-sm font-semibold text-gray-700 border-b border-gray-300 pb-0.5 mb-1">
                    {grade}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {list.map((m) => (
                      <label key={m.id} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          value={m.id}
                          checked={memberIds.includes(m.id)}
                          onChange={() => toggleMember(m.id)}
                          disabled={loading}
                        />
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              정확히 {requiredServers ?? '-'}명 선택해야 합니다.
            </p>
          </label>

          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 mt-6">
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
