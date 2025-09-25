import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet } from "react-router-dom";

export default function Layout() {
  const session = useSession();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 상단바 */}
      <header className="flex justify-between items-center p-4 bg-gray-100 shadow">
        <div>
          {session.user?.displayName} ({session.user?.email})
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
        >
          로그아웃
        </button>
      </header>

      {/* 본문 */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
