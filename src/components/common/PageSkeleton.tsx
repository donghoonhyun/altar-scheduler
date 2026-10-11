// src/components/common/PageSkeleton.tsx

/**
 * 세션·권한 확인처럼 잠깐 걸리는 대기 동안 보여주는 자리표시 화면.
 * 텍스트 한 줄 대신 화면 윤곽을 보여 줘 깜빡임을 줄인다.
 */
export default function PageSkeleton() {
  return (
    <div className="max-w-lg md:max-w-6xl mx-auto px-4 py-4 space-y-4" aria-busy="true" aria-label="불러오는 중">
      <div className="ui-skeleton h-8 w-2/3 rounded-xl" />
      <div className="ui-skeleton h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="ui-skeleton h-24 rounded-2xl" />
        <div className="ui-skeleton h-24 rounded-2xl" />
      </div>
      <div className="ui-skeleton h-56 w-full rounded-2xl" />
    </div>
  );
}
