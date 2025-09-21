// src/pages/components/Layout.tsx
import { Outlet, useParams } from "react-router-dom";
import { useSession } from "../../state/session";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { PARISHES } from "../../config/parishes";

export default function Layout() {
  const session = useSession();
  const { parishCode } = useParams(); // URL에 본당 코드가 있을 때만 표시

  // 로그아웃
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  // 본당 이름 매핑
  const parishName =
    parishCode &&
    PARISHES.find((p) => p.code === parishCode)?.name_kor;

  return (
    <div>
      {/* 상단바 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          backgroundColor: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* 사용자 정보 */}
        <div>
          {session.user && (
            <>
              <strong>{session.user.displayName || "사용자"}</strong>
              {" ("}
              {session.user.email}
              {")"}
            </>
          )}
        </div>

        {/* 위치 표시 + 로그아웃 */}
        <div>
          <span style={{ marginRight: "16px", color: "#334155" }}>
            {parishName ? `📍 ${parishName}` : "🏠 홈"}
          </span>

          <button
            onClick={handleLogout}
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              padding: "6px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 페이지 컨텐츠 */}
      <main style={{ padding: "16px" }}>
        <Outlet />
      </main>
    </div>
  );
}
