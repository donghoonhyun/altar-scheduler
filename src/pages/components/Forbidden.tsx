import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-6xl mb-4">⛔</div>
      <h1 className="text-2xl font-bold mb-2">접근 불가</h1>
      <p className="text-gray-600 mb-6">
        이 페이지에 접근할 권한이 없습니다.
      </p>
      <Link
        to="/"
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
