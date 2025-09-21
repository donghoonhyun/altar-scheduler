// src/pages/components/ServerStats.tsx
import React from "react";

interface ServerStatsProps {
  parishCode: string;
  serverGroupId: string;
}

const ServerStats: React.FC<ServerStatsProps> = ({ parishCode, serverGroupId }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">복사단 현황</h2>
      <p className="text-sm text-gray-500">
        (parishCode={parishCode}, serverGroupId={serverGroupId})
      </p>
      {/* Firestore에서 members count / survey 현황 표시 예정 */}
    </div>
  );
};

export default ServerStats;
