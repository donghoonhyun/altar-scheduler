import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useSession } from '@/state/session';
import { getAppTitleWithEnv, getAppIconPath } from '@/lib/env';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Button, Card, Heading, Input, Checkbox, Label } from '@/components/ui';
import { User, Lock, Download } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const session = useSession();
  const [processing, setProcessing] = useState(false);
  const { isInstallable, promptInstall } = useInstallPrompt();
  
  // 비밀번호 재설정 관련 상태
  const [resetEmail, setResetEmail] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);

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
         
         const providerId = user.providerData[0]?.providerId || 'google.com';

         if (userDoc.exists()) {
           console.log('Google 로그인 성공 (기존 회원):', user);
           // Provider 정보 업데이트
           await setDoc(doc(db, 'users', user.uid), { provider: providerId }, { merge: true });
           
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
      
      // Provider 정보 저장
      if (result.user) {
        const providerId = result.user.providerData[0]?.providerId || 'password';
        await setDoc(doc(db, 'users', result.user.uid), { provider: providerId }, { merge: true });
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Email 로그인 실패:', error);
      alert('이메일/비밀번호 로그인 실패. 정보를 확인해주세요.');
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      alert('이메일 주소를 입력해주세요.');
      return;
    }
    try {
      setProcessing(true);
      await sendPasswordResetEmail(auth, resetEmail);
      alert('비밀번호 재설정 이메일이 발송되었습니다.\n메일함을 확인해주세요.');
      setShowResetDialog(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('비밀번호 재설정 실패:', error);
      if (error.code === 'auth/user-not-found') {
        alert('가입되지 않은 이메일 주소입니다.');
      } else if (error.code === 'auth/invalid-email') {
        alert('유효하지 않은 이메일 주소입니다.');
      } else {
        alert('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-[400px] p-8 shadow-xl bg-white dark:bg-slate-900 border-none">
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src={getAppIconPath()} 
            alt="App Logo" 
            className="w-20 h-20 mb-4 rounded-xl shadow-md border-2 border-white dark:border-slate-800"
          />
          <h1 className="text-3xl font-extrabold text-[#4f46e5] dark:text-indigo-400 mb-2 tracking-tight">{getAppTitleWithEnv()}</h1>
          <Heading size="md" className="mb-2 text-gray-800 dark:text-slate-200">반갑습니다!</Heading>
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
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <Input
                type="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500"
                autoComplete="email"
                disabled={processing}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <Input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500"
                autoComplete="current-password"
                disabled={processing}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="keep-login" defaultChecked className="dark:border-slate-600 dark:data-[state=checked]:bg-indigo-600 dark:data-[state=checked]:text-white" />
              <Label htmlFor="keep-login" className="text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
                로그인 상태 유지
              </Label>
            </div>
            <button 
              type="button" 
              onClick={() => {
                setResetEmail(email); // 입력한 이메일이 있으면 자동으로 채워줌
                setShowResetDialog(true);
              }}
              className="text-sm text-primary dark:text-indigo-400 font-semibold hover:underline"
            >
              비밀번호찾기
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-bold bg-[#8b5cf6] hover:bg-[#7c3aed] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white"
            disabled={processing}
          >
            로그인
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-2 text-gray-400 dark:text-slate-500">또는</span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={handleGoogleLogin}
          disabled={processing}
          className="w-full h-11 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 text-gray-700 dark:text-slate-200 font-medium bg-white dark:bg-slate-800 transition-colors"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          구글 계정으로 로그인
        </Button>



        <div className="mt-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 text-center border border-blue-100 dark:border-blue-800/50">
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3 font-medium">
              처음 오셨나요?
            </p>
            <Button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 font-bold shadow-sm transition-all h-11"
            >
              회원 가입
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
                if (isInstallable) {
                    promptInstall();
                } else {
                    alert('이미 앱이 설치되어 있거나, 현재 브라우저 환경에서는 자동 설치를 지원하지 않습니다.\n브라우저 메뉴(⋮)에서 [앱 설치]를 확인해주세요.');
                }
            }}
            className="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 h-12 flex items-center justify-center gap-2 transition-all rounded-xl font-medium shadow-sm hover:shadow-md"
          >
            <Download size={18} />
            <span className="text-sm">앱으로 설치하고 간편하게 접속하세요</span>
          </Button>
        </div>
      </Card>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>비밀번호 재설정</DialogTitle>
            <DialogDescription>
              가입하신 이메일 주소를 입력해 주세요.<br />
              비밀번호를 재설정할 수 있는 링크를 보내드립니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">이메일</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="example@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              취소
            </Button>
            <Button onClick={handleResetPassword} disabled={processing} className="bg-[#8b5cf6] hover:bg-[#7c3aed]">
              재설정 메일 보내기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
