import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut 
} from 'firebase/auth';
import { auth, db } from '../lib/firebase'; // db 추가
import { doc, getDoc } from 'firebase/firestore'; // Firestore 함수 추가
import { useSession } from '../state/session';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const session = useSession();
  const [processing, setProcessing] = useState(false);

  // ✅ 이미 로그인된 상태라면 / 로 이동
  if (session.user) {
    return <Navigate to="/" replace />;
  }

  // 로그인 처리 중이면 로딩 표시
  if (processing) {
    return <LoadingSpinner label="로그인 처리 중..." size="lg" />;
  }

  const handleGoogleLogin = async () => {
    try {
      setProcessing(true); // 로딩 시작
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
         // ✅ 가입 여부 확인 (users 컬렉션 조회)
         const userDoc = await getDoc(doc(db, 'users', user.uid));
         
         if (userDoc.exists()) {
           console.log('Google 로그인 성공 (기존 회원):', user);
           navigate('/', { replace: true });
         } else {
           console.log('미가입 회원 -> 회원가입 페이지로 이동');
           alert('가입된 정보가 없습니다. 회원가입 페이지로 이동합니다.');
           
           // 세션이 로그인 상태로 잡혀서 홈으로 튕기는 것을 방지하기 위해 로그아웃
           // 순서 중요: 먼저 이동하고 로그아웃해야 함 (AppRoutes 구조 상)
           navigate('/signup');
           await signOut(auth);
         }
      } else {
        console.log('Google 로그인 취소');
        setProcessing(false); 
      }
    } catch (error: any) {
      console.error('Google 로그인 에러:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
          alert(`로그인 에러: ${error.message}`);
      }
      setProcessing(false);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setProcessing(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Email 로그인 성공:', result.user);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Email 로그인 실패:', error);
      alert('이메일/비밀번호 로그인 실패. 콘솔을 확인하세요.');
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-4">Altar Scheduler</h1>
        <p className="text-gray-600 mb-6">Google 계정 또는 개발용 계정으로 로그인</p>

        {/* Google 로그인 */}
        <button
          onClick={handleGoogleLogin}
          disabled={processing}
          className="flex items-center justify-center w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 mb-4 disabled:opacity-50"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5 mr-2"
          />
          {processing ? '로그인 중...' : 'Google 로그인'}
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
            autoComplete="email" 
            disabled={processing}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2 mb-4 w-full"
            autoComplete="current-password" 
            disabled={processing}
          />
          <button
            type="submit" 
            disabled={processing}
            className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Email/Password 로그인
          </button>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            disabled={processing}
            className="w-full mt-2 bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
