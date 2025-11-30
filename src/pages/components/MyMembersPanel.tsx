// src/pages/components/MyMembersPanel.tsx
import { useNavigate } from 'react-router-dom';
import type { MemberDoc } from '@/types/firestore';

interface Props {
  members: (MemberDoc & { memberId: string })[];
  serverGroupId: string;
  userUid: string;
}

export default function MyMembersPanel({ members }: Props) {
  const navigate = useNavigate();

  // members 컬렉션의 active 필드 기준으로 승인/대기 분리
  const approved = members.filter((m) => m.active === true);
  const pending = members.filter((m) => m.active === false);

  return (
    <div className="p-3 border rounded mb-4 bg-white shadow-sm">
      {/* 1) 승인된 복사 */}
      <div className="mb-3">
        <div className="font-semibold mb-2 text-blue-700">내 복사</div>
        {approved.length === 0 ? (
          <div className="text-gray-500 text-sm">승인된 복사가 없습니다</div>
        ) : (
          <ul className="text-sm">
            {approved.map((m) => (
              <li key={m.memberId} className="py-1">
                ✅ {m.name_kor} ({m.baptismal_name}) — {m.grade}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 2) 승인 대기 중 */}
      {pending.length > 0 && (
        <div className="mb-3">
          <div className="font-semibold mb-2 text-gray-700">승인 대기 중</div>
          <ul className="text-sm text-gray-600">
            {pending.map((m) => (
              <li key={m.memberId} className="py-1">
                ⏳ {m.name_kor} ({m.baptismal_name}) — {m.grade}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3) 복사 추가 페이지로 이동 */}
      <button
        onClick={() => navigate('/add-member')}
        className="w-full bg-green-600 text-white py-2 rounded font-semibold"
      >
        + 복사 추가하기
      </button>
    </div>
  );
}
