// src/components/common/LoadingSpinner.tsx
export default function LoadingSpinner({
  label = "Loading...",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm"
      ? "h-6 w-6 border-2"
      : size === "lg"
      ? "h-16 w-16 border-4"
      : "h-12 w-12 border-2";

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div
        className={`animate-spin rounded-full ${sizeClasses} border-t-2 border-b-2 border-blue-500`}
      />
      {label && (
        <span className="mt-3 text-blue-600 font-medium">{label}</span>
      )}
    </div>
  );
}
