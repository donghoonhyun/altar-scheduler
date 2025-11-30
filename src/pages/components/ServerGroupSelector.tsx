// src/pages/components/ServerGroupSelector.tsx
import { useSession } from "@/state/session";

export default function ServerGroupSelector() {
  const session = useSession();

  const groups = Object.entries(session.serverGroups); // [ [sgId, {parishName, groupName}], ... ]

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
      <label className="block text-sm text-gray-600 mb-1">복사단 선택</label>

      <select
        className="border p-2 rounded w-full bg-white"
        value={session.currentServerGroupId ?? ""}
        onChange={(e) => {
          if (session.setCurrentServerGroupId) {
            session.setCurrentServerGroupId(e.target.value);
          }
        }}
      >
        <option value="">복사단 선택하세요</option>

        {groups.map(([sgId, info]) => (
          <option key={sgId} value={sgId}>
            {info.parishName} - {info.groupName}
          </option>
        ))}
      </select>
    </div>
  );
}
