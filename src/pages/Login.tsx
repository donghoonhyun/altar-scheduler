// src/pages/Login.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "../lib/auth";
import { useSession } from "../state/session";

export default function Login() {
  const session = useSession();
  const navigate = useNavigate();

  // 이미 로그인된 경우 홈으로 리다이렉트
  useEffect(() => {
    if (!session.loading && session.user) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  const handleLogin = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Altar Scheduler
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Google 계정으로 로그인해주세요.
        </p>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition"
        >
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
          >
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 6 .9 8.2 3.1l5.7-5.7C34.9 6.2 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11.1 0 19.5-8.9 19.5-20 0-1.3-.1-2.3-.3-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.4 15.1 18.8 12 24 12c3.1 0 6 .9 8.2 3.1l5.7-5.7C34.9 6.2 29.7 4 24 4c-7.7 0-14.2 4.4-17.7 10.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.7 0 10.9-2.1 14.8-5.8l-6.8-5.5C29.8 34.9 27 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.9 39.6 16.5 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-4.1 5.2l.1.1 6.8 5.5c-.5.4 6-4.4 6-13.3 0-1.3-.1-2.3-.3-3.5z"
            />
          </svg>
          Google 로그인
        </button>
      </div>
    </div>
  );
}
