// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import Layout from '../pages/components/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PendingApproval from '../pages/PendingApproval';

import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import Dashboard from '../pages/Dashboard';
import ServerMain from '../pages/ServerMain';
import ServerGroupList from '../pages/ServerGroupList';
import ServerList from '../pages/ServerList';
import ServerGroupWizard from '../pages/ServerGroupWizard';
import Forbidden from '../pages/components/Forbidden';
import MassEventPlanner from '../pages/MassEventPlanner';
import RoleGuard from '../pages/components/RoleGuard';
import ServerSurvey from '@/pages/ServerSurvey';

export default function AppRoutes() {
  const session = useSession();

  // ✅ 세션 초기화 중
  if (session.loading) {
    return <LoadingSpinner label="세션 초기화 중..." size="lg" />;
  }

  // ✅ 로그인되지 않은 경우
  if (!session.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ✅ 서버 메인 Wrapper (planner/server 구분)
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams<{ serverGroupId: string }>();

    if (session.loading || !session.groupRolesLoaded) {
      return <div className="p-4 text-gray-500">세션 동기화 중...</div>;
    }

    const role = serverGroupId ? session.groupRoles[serverGroupId] : null;

    if (role === 'planner') return <Dashboard />;
    if (role === 'server') return <ServerMain />;
    return <Navigate to="/forbidden" replace />;
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        <>
          {/* 복사단 리스트 */}
          <Route
            path="/server-groups"
            element={
              <RoleGuard require="planner">
                <ServerGroupList />
              </RoleGuard>
            }
          />

          {/* 복사 명단 관리 */}
          <Route
            path="/server-groups/:serverGroupId/servers"
            element={
              <RoleGuard require="planner">
                <ServerList />
              </RoleGuard>
            }
          />

          {/* 복사단 생성 마법사 */}
          <Route
            path="/server-groups/new"
            element={
              <RoleGuard require="planner">
                <ServerGroupWizard />
              </RoleGuard>
            }
          />

          {/* 미사 일정 플래너 */}
          <Route
            path="/server-groups/:serverGroupId/mass-events"
            element={
              <RoleGuard require="planner">
                <MassEventPlanner />
              </RoleGuard>
            }
          />

          {/* 복사용 설문 페이지 */}
          <Route
            path="/survey/:serverGroupId/:yyyymm"
            element={
              <RoleGuard require="server">
                <ServerSurvey />
              </RoleGuard>
            }
          />

          {/* 복사 메인 페이지 */}
          <Route
            path="/server-groups/:serverGroupId/server-main"
            element={
              <RoleGuard require="server">
                <ServerMain />
              </RoleGuard>
            }
          />

          {/* 서버/플래너 공용 Wrapper */}
          <Route
            path="/server-groups/:serverGroupId/*"
            element={
              <RoleGuard>
                <ServerMainWrapper />
              </RoleGuard>
            }
          />

          {/* 기본 경로 분기 */}
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

          {/* 승인 대기 */}
          <Route path="/pending" element={<PendingApproval />} />
        </>

        {/* 공통 */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to="/forbidden" replace />} />
      </Route>
    </Routes>
  );
}
