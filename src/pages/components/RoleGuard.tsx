import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSession } from '../../state/session';
import { getFirestore, collectionGroup, getDocs, query, where } from 'firebase/firestore';

interface RoleGuardProps {
  children: React.ReactNode;
  require?: 'planner' | 'server';
}

/**
 * RoleGuard (개정 2025-11 PRD 반영)
 * - require 없으면 항상 접근 허용
 * - require=server 인 경우: 승인된 복사(active=true) 1개 이상 요구
 * - require=planner 는 기존대로
 */
export default function RoleGuard({ children, require }: RoleGuardProps) {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const session = useSession();
  const [checked, setChecked] = useState(false);
  const [hasServerRole, setHasServerRole] = useState(false);
  const db = getFirestore();

  useEffect(() => {
    const checkMemberStatus = async () => {
      if (!session.user) {
        setChecked(true);
        return;
      }

      // 현재 유저가 가진 member(active=true)가 있는가?
      try {
        const q = query(
          collectionGroup(db, 'members'),
          where('parent_uid', '==', session.user.uid),
          where('active', '==', true)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          setHasServerRole(true);
        }
      } catch (err) {
        console.error('checkMemberStatus error:', err);
      } finally {
        setChecked(true);
      }
    };

    if (session.user && !session.loading && session.groupRolesLoaded) {
      checkMemberStatus();
    }
  }, [session.user, session.loading, session.groupRolesLoaded, db]);

  // 1) 초기 로딩 중일 때
  // require가 있다면 세션 로딩과 멤버 상태 확인(checked)이 모두 필요
  // require가 없다면 세션 로딩만 확인되면 통과 (checked 여부 불필요)
  const isReady = !session.loading && session.groupRolesLoaded;
  const isCheckRequired = !!require;

  if (!isReady || (isCheckRequired && !checked)) {
    return <div className="p-4 text-gray-500">세션 동기화 중...</div>;
  }

  // 2) 로그인 안 됨
  if (!session.user) return <Navigate to="/login" replace />;

  // 3) require 없는 페이지는 모두 접근 허용
  if (!require) return <>{children}</>;

  // 4) require = planner
  if (require === 'planner') {
    if (!serverGroupId) return <Navigate to="/forbidden" replace />;
    const role = session.groupRoles[serverGroupId];
    if (role === 'planner') return <>{children}</>;
    return <Navigate to="/forbidden" replace />;
  }

  // 5) require = server
  if (require === 'server') {
    // PRD: 승인된 복사가 하나라도 있으면 server 접근 허용
    if (hasServerRole) return <>{children}</>;

    // 승인된 복사가 없다면?
    // → ServerMain 접근은 허용 (빈 UI로)
    if (serverGroupId) {
      return <>{children}</>;
    }

    return <Navigate to="/forbidden" replace />;
  }

  return <Navigate to="/forbidden" replace />;
}
