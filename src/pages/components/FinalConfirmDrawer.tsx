import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface FinalConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const FinalConfirmDrawer: React.FC<FinalConfirmDrawerProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      // Toast handled in parent or here? Parent usually has it, but ConfirmMassDrawer had it here.
      // Keeping consistent with ConfirmMassDrawer:
      // toast.success('...'); // handleConfirmMass in parent had toast too?
      // Check MassEventPlanner: handleConfirmMass has toast. ConfirmMassDrawer has toast. Double toast?
      // ConfirmMassDrawer line 29: toast.success. MassEventPlanner line 109: toast.success.
      // Yes, double toast potentially. I'll rely on parent for consistency or just one.
      // MassEventPlanner's handleAutoAssign had toast.
      // I'll remove toast here to avoid dupes if parent processes it, or keep it if standard.
      // Let's keep it minimal here.
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('⚠️ 최종 확정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
          <CheckCircle2 size={20} className="text-red-600" />
          최종 확정
        </DialogTitle>

        <DialogDescription className="text-sm text-gray-600 mb-3">
          현재 배정된 상태로 월간 미사 일정을 <b>“최종 확정”</b>합니다.
          <br />
          확정 후에는 배정 내역이 단원들에게 공개됩니다.
        </DialogDescription>

        <div className="border-b border-gray-200 dark:border-gray-700 my-3" />

        <div className="mt-3 text-sm text-gray-700 space-y-2">
          <p>⚠️ 최종 확정 후에는 자동 배정을 다시 실행할 수 없습니다.</p>
          <p>필요 시 월 상태 변경에서 다시 수정할 수 있습니다.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="destructive" // Red for Final
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '확정 중...' : '최종 확정'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinalConfirmDrawer;
