// src/pages/components/NextMonthPlan.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

interface NextMonthPlanProps {
  parishCode: string;
  serverGroupId: string;
}

const NextMonthPlan: React.FC<NextMonthPlanProps> = ({ parishCode, serverGroupId }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/parish/${parishCode}/server-groups/${serverGroupId}/mass-events`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">차월 계획</h2>
      <button
        onClick={handleClick}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
      >
        미사 일정 계획하기
      </button>
    </div>
  );
};

export default NextMonthPlan;
