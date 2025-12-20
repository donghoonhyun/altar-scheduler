import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { openConfirm } from '@/components/common/ConfirmDialog';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  name_kor: string;
  baptismal_name: string;
  grade: string;
  email?: string;
  active: boolean;
  request_confirmed?: boolean; // 승인 여부 (true: 승인됨, false/undefined: 미승인)
  parent_uid?: string;
  created_at?: any; // Firestore Timestamp
}

interface UserInfo {
  user_name: string;
  baptismal_name?: string;
  email: string;
  phone?: string;
}

interface AssignmentStats {
  lastMonth: number;
  thisMonth: number;
  nextMonth: number;
}

const ALL_GRADES = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'M1', 'M2', 'M3',
  'H1', 'H2', 'H3'
];

export default function ServerList() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [inactiveMembers, setInactiveMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentInfos, setParentInfos] = useState<Record<string, UserInfo>>({});
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats>({ lastMonth: 0, thisMonth: 0, nextMonth: 0 });
  // ✅ 배정 현황 기준 월 (중간달)
  const [statsBaseDate, setStatsBaseDate] = useState(dayjs());
  
  // ✅ 상태 수정용 state
  const [editActive, setEditActive] = useState(false);
  const [editGrade, setEditGrade] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ✅ 정렬 상태: 'name' | 'grade'
  const [sortBy, setSortBy] = useState<'name' | 'grade'>('name');

  // ✅ 선택된 멤버 변경 시 상태 동기화
  useEffect(() => {
    if (selectedMember) {
      setEditActive(selectedMember.active);
      setEditGrade(selectedMember.grade || 'M1');
      // Drawer 열릴 때 현재 월로 초기화
      setStatsBaseDate(dayjs());
    }
  }, [selectedMember]);

  // ✅ statsBaseDate 변경 시 통계 다시 조회
  useEffect(() => {
    if (selectedMember) {
        fetchAssignmentStats(selectedMember.id);
    }
  }, [statsBaseDate, selectedMember?.id]); // selectedMember가 바뀌거나 날짜가 바뀌면 재조회

  // ✅ Firestore 실시간 구독
  useEffect(() => {
    if (!serverGroupId) return;

    const colRef = collection(db, 'server_groups', serverGroupId, 'members');

    const unsubscribe = onSnapshot(colRef, (snap) => {
      const all: Member[] = snap.docs.map((d) => ({
        ...(d.data() as Member),
        id: d.id,
      }));

      // 1. Pending: Active=false AND request_confirmed!=true
      setPendingMembers(all.filter((m) => !m.active && !m.request_confirmed));
      
      // 2. Active: Active=true (implies confirmed or legacy)
      const active = all.filter((m) => m.active);
      const nameSorter = (a: Member, b: Member) => {
        const keyA = (a.name_kor || '') + (a.baptismal_name || '');
        const keyB = (b.name_kor || '') + (b.baptismal_name || '');
        return keyA.localeCompare(keyB);
      };

      active.sort(nameSorter);
      setActiveMembers(active);

      // 3. Inactive: Active=false AND request_confirmed=true
      const inactive = all.filter((m) => !m.active && m.request_confirmed);
      inactive.sort(nameSorter);
      setInactiveMembers(inactive);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverGroupId]);

  // ✅ 신청자(부모) 정보 조회 (대기중 + 활동중 + 비활동 모두)
  useEffect(() => {
    // 모든 멤버 합치기
    const allMembers = [...pendingMembers, ...activeMembers, ...inactiveMembers];
    
    const fetchParents = async () => {
      const uidsToFetch = allMembers
        .map((m) => m.parent_uid)
        .filter((uid): uid is string => !!uid && !parentInfos[uid]);

      const uniqueUids = Array.from(new Set(uidsToFetch));

      if (uniqueUids.length === 0) return;

      const newInfos: Record<string, UserInfo> = {};
      await Promise.all(
        uniqueUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const data = snap.data();
              newInfos[uid] = {
                user_name: data.user_name,
                baptismal_name: data.baptismal_name,
                email: data.email,
                phone: data.phone,
              };
            }
          } catch (e) {
            console.error('부모 정보 조회 실패', uid, e);
          }
        })
      );

      setParentInfos((prev) => ({ ...prev, ...newInfos }));
    };

    fetchParents();
  }, [pendingMembers, activeMembers, inactiveMembers]); 

  const fetchAssignmentStats = async (memberId: string) => {
    if (!serverGroupId) return;
    
    // statsBaseDate 기준으로 지난달, 이번달, 다음달 계산
    const base = statsBaseDate;
    const lastMonth = base.subtract(1, 'month').format('YYYY-MM');
    const thisMonth = base.format('YYYY-MM');
    const nextMonth = base.add(1, 'month').format('YYYY-MM');
    
    // 쿼리 범위: 지난달 1일 ~ 다음달 말일
    const start = base.subtract(1, 'month').startOf('month').toDate();
    const end = base.add(1, 'month').endOf('month').toDate();
    
    const q = query(
      collection(db, 'server_groups', serverGroupId, 'mass_events'),
      where('event_date', '>=', start.toISOString()), 
      where('event_date', '<=', end.toISOString())
    );

    try {
        const snap = await getDocs(q);
        let lm = 0, tm = 0, nm = 0;
        
        snap.docs.forEach(doc => {
            const data = doc.data();
            const date = dayjs(data.event_date);
            const members = data.member_ids || [];
            
            if (members.includes(memberId)) {
                if (date.format('YYYY-MM') === lastMonth) lm++;
                else if (date.format('YYYY-MM') === thisMonth) tm++;
                else if (date.format('YYYY-MM') === nextMonth) nm++;
            }
        });
        setAssignmentStats({ lastMonth: lm, thisMonth: tm, nextMonth: nm });
    } catch(e) {
        console.error("Failed to fetch assignments", e);
    }
  };


  // ✅ 승인 처리
  const handleApprove = async (uid: string) => {
    if (!serverGroupId) return;

    const ok = await openConfirm({
      title: '회원 승인',
      message: '해당 회원을 승인하시겠습니까?',
      confirmText: '승인',
      cancelText: '취소',
    });

    if (!ok) return;

    try {
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
      await updateDoc(memberRef, { 
        active: true, 
        request_confirmed: true, // 승인 확정
        updated_at: new Date() 
      });
      toast.success('✅ 회원이 승인되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  // ✅ 삭제(거절) 처리
  const handleDelete = async (uid: string) => {
    if (!serverGroupId) return;

    const ok = await openConfirm({
      title: '회원 삭제',
      message: '정말로 이 복사단원 신청을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
    });

    if (!ok) return;

    try {
      // (1) members 문서 삭제
      await deleteDoc(doc(db, 'server_groups', serverGroupId, 'members', uid));

      // (2) memberships 문서 삭제
      const membershipId = `${uid}_${serverGroupId}`;
      await deleteDoc(doc(db, 'memberships', membershipId));

      toast.success('🚫 회원이 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // ✅ 상태 변경 저장
  const handleSaveStatus = async () => {
    if (!selectedMember || !serverGroupId) return;
    setIsSaving(true);
    try {
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', selectedMember.id);
      await updateDoc(memberRef, { 
        active: editActive, 
        grade: editGrade,
        request_confirmed: true, // 수정 시 확정 상태 보장 (비활동 전환 시 필요)
        updated_at: new Date() 
      });
      
      // 로컬 상태 업데이트
      setSelectedMember(prev => prev ? ({ ...prev, active: editActive, grade: editGrade, request_confirmed: true }) : null);
      
      toast.success('정보가 저장되었습니다.');
      setIsDrawerOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('정보 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    if (selectedMember) {
      setEditActive(selectedMember.active);
      setEditGrade(selectedMember.grade || 'M1');
    }
  };

  const hasChanges = selectedMember ? (selectedMember.active !== editActive || selectedMember.grade !== editGrade) : false;

  // ✅ 정렬된 리스트 계산 (useMemo)
  const sortedActiveMembers = useMemo(() => {
    const list = [...activeMembers];
    if (sortBy === 'name') {
       // 이미 load시 정렬됨
       return list;
    } else {
       // 학년별 정렬: Grade Index (ASC) -> Name
       return list.sort((a, b) => {
          const idxA = ALL_GRADES.indexOf(a.grade);
          const idxB = ALL_GRADES.indexOf(b.grade);
          
          if (idxA !== idxB) {
            // If grade not found (-1), put it at the end
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          }
          // Same grade -> Name Sort
          const keyA = (a.name_kor || '') + (a.baptismal_name || '');
          const keyB = (b.name_kor || '') + (b.baptismal_name || '');
          return keyA.localeCompare(keyB);
       });
    }
  }, [activeMembers, sortBy]);


  if (loading) {
    return <div className="p-6 text-gray-500">명단 불러오는 중...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 fade-in">
      {/* ✅ 상단 네비게이션 */}
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
          <ArrowLeft size={24} />
        </Button>
        <h1 className="text-2xl font-bold">복사단원 관리</h1>
      </div>

      {/* ✅ 승인 대기중 */}
      <Card className="p-4 bg-pink-50 border-pink-100">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          승인 대기중{' '}
          <span className="text-sm font-normal text-gray-500">({pendingMembers.length}명)</span>
        </h2>
        {pendingMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">승인 대기 중인 단원이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingMembers.map((m) => {
              const parent = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
              let dateStr = '';
              if (m.created_at?.toDate) {
                const d = m.created_at.toDate();
                dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
              }

              return (
                <Card
                  key={m.id}
                  className="p-3 flex items-stretch gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Left Column: Server Info & Actions */}
                  <div className="flex flex-row items-center gap-3 shrink-0">
                    {/* Server Info */}
                    <div className="text-left w-[90px]">
                      <p className="font-semibold text-gray-800 text-sm">{m.name_kor}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ({m.baptismal_name}) · {m.grade}
                      </p>
                    </div>

                    {/* Actions (Vertical) */}
                    <div className="flex flex-col gap-1">
                      <Button
                        onClick={() => handleApprove(m.id)}
                        className="bg-green-600 hover:bg-green-700 text-white text-[11px] h-7 w-[50px] px-0"
                      >
                        승인
                      </Button>
                      <Button
                        onClick={() => handleDelete(m.id)}
                        className="bg-red-500 hover:bg-red-600 text-white text-[11px] h-7 w-[50px] px-0"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Applicant(Parent) Info */}
                  <div className="flex-1 border-l border-gray-100 pl-4 flex flex-col justify-center items-end min-w-0 text-right">
                    {parent ? (
                       <div className="text-xs text-gray-600 space-y-1 w-full flex flex-col items-end">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-gray-700">신청: {parent.user_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-x-2 text-gray-500">
                             <span className="truncate">{parent.email}</span>
                             {parent.phone && (
                               <>
                                 <span className="text-gray-300">|</span>
                                 <span>{parent.phone}</span>
                               </>
                             )}
                          </div>
                       </div>
                    ) : (
                      <span className="text-xs text-gray-400">신청자 정보 없음</span>
                    )}
                    
                    {/* 신청일 표시 */}
                    {dateStr && (
                      <p className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-dashed border-gray-100 w-full">
                        신청일: {dateStr}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* ✅ 활동중인 복사단원 */}
      <Card className="p-4 bg-green-50 border-green-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">
            활동중 복사단원{' '}
            <span className="text-sm font-normal text-gray-500">({activeMembers.length}명)</span>
          </h2>
          {/* 정렬 탭 */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
             <button
               onClick={() => setSortBy('name')} 
               className={cn(
                 "px-2.5 py-1 rounded-md transition-all",
                 sortBy === 'name' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
               )}
             >
               이름
             </button>
             <button
               onClick={() => setSortBy('grade')} 
               className={cn(
                 "px-2.5 py-1 rounded-md transition-all",
                 sortBy === 'grade' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
               )}
             >
               학년
             </button>
          </div>
        </div>

        {sortedActiveMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">아직 승인된 복사단원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {sortedActiveMembers.map((m, idx) => {
              const parent = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
              let dateStr = '';
              if (m.created_at?.toDate) {
                const d = m.created_at.toDate();
                dateStr = `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
              }

              // Check separator logic
              const prev = sortedActiveMembers[idx - 1];
              const showSeparator = sortBy === 'grade' && prev && prev.grade !== m.grade;

              return (
                <React.Fragment key={m.id}>
                  {showSeparator && (
                     <div className="col-span-2 border-t border-dashed border-gray-300 my-1 relative h-4">
                       <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-gray-400 font-medium">
                          {m.grade}
                       </span>
                     </div>
                  )}

                  <Card 
                    className="p-2 flex items-center justify-between text-left hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedMember(m);
                      setIsDrawerOpen(true);
                    }}
                  >
                    {/* Left: Server Info (Prioritized) */}
                    <div className="flex-1 min-w-0 mr-1">
                      <p className="font-semibold text-gray-800 text-sm truncate">{m.name_kor}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {m.baptismal_name} · {m.grade}
                      </p>
                    </div>
                    
                    {/* Right: Parent Info (Secondary, Truncatable) */}
                    {parent && (
                      <div className="text-right shrink-0 max-w-[40%]">
                        <p className="text-[10px] text-gray-600 font-medium truncate">
                          <span className="text-gray-400 mr-1 hidden sm:inline">신청:</span>
                          <span className="text-gray-400 mr-1 sm:hidden">부:</span>
                          {parent.user_name}
                        </p>
                        {dateStr && (
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            {dateStr}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </Card>

      {/* ✅ 비활동 복사단원 (Inactive) */}
      <Card className="p-4 bg-gray-50 border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          비활동 복사단원{' '}
          <span className="text-sm font-normal text-gray-500">({inactiveMembers.length}명)</span>
        </h2>
        
        {inactiveMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">비활동 단원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {inactiveMembers.map((m) => {
              const parent = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
              let dateStr = '';
              if (m.created_at?.toDate) {
                const d = m.created_at.toDate();
                dateStr = `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
              }

              return (
                <Card 
                  key={m.id} 
                  className="p-2 flex items-center justify-between text-left hover:shadow-md transition-shadow cursor-pointer bg-white" 
                  onClick={() => {
                    setSelectedMember(m);
                    setIsDrawerOpen(true);
                  }}
                >
                  {/* Left: Server Info */}
                  <div className="flex-1 min-w-0 mr-1">
                    <p className="font-semibold text-gray-500 text-sm truncate">{m.name_kor}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {m.baptismal_name} · {m.grade}
                    </p>
                  </div>
                  
                  {/* Right: Parent Info */}
                  {parent && (
                    <div className="text-right shrink-0 max-w-[40%]">
                      <p className="text-[10px] text-gray-400 font-medium truncate">
                        <span className="text-gray-300 mr-1 hidden sm:inline">신청:</span>
                        <span className="text-gray-300 mr-1 sm:hidden">부:</span>
                        {parent.user_name}
                      </p>
                      {dateStr && (
                        <p className="text-[9px] text-gray-300 mt-0.5">
                          {dateStr}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* ✅ Member Detail Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={(open) => {
        if (!open) handleCloseDrawer();
        else setIsDrawerOpen(true);
      }}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-xl font-bold flex items-center gap-2">
                 {selectedMember?.name_kor} 
                 <span className="text-base font-normal text-gray-500">({selectedMember?.baptismal_name})</span>

              </DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-6 pt-0">
               {/* 1. 복사 배정 정보 */}
               <div className="space-y-3">
                 <h4 className="font-bold text-gray-900 border-l-4 border-blue-500 pl-2 text-sm mb-3">
                   복사 배정 현황
                 </h4>
                 <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                      {/* Left Arrow */}
                      <button onClick={() => setStatsBaseDate(prev => prev.subtract(1, 'month'))} className="p-1 hover:bg-gray-200 rounded-full text-gray-400">
                          <ChevronLeft size={16} />
                      </button>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center flex-1">
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-gray-500 mb-1">{statsBaseDate.subtract(1, 'month').format('YY년 M월')}</span>
                             <span className="font-bold text-lg">{assignmentStats.lastMonth}회</span>
                          </div>
                          <div className="flex flex-col border-x border-gray-200">
                             <span className="text-xs font-bold text-blue-600 mb-1">{statsBaseDate.format('YY년 M월')}</span>
                             <span className="font-bold text-lg text-blue-600">{assignmentStats.thisMonth}회</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-gray-500 mb-1">{statsBaseDate.add(1, 'month').format('YY년 M월')}</span>
                             <span className="font-bold text-lg">{assignmentStats.nextMonth}회</span>
                          </div>
                      </div>

                      {/* Right Arrow */}
                      <button onClick={() => setStatsBaseDate(prev => prev.add(1, 'month'))} className="p-1 hover:bg-gray-200 rounded-full text-gray-400">
                          <ChevronRight size={16} />
                      </button>
                  </div>
               </div>


              {/* 2. 복사단원 상세 정보 */}
              <div className="space-y-3 text-sm">
                <h4 className="font-bold text-gray-900 border-l-4 border-blue-500 pl-2 text-sm mb-3">
                   복사단원 상세 정보
                </h4>
                {/* 학년 정보 삭제됨 (Title 옆으로 이동) */}
                {/* 학년 정보 (Dropdown) */}
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="font-medium text-gray-500">학년</span>
                   <Select value={editGrade} onValueChange={setEditGrade} disabled={isSaving}>
                      <SelectTrigger className="w-[80px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {ALL_GRADES.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                </div>
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="font-medium text-gray-500">상태</span>
                  <div className="flex items-center gap-2">
                     <Switch 
                        checked={editActive} 
                        onCheckedChange={setEditActive} 
                     />
                     <span className={editActive ? "text-green-600 font-bold" : "text-gray-600"}>
                       {editActive ? '활동중' : '비활동'}
                     </span>
                  </div>
                </div>
              </div>

              {/* 3. 신청자 정보 (Compact) */}
              {(() => {
                 const pUid = selectedMember?.parent_uid;
                 const pInfo = pUid ? parentInfos[pUid] : null;

                 // Format created_at
                 let createdAtStr = '-';
                 if (selectedMember?.created_at?.toDate) {
                    const d = selectedMember.created_at.toDate();
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hour = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    createdAtStr = `${year}.${month}.${day} ${hour}:${min}`;
                 }

                 if (pInfo) {
                   return (
                      <div className="space-y-3 pt-2">
                         <h4 className="font-bold text-gray-900 border-l-4 border-blue-500 pl-2 text-sm">
                           신청자 정보
                         </h4>
                         <div className="bg-gray-50 p-3 rounded-xl text-sm space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm">
                              <span className="font-bold text-gray-900">{pInfo.user_name}</span>
                              {pInfo.baptismal_name && (
                                <span className="text-gray-600">({pInfo.baptismal_name})</span>
                              )}
                              
                              <div className="flex items-center gap-2 text-gray-500 text-xs">
                                <span className="text-gray-300">|</span>
                                <span>{pInfo.email}</span>
                                {pInfo.phone && (
                                   <>
                                     <span className="text-gray-300">|</span>
                                     <span>{pInfo.phone}</span>
                                   </>
                                )}
                              </div>
                            </div>

                            {/* 신청일시 */}
                            <div className="text-[10px] text-gray-400">
                              신청: {createdAtStr}
                            </div>
                         </div>
                      </div>
                   );
                 }
                 return null;
              })()}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleCloseDrawer}>닫기</Button>
              <Button className="flex-1" onClick={handleSaveStatus} disabled={isSaving || !hasChanges}>
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
