// src/pages/components/RoleGuard.tsx
import { Navigate } from "react-router-dom";
import { useSession } from "../../state/session";

interface RoleGuardProps {
  children: React.ReactNode;
  require?: "admin" | "manager" | "planner" | "server";
  serverGroupId?: string; // Planner/Server 전용
}

export default function RoleGuard({
  children,
  require,
  serverGroupId,
}: RoleGuardProps) {
  const session = useSession();

  if (session.loading) {
    return <div>Loading...</div>;
  }

  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  // 권한 판정
  switch (require) {
    case "admin":
      if (!session.isAdmin) return <Navigate to="/forbidden" replace />;
      break;

    case "manager":
      if (session.managerParishes.length === 0) {
        return <Navigate to="/forbidden" replace />;
      }
      break;

    case "planner":
      if (!serverGroupId || session.groupRoles[serverGroupId] !== "planner") {
        return <Navigate to="/forbidden" replace />;
      }
      break;

    case "server":
      if (!serverGroupId || session.groupRoles[serverGroupId] !== "server") {
        return <Navigate to="/forbidden" replace />;
      }
      break;

    default:
      break;
  }

  return <>{children}</>;
}
