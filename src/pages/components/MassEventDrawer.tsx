import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import type {
  CreateMassEventRequest,
  CreateMassEventResponse,
} from '../../../functions/src/massEvents/createMassEvent';
import dayjs from 'dayjs';
import { fromLocalDateToFirestore } from '../../lib/dateUtils';


interface MassEventDrawerProps {
  eventId?: string; // 선택한 이벤트 ID (없으면 신규 생성)
  date: Date | null; // 신규 생성일 경우만 사용
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ✅ 기존 이벤트 불러오기 (수정 모드)
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setRequiredServers(data.required_servers || null);
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
      if (eventId) {
        // ✏️ 기존 이벤트 수정
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        await setDoc(
          ref,
          {
            title,
            required_servers: requiredServers,
            updated_at: new Date(),
          },
          { merge: true }
        );
        console.log(`✅ MassEvent updated: ${eventId}`);
      } else {
        // 🆕 신규 이벤트 생성 (Cloud Function)
        const functions = getFunctions();
        const createMassEvent = httpsCallable<CreateMassEventRequest, CreateMassEventResponse>(
          functions,
          'createMassEvent'
        );

        // ✅ 날짜 변환 (PRD 2.4.2.3 규칙)
        // fromLocalDateToFirestore()는 UTC Date 반환 → ISO 변환 시 UTC 기준 문자열 생성
        const localMidnight = fromLocalDateToFirestore(date!, 'Asia/Seoul');
        const formattedDate = dayjs(localMidnight).format('YYYY-MM-DD[T]00:00:00');

        const res = await createMassEvent({
          serverGroupId,
          title,
          date: formattedDate, // ✅ PRD 규칙: 문자열(로컬 자정)
          requiredServers,
        });

        if (res.data.success) {
          console.log(res.data.message || `✅ MassEvent created: ${res.data.eventId}`);
        } else {
          throw new Error(res.data.error || '저장 실패');
        }
      }

      onClose();
    } catch (err) {
      console.error('❌ 저장 오류:', err);
      setErrorMsg('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 삭제 처리 (기존 이벤트만)
  const handleDelete = async () => {
    if (!eventId) return;
    if (!window.confirm('이 미사 일정을 정말 삭제하시겠습니까?')) return;

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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
      <div className="bg-white w-80 h-full shadow-lg p-4 flex flex-col">
        {/* 상단 헤더 */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{eventId ? '미사 일정 수정' : '미사 일정 등록'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black" disabled={loading}>
            ✕
          </button>
        </div>

        {/* 신규 등록 시 날짜 표시 */}
        {!eventId && (
          <p className="text-sm text-gray-600 mb-4">
            선택한 날짜: {date ? date.toLocaleDateString('ko-KR') : '미선택'}
          </p>
        )}

        {/* 제목 */}
        <label className="block mb-2">
          <span className="text-sm font-medium">미사 제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1"
            placeholder="예: 주일 11시 미사"
            disabled={loading}
          />
        </label>

        {/* 필요 인원 */}
        <label className="block mb-2">
          <span className="text-sm font-medium">필요 인원</span>
          <div className="flex gap-2 mt-1">
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

        {errorMsg && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}

        <div className="mt-auto flex justify-between items-center">
          {/* 삭제 버튼 */}
          {eventId && (
            <button
              onClick={handleDelete}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              disabled={loading}
            >
              삭제
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded border border-gray-300"
              disabled={loading}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '저장 중...' : eventId ? '수정' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MassEventDrawer;
