// src/pages/components/RoleGuard.tsx
import { Navigate } from "react-router-dom";
import { useSession } from "../../state/session";
import LoadingSpinner from "../../components/common/LoadingSpinner";

interface RoleGuardProps {
  children: React.ReactNode;
  require?: "admin" | "manager" | "planner" | "server";
  parishCode?: string; // Manager 전용
  serverGroupId?: string; // Planner/Server 전용
}

export default function RoleGuard({
  children,
  require,
  parishCode,
  serverGroupId,
}: RoleGuardProps) {
  const session = useSession();

  // 아직 세션 로딩 중이면 Forbidden 보내지 않고 안전하게 block
  if (session.loading) {
    console.log("⏳ RoleGuard: 세션 로딩 중 → Forbidden 차단");
    return <LoadingSpinner label="권한 확인 중..." />;
  }

  if (!session.user) {
    console.warn("❌ RoleGuard: 로그인 안 됨 → /login");
    return <Navigate to="/login" replace />;
  }

  // 권한 판정
  switch (require) {
    case "admin":
      if (!session.isAdmin) {
        console.warn("❌ RoleGuard: Admin 아님");
        return <Navigate to="/forbidden" replace />;
      }
      break;

    case "manager":
      if (!parishCode || !session.managerParishes.includes(parishCode)) {
        console.warn("❌ RoleGuard: Manager 권한 없음", {
          parishCode,
          managerParishes: session.managerParishes,
        });
        return <Navigate to="/forbidden" replace />;
      }
      break;

    case "planner":
      if (!serverGroupId || session.groupRoles[serverGroupId] !== "planner") {
        console.warn("❌ RoleGuard: Planner 권한 없음", {
          serverGroupId,
          groupRoles: session.groupRoles,
        });
        return <Navigate to="/forbidden" replace />;
      }
      break;

    case "server":
      if (!serverGroupId || session.groupRoles[serverGroupId] !== "server") {
        console.warn("❌ RoleGuard: Server 권한 없음", {
          serverGroupId,
          groupRoles: session.groupRoles,
        });
        return <Navigate to="/forbidden" replace />;
      }
      break;

    default:
      // require가 없으면 모두 통과
      break;
  }

  return <>{children}</>;
}
