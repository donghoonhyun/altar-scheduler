// src/pages/components/NextMonthPlan.tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
        <Button
          variant="outline"
          onClick={() => navigate(`/server-groups/${serverGroupId}/presets`)}
          className="flex-1"
        >
          Preset 설정
        </Button>
        <Button
          variant="primary"
          onClick={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
          className="flex-1"
        >
          미사일정 계획
        </Button>
      </div>
      <div className="mt-2">
        <Button
          variant="secondary"
          onClick={() => navigate(`/server-groups/${serverGroupId}/assignment-status`)}
          className="w-full"
        >
          복사배정현황
        </Button>
      </div>
    </div>
  );
};

export default NextMonthPlan;
