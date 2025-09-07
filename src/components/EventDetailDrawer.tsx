import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface EventDetailDrawerProps {
  parishId: string;
  eventId: string | null; // 선택된 이벤트 ID
  onClose: () => void;
}

// ✅ 명시적 타입 정의
interface MassEventDetail {
  id: string;
  title: string;
  requiredServers: number;
  status:
    | "MASS-NOTCONFIRMED"
    | "MASS-CONFIRMED"
    | "SURVEY-CONFIRMED"
    | "FINAL-CONFIRMED";
}

export default function EventDetailDrawer({
  parishId,
  eventId,
  onClose,
}: EventDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState<MassEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Firestore에서 이벤트 불러오기
  useEffect(() => {
    if (!eventId) return;

    async function fetchEvent() {
      setLoading(true);
      try {
        const snap = await getDoc(
          doc(db, "parishes", parishId, "mass_events", eventId!)
        );
        if (snap.exists()) {
          const data = snap.data();
          setEventData({
            id: snap.id,
            title: data.title ?? "",
            requiredServers: data.requiredServers ?? 0,
            status: data.status ?? "MASS-NOTCONFIRMED",
          });
        } else {
          setError("이벤트를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("Firestore 오류:", err);
        setError("데이터 불러오기 실패");
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [parishId, eventId]);

  // 🔹 저장 처리
  async function handleSave() {
    if (!eventId || !eventData) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "parishes", parishId, "mass_events", eventId!), {
        title: eventData.title,
        requiredServers: eventData.requiredServers,
        status: eventData.status,
      });
      onClose(); // 저장 후 닫기
    } catch (err) {
      console.error("Firestore 업데이트 오류:", err);
      setError("저장 실패");
    } finally {
      setLoading(false);
    }
  }

  if (!eventId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full sm:w-96 bg-white dark:bg-gray-900 p-6 overflow-y-auto shadow-lg">
        <h2 className="text-xl font-semibold mb-4">미사 일정 상세</h2>

        {loading && <p>불러오는 중...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {eventData && (
          <>
            {/* 미사명 */}
            <label className="block mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                미사명
              </span>
              <input
                type="text"
                value={eventData.title}
                onChange={(e) =>
                  setEventData({ ...eventData, title: e.target.value })
                }
                className="w-full mt-1 p-2 border rounded bg-gray-50 dark:bg-gray-800"
              />
            </label>

            {/* 필요 인원 */}
            <label className="block mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                필요 인원
              </span>
              <select
                value={eventData.requiredServers}
                onChange={(e) =>
                  setEventData({
                    ...eventData,
                    requiredServers: Number(e.target.value),
                  })
                }
                className="w-full mt-1 p-2 border rounded bg-gray-50 dark:bg-gray-800"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} 명
                  </option>
                ))}
              </select>
            </label>

            {/* 상태 */}
            <label className="block mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                상태
              </span>
              <select
                value={eventData.status}
                onChange={(e) =>
                  setEventData({
                    ...eventData,
                    status: e.target.value as MassEventDetail["status"],
                  })
                }
                className="w-full mt-1 p-2 border rounded bg-gray-50 dark:bg-gray-800"
              >
                <option value="MASS-NOTCONFIRMED">미확정</option>
                <option value="MASS-CONFIRMED">확정</option>
                <option value="SURVEY-CONFIRMED">설문확정</option>
                <option value="FINAL-CONFIRMED">최종확정</option>
              </select>
            </label>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
