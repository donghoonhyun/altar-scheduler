// src/constants/massStatusLabels.ts
import type { MassStatus } from '@/types/firestore';

/**
 * 🔹 MASS_STATUS_LABELS
 * -------------------------------------------------------
 * 각 미사 상태 코드에 대한 한글 라벨 정의
 * Firestore 데이터(`MassStatus`)의 UI 표현 전용
 * -------------------------------------------------------
 */
export const MASS_STATUS_LABELS: Record<MassStatus, string> = {
  'MASS-NOTCONFIRMED': '미확정',
  'MASS-CONFIRMED': '미사확정',
  'SURVEY-CONFIRMED': '설문마감',
  'FINAL-CONFIRMED': '최종확정',
};

/**
 * 🔹 MASS_STATUS_COLORS
 * -------------------------------------------------------
 * 상태별 색상 팔레트 (PRD-2.13 App-UIUX 기준)
 * -------------------------------------------------------
 */
export const MASS_STATUS_COLORS: Record<MassStatus, { bg: string; text: string; border: string }> =
  {
    'MASS-NOTCONFIRMED': {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
    },
    'MASS-CONFIRMED': {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-300',
    },
    'SURVEY-CONFIRMED': {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-300',
    },
    'FINAL-CONFIRMED': {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
    },
  };
