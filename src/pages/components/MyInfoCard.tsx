import React from "react";
import { useSession } from "../../state/session";
import { PARISHES } from "../../config/parishes";

interface MyInfoCardProps {
  parishCode: string;
  serverGroupId: string;
}

const MyInfoCard: React.FC<MyInfoCardProps> = ({ parishCode }) => {
  const session = useSession(); // { user, isAdmin, managerParishes, groupRoles ... }

  const parishName =
    PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

  if (!session?.user) {
    return <div className="p-4">로그인이 필요합니다.</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">나의 정보</h2>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <p>
          <span className="font-medium">이름: </span>
          {session.user.displayName || "이름 없음"}
        </p>
        <p>
          <span className="font-medium">이메일: </span>
          {session.user.email}
        </p>
        <p>
          <span className="font-medium">본당: </span>
          {parishName}
        </p>
      </div>
    </div>
  );
};

export default MyInfoCard;
