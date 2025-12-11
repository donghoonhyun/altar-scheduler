import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/state/session";

export default function ServerGroupSelector() {
  const session = useSession();
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();

  const groups = Object.entries(session.serverGroups); // [ [sgId, {parishName, groupName}], ... ]
  
  // 현재 선택된 ID: URL 파라미터 우선, 없으면 세션 값
  const currentId = serverGroupId || session.currentServerGroupId || "";

  // 아직 복사단 선택 전
  if (groups.length === 0) {
    return (
      <div className="p-3 border rounded bg-gray-50 text-gray-500 mb-4">
        등록된 복사단이 없습니다.
        <br />
        플래너가 복사단을 생성하거나, 다른 복사단에서 초대받아야 합니다.
      </div>
    );
  }

  return (
    <div className="mb-4">
      {/* Label Removed */}

      <select
        className="border p-1 rounded w-full text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={currentId}
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
             // URL 변경으로 이동
             navigate(`/server-groups/${val}`);
             // 세션 상태도 업데이트 (선택사항이나 싱크 맞추기 위해)
             session.setCurrentServerGroupId?.(val);
          }
        }}
      >
        {groups.map(([sgId, info]) => (
          <option key={sgId} value={sgId}>
            {info.parishName} - {info.groupName}
          </option>
        ))}
      </select>
    </div>
  );
}
