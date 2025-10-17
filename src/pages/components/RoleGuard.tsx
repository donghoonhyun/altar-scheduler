// src/pages/components/RoleGuard.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSession } from '../../state/session';
import { getFirestore, collectionGroup, getDocs, query, where } from 'firebase/firestore';

interface RoleGuardProps {
  children: React.ReactNode;
  require?: 'planner' | 'server';
}

/**
 * ✅ RoleGuard
 * 로그인/승인(active)/권한(role) 체크 + 세션 동기화 보류처리 포함
 */
export default function RoleGuard({ children, require }: RoleGuardProps) {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const [checked, setChecked] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const db = getFirestore();

  useEffect(() => {
    const checkMemberStatus = async () => {
      if (!session.user) {
        setChecked(true);
        return;
      }

      try {
        const q = query(collectionGroup(db, 'members'), where('uid', '==', session.user.uid));
        const snap = await getDocs(q);
        if (snap.empty) {
          setChecked(true);
          return;
        }

        const hasActive = snap.docs.some((doc) => doc.data().active === true);
        const hasPending = snap.docs.some((doc) => doc.data().active === false);
        if (hasPending && !hasActive) setIsPending(true);
      } finally {
        setChecked(true);
      }
    };

    if (session.user && !session.loading && session.groupRolesLoaded) {
      checkMemberStatus();
    }
  }, [session.user, session.loading, session.groupRolesLoaded, db]);

  // ✅ 1) 세션 또는 Firestore 체크 미완료 시 대기
  if (session.loading || !session.groupRolesLoaded || !checked) {
    return <div className="p-4 text-gray-500">세션 동기화 중...</div>;
  }

  // ✅ 2) 로그인 안 된 경우
  if (!session.user) return <Navigate to="/login" replace />;

  // ✅ 3) 승인 대기 회원
  if (isPending) return <Navigate to="/pending" replace />;

  // ✅ 4) 역할 검사
  if (require) {
    if (!serverGroupId) return <Navigate to="/forbidden" replace />;
    const role = session.groupRoles[serverGroupId];
    if (role !== require) return <Navigate to="/forbidden" replace />;
  }

  // ✅ 5) 모든 조건 통과
  return <>{children}</>;
}
