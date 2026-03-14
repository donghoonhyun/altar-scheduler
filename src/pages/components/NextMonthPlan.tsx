// src/pages/components/NextMonthPlan.tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Props {
  serverGroupId: string;
}

const NextMonthPlan: React.FC<Props> = ({ serverGroupId }) => {
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">차월 계획</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-3">다음달 미사 일정을 등록하고 복사단 설문을 준비하세요.</p>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
          className="w-full"
        >
          미사일정 계획
        </Button>
        <div className="flex gap-2">
           <Button
             variant="outline"
             size="md"
             onClick={() => navigate(`/server-groups/${serverGroupId}/presets`)}
             className="flex-1"
           >
             Preset 설정
           </Button>
           <Button
             variant="secondary"
             size="md"
             onClick={() => navigate(`/server-groups/${serverGroupId}/surveys`)}
             className="flex-1"
           >
             설문 관리
           </Button>
        </div>
      </div>
    </div>
  );
};

export default NextMonthPlan;
