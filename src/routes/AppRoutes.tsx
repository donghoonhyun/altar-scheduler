import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useSession } from "../state/session";
import RoleGuard from "../pages/components/RoleGuard";
import Layout from "../pages/components/Layout";
import LoadingSpinner from "../components/common/LoadingSpinner";

// 페이지
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import ServerMain from "../pages/ServerMain";
import SelectServerGroup from "../pages/SelectServerGroup";
import Forbidden from "../pages/components/Forbidden";

export default function AppRoutes() {
  const session = useSession();

  if (session.loading) {
    return <LoadingSpinner label="세션 초기화 중..." size="lg" />;
  }

  if (!session.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 동적 Wrapper
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams();
    if (session.loading) return <div>Loading...</div>;

    const role = session.groupRoles[serverGroupId || ""];

    if (role === "planner") {
      return (
        <RoleGuard require="planner" serverGroupId={serverGroupId}>
          <Dashboard />
        </RoleGuard>
      );
    } else if (role === "server") {
      return (
        <RoleGuard require="server" serverGroupId={serverGroupId}>
          <ServerMain />
        </RoleGuard>
      );
    } else {
      return <Navigate to="/forbidden" replace />;
    }
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Planner / Server 공통 */}
        {Object.keys(session.groupRoles).length > 0 && (
          <>
            <Route
              path="/select-server-group"
              element={
                <RoleGuard>
                  <SelectServerGroup />
                </RoleGuard>
              }
            />
            <Route path="/:serverGroupId/*" element={<ServerMainWrapper />} />
            <Route
              path="/"
              element={
                session.currentServerGroupId ? (
                  <Navigate to={`/${session.currentServerGroupId}`} replace />
                ) : (
                  <Navigate to="/select-server-group" replace />
                )
              }
            />
          </>
        )}

        {/* 공통 */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to="/forbidden" replace />} />
      </Route>
    </Routes>
  );
}
