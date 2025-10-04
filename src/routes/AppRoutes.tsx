// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import Layout from '../pages/components/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';

// 페이지
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import ServerMain from '../pages/ServerMain';
import ServerGroupList from '../pages/ServerGroupList';
import ServerList from '../pages/ServerList';
import ServerGroupWizard from '../pages/ServerGroupWizard';
import Forbidden from '../pages/components/Forbidden';
import MassEventPlanner from '../pages/MassEventPlanner';
import RoleGuard from '../pages/components/RoleGuard';

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

  // ✅ 서버 메인 Wrapper
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams<{ serverGroupId: string }>();
    if (session.loading) return <div>Loading...</div>;

    const role = serverGroupId ? session.groupRoles[serverGroupId] : null;

    if (role === 'planner') {
      return <Dashboard />;
    } else if (role === 'server') {
      return <ServerMain />;
    } else {
      return <Navigate to="/forbidden" replace />;
    }
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        {Object.keys(session.groupRoles).length > 0 && (
          <>
            {/* 복사단 리스트 */}
            <Route path="/server-groups" element={<ServerGroupList />} />

            {/* 복사 명단 관리 */}
            <Route path="/server-groups/:serverGroupId/servers" element={<ServerList />} />

            {/* 복사단 생성 마법사 */}
            <Route path="/server-groups/new" element={<ServerGroupWizard />} />

            {/* ✅ 미사일정 플래너 페이지 (planner 전용) */}
            <Route
              path="/server-groups/:serverGroupId/mass-events"
              element={
                <RoleGuard require="planner">
                  <MassEventPlanner />
                </RoleGuard>
              }
            />

            {/* 복사단별 메인 (planner → Dashboard, server → ServerMain) */}
            <Route path="/server-groups/:serverGroupId/*" element={<ServerMainWrapper />} />

            {/* 초기 진입 분기 */}
            <Route
              path="/"
              element={
                session.currentServerGroupId ? (
                  <Navigate to={`/server-groups/${session.currentServerGroupId}`} replace />
                ) : (
                  <Navigate to="/server-groups" replace />
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
