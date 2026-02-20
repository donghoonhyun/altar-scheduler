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
} from '@/components/ui/dialog';
import dayjs from 'dayjs';

import { Parish, getDioceseName } from '@/types/parish';
import { useParishes } from '@/hooks/useParishes';
import { useDioceses, Diocese } from '@/hooks/useDioceses';
import { COLLECTIONS } from '@/lib/collections';
import { 
  UserPlus, 
  GraduationCap, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  User, 
  Church, 
  MapPin,
  Settings,
  Baby
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
  const { data: diocesesData } = useDioceses();

  // 교구 선택
  const [selectedDiocese, setSelectedDiocese] = useState<string>('');
  
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
             getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, targetSgId)).then((snap) => {
                 if (snap.exists()) {
                     const data = snap.data();
                     setSelectedParish(data.parish_code);
                 }
             }).catch(console.error);
        }
    }
  }, [searchParams, session.serverGroups, session.currentServerGroupId, selectedParish]);

  // ✅ 성당이 이미 선택된 경우 (URL 파라미터 등) 교구 자동 매칭
  useEffect(() => {
    if (selectedParish && parishes && !selectedDiocese) {
        const p = parishes.find(item => item.code === selectedParish);
        if (p) setSelectedDiocese(p.diocese);
    }
  }, [selectedParish, parishes, selectedDiocese]);

  // ✅ [수정] URL 파라미터 혹은 현재 세션 그룹으로 초기값 세팅 - 2단계: 목록 로드 후 그룹 선택
  useEffect(() => {
      let targetSgId = searchParams.get('sg');
      
      if (targetSgId && serverGroups.length > 0 && !selectedGroup) {
          // 로드된 목록에 해당 그룹이 있는지 확인
          if (serverGroups.find(g => g.id === targetSgId)) {
              setSelectedGroup(targetSgId);
          }
      }
  }, [serverGroups, searchParams, selectedGroup]);

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
        collection(db, COLLECTIONS.SERVER_GROUPS), 
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
  const handleSubmit = async (e?: React.MouseEvent | React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    
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
                collection(db, `${COLLECTIONS.SERVER_GROUPS}/${selectedGroup}/members`), 
                where('parent_uid', '==', user.uid)
            );
            const snap = await getDocs(q);
            
            // 2. 이름이 같은 멤버 중 'active' 상태이거나 '승인 대기(request_confirmed=false)' 상태인 멤버만 필터링
            const sameNameMembers = snap.docs.filter(d => {
                const data = d.data();
                return data.name_kor === nameKor && (data.active === true || data.request_confirmed === false);
            });

            if (sameNameMembers.length > 0) {
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
                return;
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
        }
    }

    try {
      // 1) server_groups/{sg}/members 에 복사 정보 저장
      await addDoc(collection(db, `${COLLECTIONS.SERVER_GROUPS}/${selectedGroup}/members`), {
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

      await setDoc(doc(db, COLLECTIONS.MEMBERSHIPS, membershipId), {
        uid: user.uid,
        server_group_id: selectedGroup,
        role: ['server'],
        active: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 3) 현재 선택된 groupId 변경
      session.setCurrentServerGroupId?.(selectedGroup);

      setDuplicateConfirmOpen(false);
      toast.success('복사 등록 요청이 완료되었습니다! (승인 대기중)');

      window.location.href = '/';
    } catch (err) {
      console.error(err);
      toast.error('복사 등록 중 오류가 발생했습니다.');
    }
  };

  // 📝 사용자 프로필 정보 누락 체크
  const [showProfileUpdate, setShowProfileUpdate] = useState<boolean>(false);

  useEffect(() => {
    const skipped = sessionStorage.getItem('profile_skip');
    if (skipped) {
      setShowProfileUpdate(false);
      return;
    }

    if (!session.loading && session.user) {
      if (!session.userInfo || !session.userInfo.userName) {
        setShowProfileUpdate(true);
      } else {
        setShowProfileUpdate(false);
      }
    }
  }, [session.loading, session.user, session.userInfo]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* 🔹 페이지 헤더 (Height reduced by 20%: h-20) */}
      <div className="relative h-20 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] rounded-b-[32px] shadow-lg overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="absolute top-4 left-6 right-6">
            <div className="space-y-0">
                <p className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5">
                    복사단 활동을 위해
                </p>
                <h1 className="text-2xl font-bold text-white tracking-tight font-gamja">
                    복사 추가하기
                </h1>
            </div>
        </div>
      </div>

      <div className="px-5 mt-2 pb-12 max-w-xl mx-auto space-y-4">
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


      <Card className="rounded-2xl border-0 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900 overflow-hidden border-t-4 border-t-blue-500 bg-white/90 backdrop-blur-sm p-0">
        <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-2">
           <User className="w-5 h-5 text-cyan-600" />
           <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">기본 정보</h3>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">이름 (필수)</Label>
            <Input
              className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans"
              placeholder="이름을 입력하세요"
              value={nameKor}
              onChange={(e) => setNameKor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">세례명</Label>
            <Input
              className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans"
              placeholder="세례명을 입력하세요"
              value={baptismalName}
              onChange={(e) => setBaptismalName(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Group 2: 신앙 정보 (Spiritual Info) */}
      <Card className="rounded-2xl border-0 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900 overflow-hidden border-t-4 border-t-indigo-500 bg-white/90 backdrop-blur-sm p-0">
        <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-2">
           <Church className="w-5 h-5 text-cyan-600" />
           <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">신앙 정보</h3>
        </div>
        <div className="p-6 pt-0 space-y-4">
          {/* 교구 선택 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">교구</Label>
            <Select value={selectedDiocese} onValueChange={(val) => { setSelectedDiocese(val); setSelectedParish(''); setSelectedGroup(''); }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans">
                    <SelectValue placeholder="교구를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl font-sans">
                    {(diocesesData || []).map((diocese: Diocese) => (
                        <SelectItem key={diocese.code} value={diocese.code} className="rounded-lg font-sans">{diocese.name_kor}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {/* 성당 선택 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">소속 본당</Label>
            <Select disabled={!selectedDiocese} value={selectedParish} onValueChange={(val) => { setSelectedParish(val); setSelectedGroup(''); }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans">
                    <SelectValue placeholder={!selectedDiocese ? "교구를 먼저 선택하세요" : "성당을 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl font-sans">
                    {parishes?.filter(p => !selectedDiocese || p.diocese === selectedDiocese).map((p: Parish) => (
                        <SelectItem key={p.code} value={p.code} className="rounded-lg font-sans">{p.name_kor}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {/* 복사단 선택 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">복사단</Label>
            <Select disabled={!selectedParish} value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans">
                    <SelectValue placeholder={!selectedParish ? "성당을 먼저 선택하세요" : "복사단을 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl font-sans">
                    {serverGroups.map((sg) => (
                        <SelectItem key={sg.id} value={sg.id} className="rounded-lg font-sans">{sg.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {/* 학년 & 입단년도 (Grid) */}
          <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">학년</Label>
                <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 font-sans">
                        <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl font-sans">
                        {[
                            { val: 'E1', lab: '초등 1학년' }, { val: 'E2', lab: '초등 2학년' }, { val: 'E3', lab: '초등 3학년' },
                            { val: 'E4', lab: '초등 4학년' }, { val: 'E5', lab: '초등 5학년' }, { val: 'E6', lab: '초등 6학년' },
                            { val: 'M1', lab: '중등 1학년' }, { val: 'M2', lab: '중등 2학년' }, { val: 'M3', lab: '중등 3학년' },
                            { val: 'H1', lab: '고등 1학년' }, { val: 'H2', lab: '고등 2학년' }, { val: 'H3', lab: '고등 3학년' },
                            { val: 'etc', lab: '기타' },
                        ].map((g) => (
                            <SelectItem key={g.val} value={g.val} className="rounded-lg font-sans">{g.lab}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">입단년도</Label>
                <div className="flex gap-1 items-center">
                  <Button variant="outline" size="icon" className="h-10 w-9 rounded-xl bg-slate-50/50 border-slate-100" onClick={() => { const current = parseInt(startYear) || new Date().getFullYear(); setStartYear((current - 1).toString()); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input type="number" className="h-10 rounded-xl bg-slate-50/50 border-slate-100 text-center font-bold px-1 font-sans" value={startYear} onChange={(e) => setStartYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="YYYY" />
                  <Button variant="outline" size="icon" className="h-10 w-9 rounded-xl bg-slate-50/50 border-slate-100" onClick={() => { const current = parseInt(startYear) || new Date().getFullYear(); setStartYear((current + 1).toString()); }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
          </div>
        </div>
      </Card>

      <Button 
        type="button"
        className="w-full font-bold h-12 text-base shadow-sm" 
        onClick={(e) => handleSubmit(e, false)}
      >
        복사 등록 신청하기
      </Button>

      <div className="text-center py-8">
        <p className="text-xs text-slate-400 mb-3">플래너(관리자)로 활동하실 예정인가요?</p>
        <button 
          onClick={() => navigate('/request-planner-role')}
          className="text-xs text-blue-500 font-bold hover:text-blue-700 underline underline-offset-4 decoration-blue-200"
        >
          플래너 권한 신청 페이지로 이동
        </button>
      </div>

      {/* 중복 확인 다이얼로그 */}
      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[90%] max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-white dark:bg-slate-900 p-0 shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 border-b border-amber-100 dark:border-amber-900/30">
                <DialogTitle className="text-xl font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    🚨 동일한 이름의 복사가 존재합니다
                </DialogTitle>
                <DialogDescription className="text-amber-700/80 dark:text-amber-300/60 mt-2">
                    이미 등록된 정보 중에 동일한 이름의 복사가 발견되었습니다. 정보를 다시 한 번 확인해주세요.
                </DialogDescription>
            </div>

            <div className="p-6">
                <div className="space-y-3">
                    {duplicateMembers.map((m) => {
                        let statusLabel = '상태미상';
                        let statusColor = 'bg-gray-100 text-gray-600';

                        if (m.active) {
                            statusLabel = '활동 중';
                            statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
                        } else if (!m.requestConfirmed) {
                            statusLabel = '승인 대기 중';
                            statusColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
                        }

                        return (
                        <div key={m.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider", statusColor)}>
                                    {statusLabel}
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                    {m.createdAt ? dayjs(m.createdAt).format('YYYY.MM.DD') : '날짜 정보 없음'} 등록
                                </span>
                            </div>
                            <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                {m.name} <span className="font-normal text-slate-500">({m.baptismalName})</span>
                            </div>
                        </div>
                        );
                    })}
                </div>

                <div className="flex gap-3 mt-8">
                    <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setDuplicateConfirmOpen(false)}
                    >
                        취소
                    </Button>
                    <Button
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        onClick={(e) => handleSubmit(e, true)}
                    >
                        그래도 신청하기
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
