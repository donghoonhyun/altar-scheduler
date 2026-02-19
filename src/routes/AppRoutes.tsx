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
import RequestPlannerRole from '@/pages/RequestPlannerRole';
import AdminMain from '../pages/AdminMain';
import MemberRoleManagement from '../pages/MemberRoleManagement';
import ServerGroupSettings from '../pages/ServerGroupSettings';
import PlannerRoleApproval from '../pages/PlannerRoleApproval';
import SuperAdminMain from '../pages/superadmin/SuperAdminMain';
import UserManagement from '../pages/superadmin/UserManagement';
import SmsManagement from '../pages/superadmin/SmsManagement';
import NotificationManagement from '../pages/superadmin/NotificationManagement';
import SurveyManagement from '../pages/SurveyManagement';
import SurveyCalendar from '@/pages/SurveyCalendar';
import SurveyByServer from '@/pages/SurveyByServer';
import WelcomeStandby from '../pages/WelcomeStandby';
import PendingApproval from '../pages/PendingApproval';
import Support from '@/pages/Support';
import ServerSchedulePrint from '@/pages/ServerSchedulePrint';

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
   * HomeRedirect
   * '/' 진입 시 Admin / Planner / Server / 신규 사용자 분기 처리
   */
  const HomeRedirect = () => {
    const navigate = useNavigate();

    useEffect(() => {
      if (session.loading || !session.groupRolesLoaded) return;

      const roles = session.groupRoles;
      const groupIds = Object.keys(roles);

      // 1) 어드민 역할 우선 진입
      const adminGroup = groupIds.find((g) => roles[g].includes('admin'));
      if (adminGroup) {
        navigate(`/server-groups/${adminGroup}`, { replace: true });
        return;
      }

      // 2) 플래너 역할 진입
      const plannerGroup = groupIds.find((g) => roles[g].includes('planner'));
      if (plannerGroup) {
        navigate(`/server-groups/${plannerGroup}`, { replace: true });
        return;
      }

      // 3) 서버 역할로 진입
      const serverGroup = groupIds.find((g) => roles[g].includes('server'));
      if (serverGroup) {
        navigate(`/server-groups/${serverGroup}`, { replace: true });
        return;
      }

      // 4) 슈퍼어드민이면 (다른 역할이 없을 때)
      if (session.isSuperAdmin) {
        navigate('/superadmin', { replace: true });
        return;
      }

      // 5) 승인 대기 중인 내역이 있으면
      if (session.hasPending) {
        navigate('/pending-approval', { replace: true });
        return;
      }

      // 6) 어떤 역할도 없으면 WelcomeStandby 로
      navigate('/welcome-standby', { replace: true });
    }, [session.loading, session.groupRolesLoaded, session.groupRoles, navigate]);

    return <LoadingSpinner label="홈으로 이동 중..." />;
  };

  /**
   * ServerMainWrapper
   * /server-groups/:serverGroupId/* 에 진입 시 Admin/Planner/Server 분기
   */
  const ServerMainWrapper = () => {
    const { serverGroupId } = useParams<{ serverGroupId: string }>();

    if (session.loading || !session.groupRolesLoaded) {
      return <div className="p-4 text-gray-500">세션 동기화 중...</div>;
    }

    if (!serverGroupId) {
      return <Navigate to="/" replace />;
    }

    const userRoles = session.groupRoles[serverGroupId] || [];

    // Admin 또는 SuperAdmin 은 AdminMain 으로
    if (session.isSuperAdmin || userRoles.includes('admin')) return <AdminMain />;
    // Planner 는 Dashboard 로 진입
    if (userRoles.includes('planner')) return <Dashboard />;
    // Server 는 ServerMain 으로 진입
    if (userRoles.includes('server')) return <ServerMain />;

    return <Navigate to="/request-planner-role" replace />;
  };

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      
      {/* 로그인 상태에서도 회원가입 페이지 접근 허용 (Google 미가입자 리다이렉트용) */}
      <Route path="/signup" element={<SignUp />} />
      
      {/* 2-1) Support 페이지 (공용) */}
      <Route path="/support" element={<Support />} />

      {/* 3) Forbidden 페이지 */}
      <Route path="/forbidden" element={<Forbidden />} />

      {/* 3-1) 인쇄 페이지 (Layout 미적용 - 별도 윈도우/전체화면용) */}
      <Route
          path="/server-groups/:serverGroupId/print-schedule/:yyyymm"
          element={
            <RoleGuard require="planner">
              <ServerSchedulePrint />
            </RoleGuard>
          }
        />

      {/* 4) 메인 앱 레이아웃 (Layout 적용) */}
      <Route element={<Layout />}>
        {/* 대기 페이지 (Layout 적용) */}
        <Route path="/welcome-standby" element={<WelcomeStandby />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* 복사 추가 페이지 (Layout 적용, RoleGuard 없음) */}
        <Route path="/add-member" element={<AddMember />} />
        
        {/* 플래너 권한 신청 페이지 */}
        <Route path="/request-planner-role" element={<RequestPlannerRole />} />

        {/* Super Admin 페이지 */}
        <Route path="/superadmin" element={<SuperAdminMain />} />
        <Route path="/superadmin/users" element={<UserManagement />} />
        <Route path="/superadmin/sms" element={<SmsManagement />} />
        <Route path="/superadmin/notifications" element={<NotificationManagement />} />


        {/* Admin 전용 라우트 */}
        <Route
          path="/server-groups/:serverGroupId/admin"
          element={
            <RoleGuard require="admin">
              <AdminMain />
            </RoleGuard>
          }
        />
        <Route
          path="/server-groups/:serverGroupId/admin/members"
          element={
            <RoleGuard require="admin">
              <MemberRoleManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/server-groups/:serverGroupId/admin/settings"
          element={
            <RoleGuard require="admin">
              <ServerGroupSettings />
            </RoleGuard>
          }
        />
        <Route
          path="/server-groups/:serverGroupId/admin/role-approval"
          element={
            <RoleGuard require="admin">
              <PlannerRoleApproval />
            </RoleGuard>
          }
        />
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



        <Route
          path="/server-groups/:serverGroupId/surveys"
          element={
            <RoleGuard require="planner">
              <SurveyManagement />
            </RoleGuard>
          }
        />

        <Route
          path="/server-groups/:serverGroupId/surveys/:surveyId/calendar"
          element={
            <RoleGuard require="planner">
              <SurveyCalendar />
            </RoleGuard>
          }
        />

        <Route
          path="/server-groups/:serverGroupId/surveys/:surveyId/by-server"
          element={
            <RoleGuard require="planner">
              <SurveyByServer />
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
              <Routes>
                <Route path="admin" element={<RoleGuard require="admin"><AdminMain /></RoleGuard>} />
                <Route path="admin/members" element={<RoleGuard require="admin"><MemberRoleManagement /></RoleGuard>} />
                <Route path="admin/settings" element={<RoleGuard require="admin"><ServerGroupSettings /></RoleGuard>} />
                <Route path="admin/role-approval" element={<RoleGuard require="admin"><PlannerRoleApproval /></RoleGuard>} />
                <Route path="dashboard" element={<RoleGuard require="planner"><Dashboard /></RoleGuard>} />
                <Route path="main" element={<RoleGuard require="server"><ServerMain /></RoleGuard>} />
                <Route path="*" element={<ServerMainWrapper />} />
              </Routes>
            </RoleGuard>
          }
        />
      </Route>

      {/* 없는 페이지 처리 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
