import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SendSurveyDrawerProps {
  open: boolean;
  onClose: () => void;
  surveyUrl: string;
}

const SendSurveyDrawer: React.FC<SendSurveyDrawerProps> = ({ open, onClose, surveyUrl }) => {
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl);
    toast.success('📎 설문 링크가 복사되었습니다.');
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>가용성 설문 링크 보내기</DrawerTitle>
          <p className="text-sm text-gray-600 mb-2">아래 링크를 복사하여 단체방에 공유해주세요.</p>
          <div className="rounded-md border bg-gray-50 p-2 text-xs break-all">{surveyUrl}</div>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleCopyLink}>링크 복사</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default SendSurveyDrawer;
