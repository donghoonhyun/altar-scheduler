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

interface ConfirmMassDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const ConfirmMassDrawer: React.FC<ConfirmMassDrawerProps> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      toast.success('📘 미사 일정이 확정되었습니다.');
      onClose();
    } catch {
      toast.error('미사 일정 확정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>미사 일정 확정</DrawerTitle>
          <p className="text-sm text-gray-600">
            현재 월의 미사 일정을 확정하면 복사단원들에게 설문을 요청할 수 있습니다.
            <br />
            확정하시겠습니까?
          </p>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '확정 중...' : '확정'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ConfirmMassDrawer;
