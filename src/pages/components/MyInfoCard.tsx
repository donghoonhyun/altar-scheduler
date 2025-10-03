import { useSession } from "../../state/session";

interface MyInfoCardProps {
  serverGroupId: string;
}

const MyInfoCard: React.FC<MyInfoCardProps> = ({ serverGroupId }) => {
  const session = useSession();

  if (!session?.user) {
    return <div className="p-4">로그인이 필요합니다.</div>;
  }

  const groupInfo = session.serverGroups[serverGroupId];
  const role = session.groupRoles[serverGroupId] || "server";
  const roleLabel = role === "planner" ? "플래너" : "복사";

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">나의 정보</h2>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <p>
          <span className="font-medium">이름: </span>
          {session.user.displayName || "이름 없음"} {roleLabel}
        </p>
        <p>
          <span className="font-medium">이메일: </span>
          {session.user.email}
        </p>
        <p>
          <span className="font-medium">본당: </span>
          {groupInfo?.parishName || groupInfo?.parishCode || "-"}
        </p>
        <p>
          <span className="font-medium">복사단 코드: </span>
          {serverGroupId}
        </p>
      </div>
    </div>
  );
};

export default MyInfoCard;
