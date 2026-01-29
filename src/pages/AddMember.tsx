// src/pages/AddMember.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  doc,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { toast } from 'sonner';
import UpdateUserProfileDialog from './components/UpdateUserProfileDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import dayjs from 'dayjs';

import { Parish } from '@/types/parish';
import { useParishes } from '@/hooks/useParishes';

type ServerGroupItem = {
  id: string;
  name: string;
  parish_code: string;
};

export default function AddMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useSession();
  const user = session.user;
  const { data: parishes } = useParishes(true);
  
  // 성당 선택
  const [selectedParish, setSelectedParish] = useState<string>('');

  // 복사단 목록
  const [serverGroups, setServerGroups] = useState<ServerGroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // 복사 정보
  const [nameKor, setNameKor] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [grade, setGrade] = useState<string>('');

  const [startYear, setStartYear] = useState<string>('');

  // 중복 확인 관련 상태
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [duplicateMembers, setDuplicateMembers] = useState<any[]>([]);

  // ✅ [수정] URL 파라미터(sg) 또는 현재 세션 그룹(session.currentServerGroupId)로 초기값 세팅 - 1단계: 성당 선택
  useEffect(() => {
    // 1. URL 파라미터 우선
    let targetSgId = searchParams.get('sg');
    // 2. 없으면 헤더에 선택된(세션) 그룹 사용
    if (!targetSgId && session.currentServerGroupId) {
        targetSgId = session.currentServerGroupId;
    }

    if (targetSgId && !selectedParish) {
        // 세션에 이미 정보가 있는 경우
        if (session.serverGroups[targetSgId]) {
             const sgInfo = session.serverGroups[targetSgId];
             setSelectedParish(sgInfo.parishCode);
             // Group은 목록 로드 후 (아래 useEffect에서) 세팅
        } else {
             // 세션에 없으면 Firestore 조회
             getDoc(doc(db, 'server_groups', targetSgId)).then((snap) => {
                 if (snap.exists()) {
                     const data = snap.data();
                     setSelectedParish(data.parish_code);
                 }
             }).catch(console.error);
        }
    }
  }, [searchParams, session.serverGroups, session.currentServerGroupId]);

  // ✅ [수정] URL 파라미터 혹은 현재 세션 그룹으로 초기값 세팅 - 2단계: 목록 로드 후 그룹 선택
  useEffect(() => {
      let targetSgId = searchParams.get('sg');
      
      // Removed session fallback to enforce manual selection rule (controlled by load logic)
      /*
      if (!targetSgId && session.currentServerGroupId) {
          targetSgId = session.currentServerGroupId;
      }
      */

      if (targetSgId && serverGroups.length > 0 && !selectedGroup) {
          // 로드된 목록에 해당 그룹이 있는지 확인
          if (serverGroups.find(g => g.id === targetSgId)) {
              setSelectedGroup(targetSgId);
          }
      }
  }, [serverGroups, searchParams, session.currentServerGroupId]);

  /**
   * 선택된 성당 → 해당 복사단(server_groups) 로딩
   */
  useEffect(() => {
    const load = async () => {
      if (!selectedParish) {
        setServerGroups([]);
        return;
      }
      
      const q = query(
        collection(db, 'server_groups'), 
        where('parish_code', '==', selectedParish),
        where('active', '==', true)
      );

      const snap = await getDocs(q);
      const list: ServerGroupItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ServerGroupItem, 'id'>),
      }));

      setServerGroups(list);

      // Auto-select if only one group exists
      if (list.length === 1) {
          setSelectedGroup(list[0].id);
      } else {
          // Force reset to require manual selection if multiple (or zero)
          setSelectedGroup(''); 
      }
    };

    load();
  }, [selectedParish]);

  /**
   * 복사 등록
   */
  const handleSubmit = async (e?: React.MouseEvent, force: boolean = false) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!selectedParish || !selectedGroup) {
      toast.error('성당과 복사단을 모두 선택해주세요.');
      return;
    }

    if (!nameKor || !baptismalName || !grade || !startYear) {
      toast.error('이름, 세례명, 학년, 시작년도를 모두 입력해주세요.');
      return;
    }

    // [중복 체크] 강제 진행(force)이 아니고, 이름/세례명이 입력된 경우
    if (!force) {
        try {
            // 1. [변경] 현재 선택된 복사단 내에서만 중복 체크
            const q = query(
                collection(db, `server_groups/${selectedGroup}/members`), 
                where('parent_uid', '==', user.uid)
            );
            const snap = await getDocs(q);
            
            // 2. 이름이 같은 멤버 중 'active' 상태이거나 '승인 대기(request_confirmed=false)' 상태인 멤버만 필터링
            // (Firestore '==' 쿼리는 인덱스 필요 가능성이 있어 client-side 필터링 활용)
            const sameNameMembers = snap.docs.filter(d => {
                const data = d.data();
                // 활동 중이거나, 아직 승인 대기중인(신청 상태) 경우 중복 체크
                return data.name_kor === nameKor && (data.active === true || data.request_confirmed === false);
            });

            if (sameNameMembers.length > 0) {
                // 3. 중복된 멤버 정보 구성
                // 현재 선택된 복사단과 성당 정보를 사용 (같은 복사단 내 중복이므로)
                const currentParishName = parishes?.find(p => p.code === selectedParish)?.name_kor || '알 수 없음';
                const currentGroupName = serverGroups.find(g => g.id === selectedGroup)?.name || '알 수 없음';

                const detailedMembers = sameNameMembers.map((mDoc) => {
                    const mData = mDoc.data();
                    return {
                        id: mDoc.id,
                        name: mData.name_kor,
                        baptismalName: mData.baptismal_name,
                        createdAt: mData.created_at?.toDate(),
                        active: mData.active,
                        requestConfirmed: mData.request_confirmed,
                    };
                });

                setDuplicateMembers(detailedMembers);
                setDuplicateConfirmOpen(true);
                return; // 확인창 띄우고 중단
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
            // 에러 나면 그냥 진행? 아니면 에러 표시? 일단 진행 시도가 안전.
        }
    }

    try {
      // 1) server_groups/{sg}/members 에 복사 정보 저장
      await addDoc(collection(db, `server_groups/${selectedGroup}/members`), {
        parent_uid: user.uid,
        name_kor: nameKor,
        baptismal_name: baptismalName,
        grade,
        start_year: startYear,
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
        role: ['server'],
        active: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 3) 현재 선택된 groupId 변경 → ServerMain이 올바른 group으로 렌더링됨
      session.setCurrentServerGroupId?.(selectedGroup);

      setDuplicateConfirmOpen(false); // 닫기
      toast.success('복사 등록 요청이 완료되었습니다! (승인 대기중)');

      // 4) ServerMain 으로 이동 (세션 갱신을 위해 새로고침)
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      toast.error('복사 등록 중 오류가 발생했습니다.');
    }
  };

  // 📝 사용자 프로필 정보 누락 체크
  const [showProfileUpdate, setShowProfileUpdate] = useState<boolean>(false);

  useEffect(() => {
    // 이미 건너 뛰었으면 다시 안 띄움
    const skipped = sessionStorage.getItem('profile_skip');
    if (skipped) {
      setShowProfileUpdate(false);
      return;
    }

    // 세션 로딩이 끝났고(userInfo 체크 가능), 로그인 상태일 때
    if (!session.loading && session.user) {
      // userInfo가 아예 없거나, userName이 비어있으면 팝업
      if (!session.userInfo || !session.userInfo.userName) {
        setShowProfileUpdate(true);
      } else {
        setShowProfileUpdate(false);
      }
    }
  }, [session.loading, session.user, session.userInfo]);

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* 사용자 프로필 누락 시 다이얼로그 띄움 */}
      {showProfileUpdate && session.user && (
        <UpdateUserProfileDialog
          uid={session.user.uid}
          currentName={session.userInfo?.userName}
          currentBaptismalName={session.userInfo?.baptismalName}
          onClose={() => {
            sessionStorage.setItem('profile_skip', 'true');
            setShowProfileUpdate(false);
          }}
        />
      )}
      <h2 className="text-xl font-bold mb-4">복사 추가하기</h2>

      {/* 성당 선택 */}
      <div className="mb-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">성당 선택</label>
        <select
          className="w-full border rounded p-2 mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none"
          value={selectedParish}
          onChange={(e) => {
            setSelectedParish(e.target.value);
            // 사용자가 직접 성당을 바꿀 때만 그룹 초기화
            setSelectedGroup('');
          }}
        >
          <option value="">성당 선택</option>
          {parishes?.map((p: Parish) => (
            <option key={p.code} value={p.code}>
              {p.name_kor}
            </option>
          ))}
        </select>
      </div>

      {/* 복사단 선택 */}
      <div className="mb-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">복사단 선택</label>
        <select
          className="w-full border rounded p-2 mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-900/50 disabled:text-gray-500 dark:disabled:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none"
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
        <label className="text-sm text-gray-700 dark:text-gray-300">이름(한글)</label>
        <input
          className="w-full border rounded p-2 mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
          value={nameKor}
          onChange={(e) => setNameKor(e.target.value)}
        />
      </div>

      {/* 세례명 */}
      <div className="mb-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">세례명</label>
        <input
          className="w-full border rounded p-2 mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
          value={baptismalName}
          onChange={(e) => setBaptismalName(e.target.value)}
        />
      </div>

      {/* 학년 */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 dark:text-gray-300">학년</label>
        <select
          className="w-full border rounded p-2 mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none"
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

      {/* 복사시작년도 */}

      <div className="mb-4">
        <label className="text-sm text-gray-700 dark:text-gray-300">입단년도</label>
        <div className="flex gap-2 mt-1">
          <button 
             tabIndex={-1}
             onClick={() => {
                const current = parseInt(startYear) || new Date().getFullYear();
                setStartYear((current - 1).toString());
             }}
             className="px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
             &lt;
          </button>
          <input
            type="number"
            className="w-36 border rounded p-2 text-center bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none"
            value={startYear}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
              setStartYear(val);
            }}
            placeholder="YYYY"
          />
          <button 
             tabIndex={-1}
             onClick={() => {
                const current = parseInt(startYear) || new Date().getFullYear();
                setStartYear((current + 1).toString());
             }}
             className="px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
             &gt;
          </button>
          <button 
            tabIndex={-1}
            onClick={() => setStartYear(new Date().getFullYear().toString())}
            className="whitespace-nowrap px-3 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            올해
          </button>
        </div>
      </div>

      <button className="w-full bg-blue-600 text-white py-2 rounded text-lg" onClick={(e) => handleSubmit(e, false)}>
        등록하기
      </button>

      <div className="mt-8 text-center pt-6 border-t border-gray-100 dark:border-slate-800">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">플래너로 활동하실 예정인가요?</p>
        <button 
          onClick={() => navigate('/request-planner-role')}
          className="text-sm text-blue-600 dark:text-blue-400 font-medium underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
        >
          플래너 권한 신청하기
        </button>
      </div>

      {/* 중복 확인 다이얼로그 */}
      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[90%] max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white dark:bg-slate-900 p-6 shadow-lg rounded-xl h-auto">
            <DialogHeader>
                <DialogTitle>🚨 동일한 이름의 복사가 있습니다</DialogTitle>
                <DialogDescription>
                    이미 등록하신 정보와 동일한 이름의 복사가 발견되었습니다.<br/>
                    정보를 확인하시고 계속 진행할지 결정해주세요.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
                {duplicateMembers.map((m) => {
                    let statusLabel = '상태미상';
                    let statusColor = 'bg-gray-100 text-gray-600';

                    if (m.active) {
                        statusLabel = '기등록';
                        statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    } else if (!m.requestConfirmed) {
                        statusLabel = '신청중';
                        statusColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                    }

                    return (
                    <div key={m.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-slate-800 text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColor}`}>
                                {statusLabel}
                            </span>
                            <span className="text-gray-500 text-xs font-normal">
                                {m.createdAt ? dayjs(m.createdAt).format('YYYY-MM-DD') : '날짜없음'} 등록됨
                            </span>
                        </div>
                        <div className="font-bold text-base mt-1">
                            {m.name} ({m.baptismalName})
                        </div>
                    </div>
                    );
                })}
            </div>

            <div className="flex gap-3 justify-end mt-4">
                <button
                    className="flex-1 sm:flex-none px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800 dark:border-slate-600 transition-colors"
                    onClick={() => setDuplicateConfirmOpen(false)}
                >
                    취소
                </button>
                <button
                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors"
                    onClick={(e) => handleSubmit(e as unknown as React.MouseEvent, true)}
                >
                    그래도 신청하기
                </button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
