import { clsx, ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn()
 * Tailwind 클래스명 병합 헬퍼
 * 중복된 스타일을 자동 제거하고 조건부 클래스를 깔끔하게 처리
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
