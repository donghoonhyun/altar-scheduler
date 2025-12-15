import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface UpdateUserProfileDialogProps {
  uid: string;
  currentName?: string;
  currentBaptismalName?: string;
  onClose: () => void;
}

export default function UpdateUserProfileDialog({
  uid,
  currentName,
  currentBaptismalName,
  onClose,
}: UpdateUserProfileDialogProps) {
  const [name, setName] = useState(currentName || '');
  const [baptismalName, setBaptismalName] = useState(currentBaptismalName || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('이름은 필수 입력 항목입니다.');
      return;
    }
    if (!baptismalName.trim()) { // 사용자 프로필에서도 세례명 필수로 할까요? 사용자 요청은 "입력을 유도"
        // 사용자가 "이름과 세례명이 없으면"이라고 했으므로 둘 다 받는게 좋아보임. 일단 필수는 아님(UI상)
    }

    try {
      setLoading(true);
      const ref = doc(db, 'users', uid);
      // users 컬렉션이 없을 수도 있으므로 setDoc(merge: true) 사용
      await setDoc(ref, {
        user_name: name.trim(), // ⭐ name -> user_name
        baptismal_name: baptismalName.trim(),
        updated_at: serverTimestamp(),
      }, { merge: true });
      
      toast.success('프로필 정보가 업데이트되었습니다.');
      // 변경 사항이 세션에 반영되려면 페이지 새로고침이 필요할 수 있음
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      toast.error('업데이트 실패');
      setLoading(false); // reload 안 할 경우
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-sm rounded-lg shadow-lg p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-bold mb-4">프로필 정보 입력</h2>
        <p className="text-sm text-gray-600 mb-4">
          서비스 이용을 위해 보호자(본인)의 성명과 세례명을 입력해주세요.
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              나중에 하기
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
