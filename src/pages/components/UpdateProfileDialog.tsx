import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface UpdateProfileDialogProps {
  memberId: string;
  serverGroupId: string;
  currentName?: string;
  currentBaptismalName?: string;
  onClose: () => void;
}

export default function UpdateProfileDialog({
  memberId,
  serverGroupId,
  currentName,
  currentBaptismalName,
  onClose,
}: UpdateProfileDialogProps) {
  const [name, setName] = useState(currentName || '');
  const [baptismalName, setBaptismalName] = useState(currentBaptismalName || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('이름은 필수 입력 항목입니다.');
      return;
    }

    try {
      setLoading(true);
      const ref = doc(db, 'server_groups', serverGroupId, 'members', memberId);
      await updateDoc(ref, {
        name_kor: name.trim(),
        baptismal_name: baptismalName.trim(),
        updated_at: serverTimestamp(),
      });
      toast.success('정보가 업데이트되었습니다.');
      onClose(); // 닫기 (상태 업데이트는 리스너에 의해 자동 반영됨)
    } catch (err) {
      console.error(err);
      toast.error('업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-sm rounded-lg shadow-lg p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-bold mb-4">추가 정보 입력</h2>
        <p className="text-sm text-gray-600 mb-4">
          원활한 활동을 위해 이름 정보를 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">이름 (필수)</label>
            <input
              className="w-full border rounded p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              세례명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              className="w-full border rounded p-2"
              value={baptismalName}
              onChange={(e) => setBaptismalName(e.target.value)}
              placeholder="베드로"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
