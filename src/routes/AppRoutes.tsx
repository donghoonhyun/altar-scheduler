// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "../state/session";

// 페이지들
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import ServerMain from "../pages/ServerMain";
import SelectServerGroup from "../pages/SelectServerGroup";
import SelectParish from "../pages/SelectParish";
import Forbidden from "../pages/components/Forbidden"; // 필요 시 추가

export default function AppRoutes() {
  const session = useSession();

  if (session.loading) {
    return <div>Loading...</div>; // TODO: 로딩 스피너 UI로 교체
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

  // 로그인 된 경우 역할별 라우팅
  return (
    <Routes>
      {/* Admin */}
      {session.isAdmin && (
        <>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </>
      )}

      {/* Manager → 본당 선택 */}
      {session.managerParishes.length > 0 && (
        <>
          <Route path="/select-parish" element={<SelectParish />} />
          <Route path="/" element={<Navigate to="/select-parish" replace />} />
        </>
      )}

      {/* Planner/Server */}
      {Object.keys(session.groupRoles).length > 0 && (
        <>
          <Route path="/select-server-group" element={<SelectServerGroup />} />
          <Route
            path="/:serverGroupId/*"
            element={<ServerMain />} // 복사 메인 or Dashboard 재활용 가능
          />
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

      {/* 권한 없음 */}
      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="*" element={<Navigate to="/forbidden" replace />} />
    </Routes>
  );
}
