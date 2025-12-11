import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clipboard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import dayjs from 'dayjs';

interface ApplyPresetDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  serverGroupId: string;
  currentMonth: dayjs.Dayjs;
}

const ApplyPresetDrawer: React.FC<ApplyPresetDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  serverGroupId,
  currentMonth,
}) => {
  const [loading, setLoading] = useState(false);

  const handleApplyPreset = async () => {
    // Dialog의 포커스 트래핑과 브라우저 confirm 충돌 방지 위해 지연 실행
    setTimeout(() => {
        const ok = window.confirm(
        `Preset 데이터를 사용하여 ${currentMonth.format('M월')} 일정을 초기화하시겠습니까?\n\n⚠️ 현재 월의 모든 미사 일정이 삭제되고 Preset 설정대로 재생성됩니다.\n이 작업은 되돌릴 수 없습니다.`
        );
        if (ok) {
            startApply();
        }
    }, 300);
  };

  const startApply = async () => {
    if (!serverGroupId) return;

    setLoading(true);
    try {
      // 1. Preset 로드
      const presetRef = doc(db, 'server_groups', serverGroupId, 'mass_presets', 'default');
      const presetSnap = await getDoc(presetRef);
      if (!presetSnap.exists()) {
        toast.error("미사 Preset 설정이 없습니다. 먼저 Preset을 설정해주세요.");
        return;
      }
      const presetData = presetSnap.data();
      const weekdaysPreset = presetData.weekdays || {};

      // 2. 현재 월 기존 일정 삭제
      const startStr = currentMonth.startOf('month').format('YYYYMMDD');
      const endStr = currentMonth.endOf('month').format('YYYYMMDD');
      
      const q = query(
        collection(db, 'server_groups', serverGroupId, 'mass_events'),
        where('event_date', '>=', startStr),
        where('event_date', '<=', endStr)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // 3. Preset 기반 생성
      const startDay = currentMonth.startOf('month');
      const daysInMonth = currentMonth.daysInMonth();

      for (let i = 0; i < daysInMonth; i++) {
        const targetDate = startDay.add(i, 'day');
        const dow = targetDate.day().toString(); // 0(일) ~ 6(토)
        const dateStr = targetDate.format('YYYYMMDD');

        const dailyPresets = weekdaysPreset[dow];
        if (Array.isArray(dailyPresets)) {
          dailyPresets.forEach((p: any) => {
            const newRef = doc(collection(db, 'server_groups', serverGroupId, 'mass_events'));
            batch.set(newRef, {
              title: p.title || '미사',
              event_date: dateStr,
              required_servers: p.required_servers || 2,
              member_ids: [],
              status: 'MASS-NOTCONFIRMED', 
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            });
          });
        }
      }

      await batch.commit();
      console.log("Batch commit successful");
      
      toast.success("Preset 기반으로 미사 일정이 초기화되었습니다.");
      await onConfirm(); // 부모 컴포넌트의 새로고침 로직 등 호출
      onClose();

    } catch (err) {
      console.error("Error in ApplyPreset:", err);
      toast.error("작업 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
          <Clipboard size={20} className="text-blue-600" />
          Preset 초기화
          <span className="text-gray-500 text-base ml-1">
            ({currentMonth.format('YYYY년 M월')})
          </span>
        </DialogTitle>

        <DialogDescription asChild>
          <div className="text-sm text-gray-600 mb-3">
            미리 설정된 <b>주간 반복 Preset</b>을 사용하여
            <br/>
            <b>{currentMonth.format('M월')}</b>의 전체 미사 일정을 자동 생성합니다.
          </div>
        </DialogDescription>

        <div className="border-b border-gray-200 dark:border-gray-700 my-3" />
        <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p className="text-red-600 font-bold">⚠️ 주의: 현재 월의 기존 일정이 모두 삭제됩니다.</p>
          <p>초기화 후에는 되돌릴 수 없습니다.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleApplyPreset}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '초기화 중...' : '초기화 시작'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyPresetDrawer;
