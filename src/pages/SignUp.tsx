// src/pages/SignUp.tsx
import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, Heading, Input, Checkbox, Label } from '@/components/ui';

export default function SignUp() {
  const navigate = useNavigate();

  // 일반 회원가입 입력 항목
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [userName, setUserName] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [phone, setPhone] = useState('');
  
  // 약관 동의 상태
  const [agreements, setAgreements] = useState({
    age: false,
    terms: false,
    privacy: false,
  });

  const allAgreed = agreements.age && agreements.terms && agreements.privacy;

  const handleAllAgree = (checked: boolean) => {
    setAgreements({
      age: checked,
      terms: checked,
      privacy: checked,
    });
  };

  const handleAgreeChange = (key: keyof typeof agreements) => (checked: boolean) => {
    setAgreements((prev) => ({ ...prev, [key]: checked }));
  };

  // ============================================================
  // 1) Google 계정으로 가입/로그인
  // ============================================================
  const handleGoogleSignUp = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) {
        toast.error('구글 계정에 이메일 정보가 없습니다.');
        return;
      }

      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);

      // 이미 가입된 사용자
      if (snap.exists()) {
        toast.success('이미 가입된 계정입니다. 로그인되었습니다.');
        navigate('/');
        return;
      }

      // 신규 유저 → Firestore 기본 프로필 생성
      await setDoc(docRef, {
        uid: user.uid,
        email: user.email,
        user_name: user.displayName || '',
        baptismal_name: '',
        phone: '', 
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      toast.success('Google 로그인 완료! 추가 정보를 입력해주세요.');
      navigate('/complete-profile');
    } catch (err) {
      console.error(err);
      toast.error('Google 로그인 중 오류가 발생했습니다.');
    }
  };

  // ============================================================
  // 2) 이메일 + 비밀번호 가입
  // ============================================================
  const handleSignUp = async () => {
    try {
      if (!email || !password || !passwordConfirm || !userName || !phone) {
        toast.error('필수 정보를 모두 입력해주세요.');
        return;
      }

      if (password !== passwordConfirm) {
        toast.error('비밀번호가 일치하지 않습니다.');
        return;
      }

      if (!allAgreed) {
        toast.error('모든 필수 항목에 동의해야 합니다.');
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        user_name: userName,
        baptismal_name: baptismalName, // 선택사항
        email,
        phone,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      toast.success('회원가입이 완료되었습니다. 로그인해주세요.');
      navigate('/login');
    } catch (err: unknown) {
      console.error('회원가입 오류:', err);

      const error = err as { code?: string };

      const errorMessages: Record<string, string> = {
        'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 가입된 이메일입니다.',
        'auth/weak-password': '비밀번호는 최소 6자 이상이어야 합니다.',
      };

      toast.error(errorMessages[error.code || ''] || '회원가입 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-[500px] p-8 shadow-xl bg-white border-none">
        <div className="text-center mb-8">
          <Heading size="lg" className="mb-2 text-gray-800">환영합니다!</Heading>
        </div>

        <div className="space-y-6">
          {/* 이메일 */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">이메일</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-white"
            />
          </div>

          {/* 비밀번호 */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">비밀번호</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">* 10자 이상이면서 영문, 숫자, 특수문자를 모두 포함하세요 (권장)</p>
          </div>

          {/* 비밀번호 재확인 */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold text-gray-700">비밀번호 재확인</Label>
            <Input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="h-11 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">* 비밀번호를 다시 입력해주세요</p>
          </div>

          {/* 이름 / 세례명 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-gray-700">이름</Label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="h-11 bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-gray-700">세례명(선택)</Label>
              <Input
                value={baptismalName}
                onChange={(e) => setBaptismalName(e.target.value)}
                className="h-11 bg-white"
              />
            </div>
          </div>
          
          <div className="space-y-1">
             <Label className="text-sm font-semibold text-gray-700">연락처</Label>
             <Input
               value={phone}
               onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))}
               placeholder="010-0000-0000"
               className="h-11 bg-white"
             />
          </div>

          {/* 약관 동의 */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-100 mb-2">
              <Checkbox 
                id="all-agree" 
                checked={allAgreed} 
                onCheckedChange={(c) => handleAllAgree(c === true)} 
              />
              <Label htmlFor="all-agree" className="text-sm font-bold text-gray-800 cursor-pointer">
                모두 동의합니다
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agree-age" 
                checked={agreements.age} 
                onCheckedChange={(c) => handleAgreeChange('age')(c === true)} 
              />
              <Label htmlFor="agree-age" className="text-sm text-gray-600 cursor-pointer">
                [필수] 만 14세 이상입니다
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agree-terms" 
                checked={agreements.terms} 
                onCheckedChange={(c) => handleAgreeChange('terms')(c === true)} 
              />
              <Label htmlFor="agree-terms" className="text-sm text-gray-600 cursor-pointer">
                [필수] 최종이용자 이용약관에 동의합니다
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="agree-privacy" 
                checked={agreements.privacy} 
                onCheckedChange={(c) => handleAgreeChange('privacy')(c === true)} 
              />
              <Label htmlFor="agree-privacy" className="text-sm text-gray-600 cursor-pointer">
                [필수] 개인정보 수집 및 이용에 동의합니다
              </Label>
            </div>
          </div>

          <Button
            onClick={handleSignUp}
            className="w-full h-12 text-base font-bold bg-[#3b82f6] hover:bg-blue-600 mt-4"
          >
            가입하기
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleSignUp}
            className="w-full h-11 border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium bg-white"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-5 h-5"
            />
            구글 계정으로 가입하기
          </Button>
        </div>
      </Card>
    </div>
  );
}
