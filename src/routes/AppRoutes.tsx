// src/routes/AppRoutes.tsx
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
import SelectParish from "../pages/SelectParish";
import ServerGroupWizard from "../pages/ServerGroupWizard";
import ServerGroupsList from "../pages/ServerGroupsList";   // ✅ 신규 추가
import Forbidden from "../pages/components/Forbidden";

export default function AppRoutes() {
  const session = useSession();

  // ✅ 세션 로딩 중일 때는 분기하지 않고 무조건 로딩 표시
  if (session.loading) {
    return <LoadingSpinner label="세션 초기화 중..." size="lg" />;
  }

  // 로그인 안 된 경우
  if (!session.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 동적 parishCode 전달용 Wrapper
  const ParishServerGroupWizardWrapper = () => {
    const { parishCode } = useParams();
    if (session.loading) return <div>Loading...</div>; // ✅ 안전 처리
    return (
      <RoleGuard require="manager" parishCode={parishCode}>
        <ServerGroupWizard />
      </RoleGuard>
    );
  };

  // 동적 parishCode 전달용 Wrapper (리스트 페이지)
  const ParishServerGroupsListWrapper = () => {
    const { parishCode } = useParams();
    if (session.loading) return <div>Loading...</div>;
    return (
      <RoleGuard require="manager" parishCode={parishCode}>
        <ServerGroupsList />
      </RoleGuard>
    );
  };

  // 동적 serverGroupId 전달용 Wrapper
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams();
    if (session.loading) return <div>Loading...</div>; // ✅ 안전 처리
    return (
      <RoleGuard require="planner" serverGroupId={serverGroupId}>
        <ServerMain />
      </RoleGuard>
    );
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Admin */}
        {session.isAdmin && (
          <>
            <Route
              path="/dashboard"
              element={
                <RoleGuard require="admin">
                  <Dashboard />
                </RoleGuard>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </>
        )}

        {/* Manager */}
        {session.managerParishes.length > 0 && (
          <>
            <Route
              path="/select-parish"
              element={
                <RoleGuard
                  require="manager"
                  parishCode={session.managerParishes[0]}
                >
                  <SelectParish />
                </RoleGuard>
              }
            />
            {/* ✅ 복사단 리스트 */}
            <Route
              path="/parish/:parishCode/server-groups"
              element={<ParishServerGroupsListWrapper />}
            />
            {/* ✅ 복사단 생성 */}
            <Route
              path="/parish/:parishCode/server-groups/new"
              element={<ParishServerGroupWizardWrapper />}
            />
            <Route path="/" element={<Navigate to="/select-parish" replace />} />
          </>
        )}

        {/* Planner / Server */}
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
