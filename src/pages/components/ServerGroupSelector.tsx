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
    return null;
  }

  return (
    <div className="w-full">
      <select
        className="w-full border-none px-2 py-1.5 text-sm bg-transparent text-gray-800 font-bold focus:outline-none appearance-none cursor-pointer"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236B7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0rem center', backgroundSize: '1rem' }}
        value={currentId}
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
             navigate(`/server-groups/${val}`);
             session.setCurrentServerGroupId?.(val);
          }
        }}
      >
        {groups.map(([sgId, info]) => {
          // "그룹" 글자가 우측에 붙어있으면 제거
          const displayName = `${info.parishName} ${info.groupName}`.replace(/그룹$/, '').trim();
          return (
            <option key={sgId} value={sgId}>
              {displayName}
            </option>
          );
        })}
      </select>
    </div>
  );
}
