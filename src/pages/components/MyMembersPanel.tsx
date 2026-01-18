import { useNavigate } from 'react-router-dom';
import type { MemberDoc } from '@/types/firestore';
import { cn } from '@/lib/utils';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface Props {
  members: (MemberDoc & { memberId: string })[];
  serverGroupId: string;
  userUid: string;
  checkedMemberIds: string[];
  onToggle: (id: string) => void;
}

export default function MyMembersPanel({ members, checkedMemberIds, onToggle, serverGroupId }: Props) {
  const navigate = useNavigate();
  const [selectedPendingMember, setSelectedPendingMember] = useState<(MemberDoc & { memberId: string }) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteParams = async () => {
    if (!selectedPendingMember) return;
    if (!confirm(`'${selectedPendingMember.name_kor}'님의 신청 정보를 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'server_groups', serverGroupId, 'members', selectedPendingMember.memberId));
      toast.success('신청이 취소되었습니다.');
      setSelectedPendingMember(null);
    } catch (error) {
      console.error(error);
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // members 컬렉션의 active 필드 및 request_confirmed 필드 기준 분리
  const approved = members.filter((m) => m.active === true);
  // Pending: Active=false AND request_confirmed!=true
  const pending = members.filter((m) => m.active === false && !m.request_confirmed);
  // Inactive: Active=false AND request_confirmed=true
  const inactive = members.filter((m) => m.active === false && m.request_confirmed);

  return (
    <div className="p-3 border rounded-xl mb-4 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm">
      {/* 1) 승인된 복사 (Toggle Buttons) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">나의 복사 (선택하여 일정 보기)</div>
          <button
            onClick={() => navigate('/add-member')}
            className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
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
                      ? 'bg-blue-50 border-blue-500 border-[1.5px] font-bold text-blue-800 shadow-md dark:bg-blue-900/40 dark:border-blue-500 dark:text-blue-300'
                      : 'bg-green-50 border-green-200 text-gray-700 hover:bg-green-100 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-gray-300 dark:hover:bg-emerald-900/30'
                  )}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                  {m.name_kor} ({m.baptismal_name})
                </button>
              );
            })}

            {/* 승인 대기 중 복사 */}
            {pending.map((m) => (
              <button
                key={m.memberId}
                onClick={() => setSelectedPendingMember(m)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                title="클릭하여 신청 정보 확인/취소"
              >
                ⏳ {m.name_kor} (승인대기)
              </button>
            ))}

            {/* 비활성 복사 (Inactive) */}
            {inactive.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border bg-gray-100 border-gray-200 text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-500 cursor-not-allowed"
                title="비활성 상태"
              >
                🚫 {m.name_kor} (비활성)
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPendingMember} onOpenChange={(open) => !open && setSelectedPendingMember(null)}>
        <DialogContent className="max-w-xs rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 dark:text-white">
              <span className="text-xl">⏳</span> 승인 대기 중
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              관리자의 승인을 기다리고 있습니다.
            </DialogDescription>
          </DialogHeader>

          {selectedPendingMember && (
            <div className="py-2 space-y-3">
              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 text-sm">
                <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">이름</span>
                    <span className="col-span-2 font-bold dark:text-gray-200">{selectedPendingMember.name_kor}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">세례명</span>
                    <span className="col-span-2 font-bold dark:text-gray-200">{selectedPendingMember.baptismal_name}</span>
                </div>
                {selectedPendingMember.created_at && (
                    <div className="grid grid-cols-3 gap-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">신청일</span>
                        <span className="col-span-2 dark:text-gray-200">
                            {dayjs(selectedPendingMember.created_at.toDate()).format('YYYY-MM-DD')}
                        </span>
                    </div>
                )}
              </div>
              
              <div className="text-xs text-center text-gray-400 dark:text-gray-500 px-2 break-keep">
                 잘못 신청하셨거나 신청을 취소하려면 아래 삭제 버튼을 눌러주세요.
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
             <Button 
                variant="destructive" 
                onClick={handleDeleteParams} 
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-2"
            >
                <Trash2 size={16} />
                {isDeleting ? '삭제 중...' : '신청 취소'}
            </Button>
            <Button 
                variant="outline" 
                onClick={() => setSelectedPendingMember(null)}
                className="w-full"
            >
                닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
