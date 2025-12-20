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

interface AutoAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const AutoAssignDrawer: React.FC<AutoAssignDrawerProps> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      toast.success('⚙️ 자동배정이 완료되었습니다.');
      onClose();
    } catch {
      toast.error('자동배정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>자동배정 실행</DrawerTitle>
          <p className="text-sm text-gray-600">
            설문이 완료된 데이터를 바탕으로 자동배정을 진행합니다.
            <br />
            계속하시겠습니까?
          </p>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '진행 중...' : '실행'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AutoAssignDrawer;
