import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { openConfirm } from '@/components/common/ConfirmDialog';

interface Member {
  id: string;
  name_kor: string;
  baptismal_name: string;
  grade: string;
  email?: string;
  active: boolean;
}

export default function ServerList() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Firestore 실시간 구독
  useEffect(() => {
    if (!serverGroupId) return;

    const colRef = collection(db, 'server_groups', serverGroupId, 'members');
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const all: Member[] = snap.docs.map((d) => ({
        ...(d.data() as Member),
        id: d.id,
      }));
      setPendingMembers(all.filter((m) => m.active === false));
      setActiveMembers(all.filter((m) => m.active === true));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverGroupId]);

  // ✅ 승인 처리
  const handleApprove = async (uid: string) => {
    if (!serverGroupId) return;

    const ok = await openConfirm({
      title: '회원 승인',
      message: '해당 회원을 승인하시겠습니까?',
      confirmText: '승인',
      cancelText: '취소',
    });

    if (!ok) return;

    try {
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
      await updateDoc(memberRef, { active: true, updated_at: new Date() });
      toast.success('✅ 회원이 승인되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  // ✅ 삭제(거절) 처리
  const handleDelete = async (uid: string) => {
    if (!serverGroupId) return;

    const ok = await openConfirm({
      title: '회원 삭제',
      message: '정말로 이 회원을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
    });

    if (!ok) return;

    try {
      // (1) members 문서 삭제
      await deleteDoc(doc(db, 'server_groups', serverGroupId, 'members', uid));

      // (2) memberships 문서 삭제
      const membershipId = `${uid}_${serverGroupId}`;
      await deleteDoc(doc(db, 'memberships', membershipId));

      toast.success('🚫 회원이 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">명단 불러오는 중...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 fade-in">
      <h1 className="text-2xl font-bold mb-6">복사단원 관리</h1>

      {/* ✅ 승인 대기중 */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">승인 대기중</h2>
        {pendingMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">승인 대기 중인 단원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {pendingMembers.map((m) => (
              <Card
                key={m.id}
                className="p-3 flex flex-col justify-between text-center hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{m.name_kor}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ({m.baptismal_name}) · {m.grade}
                  </p>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button
                    onClick={() => handleApprove(m.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                  >
                    승인
                  </Button>
                  <Button
                    onClick={() => handleDelete(m.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1"
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* ✅ 활동중인 복사단원 */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">활동중인 복사단원</h2>
        {activeMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">아직 승인된 복사단원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {activeMembers.map((m) => (
              <Card key={m.id} className="p-3 text-center hover:shadow-md transition-shadow">
                <p className="font-semibold text-gray-800 text-sm">{m.name_kor}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  ({m.baptismal_name}) · {m.grade}
                </p>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
