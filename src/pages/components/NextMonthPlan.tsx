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
      <button
        onClick={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        미사일정 계획하기
      </button>
    </div>
  );
};

export default NextMonthPlan;
