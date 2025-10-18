import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet } from "react-router-dom";

export default function Layout() {
  const { user } = useSession();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* 🔹공통 상단바 */}
      <header className="flex justify-between items-center px-5 py-3 bg-white/70 backdrop-blur-sm shadow-sm">
        <div className="text-gray-700 text-sm">
          {user?.displayName || "로그인 사용자"} ({user?.email})
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-3 py-1 rounded-xl text-sm hover:bg-red-600 transition"
        >
          로그아웃
        </button>
      </header>

      {/* 🔹본문 */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
