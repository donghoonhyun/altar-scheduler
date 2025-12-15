// src/routes/AppRoutes.tsx
import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
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
        {/* /signup은 공용 라우트로 이동 */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  /**
   * InitialRoute
   * '/' 진입 시 Planner / Server / 신규 사용자 분기 처리
   */
  /**
   * HomeRedirect
   * '/' 진입 시 Planner / Server / 신규 사용자 분기 처리
   * useEffect 기반으로 변경하여 렌더링 중 리다이렉트 충돌 방지
   */
  const HomeRedirect = () => {
    const navigate = useNavigate(); // Hook 사용 필요

    useEffect(() => {
      // 로딩 중이면 대기
      if (session.loading || !session.groupRolesLoaded) return;

      const roles = session.groupRoles;
      const groupIds = Object.keys(roles);

      // 1) 플래너 역할 우선 진입
      const plannerGroup = groupIds.find((g) => roles[g] === 'planner');
      if (plannerGroup) {
        navigate(`/server-groups/${plannerGroup}`, { replace: true });
        return;
      }

      // 2) 서버 역할로 진입
      const serverGroup = groupIds.find((g) => roles[g] === 'server');
      if (serverGroup) {
        navigate(`/server-groups/${serverGroup}`, { replace: true });
        return;
      }

      // 3) 어떤 역할도 없으면 AddMember 로
      navigate('/add-member', { replace: true });
    }, [session.loading, session.groupRolesLoaded, session.groupRoles, navigate]);

    // 리다이렉트 전까지 로딩 표시
    return <LoadingSpinner label="홈으로 이동 중..." />;
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
      <Route path="/" element={<HomeRedirect />} />
      
      {/* 로그인 상태에서도 회원가입 페이지 접근 허용 (Google 미가입자 리다이렉트용) */}
      <Route path="/signup" element={<SignUp />} />

      {/* 3) Forbidden 페이지 */}
      <Route path="/forbidden" element={<Forbidden />} />

      {/* 4) 메인 앱 레이아웃 (Layout 적용) */}
      <Route element={<Layout />}>
        {/* 복사 추가 페이지 (Layout 적용, RoleGuard 없음) */}
        <Route path="/add-member" element={<AddMember />} />

        {/* Planner 전용 라우트 */}
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

        {/* Server 전용 라우트 */}
        <Route
          path="/survey/:serverGroupId/:yyyymm"
          element={
            <RoleGuard require="server">
              <ServerSurvey />
            </RoleGuard>
          }
        />

        {/* Planner / Server 공통 Wrapper */}
        <Route
          path="/server-groups/:serverGroupId/*"
          element={
            <RoleGuard>
              <ServerMainWrapper />
            </RoleGuard>
          }
        />
      </Route>

      {/* Catch-all: 잘못된 경로는 홈으로 리다이렉트하여 재처리 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
