import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DialogDescription } from '@/components/ui/dialog-description';
import { Button } from '@/components/ui/button';
import { Clipboard, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase'; // ✅ db 포함
import { doc, getDoc } from 'firebase/firestore';
import dayjs from 'dayjs';

interface CopyPrevMonthDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
  serverGroupId: string;
  currentMonth: dayjs.Dayjs;
}

interface CopyPrevMonthResponse {
  ok: boolean;
  message: string;
}

interface CopyPrevMonthRequest {
  serverGroupId: string;
  currentMonth: string;
}

/**
 * ✅ CopyPrevMonthDrawer
 * - 전월 상태('MASS-CONFIRMED')일 때만 복사 허용
 */
const CopyPrevMonthDrawer: React.FC<CopyPrevMonthDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  serverGroupId,
  currentMonth,
}) => {
  const [loading, setLoading] = useState(false);
  const prevMonth = currentMonth.subtract(1, 'month');

  /** 🔹 전월 상태 확인 */
  const checkPrevMonthStatus = async (): Promise<boolean> => {
    try {
      const prevMonthKey = prevMonth.format('YYYYMM');
      const ref = doc(db, `server_groups/${serverGroupId}/month_status/${prevMonthKey}`);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert(`⚠️ ${prevMonth.format('M월')} 상태 문서가 존재하지 않습니다.`);
        return false;
      }

      const data = snap.data();
      const status = data.status;

      // ✅ 허용 가능한 상태 목록
      const allowedStatuses = ['MASS-CONFIRMED', 'SURVEY-CONFIRMED', 'FINAL-CONFIRMED'];

      if (!allowedStatuses.includes(status)) {
        alert(
          `⚠️ ${prevMonth.format(
            'M월'
          )} 상태가 '확정', '설문마감', '최종확정' 중 하나가 아닙니다.\n\n'미확정' 상태에서는 전월 일정을 복사할 수 없습니다.`
        );
        return false;
      }

      return true;
    } catch (e) {
      console.error('Month status check error:', e);
      alert('전월 상태 확인 중 오류가 발생했습니다.');
      return false;
    }
  };

  /** 🔹 Cloud Function 호출 */
  const handleCopyViaCF = async (): Promise<void> => {
    if (!serverGroupId) return;

    // ✅ 먼저 전월 상태 확인
    const canCopy = await checkPrevMonthStatus();
    if (!canCopy) return;

    // ✅ 사용자 확인
    const ok = window.confirm(
      `전월(${prevMonth.format('M월')}) 일정을 현재 월(${currentMonth.format(
        'M월'
      )})로 복사하시겠습니까?\n\n⚠️ 현재 월의 모든 미사 일정이 삭제된 뒤 전월 패턴으로 덮어씌워집니다.\n이 작업은 되돌릴 수 없습니다.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const copyPrevMonth = httpsCallable<CopyPrevMonthRequest, CopyPrevMonthResponse>(
        functions,
        'copyPrevMonthMassEvents'
      );

      const res = await copyPrevMonth({
        serverGroupId,
        currentMonth: currentMonth.format('YYYY-MM'),
      });

      const result = res.data;
      if (result.ok) toast.success(result.message);
      else toast.warning(result.message);

      await onConfirm?.();
      onClose?.();
    } catch (err) {
      const e = err as Error;
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

        <DialogDescription>
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
