// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../state/session';
import Layout from '../pages/components/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';

import Login from '../pages/Login';
import SignUp from '../pages/SignUp';

import Dashboard from '../pages/Dashboard';
import ServerMain from '../pages/ServerMain';
import ServerGroupList from '../pages/ServerGroupList';
import ServerList from '../pages/ServerList';
import ServerGroupWizard from '../pages/ServerGroupWizard';
import Forbidden from '../pages/components/Forbidden';
import MassEventPlanner from '../pages/MassEventPlanner';
import MassEventPresets from '../pages/MassEventPresets';

import RoleGuard from '../pages/components/RoleGuard';
import ServerSurvey from '@/pages/ServerSurvey';
import AddMember from '@/pages/AddMember';
import ServerAssignmentStatus from '@/pages/ServerAssignmentStatus';

export default function AppRoutes() {
  const session = useSession();

  // 1) 세션 로딩 중
  if (session.loading) {
    return <LoadingSpinner label="세션 초기화 중..." size="lg" />;
  }

  // 2) 로그인 안됨
  if (!session.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  /**
   * InitialRoute
   * '/' 진입 시 Planner / Server / 신규 사용자 분기 처리
   */
  const InitialRoute = () => {
    if (session.loading || !session.groupRolesLoaded) {
      return <LoadingSpinner label="세션 동기화 중..." />;
    }

    const roles = session.groupRoles; // { [groupId]: 'planner' | 'server' }
    const groupIds = Object.keys(roles);

    // 1) 플래너 역할 우선 진입
    const plannerGroup = groupIds.find((g) => roles[g] === 'planner');
    if (plannerGroup) {
      return <Navigate to={`/server-groups/${plannerGroup}`} replace />;
    }

    // 2) 서버 역할로 진입
    const serverGroup = groupIds.find((g) => roles[g] === 'server');
    if (serverGroup) {
      return <Navigate to={`/server-groups/${serverGroup}`} replace />;
    }

    // 3) 어떤 역할도 없으면 AddMember 로
    return <Navigate to="/add-member" replace />;
  };

  /**
   * ServerMainWrapper
   * /server-groups/:serverGroupId/* 에 진입 시 Planner/Server 분기
   */
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams<{ serverGroupId: string }>();

    if (session.loading || !session.groupRolesLoaded) {
      return <div className="p-4 text-gray-500">세션 동기화 중...</div>;
    }

    if (!serverGroupId) {
      return <Navigate to="/" replace />;
    }

    const role = session.groupRoles[serverGroupId];

    if (role === 'planner') return <Dashboard />;
    if (role === 'server') return <ServerMain />;

    // Server도 Planner도 아닌데 특정 그룹 접근 → Forbidden
    return <Navigate to="/forbidden" replace />;
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        <>
          {/* ------------------------------- */}
          {/* Planner 전용 라우트               */}
          {/* ------------------------------- */}
          <Route
            path="/server-groups"
            element={
              <RoleGuard require="planner">
                <ServerGroupList />
              </RoleGuard>
            }
          />

          <Route
            path="/server-groups/:serverGroupId/servers"
            element={
              <RoleGuard require="planner">
                <ServerList />
              </RoleGuard>
            }
          />

          <Route
            path="/server-groups/new"
            element={
              <RoleGuard require="planner">
                <ServerGroupWizard />
              </RoleGuard>
            }
          />

          <Route
            path="/server-groups/:serverGroupId/mass-events"
            element={
              <RoleGuard require="planner">
                <MassEventPlanner />
              </RoleGuard>
            }
          />

          <Route
            path="/server-groups/:serverGroupId/presets"
            element={
              <RoleGuard require="planner">
                <MassEventPresets />
              </RoleGuard>
            }
          />

          <Route
            path="/server-groups/:serverGroupId/assignment-status"
            element={
              <RoleGuard require="planner">
                <ServerAssignmentStatus />
              </RoleGuard>
            }
          />

          {/* ------------------------------- */}
          {/* Server 전용 라우트               */}
          {/* ------------------------------- */}
          <Route
            path="/survey/:serverGroupId/:yyyymm"
            element={
              <RoleGuard require="server">
                <ServerSurvey />
              </RoleGuard>
            }
          />

          {/* ------------------------------- */}
          {/* Planner / Server 공통 Wrapper     */}
          {/* ------------------------------- */}
          <Route
            path="/server-groups/:serverGroupId/*"
            element={
              <RoleGuard>
                <ServerMainWrapper />
              </RoleGuard>
            }
          />

          {/* ------------------------------- */}
          {/* 홈 경로: Role 기반 자동 라우팅    */}
          {/* ------------------------------- */}
          <Route path="/" element={<InitialRoute />} />
        </>

        {/* ------------------------------- */}
        {/* 복사 추가 페이지 (로그인만 필요)  */}
        {/* ------------------------------- */}
        <Route
          path="/add-member"
          element={
            <RoleGuard>
              <AddMember />
            </RoleGuard>
          }
        />

        {/* ------------------------------- */}
        {/* 공통 Route                        */}
        {/* ------------------------------- */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to="/forbidden" replace />} />
      </Route>
    </Routes>
  );
}
