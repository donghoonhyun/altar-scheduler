// src/pages/components/MyMembersPanel.tsx
import { useNavigate } from 'react-router-dom';
import type { MemberDoc } from '@/types/firestore';
import { cn } from '@/lib/utils';
import { Check, Plus } from 'lucide-react';

interface Props {
  members: (MemberDoc & { memberId: string })[];
  serverGroupId: string;
  userUid: string;
  checkedMemberIds: string[];
  onToggle: (id: string) => void;
}

export default function MyMembersPanel({ members, checkedMemberIds, onToggle }: Props) {
  const navigate = useNavigate();

  // members 컬렉션의 active 필드 및 request_confirmed 필드 기준 분리
  const approved = members.filter((m) => m.active === true);
  // Pending: Active=false AND request_confirmed!=true
  const pending = members.filter((m) => m.active === false && !m.request_confirmed);
  // Inactive: Active=false AND request_confirmed=true
  const inactive = members.filter((m) => m.active === false && m.request_confirmed);

  return (
    <div className="p-3 border rounded-xl mb-4 bg-white shadow-sm">
      {/* 1) 승인된 복사 (Toggle Buttons) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-gray-800 text-sm">나의 복사 (선택하여 일정 보기)</div>
          <button
            onClick={() => navigate('/add-member')}
            className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="복사 추가"
          >
            <Plus size={18} />
          </button>
        </div>
        {approved.length === 0 && pending.length === 0 && inactive.length === 0 ? (
          <div className="text-gray-500 text-sm">등록된 복사가 없습니다</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* 승인된 복사 버튼 */}
            {approved.map((m) => {
              const checked = checkedMemberIds.includes(m.memberId);
              return (
                <button
                  key={m.memberId}
                  onClick={() => onToggle(m.memberId)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
                    checked
                      ? 'bg-blue-50 border-blue-500 border-[1.5px] font-bold text-blue-800 shadow-md'
                      : 'bg-green-50 border-green-200 text-gray-700 hover:bg-green-100'
                  )}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                  {m.name_kor} ({m.baptismal_name})
                </button>
              );
            })}

            {/* 승인 대기 중 복사 */}
            {pending.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                title="관리자 승인 대기 중"
              >
                ⏳ {m.name_kor} (승인대기)
              </div>
            ))}

            {/* 비활성 복사 (Inactive) */}
            {inactive.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                title="비활성 상태"
              >
                🚫 {m.name_kor} (비활성)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
