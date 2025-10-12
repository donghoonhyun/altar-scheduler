import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DialogDescription } from '@/components/ui/dialog-description';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

interface ConfirmMassDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  currentMonth?: Dayjs;
}

const ConfirmMassDrawer: React.FC<ConfirmMassDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  currentMonth = dayjs(),
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      toast.success('📘 미사 일정이 확정되었습니다.');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('⚠️ 미사 일정 확정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        {/* Header */}
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
          <Lock size={20} className="text-blue-600" />
          미사 일정 확정
          <span className="text-gray-500 text-base ml-1">
            ({currentMonth.format('YYYY년 M월')})
          </span>
        </DialogTitle>

        <DialogDescription className="text-sm text-gray-600 mb-3">
          선택된 월의 모든 미사 일정 상태를 <b>“확정됨”</b>으로 변경합니다.
          <br />
          이후 설문 발송 및 응답이 가능해집니다.
        </DialogDescription>

        {/* ✅ 구분선 */}
        <div className="border-b border-gray-200 dark:border-gray-700 my-3" />

        {/* Body */}
        <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p>⚠️ 확정 후에는 미사 일정이 “설문 가능” 상태로 전환됩니다.</p>
          <p>필요 시 월 상태 변경에서 다시 수정할 수 있습니다.</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '확정 중...' : '확정하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmMassDrawer;
