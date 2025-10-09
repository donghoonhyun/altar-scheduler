import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CopyPrevMonthDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CopyPrevMonthDrawer: React.FC<CopyPrevMonthDrawerProps> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      toast.success('✅ 전월 미사일정이 복사되었습니다.');
      onClose();
    } catch {
      toast.error('전월 미사일정 복사 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>전월 미사일정 복사</DrawerTitle>
          <p className="text-sm text-gray-600">
            전월 미사일정을 복사하면 현재 월의 모든 일정이 삭제됩니다.
            <br />
            계속하시겠습니까?
          </p>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '복사 중...' : '확인'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CopyPrevMonthDrawer;
