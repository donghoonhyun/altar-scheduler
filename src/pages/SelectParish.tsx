// src/pages/SelectParish.tsx
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/session";
import { PARISHES } from "../config/parishes"; // ✅ parish 목록 import

// code → name_kor 매핑 딕셔너리 생성
const PARISH_MAP = PARISHES.reduce<Record<string, string>>((acc, parish) => {
  acc[parish.code] = parish.name_kor;
  return acc;
}, {});

export default function SelectParish() {
  const session = useSession();
  const navigate = useNavigate();

  if (session.loading) return <div>Loading...</div>;
  if (session.managerParishes.length === 0) {
    return <div>권한이 없습니다.</div>;
  }

  // ✅ 복사단 "리스트" 페이지로 이동하도록 수정
  const handleSelect = (parishCode: string) => {
    navigate(`/parish/${parishCode}/server-groups`);
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">본당 선택</h1>
      <ul className="space-y-3">
        {session.managerParishes.map((parishCode) => (
          <li key={parishCode}>
            <button
              onClick={() => handleSelect(parishCode)}
              className="w-full p-3 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              {PARISH_MAP[parishCode] || parishCode}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
