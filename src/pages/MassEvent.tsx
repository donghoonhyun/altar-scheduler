import { useParams } from "react-router-dom";
import { useState } from "react";
import MassCalendar from "../components/MassCalendar";
import EventDetailDrawer from "../components/EventDetailDrawer";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import type { MassEventDoc } from "../types/firestore";

export default function MassEvent() {
  const { parishId } = useParams<{ parishId: string }>();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (!parishId) {
    return <div className="p-6 text-red-600">잘못된 접근: parishId 없음</div>;
  }

  // 🔹 전월복사 기능
  async function handleCopyFromLastMonth() {
    const today = new Date();
    const thisMonth = today.getMonth() + 1;
    const lastMonth = thisMonth - 1;

    // 지난달 이벤트 불러오기
    const snap = await getDocs(
      collection(db, "parishes", parishId!, "mass_events")
    );

    type EventWithId = MassEventDoc & { id: string };

    const lastMonthEvents: EventWithId[] = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as MassEventDoc),
      }))
      .filter((ev) => ev.month === lastMonth);

    // 이번달로 복사 (id 제외)
    for (const ev of lastMonthEvents) {
      const copy: MassEventDoc = {
        title: ev.title,
        date: ev.date,
        month: thisMonth,
        requiredServers: ev.requiredServers,
        servers: ev.servers,
        status: ev.status,
      };

      await addDoc(collection(db, "parishes", parishId!, "mass_events"), copy);
    }

    alert("전월 미사 일정을 복사했습니다.");
  }

  // 🔹 설문 링크 복사
  function handleCopySurveyLink() {
    const url = `${window.location.origin}/p/${parishId}/surveys`;
    navigator.clipboard.writeText(url);
    alert("설문 링크가 복사되었습니다.");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">차월 미사 일정 관리</h1>

      {/* 버튼들 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopyFromLastMonth}
          className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700"
        >
          전월복사
        </button>
        <button
          onClick={() => alert("확정/취소 기능은 아직 구현 전입니다.")}
          className="px-4 py-2 rounded bg-blue-500 text-white"
        >
          확정/확정취소
        </button>
        <button
          onClick={handleCopySurveyLink}
          className="px-4 py-2 rounded bg-green-500 text-white"
        >
          설문링크 복사
        </button>
        <button
          onClick={() => alert("자동배정 기능은 아직 구현 전입니다.")}
          className="px-4 py-2 rounded bg-yellow-500 text-white"
        >
          자동배정
        </button>
      </div>

      {/* 달력 */}
      <MassCalendar parishId={parishId!} onSelectEvent={setSelectedEventId} />

      {/* 이벤트 상세 Drawer */}
      {selectedEventId && (
        <EventDetailDrawer
          parishId={parishId!}
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
}
