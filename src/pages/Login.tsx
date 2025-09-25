import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { signInWithGoogle, checkRedirectResult } from "../lib/auth";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useSession } from "../state/session";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const auth = getAuth();
  const session = useSession();

  // ✅ Redirect 로그인 결과 확인 (항상 hook 최상위에서 호출)
  useEffect(() => {
    checkRedirectResult().then((user) => {
      if (user) {
        console.log("Redirect 로그인 성공:", user);
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);

  // ✅ 이미 로그인된 상태라면 / 로 이동
  if (session.user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  const handleEmailLogin = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("Email 로그인 성공:", result.user);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Email 로그인 실패:", error);
      alert("이메일/비밀번호 로그인 실패. 콘솔을 확인하세요.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-4">Altar Scheduler</h1>
        <p className="text-gray-600 mb-6">
          Google 계정 또는 개발용 계정으로 로그인
        </p>

        {/* Google 로그인 */}
        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 mb-4"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5 mr-2"
          />
          Google 로그인
        </button>

        {/* 개발용 Email/Password 로그인 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailLogin();
          }}
        >
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2 mb-2 w-full"
            autoComplete="email"              // ✅ 자동완성 힌트
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2 mb-4 w-full"
            autoComplete="current-password"   // ✅ 자동완성 힌트
          />
          <button
            type="submit" // ✅ 엔터로 제출 가능
            className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
          >
            Email/Password 로그인
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
