// src/pages/ServerMain.tsx
import { useSession } from "../state/session";
import MassCalendar from "./components/MassCalendar"; // 달력 컴포넌트

export default function ServerMain() {
  const session = useSession();

  if (session.loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  if (!session.user) {
    return <div className="p-6 text-center">로그인이 필요합니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
      {/* 상단 사용자 인사 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          안녕하세요, {session.user.displayName} 님 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          이번 달 배정 일정을 확인하세요.
        </p>
      </div>

      {/* 달력 */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-4">📅 이번 달 미사 일정</h2>
        <MassCalendar />
      </div>

      {/* 설문 참여 안내 */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900 p-4 rounded-xl">
        <p className="mb-3">
          아직 가용성 설문에 참여하지 않았다면 지금 참여해주세요.
        </p>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
          onClick={() => {
            // TODO: 설문 페이지 라우팅 (/availability 등)
            alert("설문 페이지로 이동 예정");
          }}
        >
          설문 참여하기
        </button>
      </div>
    </div>
  );
}
