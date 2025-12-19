import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useSession } from '@/state/session';
import { getAppTitleWithEnv } from '@/lib/env';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Button, Card, Heading, Input, Checkbox, Label } from '@/components/ui';
import { User, Lock } from 'lucide-react';

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
      // Persistence 설정 (기본값: LOCAL)
      await setPersistence(auth, browserLocalPersistence);

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
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Email 로그인 성공:', result.user);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Email 로그인 실패:', error);
      alert('이메일/비밀번호 로그인 실패. 정보를 확인해주세요.');
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-[400px] p-8 shadow-xl bg-white border-none">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-600 mb-2">{getAppTitleWithEnv()}</h1>
          <Heading size="md" className="mb-2 text-gray-800">반갑습니다!</Heading>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailLogin();
          }}
          className="space-y-4"
        >
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 bg-white"
                autoComplete="email"
                disabled={processing}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-white"
                autoComplete="current-password"
                disabled={processing}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="keep-login" defaultChecked />
              <Label htmlFor="keep-login" className="text-sm text-gray-600 cursor-pointer">
                로그인 상태 유지
              </Label>
            </div>
            <button type="button" className="text-sm text-primary font-semibold hover:underline">
              비밀번호찾기
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-bold bg-[#8b5cf6] hover:bg-[#7c3aed]"
            disabled={processing}
          >
            로그인
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">또는</span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={handleGoogleLogin}
          disabled={processing}
          className="w-full h-11 border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium bg-white"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          구글 계정으로 시작하기
        </Button>

        <div className="mt-8 text-center text-sm text-gray-500">
          아직 계정이 없나요?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-[#8b5cf6] font-semibold hover:underline ml-1"
          >
            회원가입
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
