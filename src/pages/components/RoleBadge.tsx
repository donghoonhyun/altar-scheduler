// src/pages/components/RoleBadge.tsx
import React, { useEffect, useState } from 'react';
import { useSession } from '../../state/session';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui';

interface RoleBadgeProps {
  serverGroupId?: string;
}

interface MemberInfo {
  name_kor?: string;
  baptismal_name?: string;
  grade?: string;
  notes?: string;
  active?: boolean;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ serverGroupId }) => {
  const session = useSession();
  const [showModal, setShowModal] = useState(false);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  // ✅ 항상 hook 호출, 내부에서 조건 처리
  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!serverGroupId) return;
      const role = session.groupRoles[serverGroupId];
      if (role !== 'server' || !session.user) return;

      const db = getFirestore();
      const ref = doc(db, 'server_groups', serverGroupId, 'members', session.user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setMemberInfo(snap.data() as MemberInfo);
      }
    };
    fetchMemberInfo();
  }, [serverGroupId, session.groupRoles, session.user]);

  if (!serverGroupId) return null;

  const role = session.groupRoles[serverGroupId];
  if (!role) return null;

  const serverGroup = session.serverGroups[serverGroupId];
  const label = role === 'planner' ? 'Planner' : 'Server';

  const styles = role === 'planner' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

  return (
    <>
      <button
        className={`px-3 py-1 text-sm rounded-full ${styles}`}
        onClick={() => setShowModal(true)}
      >
        [{label}] {serverGroup?.parishName} {serverGroup?.groupName}
      </button>

      {/* ✅ 표준 Dialog 컴포넌트 사용 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle>나의 정보</DialogTitle>
            <DialogDescription>
              현재 로그인된 계정의 정보입니다.
            </DialogDescription>
          </div>

          <div className="space-y-3 text-sm py-4">
            <p>
              <strong>이메일:</strong> {session.user?.email}
            </p>
            <p>
              <strong>이름:</strong>{' '}
              {session.user?.displayName || memberInfo?.name_kor || '-'}
            </p>
            <p>
              <strong>역할:</strong> {label}
            </p>
            <p>
              <strong>본당:</strong> {serverGroup?.parishName}
            </p>
            <p>
              <strong>복사단:</strong> {serverGroup?.groupName}
            </p>

            {role === 'server' && memberInfo && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p>
                  <strong>세례명:</strong> {memberInfo.baptismal_name || '-'}
                </p>
                <p>
                  <strong>학년:</strong> {memberInfo.grade || '-'}
                </p>
                <p>
                  <strong>비고:</strong> {memberInfo.notes || '-'}
                </p>
                <p>
                  <strong>승인여부:</strong>{' '}
                  {memberInfo.active ? '승인됨' : '승인대기'}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RoleBadge;
