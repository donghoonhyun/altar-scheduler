import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { toast } from 'sonner';

import type { Parish } from '@/config/parishes';
import { PARISHES } from '@/config/parishes';

type ServerGroupItem = {
  id: string;
  name: string;
  parish_code: string;
};

export default function AddMember() {
  const navigate = useNavigate();
  const session = useSession();
  const user = session.user;

  // 성당 선택
  const [selectedParish, setSelectedParish] = useState<string>('');

  // 복사단 목록
  const [serverGroups, setServerGroups] = useState<ServerGroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // 복사 정보
  const [nameKor, setNameKor] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [grade, setGrade] = useState<string>('');

  /**
   * 선택된 성당 → 해당 복사단(server_groups) 로딩
   */
  useEffect(() => {
    const load = async () => {
      if (!selectedParish) {
        setServerGroups([]);
        return;
      }

      const q = query(collection(db, 'server_groups'), where('parish_code', '==', selectedParish));

      const snap = await getDocs(q);
      const list: ServerGroupItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ServerGroupItem, 'id'>),
      }));

      setServerGroups(list);
    };

    load();
  }, [selectedParish]);

  /**
   * 복사 등록
   */
  const handleSubmit = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!selectedParish || !selectedGroup) {
      toast.error('성당과 복사단을 모두 선택해주세요.');
      return;
    }

    if (!nameKor || !baptismalName || !grade) {
      toast.error('이름, 세례명, 학년을 모두 입력해주세요.');
      return;
    }

    try {
      // 1) server_groups/{sg}/members 에 복사 정보 저장
      await addDoc(collection(db, `server_groups/${selectedGroup}/members`), {
        parent_uid: user.uid,
        name_kor: nameKor,
        baptismal_name: baptismalName,
        grade,
        active: false,
        request_confirmed: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 2) memberships/{uid}_{sg} 문서 생성
      const membershipId = `${user.uid}_${selectedGroup}`;

      await setDoc(doc(db, 'memberships', membershipId), {
        uid: user.uid,
        server_group_id: selectedGroup,
        role: 'server',
        active: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 3) 현재 선택된 groupId 변경 → ServerMain이 올바른 group으로 렌더링됨
      session.setCurrentServerGroupId?.(selectedGroup);

      toast.success('복사 등록 요청이 완료되었습니다! (승인 대기중)');

      // 4) ServerMain 으로 이동 (세션 갱신을 위해 새로고침)
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      toast.error('복사 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">복사 추가하기</h2>

      {/* 성당 선택 */}
      <div className="mb-3">
        <label className="text-sm">성당 선택</label>
        <select
          className="w-full border rounded p-2 mt-1"
          value={selectedParish}
          onChange={(e) => {
            setSelectedParish(e.target.value);
            setSelectedGroup('');
          }}
        >
          <option value="">성당 선택</option>
          {PARISHES.map((p: Parish) => (
            <option key={p.code} value={p.code}>
              {p.name_kor}
            </option>
          ))}
        </select>
      </div>

      {/* 복사단 선택 */}
      <div className="mb-3">
        <label className="text-sm">복사단 선택</label>
        <select
          className="w-full border rounded p-2 mt-1"
          disabled={!selectedParish}
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          <option value="">복사단 선택</option>

          {serverGroups.map((sg) => (
            <option key={sg.id} value={sg.id}>
              {sg.name}
            </option>
          ))}
        </select>
      </div>

      {/* 이름 */}
      <div className="mb-3">
        <label className="text-sm">이름(한글)</label>
        <input
          className="w-full border rounded p-2 mt-1"
          value={nameKor}
          onChange={(e) => setNameKor(e.target.value)}
        />
      </div>

      {/* 세례명 */}
      <div className="mb-3">
        <label className="text-sm">세례명</label>
        <input
          className="w-full border rounded p-2 mt-1"
          value={baptismalName}
          onChange={(e) => setBaptismalName(e.target.value)}
        />
      </div>

      {/* 학년 */}
      <div className="mb-4">
        <label className="text-sm">학년</label>
        <select
          className="w-full border rounded p-2 mt-1"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          <option value="">학년 선택</option>
          {['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3'].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <button className="w-full bg-blue-600 text-white py-2 rounded text-lg" onClick={handleSubmit}>
        등록하기
      </button>

      <div className="mt-8 text-center pt-6 border-t border-gray-100">
        <p className="text-sm text-gray-500 mb-2">플래너로 활동하실 예정인가요?</p>
        <button 
          onClick={() => navigate('/request-planner-role')}
          className="text-sm text-blue-600 font-medium underline underline-offset-2 hover:text-blue-700"
        >
          플래너 권한 신청하기
        </button>
      </div>
    </div>
  );
}
