import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { useSession } from "../state/session";
import { PARISHES } from "../config/parishes";

// code → name_kor 매핑 딕셔너리
const PARISH_MAP = PARISHES.reduce<Record<string, string>>((acc, parish) => {
  acc[parish.code] = parish.name_kor;
  return acc;
}, {});

export default function ServerGroupWizard() {
  const { parishCode } = useParams();
  const session = useSession();
  const navigate = useNavigate();

  const [name, setName] = useState("");
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

      const counterRef = doc(db, 'counters', 'server_groups');
      
      const newSgId = await runTransaction(db, async (transaction) => {
        // 1) 카운터 조회 및 증가
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        if (counterDoc.exists()) {
          nextSeq = (counterDoc.data().last_seq || 0) + 1;
        }
        transaction.set(counterRef, { last_seq: nextSeq }, { merge: true });

        // 2) SG00000 포맷 ID 생성
        const sgId = `SG${nextSeq.toString().padStart(5, '0')}`;
        const sgRef = doc(db, 'server_groups', sgId);

        // 3) 복사단 문서 생성
        transaction.set(sgRef, {
          parish_code: parishCode,
          name: name,
          active: true,
          timezone: 'Asia/Seoul',
          locale: 'ko-KR',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // 4) 생성자를 해당 복사단의 어드민/플래너로 등록
        if (session.user) {
          const membershipId = `${session.user.uid}_${sgId}`;
          const membershipRef = doc(db, 'memberships', membershipId);
          transaction.set(membershipRef, {
            uid: session.user.uid,
            server_group_id: sgId,
            parish_code: parishCode,
            role: ['admin', 'planner'],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        return sgId;
      });

      console.log("✅ 복사단 직접 생성 완료:", newSgId);

      // ✅ 세션 갱신 (새로운 역할을 State에 반영)
      await session.refreshSession?.();

      // ✅ 생성 후 리스트 페이지로 리다이렉트
      navigate(`/parish/${parishCode}/server-groups`);
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
        {PARISH_MAP[parishCode || ""] || parishCode} - 복사단 생성
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
