// src/pages/components/RoleGuard.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../../state/session";

interface RoleGuardProps {
  children: React.ReactNode;
  require?: "planner" | "server"; // ✅ Admin/Manager 제거
  serverGroupId?: string;
}

/**
 * ✅ 역할 기반 접근 제어
 * - require 지정 없으면 로그인만 확인
 * - require = "planner" → 해당 그룹 플래너만 접근 가능
 * - require = "server"  → 해당 그룹 복사만 접근 가능
 */
export default function RoleGuard({
  children,
  require,
  serverGroupId,
}: RoleGuardProps) {
  const session = useSession();

  // 아직 세션 로딩 중이면 아무것도 렌더링하지 않음
  if (session.loading) {
    return null;
  }

  // 로그인 안 된 경우 → 로그인 페이지로
  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  // 권한 체크
  if (require && serverGroupId) {
    const role = session.groupRoles[serverGroupId];
    if (role !== require) {
      console.warn(
        `🚫 접근 거부: ${session.user.email} → require=${require}, actual=${role}`
      );
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
