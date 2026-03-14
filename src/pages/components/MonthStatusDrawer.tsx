import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Lock } from 'lucide-react';
import DrawerHeader from '@/components/common/DrawerHeader';
import type { MassStatus } from '@/types/firestore';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { COLLECTIONS } from '@/lib/collections';

interface MonthStatusDrawerProps {
  open: boolean;
  onClose: () => void;
  serverGroupId: string;
  currentMonth: dayjs.Dayjs;
}

const STATUS_LABELS: Record<MassStatus, string> = {
  'MASS-NOTCONFIRMED': '미확정 (초안)',
  'MASS-CONFIRMED': '미사일정 확정 (설문 가능)',
  'SURVEY-CONFIRMED': '설문 확정 (자동배정 시작)',
  'FINAL-CONFIRMED': '최종 확정 (잠금)',
};

const MonthStatusDrawer: React.FC<MonthStatusDrawerProps> = ({
  open,
  onClose,
  serverGroupId,
  currentMonth,
}) => {
  const db = getFirestore();
  const monthKey = currentMonth.format('YYYYMM');
  const monthLabel = currentMonth.format('YYYY년 M월');

  const [selectedStatus, setSelectedStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  const [note, setNote] = useState<string>('');
  const [lock, setLock] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  /** 🔹 Firestore에서 현재 상태 읽기 */
  useEffect(() => {
    const loadMonthStatus = async () => {
      if (!serverGroupId) return;
      setLoading(true);
      try {
        const ref = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/month_status/${monthKey}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setSelectedStatus(data.status || 'MASS-NOTCONFIRMED');
          setNote(data.note || '');
          setLock(data.lock || false);
          if (data.updated_at) {
            setLastUpdated(dayjs(data.updated_at.toDate()).format('YYYY-MM-DD HH:mm'));
          }
        } else {
          setSelectedStatus('MASS-NOTCONFIRMED');
          setNote('');
          setLock(false);
          setLastUpdated(null);
        }
      } catch (err) {
        console.error(err);
        toast.error('상태 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (open) loadMonthStatus();
  }, [open, serverGroupId, monthKey]);

  /** 🔹 상태 저장 */
  const handleSave = async () => {
    if (!serverGroupId) return;
    try {
      setSaving(true);
      const ref = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/month_status/${monthKey}`);
      await setDoc(
        ref,
        {
          status: selectedStatus,
          note: note.trim(),
          lock,
          updated_at: serverTimestamp(),
          updated_by: 'planner@test.com',
        },
        { merge: true }
      );
      toast.success(`✅ ${monthLabel} 상태가 "${STATUS_LABELS[selectedStatus]}"로 변경되었습니다.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('상태 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 flex flex-col overflow-hidden" hideClose>
        <DrawerHeader
          title="월 상태 변경"
          subtitle={monthLabel}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-4">로딩 중...</div>
        ) : (
          <>
            <RadioGroup
              value={selectedStatus}
              onValueChange={(val: string) => setSelectedStatus(val as MassStatus)}
              className="space-y-2 mb-4"
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    selectedStatus === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedStatus(key as MassStatus)}
                >
                  <RadioGroupItem
                    id={key}
                    value={key}
                    className={`h-4 w-4 border-2 ${
                      selectedStatus === key
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-400 bg-white dark:bg-gray-800'
                    }`}
                  />
                  <Label
                    htmlFor={key}
                    className="cursor-pointer select-none text-sm text-gray-700 dark:text-gray-200"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* 🔹 비고 입력 */}
            <div className="mt-4">
              <Label htmlFor="note" className="text-sm text-gray-700 dark:text-gray-300">
                변경 사유 / 비고
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 설문 완료 후 자동배정 시작"
                className="mt-1"
              />
            </div>

            {/* 🔹 편집 잠금 */}
            <div className="flex items-center gap-2 mt-4">
              <Switch id="lock" checked={lock} onCheckedChange={setLock} />
              <Label
                htmlFor="lock"
                className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"
              >
                <Lock size={14} />
                자동배정 후 편집 잠금
              </Label>
            </div>
          </>
        )}

        {lastUpdated && (
          <div className="text-xs text-gray-500 mt-3">마지막 변경: {lastUpdated}</div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MonthStatusDrawer;
