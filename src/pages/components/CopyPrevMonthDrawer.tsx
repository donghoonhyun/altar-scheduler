import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clipboard, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import dayjs from 'dayjs';

interface CopyPrevMonthDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
  serverGroupId: string;
  currentMonth: dayjs.Dayjs;
}

/** 🔹 Cloud Function 응답 타입 */
interface CopyPrevMonthResponse {
  ok: boolean;
  message: string;
}

/** 🔹 Cloud Function 요청 타입 */
interface CopyPrevMonthRequest {
  serverGroupId: string;
  currentMonth: string;
}

/**
 * CopyPrevMonthDrawer (Cloud Function 연동)
 */
const CopyPrevMonthDrawer: React.FC<CopyPrevMonthDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  serverGroupId,
  currentMonth,
}) => {
  const [loading, setLoading] = useState(false);
  const functions = getFunctions();
  const prevMonth = currentMonth.subtract(1, 'month');

  /** 🔹 Cloud Function 호출 */
  const handleCopyViaCF = async (): Promise<void> => {
    if (!serverGroupId) return;
    try {
      setLoading(true);

      // ✅ 타입 명시로 any 제거
      const copyPrevMonth = httpsCallable<CopyPrevMonthRequest, CopyPrevMonthResponse>(
        functions,
        'copyPrevMonthMassEvents'
      );

      const res: HttpsCallableResult<CopyPrevMonthResponse> = await copyPrevMonth({
        serverGroupId,
        currentMonth: currentMonth.format('YYYY-MM-DD'),
      });

      const result = res.data;
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }

      onConfirm?.();
      onClose?.();
    } catch (err) {
      // ⚠️ 안전한 타입 내러잉 (unknown → Error)
      const e = err as Error;
      console.error('❌ copyPrevMonthMassEvents failed:', e);
      toast.error(e.message || '전월 미사일정 복사 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
          <Clipboard size={20} className="text-blue-600" />
          전월 미사일정 복사
          <span className="text-gray-500 text-base ml-1">
            ({currentMonth.format('YYYY년 M월')})
          </span>
        </DialogTitle>

        <DialogDescription asChild>
          <div className="text-sm text-gray-600 mb-3">
            전월(<b>{prevMonth.format('M월')}</b>)의 미사 일정을 현재 월(
            <b>{currentMonth.format('M월')}</b>)로 <b>복사</b>합니다.
            <br />
            <br />
            <div className="text-center">
              🎯 전월(<b>{prevMonth.format('YYYY년 M월')}</b>)
              <ArrowRight className="inline mx-2 text-gray-500" size={24} />
              현재 월(<b>{currentMonth.format('M월')}</b>)
            </div>
          </div>
        </DialogDescription>

        <div className="border-b border-gray-200 dark:border-gray-700 my-3" />
        <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p>⚠️ 현재 월의 모든 미사 일정은 삭제된 후 전월 패턴으로 복사됩니다.</p>
          <p>복사 완료 후 달력이 자동으로 새로고침됩니다.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleCopyViaCF}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '복사 중...' : '복사 시작'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CopyPrevMonthDrawer;
