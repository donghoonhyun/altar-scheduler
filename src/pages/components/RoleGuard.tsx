// src/pages/components/RoleGuard.tsx
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSession } from '../../state/session';

interface RoleGuardProps {
  children: React.ReactNode;
  require?: 'planner' | 'server'; // ✅ Admin/Manager는 제외
}

/**
 * ✅ 역할 기반 접근 제어
 * - require 지정 없으면 로그인만 확인
 * - require = "planner" → 해당 그룹 플래너만 접근 가능
 * - require = "server"  → 해당 그룹 복사만 접근 가능
 */
export default function RoleGuard({ children, require }: RoleGuardProps) {
  const { serverGroupId } = useParams<{ serverGroupId: string }>(); // ✅ 라우트 파라미터 직접 읽음
  const session = useSession();

  // 세션 로딩 중
  if (session.loading) {
    return <div className="p-4">세션 로딩 중...</div>;
  }

  // 로그인 안 된 경우 → 로그인 페이지로
  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  // 권한 체크
  if (require) {
    if (!serverGroupId) {
      console.warn(`🚫 접근 거부: serverGroupId 누락 (require=${require})`);
      return <Navigate to="/forbidden" replace />;
    }

    const role = session.groupRoles[serverGroupId];
    if (role !== require) {
      console.warn(`🚫 접근 거부: ${session.user.email} → require=${require}, actual=${role}`);
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
