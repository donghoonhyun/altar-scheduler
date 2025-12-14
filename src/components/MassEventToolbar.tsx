// src/components/MassEventToolbar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Lock, Send, StopCircle, Repeat, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MassEventToolbarProps {
  monthStatus: string;
  isLocked: boolean;
  isCopyEnabled: boolean;
  onApplyPreset: () => void;
  onConfirmMass: () => void;
  onOpenSurvey: () => void;
  onCloseSurvey: () => void;
  onAutoAssign: () => void;
  onOpenMonthStatus: () => void;
}

export const MassEventToolbar: React.FC<MassEventToolbarProps> = ({
  monthStatus,
  isLocked,
  isCopyEnabled,
  onApplyPreset,
  onConfirmMass,
  onOpenSurvey,
  onCloseSurvey,
  onAutoAssign,
  onOpenMonthStatus,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4 justify-end">
      {/* 🔵 그룹 ① 확정 준비 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-blue-400 text-blue-700',
          'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        disabled={!isCopyEnabled}
        onClick={onApplyPreset}
      >
        <Copy className="w-3.5 h-3.5 mr-1" /> Preset 초기화
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-blue-400 text-blue-700',
          'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        disabled={monthStatus !== 'MASS-NOTCONFIRMED' || isLocked}
        onClick={onConfirmMass}
      >
        <Lock className="w-3.5 h-3.5 mr-1" /> 미사 일정 확정
      </Button>

      {/* 🟠 그룹 ② 설문 단계 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border',
          monthStatus === 'MASS-CONFIRMED'
            ? 'border-amber-500 text-amber-700 hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800'
            : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        disabled={monthStatus === 'MASS-NOTCONFIRMED'}
        onClick={onOpenSurvey}
      >
        <Send className="w-3.5 h-3.5 mr-1" /> 
        {monthStatus === 'SURVEY-CONFIRMED' || monthStatus === 'FINAL-CONFIRMED' ? '설문 보기' : '설문 진행'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-amber-500 text-amber-700',
          'hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        disabled={monthStatus !== 'MASS-CONFIRMED'}
        onClick={onCloseSurvey}
      >
        <StopCircle className="w-3.5 h-3.5 mr-1" /> 설문 종료
      </Button>

      {/* 🔴 그룹 ③ 최종 확정 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-red-500 text-red-700',
          'hover:bg-red-50 hover:border-red-600 hover:text-red-800',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        disabled={monthStatus !== 'SURVEY-CONFIRMED'}
        onClick={onAutoAssign}
      >
        <Repeat className="w-3.5 h-3.5 mr-1" /> 자동 배정 (최종 확정)
      </Button>

      {/* ⚙️ 기타 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-gray-400 text-gray-700',
          'hover:bg-gray-50 hover:border-gray-500 hover:text-gray-800',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
        )}
        onClick={onOpenMonthStatus}
      >
        <Settings className="w-3.5 h-3.5 mr-1" /> 월 상태변경
      </Button>
    </div>
  );
};
