// src/components/MassEventToolbar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Lock, Send, StopCircle, Repeat, Settings, Check, Bot } from 'lucide-react';
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
  onFinalConfirm: () => void;
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
  onFinalConfirm,
  onOpenMonthStatus,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4 justify-center">
      {/* 🔵 그룹 ① 확정 준비 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-500',
          'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-200',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={!isCopyEnabled}
        onClick={onApplyPreset}
      >
        <Copy className="w-3.5 h-3.5 mr-1" /> Preset초기화
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-500',
          'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-200',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={monthStatus !== 'MASS-NOTCONFIRMED' || isLocked}
        onClick={onConfirmMass}
      >
        <Lock className="w-3.5 h-3.5 mr-1" /> 미사일정확정
      </Button>

      {/* 🟠 그룹 ② 설문 단계 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border',
          monthStatus === 'MASS-CONFIRMED'
            ? 'border-amber-500 text-amber-700 hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-300'
            : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={monthStatus === 'MASS-NOTCONFIRMED'}
        onClick={onOpenSurvey}
      >
        <Send className="w-3.5 h-3.5 mr-1" /> 
        {monthStatus === 'SURVEY-CONFIRMED' || monthStatus === 'FINAL-CONFIRMED' ? '설문보기' : '설문발송'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-amber-500 text-amber-700 dark:text-amber-400 dark:border-amber-600',
          'hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800 dark:hover:bg-amber-900/30 dark:hover:text-amber-300',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={monthStatus !== 'MASS-CONFIRMED'}
        onClick={onCloseSurvey}
      >
        <StopCircle className="w-3.5 h-3.5 mr-1" /> 설문종료
      </Button>

      {/* 🔴 그룹 ③ 최종 확정 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-red-500 text-red-700 dark:text-red-400 dark:border-red-600',
          'hover:bg-red-50 hover:border-red-600 hover:text-red-800 dark:hover:bg-red-900/30 dark:hover:text-red-300',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={monthStatus !== 'SURVEY-CONFIRMED'}
        onClick={onAutoAssign}
      >
        <Bot className="w-3.5 h-3.5 mr-1" /> 자동배정
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-red-500 text-red-700 dark:text-red-400 dark:border-red-600',
          'hover:bg-red-50 hover:border-red-600 hover:text-red-800 dark:hover:bg-red-900/30 dark:hover:text-red-300',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        disabled={monthStatus !== 'SURVEY-CONFIRMED'}
        onClick={onFinalConfirm}
      >
        <Check className="w-3.5 h-3.5 mr-1" /> 최종확정
      </Button>

      {/* 구분선 */}
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* ⚙️ 기타 */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-7 text-[12px] px-2 py-1 border border-gray-400 text-gray-700 dark:text-gray-300 dark:border-gray-500',
          'hover:bg-gray-50 hover:border-gray-500 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200',
          'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed dark:disabled:bg-gray-800/40 dark:disabled:text-gray-500 dark:disabled:border-gray-600'
        )}
        onClick={onOpenMonthStatus}
      >
        <Settings className="w-3.5 h-3.5 mr-1" /> 월상태변경
      </Button>
    </div>
  );
};
