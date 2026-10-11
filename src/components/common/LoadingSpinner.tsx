// src/components/common/LoadingSpinner.tsx
import { AltarServer } from '@/components/characters/AltarServer';

export default function LoadingSpinner({
  label = "Loading...",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dotClasses =
    size === "sm" ? "h-1.5 w-1.5" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";
  const labelClasses = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[200px] ui-rise"
      role="status"
      aria-live="polite"
    >
      {/* 큰 로딩 화면에서는 종을 든 복사 캐릭터가 함께 기다린다 */}
      {size === "lg" && <AltarServer pose="bell" className="mb-3 w-24" />}
      <div className="flex items-end gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`ui-bounce-dot rounded-full bg-violet-500 dark:bg-violet-400 ${dotClasses}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {label && (
        <span className={`mt-4 font-display text-violet-700 dark:text-violet-300 ${labelClasses}`}>
          {label}
        </span>
      )}
    </div>
  );
}
