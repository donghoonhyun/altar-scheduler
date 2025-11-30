// src/pages/SignUp.tsx
import { useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SignUp() {
  const navigate = useNavigate();

  // 일반 회원가입 입력 항목
  const [userName, setUserName] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

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
        toast.success('이미 가입된 계정입니다.');
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
      if (!userName || !baptismalName || !email || !password) {
        toast.error('필수 정보를 모두 입력해주세요.');
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        user_name: userName,
        baptismal_name: baptismalName,
        email,
        phone: phone || '',
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

  // ============================================================
  // UI 영역
  // ============================================================
  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">회원가입</h2>

      {/* 이름 */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="이름"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />

      {/* 세례명 */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="세례명"
        value={baptismalName}
        onChange={(e) => setBaptismalName(e.target.value)}
      />

      {/* 이메일 */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* 비밀번호 */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="비밀번호 (6자 이상)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* 전화번호 */}
      <input
        className="border p-2 w-full mb-4"
        placeholder="전화번호 (선택)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {/* 이메일/비번 가입 버튼 */}
      <button className="w-full py-2 bg-green-600 text-white rounded mb-2" onClick={handleSignUp}>
        이메일로 가입하기
      </button>

      {/* Google 버튼 */}
      <button
        className="w-full py-2 bg-red-500 text-white rounded mb-4"
        onClick={handleGoogleSignUp}
      >
        Google 계정으로 가입 / 로그인
      </button>

      {/* 뒤로가기 */}
      <button
        className="w-full py-2 bg-gray-200 text-gray-700 rounded"
        onClick={() => navigate('/login')}
      >
        돌아가기
      </button>
    </div>
  );
}
