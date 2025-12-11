// src/pages/components/NextMonthPlan.tsx
import { useNavigate } from 'react-router-dom';

interface Props {
  serverGroupId: string;
}

const NextMonthPlan: React.FC<Props> = ({ serverGroupId }) => {
  const navigate = useNavigate();

  return (
    <div className="p-4 border rounded shadow">
      <h3 className="text-lg font-bold mb-2">차월 계획</h3>
      <p className="text-gray-600 mb-3">다음달 미사 일정을 등록하고 복사단 설문을 준비하세요.</p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/server-groups/${serverGroupId}/presets`)}
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          Preset 설정
        </button>
        <button
          onClick={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
        >
          미사일정 계획
        </button>
      </div>
    </div>
  );
};

export default NextMonthPlan;
