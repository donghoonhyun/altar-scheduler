// src/pages/CompleteProfile.tsx
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, Input, Label, Button, Heading } from '@/components/ui';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-[400px] p-8 shadow-xl bg-white border-none">
        <div className="text-center mb-6">
          <Heading size="md" className="mb-2 text-gray-800">추가 정보 입력</Heading>
          <p className="text-sm text-gray-500">원활한 서비스 이용을 위해 추가 정보를 입력해주세요.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">이름</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="이름"
              className="h-11 bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">세례명</Label>
            <Input
              value={baptismalName}
              onChange={(e) => setBaptismalName(e.target.value)}
              placeholder="세례명"
              className="h-11 bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">전화번호</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="010-0000-0000"
              className="h-11 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">* 연락처는 본인 확인 및 긴급 연락용으로 사용됩니다.</p>
          </div>

          <Button
            onClick={handleSave}
            className="w-full h-12 text-base font-bold bg-[#3b82f6] hover:bg-blue-600 mt-4"
          >
            저장하기
          </Button>
        </div>
      </Card>
    </div>
  );
}
