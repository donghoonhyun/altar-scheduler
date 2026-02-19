import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useSession } from '@/state/session';
import { getAppTitleWithEnv, getAppIconPath } from '@/lib/env';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Button, Card, Heading } from '@/components/ui';
import { Download, LogIn } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const ORDO_LOGIN_URL = 'https://ordo.web.app/login';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const session = useSession();
  const { isInstallable, promptInstall } = useInstallPrompt();
  const [processing, setProcessing] = useState(false);

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // ✅ 이미 로그인된 상태라면 / 로 이동
  if (session.user) {
    return <Navigate to="/" replace />;
  }

  // 로그인 처리 중이면 로딩 표시
  if (processing) {
    return <LoadingSpinner label="로그인 처리 중..." size="lg" />;
  }

  const handleOrdoLogin = () => {
    window.location.href = ORDO_LOGIN_URL;
  };

  const handleGoogleLogin = async () => {
    try {
      setProcessing(true); 
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
         const userDoc = await getDoc(doc(db, 'users', user.uid));
         if (userDoc.exists()) {
           navigate('/', { replace: true });
         } else {
           alert('가입된 정보가 없습니다. Ordo 메인 앱에서 먼저 가입해주세요.');
           await signOut(auth);
           setProcessing(false);
         }
      }
    } catch (error: any) {
      console.error('Google 로그인 에러:', error);
      setProcessing(false);
    }
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-[400px] p-8 shadow-xl bg-white dark:bg-slate-900 border-none transition-all duration-300">
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src={getAppIconPath()} 
            alt="App Logo" 
            className="w-20 h-20 mb-4 rounded-xl shadow-md border-2 border-white dark:border-slate-800"
          />
          <h1 className="text-3xl font-extrabold text-[#4f46e5] dark:text-indigo-400 mb-2 tracking-tight">{getAppTitleWithEnv()}</h1>
          <Heading size="md" className="mb-2 text-gray-800 dark:text-slate-200">반갑습니다!</Heading>
          <p className="text-sm text-gray-500 dark:text-slate-400">서비스 이용을 위해 로그인이 필요합니다.</p>
        </div>

        {/* ✅ Main Action: Ordo Login */}
        <div className="space-y-4">
            <Button
                onClick={handleOrdoLogin}
                className="w-full h-12 text-base font-bold bg-[#8b5cf6] hover:bg-[#7c3aed] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-transform active:scale-[0.98]"
            >
                <LogIn className="w-5 h-5 mr-2" />
                Ordo 계정으로 로그인
            </Button>
            
            <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                Ordo 통합 계정을 사용하여 모든 서비스를 이용할 수 있습니다.
            </p>

            {isLocal && (
                <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-800 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest text-center">
                        Local Development Only
                    </p>
                    <Button
                        variant="outline"
                        onClick={handleGoogleLogin}
                        className="w-full h-10 text-sm font-medium border-gray-200 dark:border-slate-800"
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            alt="Google"
                            className="w-4 h-4 mr-2"
                        />
                        구글 로그인 (개발용)
                    </Button>
                </div>
            )}
        </div>



        {/* Install Button */}
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-800">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
                if (isInstallable) promptInstall();
                else alert('브라우저 메뉴에서 [앱 설치]를 확인해주세요.');
            }}
            className="w-full text-blue-600 dark:text-blue-400 h-10 text-sm"
          >
            <Download size={16} className="mr-2" />
            앱 설치하기
          </Button>
        </div>
      </Card>


    </div>
  );
};

export default Login;
