// src/pages/SignUp.tsx
import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { PARISHES, Parish } from '../config/parishes';
import { useNavigate } from 'react-router-dom';
import type { MemberDoc } from '../types/firestore';
import { toast } from 'sonner'; // ✅ sonner 기반 토스트 알림

interface ServerGroup {
  id: string;
  name: string;
  parish_code: string;
}

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameKor, setNameKor] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [grade, setGrade] = useState<MemberDoc['grade'] | ''>('');
  const [parishCode, setParishCode] = useState('');
  const [serverGroupId, setServerGroupId] = useState('');
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const navigate = useNavigate();

  // ✅ 성당 선택 → 복사단(server_groups) 목록 로드
  useEffect(() => {
    const loadGroups = async () => {
      if (!parishCode) return;
      try {
        const q = query(collection(db, 'server_groups'), where('parish_code', '==', parishCode));
        const snap = await getDocs(q);
        const list: ServerGroup[] = snap.docs.map((d) => ({
          ...(d.data() as ServerGroup),
          id: d.id,
        }));
        setServerGroups(list);

        // 복사단이 1개뿐이면 자동 선택
        if (list.length === 1) {
          setServerGroupId(list[0].id);
        }
      } catch (err) {
        console.error('복사단 목록 로드 오류:', err);
        toast.error('복사단 목록을 불러올 수 없습니다. 관리자에게 문의하세요.');
      }
    };
    loadGroups();
  }, [parishCode]);

  // ✅ 회원가입 처리
  const handleSignUp = async () => {
    try {
      // --- 필수 입력 검증 ---
      if (!email || !password || !nameKor || !baptismalName) {
        toast.error('모든 필수 항목을 입력해주세요.');
        return;
      }
      if (!parishCode || !serverGroupId) {
        toast.error('성당과 복사단을 모두 선택해주세요.');
        return;
      }
      if (!grade) {
        toast.error('학년을 선택해주세요.');
        return;
      }

      // --- Firebase Auth ---
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // --- Firestore users/{uid} ---
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        user_name: `${nameKor} ${baptismalName}`,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // --- Firestore server_groups/{sg}/members/{uid} ---
      await setDoc(doc(db, 'server_groups', serverGroupId, 'members', uid), {
        id: uid,
        uid,
        email,
        name_kor: nameKor,
        baptismal_name: baptismalName,
        grade,
        notes: '',
        active: false, // 관리자가 승인 후 true로 변경
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      toast.success('회원가입이 완료되었습니다! 관리자의 승인을 기다려주세요.');
      navigate('/login');
    } catch (err: any) {
      console.error('회원가입 오류:', err);

      // ✅ Firebase 에러코드 → 사용자 친화적 메시지 변환
      const errorMessages: Record<string, string> = {
        'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 가입된 이메일입니다.',
        'auth/weak-password': '비밀번호는 최소 6자 이상이어야 합니다.',
        'auth/missing-password': '비밀번호를 입력해주세요.',
      };

      const message =
        errorMessages[err.code] ||
        '회원가입 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

      toast.error(message);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">복사단원 회원가입</h2>

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
        type="password"
        placeholder="비밀번호 (6자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* 이름(한글) */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="이름(한글)"
        value={nameKor}
        onChange={(e) => setNameKor(e.target.value)}
      />

      {/* 세례명 */}
      <input
        className="border p-2 w-full mb-2"
        placeholder="세례명"
        value={baptismalName}
        onChange={(e) => setBaptismalName(e.target.value)}
      />

      {/* ✅ 학년 선택 (MemberDoc 타입 기반) */}
      <select
        className="border p-2 w-full mb-2"
        value={grade}
        onChange={(e) => setGrade(e.target.value as MemberDoc['grade'])}
      >
        <option value="">학년 선택</option>
        <optgroup label="초등부">
          <option value="E1">초등 1학년</option>
          <option value="E2">초등 2학년</option>
          <option value="E3">초등 3학년</option>
          <option value="E4">초등 4학년</option>
          <option value="E5">초등 5학년</option>
          <option value="E6">초등 6학년</option>
        </optgroup>
        <optgroup label="중등부">
          <option value="M1">중등 1학년</option>
          <option value="M2">중등 2학년</option>
          <option value="M3">중등 3학년</option>
        </optgroup>
        <optgroup label="고등부">
          <option value="H1">고등 1학년</option>
          <option value="H2">고등 2학년</option>
          <option value="H3">고등 3학년</option>
        </optgroup>
      </select>

      {/* ✅ 성당 선택 */}
      <select
        className="border p-2 w-full mb-2"
        value={parishCode}
        onChange={(e) => {
          setParishCode(e.target.value);
          setServerGroupId('');
          setServerGroups([]);
        }}
      >
        <option value="">성당 선택</option>
        {PARISHES.map((p: Parish) => (
          <option key={p.code} value={p.code}>
            {p.name_kor} ({p.diocese})
          </option>
        ))}
      </select>

      {/* ✅ 복사단 선택 */}
      {parishCode && (
        <select
          className="border p-2 w-full mb-4"
          value={serverGroupId}
          onChange={(e) => setServerGroupId(e.target.value)}
        >
          <option value="">복사단 선택</option>
          {serverGroups.map((sg) => (
            <option key={sg.id} value={sg.id}>
              {sg.name}
            </option>
          ))}
        </select>
      )}

      {/* 버튼 */}
      <button className="w-full py-2 bg-green-600 text-white rounded mb-2" onClick={handleSignUp}>
        회원가입
      </button>
      <button
        className="w-full py-2 bg-gray-200 text-gray-700 rounded"
        onClick={() => navigate('/login')}
      >
        돌아가기
      </button>
    </div>
  );
}
