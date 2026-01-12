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
import { Bot } from 'lucide-react';

interface AutoAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const AutoAssignDrawer: React.FC<AutoAssignDrawerProps> = ({ open, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!window.confirm('기존 배정 정보가 모두 초기화됩니다. 정말로 실행하시겠습니까?')) {
      return;
    }
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
          <DrawerTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            자동배정 실행
          </DrawerTitle>
          <div className="text-left space-y-4 px-2">
            <p className="text-sm text-gray-600">
              설문이 완료된 데이터를 바탕으로 아래 규칙에 따라 자동 배정을 진행합니다.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-3">
               <div className="text-xs font-semibold text-gray-900 pb-2 border-b border-gray-200">
                 매월 1일부터 말일까지 확정된 미사일정을 순회하며 배정
               </div>
               <ol className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex gap-2">
                  <span className="font-bold shrink-0 text-blue-600">1.</span>
                  <div>
                    <span className="font-bold">불참자 제외</span>
                    <p className="text-gray-500 mt-0.5">불참으로 설문 제출한 복사는 배정에서 제외합니다.</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0 text-blue-600">2.</span>
                  <div>
                    <span className="font-bold">배정 실적 우선 (전월)</span>
                    <p className="text-gray-500 mt-0.5">가능한 복사 중 전월 배정 실적이 적은 복사를 먼저 배정합니다.</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0 text-blue-600">3.</span>
                  <div>
                    <span className="font-bold">이름순 배정</span>
                    <p className="text-gray-500 mt-0.5">실적이 동일한 경우, 이름 가나다순으로 순차 배정합니다.</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0 text-blue-600">4.</span>
                  <div>
                    <span className="font-bold">주복사 자동 지정</span>
                    <p className="text-gray-500 mt-0.5">
                      배정된 인원 중 입단년도가 가장 빠른(오래된) 복사가 주복사가 됩니다. (년도가 같으면 이름순)
                    </p>
                  </div>
                </li>
               </ol>
            </div>
            
            <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded border border-amber-200">
               ⚠️ <b>주의:</b> 자동 배정 실행 시 <span className="underline">기존 배정 정보는 모두 초기화(삭제)</span>되고 새로 배정됩니다.
            </div>

            <p className="text-xs text-gray-400 text-center">
              * 배정 후 '미사 일정 관리'에서 내역을 수정할 수 있습니다.
            </p>
          </div>
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
