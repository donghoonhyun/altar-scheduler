import { Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status?: string;
  size?: "sm" | "md";
  iconOnly?: boolean; // ✅ 추가
  className?: string;
}

/**
 * ✅ StatusBadge
 * 상태(status)에 따라 색상, 아이콘, Tooltip을 일관되게 표시하는 컴포넌트.
 * - PRD-2.13 8.5 Status & Badge Design System 기반
 */
export const StatusBadge = ({
  status = "MASS-NOTCONFIRMED",
  size = "sm",
  iconOnly = false, // ✅ 기본 false (Dashboard에서는 텍스트 포함)
  className,
}: StatusBadgeProps) => {
  const styles: Record<
    string,
    { bg: string; text: string; icon: JSX.Element; tooltip: string; label: string }
  > = {
    "MASS-NOTCONFIRMED": {
      bg: "bg-gray-100",
      text: "text-gray-500",
      icon: <Clock size={12} className="text-gray-400" />, // ⏳ 아이콘
      tooltip: "미확정",
      label: "미확정",
    },
    "MASS-CONFIRMED": {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: <Lock size={12} className="text-gray-400" />,
      tooltip: "확정됨",
      label: "확정",
    },
    "SURVEY-CONFIRMED": {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: <Lock size={12} className="text-amber-500" />,
      tooltip: "설문 마감됨",
      label: "설문 마감",
    },
    "FINAL-CONFIRMED": {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: <Lock size={12} className="text-green-500" />,
      tooltip: "최종 확정됨",
      label: "최종 확정",
    },
  };

  const current = styles[status] || styles["MASS-NOTCONFIRMED"];

  return (
    <div
      title={current.tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-sm",
        current.bg,
        current.text,
        className
      )}
    >
      {current.icon}
      {!iconOnly && <span>{current.label}</span>} {/* ✅ 아이콘만 모드일 때 텍스트 숨김 */}
    </div>
  );
};
