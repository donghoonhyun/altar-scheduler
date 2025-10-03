// src/pages/SignUp.tsx
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameKor, setNameKor] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [grade, setGrade] = useState('');
  const [serverGroupId, setServerGroupId] = useState('');

  const handleSignUp = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // members 문서 생성
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
      await setDoc(memberRef, {
        uid,
        email,
        name_kor: nameKor,
        baptismal_name: baptismalName,
        grade,
        notes: '',
        active: false, // 기본 승인 전
        created_at: new Date(),
      });

      alert('회원가입 완료! 관리자의 승인을 기다려주세요.');
    } catch (err) {
      console.error(err);
      alert('회원가입 중 오류 발생');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">복사단원 회원가입</h2>
      <input
        className="border p-2 w-full mb-2"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        placeholder="이름"
        value={nameKor}
        onChange={(e) => setNameKor(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        placeholder="세례명"
        value={baptismalName}
        onChange={(e) => setBaptismalName(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        placeholder="학년"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-4"
        placeholder="소속 복사단 코드 (예: SG00001)"
        value={serverGroupId}
        onChange={(e) => setServerGroupId(e.target.value)}
      />
      <button className="w-full py-2 bg-green-600 text-white rounded" onClick={handleSignUp}>
        회원가입
      </button>
    </div>
  );
}
