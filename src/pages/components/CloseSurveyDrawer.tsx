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

interface CloseSurveyDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CloseSurveyDrawer: React.FC<CloseSurveyDrawerProps> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      toast.success('📊 설문이 종료되었습니다.');
      onClose();
    } catch {
      toast.error('설문 종료 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>설문 종료</DrawerTitle>
          <p className="text-sm text-gray-600">
            설문을 종료하면 더 이상 응답을 받을 수 없습니다.
            <br />
            자동배정 단계를 진행하시겠습니까?
          </p>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '종료 중...' : '설문 종료'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CloseSurveyDrawer;
