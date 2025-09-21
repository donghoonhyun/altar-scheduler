import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useSession } from "../state/session";
import { PARISHES } from "../config/parishes";

// ✅ 타입 import
import type {
  CreateServerGroupRequest,
  CreateServerGroupResponse,
} from "../types/firestore";

// code → name_kor 매핑 딕셔너리
const PARISH_MAP = PARISHES.reduce<Record<string, string>>((acc, parish) => {
  acc[parish.code] = parish.name_kor;
  return acc;
}, {});

// ✅ Cloud Function 등록 (타입 적용)
const createServerGroup = httpsCallable<
  CreateServerGroupRequest,
  CreateServerGroupResponse
>(functions, "createServerGroup");

export default function ServerGroupWizard() {
  const { parishCode } = useParams();
  const session = useSession();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.loading) return <div>Loading...</div>;
  if (!session.user) return <div>로그인이 필요합니다.</div>;
  if (!parishCode) return <div>잘못된 접근입니다. parishCode 없음</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("복사단 이름을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ✅ 타입 안전한 Cloud Function 호출
      const result = await createServerGroup({
        parishCode,
        name,
        timezone: "Asia/Seoul",
        locale: "ko-KR",
        description,
      });

      const newGroupId = result.data.serverGroupId;
      console.log("✅ 복사단 생성 완료:", newGroupId);

      navigate(`/server-group/${newGroupId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("❌ 복사단 생성 실패:", err.message);
        setError(err.message);
      } else {
        console.error("❌ 복사단 생성 실패:", err);
        setError("저장 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">
        {PARISH_MAP[parishCode] || parishCode} - 복사단 생성
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">복사단 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="예: 제1복사단"
            required
          />
        </div>

        <div>
          <label className="block mb-1">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="복사단 설명을 입력하세요."
          />
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? "저장 중..." : "복사단 생성"}
        </button>
      </form>
    </div>
  );
}
