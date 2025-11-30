// src/pages/CompleteProfile.tsx
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function CompleteProfile() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [userName, setUserName] = useState(user?.displayName || '');
  const [baptismalName, setBaptismalName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    if (!user) return;
    if (!userName || !baptismalName) {
      toast.error('이름과 세례명을 입력해주세요.');
      return;
    }

    await updateDoc(doc(db, 'users', user.uid), {
      user_name: userName,
      baptismal_name: baptismalName,
      phone,
      updated_at: serverTimestamp(),
    });

    toast.success('프로필이 저장되었습니다!');
    navigate('/');
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">추가 정보입력</h2>

      <input
        className="border p-2 w-full mb-2"
        placeholder="이름"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-2"
        placeholder="세례명"
        value={baptismalName}
        onChange={(e) => setBaptismalName(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-4"
        placeholder="전화번호(선택)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <button className="w-full py-2 bg-green-600 text-white rounded" onClick={handleSave}>
        저장하기
      </button>
    </div>
  );
}
