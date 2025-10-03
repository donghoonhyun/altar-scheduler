import { useSession } from "../state/session";
import MassCalendar from "./components/MassCalendar";
import RoleGuard from "./components/RoleGuard";
import MyInfoCard from "./components/MyInfoCard";

export default function ServerMain() {
  const session = useSession();
  const serverGroupId = session.currentServerGroupId || "";

  return (
    <RoleGuard require="server" serverGroupId={serverGroupId}>
      <div className="mb-6">
        <h2 className="text-xl font-bold">
          안녕하세요, {session.user?.displayName} 복사님 👋
        </h2>
        <p className="text-gray-600 mt-1">이번 달 배정 일정을 확인하세요.</p>
      </div>

      <MyInfoCard serverGroupId={serverGroupId} />

      <MassCalendar
        highlightServerName={session.user?.displayName || ""}
        events={[]} // TODO: 서버 전용 이벤트 fetch 필요 시 구현
      />

      <div className="mt-6">
        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          설문 참여하기
        </button>
      </div>
    </RoleGuard>
  );
}
