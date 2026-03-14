import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import DrawerHeader from '@/components/common/DrawerHeader';

interface CloseSurveyDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  currentMonth?: Dayjs;
}

/**
 * CloseSurveyDrawer
 * - 설문 종료 다이얼로그
 * - DrawerHeader 표준 헤더 적용
 */
const CloseSurveyDrawer: React.FC<CloseSurveyDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  currentMonth = dayjs(),
}) => {
  const [loading, setLoading] = useState(false);

  const handleCloseSurvey = async () => {
    try {
      setLoading(true);
      await onConfirm();
      toast.success('🗳️ 설문이 종료되었습니다.');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('⚠️ 설문 종료 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 flex flex-col overflow-hidden" hideClose>
        <DrawerHeader
          title="설문 종료"
          subtitle={currentMonth.format('YYYY년 M월')}
          onClose={onClose}
        />

        <div className="p-6 text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p className="text-gray-600 dark:text-gray-400">
            설문 응답 기간을 마감하고, 이후 응답 제출을 차단합니다.
            <br />
            설문 결과는 자동으로 저장되며, 확정 단계로 이동할 수 있습니다.
          </p>
          <div className="border-b border-gray-200 dark:border-gray-700 my-3" />
          <p>⚠️ 설문 종료 후에는 새로운 응답을 제출할 수 없습니다.</p>
          <p>종료된 설문은 &quot;자동 배정(최종 확정)&quot; 단계로 이동하게 됩니다.</p>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleCloseSurvey}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '종료 중...' : '설문 종료'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloseSurveyDrawer;
