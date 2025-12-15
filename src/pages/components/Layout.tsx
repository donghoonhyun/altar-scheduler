import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet } from "react-router-dom";
import { Home } from "lucide-react";

export default function Layout() {
  const { user, userInfo } = useSession();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* 🔹공통 상단바 */}
      <header className="flex justify-between items-center px-5 py-3 bg-white/70 backdrop-blur-sm shadow-sm">
        <div className="text-gray-700 text-sm">
          {userInfo 
            ? `${userInfo.userName} ${userInfo.baptismalName}`.trim() 
            : user?.displayName || "로그인 사용자"
          }
          <span className="ml-1 text-gray-500 text-xs">({user?.email})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded-lg text-xs hover:bg-gray-300 transition"
          >
            <Home size={14} /> Home
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-red-600 transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 🔹본문 */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
