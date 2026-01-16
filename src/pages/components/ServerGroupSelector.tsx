import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/state/session";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Select
        value={currentId}
        onValueChange={(val) => {
          if (val) {
            navigate(`/server-groups/${val}`);
            session.setCurrentServerGroupId?.(val);
          }
        }}
      >
        <SelectTrigger className="w-full border-none px-2 py-1.5 h-auto text-sm bg-transparent text-gray-800 dark:text-gray-100 font-bold focus:ring-0 focus:ring-offset-0 shadow-none">
          <SelectValue placeholder="복사단을 선택하세요" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-white dark:bg-slate-900" position="popper">
          {groups.map(([sgId, info]) => {
            // "그룹" 글자가 우측에 붙어있으면 제거
            const displayName = `${info.parishName} ${info.groupName}`.replace(/그룹$/, '').trim();
            return (
              <SelectItem key={sgId} value={sgId} className="cursor-pointer font-medium">
                {displayName}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
