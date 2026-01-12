import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  DocumentData,
  runTransaction,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions'; // httpsCallable removed
import dayjs from 'dayjs';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import type { MemberDoc } from '@/types/firestore';
// Removed unused cloud function imports
import type { MassEventCalendar } from '@/types/massEvent';
import { RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

interface MassEventDrawerProps {
  eventId?: string;
  date: Date | null;
  serverGroupId: string;
  onClose: () => void;
  monthStatus?: string;
  events?: MassEventCalendar[];
  readOnly?: boolean;
}

const MassEventDrawer: React.FC<MassEventDrawerProps> = ({
  eventId,
  date,
  serverGroupId,
  onClose,
  monthStatus,
  events = [],
  readOnly = false,
}) => {
  const db = getFirestore();

  const [title, setTitle] = useState('');
  const [requiredServers, setRequiredServers] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [mainMemberId, setMainMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; grade: string; active: boolean; start_year?: string }[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showUnavailableWarning, setShowUnavailableWarning] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'grade'>('name');

  const GRADE_ORDER = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3', '기타'];

  // ✅ 복사단 멤버 목록 불러오기 (v2: active 필터링 로직 수정)
  const fetchMembers = useCallback(async () => {
    try {
      const ref = collection(db, 'server_groups', serverGroupId, 'members');
      const snaps = await getDocs(ref);

      const list = snaps.docs
        .map((d) => {
          const data = d.data() as MemberDoc;
          return {
            docId: d.id,
            data
          };
        })
        .filter(({ data: m }) => m.name_kor && m.baptismal_name) // 이름 없는 데이터 제외
        .map(({ docId, data: m }) => {
          const gradeStr = String(m.grade || '')
            .trim()
            .toUpperCase();
          const grade = [
            'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
            'M1', 'M2', 'M3',
            'H1', 'H2', 'H3',
          ].includes(gradeStr) ? gradeStr : '기타';

          const memberId = m.uid || docId;
          
          return {
            id: memberId,
            name: `${m.name_kor} ${m.baptismal_name}`,
            grade,
            active: m.active !== false, // active가 false인 경우만 비활성으로 간주 (undefined는 활성으로 취급)
            start_year: m.start_year
          };
        })
        .sort((a, b) => {
          // 정렬 로직
          const order = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3', '기타'];
          const idxA = order.indexOf(a.grade);
          const idxB = order.indexOf(b.grade);
          if (idxA !== idxB) return idxA - idxB;
          return a.name.localeCompare(b.name, 'ko');
        });

      // @ts-ignore
      setMembers(list);
    } catch (err) {
      console.error('❌ members load error:', err);
    }
  }, [db, serverGroupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ✅ 기존 이벤트 불러오기
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as DocumentData;
          
          setTitle(data.title || '');
          setRequiredServers(data.required_servers || null);
          const loadedMemberIds = (data.member_ids as string[]) || [];
          setMemberIds(loadedMemberIds);
          setMainMemberId(data.main_member_id || null);
        }
      } catch (err) {
        console.error('❌ 이벤트 불러오기 오류:', err);
      }
    };
    fetchEvent();
  }, [eventId, serverGroupId, db]);

  // ✅ Fetch survey responses to identify unavailable members
  const fetchSurveyData = useCallback(async () => {
    if (!date) return;
    
    try {
      const yyyymm = dayjs(date).format('YYYYMM');
      const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
      const surveySnap = await getDoc(surveyRef);
      
      if (surveySnap.exists()) {
        const surveyData = surveySnap.data();
        const responses = surveyData.responses || {};
        const unavailableMap = new Map<string, string[]>();
        
        Object.entries(responses).forEach(([memberId, response]: [string, any]) => {
          let unavailableIds: string[] = [];
          if (Array.isArray(response.unavailable)) {
            unavailableIds = response.unavailable;
          } else if (response.unavailable && typeof response.unavailable === 'object') {
            unavailableIds = Object.keys(response.unavailable);
          }
          
          if (unavailableIds.length > 0) {
            unavailableMap.set(memberId, unavailableIds);
          }
        });
        
        // For the current event, find which members marked it as unavailable
        if (eventId) {
          const unavailableSet = new Set<string>();
          unavailableMap.forEach((eventIds, memberId) => {
            if (eventIds.includes(eventId)) {
              unavailableSet.add(memberId);
            }
          });
          setUnavailableMembers(unavailableSet);
        }
      }
    } catch (err) {
      console.error('❌ Survey data fetch error:', err);
    }
  }, [date, db, serverGroupId, eventId]);

  useEffect(() => {
    fetchSurveyData();
  }, [fetchSurveyData]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMembers(), fetchSurveyData()]);
    setIsRefreshing(false);
  };

  // ✅ 복사 선택 토글
  const toggleMember = (id: string) => {
    const isUnavailable = unavailableMembers.has(id);
    
    if (isUnavailable && !memberIds.includes(id)) {
      setShowUnavailableWarning(true);
      setTimeout(() => setShowUnavailableWarning(false), 3000);
    }

    let newIds: string[];
    if (memberIds.includes(id)) {
      newIds = memberIds.filter((x) => x !== id);
    } else {
      newIds = [...memberIds, id];
    }
    
    setMemberIds(newIds);

    // 🤖 주복사 자동 지정 로직 (입단년도 빠른 순 > 이름 순)
    if (newIds.length > 0) {
      const selectedMembers = members.filter(m => newIds.includes(m.id));
      selectedMembers.sort((a, b) => {
        const yearA = a.start_year || '9999';
        const yearB = b.start_year || '9999';
        if (yearA !== yearB) return yearA.localeCompare(yearB);
        return a.name.localeCompare(b.name, 'ko');
      });
      setMainMemberId(selectedMembers[0].id);
    } else {
      setMainMemberId(null);
    }
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    if (!title || !requiredServers || (!eventId && !date)) {
      setErrorMsg('모든 필드를 입력해주세요.');
      return;
    }

    // 🔥 비활성 멤버가 포함된 상태로 저장하려는지 체크 (저장 시 자동으로 제외되므로 경고 불필요할 수도 있지만, 사용자 인지용)
    const activeMemberIds = memberIds.filter(id => {
       const m = members.find(mem => mem.id === id);
       // @ts-ignore
       return m ? m.active : false; // 멤버 정보가 없으면(이미 삭제됨 등) 비활성 취급
    });

    // ✅ 선택 인원 검증 (정확히 동일해야 함) - 단, 미확정(MASS-NOTCONFIRMED) 상태일 땐 검증 스킵
    // 주의: 요구사항에 따라 '비활성 멤버를 교체할 수 있도록 count에서 제외' 하라고 했으므로,
    // 검증 시 activeMemberIds.length 를 기준으로 해야 함.
    const isPlanPhase = monthStatus === 'MASS-NOTCONFIRMED';
    
    if (!isPlanPhase && activeMemberIds.length !== requiredServers) {
      setErrorMsg(
        `필요 인원(${requiredServers}명)에 맞게 정확히 ${requiredServers}명을 선택해야 합니다. (현재 활성 인원 ${activeMemberIds.length}명 선택됨, 비활성 인원은 자동 제외됩니다)`
      );
      return;
    }
    
    // Validate main member selection
    // 주복사가 비활성 멤버라면? -> 에러 처리
    if (!isPlanPhase && activeMemberIds.length > 0) {
        if (!mainMemberId) {
            setErrorMsg('주복사를 선택해주세요.');
            return;
        }
        const mainMember = members.find(m => m.id === mainMemberId);
        // @ts-ignore
        if (!mainMember || !mainMember.active) {
            setErrorMsg('주복사가 비활성 상태입니다. 다른 복사를 주복사로 지정해주세요.');
            return;
        }
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const groupSnap = await getDoc(doc(db, 'server_groups', serverGroupId));
      const tz = (groupSnap.data()?.timezone as string) || 'Asia/Seoul';

      // 💥 저장 시 비활성 멤버는 payload에서 제외!
      const finalMemberIds = activeMemberIds;

      if (eventId) {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        await setDoc(
          ref,
          {
            title,
            required_servers: requiredServers,
            member_ids: finalMemberIds,
            main_member_id: mainMemberId,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`✅ MassEvent updated: ${eventId}`);
      } else {

        // ✅ [Refactored] Create Mass Event locally (No Cloud Function)
        await runTransaction(db, async (transaction) => {
           // 1. Get Counter for ID generation
           const counterRef = doc(db, 'counters', 'mass_events');
           const counterSnap = await transaction.get(counterRef);
           
           let newSeq = 1;
           if (counterSnap.exists()) {
             newSeq = (counterSnap.data().last_seq || 0) + 1;
           }

           const newEventId = `ME${String(newSeq).padStart(6, '0')}`;
           const newEventRef = doc(db, 'server_groups', serverGroupId, 'mass_events', newEventId);

           // 2. Prepare Data (PRD: event_date is string YYYYMMDD)
           // date is Date | null passed from props.
           const eventDateStr = dayjs(date).format('YYYYMMDD');
           
           // 3. Writes
           transaction.set(counterRef, { last_seq: newSeq }, { merge: true });
           transaction.set(newEventRef, {
             server_group_id: serverGroupId,
             title,
             event_date: eventDateStr,
             required_servers: requiredServers,
             member_ids: [], // Initial empty
             status: 'MASS-NOTCONFIRMED',
             created_at: serverTimestamp(),
             updated_at: serverTimestamp(),
           });
        });
        
        console.log(`✅ MassEvent created locally`);
      }

      onClose();
    } catch (err) {
      console.error('❌ 저장 오류:', err);
      setErrorMsg('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 삭제 처리
  const handleDelete = async () => {
    if (!eventId) return;
    if (!window.confirm('이 미사 일정을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
      await deleteDoc(ref);
      console.log(`🗑️ MassEvent deleted: ${eventId}`);
      onClose();
    } catch (err) {
      console.error('❌ 삭제 오류:', err);
      setErrorMsg('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 정렬 및 필터링된 멤버 리스트
  const sortedMembers = React.useMemo(() => {
    // 1. 필터링
    const filtered = members.filter(m => {
      // 설문 불가 제외 체크 시
      if (hideUnavailable && unavailableMembers.has(m.id)) return false;
      // Active 상태이거나, 이미 배정된 멤버(비활성 포함)인 경우 표시
      // @ts-ignore
      return m.active === true || memberIds.includes(m.id);
    });

    // 2. 정렬
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ko');
      } else {
        // 학년순
        const idxA = GRADE_ORDER.indexOf(a.grade);
        const idxB = GRADE_ORDER.indexOf(b.grade);
        
        if (idxA !== idxB) {
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        }
        // 학년 같으면 이름순
        return a.name.localeCompare(b.name, 'ko');
      }
    });
  }, [members, hideUnavailable, unavailableMembers, memberIds, sortBy]);

  // 🔴 비활성 멤버 포함 여부 확인
  const hasInactiveAssigned = memberIds.some(id => {
      const m = members.find(mem => mem.id === id);
      // @ts-ignore
      return m && m.active === false;
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md h-full fixed right-0 top-0 p-6 flex flex-col bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto fade-in">
        {/* Header */}
        <div className="space-y-1">
          <DialogTitle>
            📝 {readOnly ? '미사 일정 상세' : eventId ? '미사 일정 수정' : '미사 일정 등록'}
            {date && (
              <span className="ml-2 text-base font-normal text-gray-600">
                ({dayjs(date).format('M월 D일 (ddd)')})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {readOnly ? '미사 일정의 상세 정보를 확인합니다.' : '미사 일정을 새로 등록하거나 기존 일정을 수정합니다.'}
          </DialogDescription>
        </div>
        
        <div className="border-b border-gray-200" />

        {/* Body */}
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          {/* 미사 제목 */}
          <label className="block">
            <span className="font-medium">미사 제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="예: 주일 11시 미사"
              disabled={loading || readOnly}
            />
          </label>

          {/* 필요 인원 */}
          <label className="block">
            <span className="font-medium">필요 인원</span>
            <div className="flex gap-2 mt-1 flex-wrap">
              {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                <label key={n} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="requiredServers"
                    value={n}
                    checked={requiredServers === n}
                    onChange={() => setRequiredServers(n)}
                    disabled={loading || readOnly}
                  />
                  {n}명
                </label>
              ))}
            </div>
          </label>

          {/* 기 배정된 복사 표시 */}
          {eventId && (
            <div className="block">
              <span className="font-medium">배정된 복사</span>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                {memberIds.length === 0 ? (
                  <p className="text-sm text-gray-500">배정된 복사가 없습니다.</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-gray-500">로딩 중...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...memberIds]
                      .sort((a, b) => (a === mainMemberId ? -1 : b === mainMemberId ? 1 : 0))
                      .map((id) => {
                        const member = members.find((m) => m.id === id);
                        const isMain = id === mainMemberId;
                        // @ts-ignore
                        const isActive = member ? member.active : false;

                        return (
                          <span
                            key={id}
                            className={`px-2 py-1 rounded text-sm border flex items-center gap-1 ${
                              isMain
                                ? 'bg-blue-600 text-white font-bold border-blue-600'
                                : isActive 
                                    ? 'bg-green-50 border-green-200 text-green-900' 
                                    : 'bg-red-100 border-red-300 text-red-700' // 🔴 비활성: 붉은 계통
                            }`}
                          >
                            {member
                              ? (
                                  <>
                                    <span>{member.name} {isMain ? '(주복사)' : ''}</span>
                                    {member.start_year && (
                                    <span className={`text-[10px] ml-0.5 ${isMain ? 'text-blue-100' : 'text-violet-600'}`}>
                                        {member.start_year.length === 4 ? member.start_year.slice(2) : member.start_year}년
                                      </span>
                                    )}
                                  </>
                                )
                              : `ID: ${id.substring(0, 8)}... (미확인)`}
                            
                            {/* 비활성 뱃지 */}
                            {!isActive && <span className="text-[10px] font-bold bg-red-200 text-red-800 px-1 rounded">비활성</span>}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
               {/* 🔴 비활성 경고 메시지 */}
               {hasInactiveAssigned && !readOnly && (
                   <div className="mt-1 text-xs text-red-600 font-bold flex items-center gap-1 animate-pulse">
                       ⚠️ 비활성(활동 중단) 단원이 배정되어 있습니다. 다른 단원으로 교체해 주세요.
                       (저장 시 비활성 단원은 자동으로 배정 취소됩니다)
                   </div>
               )}
            </div>
          )}

          {/* 복사 배정 (학년별 그룹) - 미확정 상태에서는 숨김, 읽기 전용이면 숨김 */}
          {!readOnly && monthStatus !== 'MASS-NOTCONFIRMED' && (
            <div className="block">
              {/* Row 1: Title & Refresh */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">배정 복사 선택</span>
                <Button
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 text-gray-500"
                    title="데이터 새로고침"
                >
                    <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
                </Button>
              </div>

              {/* Row 2: Checkbox (Left) & Sort Buttons (Right) */}
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                    {/* 🔹 설문 불가 제외 체크박스 */}
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 hover:border-gray-200 transition-colors">
                      <input 
                        id="chk-unavailable"
                        type="checkbox" 
                        checked={hideUnavailable}
                        onChange={(e) => setHideUnavailable(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="chk-unavailable" className="text-xs text-gray-600 font-medium cursor-pointer select-none">
                        설문 불가 제외
                      </label>
                    </div>

                    {showUnavailableWarning && (
                      <span className="text-xs text-orange-600 font-medium animate-pulse">
                          ⚠️ 불참
                      </span>
                    )}
                 </div>

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
              <div className="mt-2 border rounded p-3 max-h-[600px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {sortedMembers.map((m, idx) => {
                    const isUnavailable = unavailableMembers.has(m.id);
                    const isSelected = memberIds.includes(m.id);
                    const isMain = m.id === mainMemberId;
                    const isActive = m.active;

                    // Header Separator for Grade Sort
                    const prev = sortedMembers[idx - 1];
                    const showSeparator = sortBy === 'grade' && (!prev || prev.grade !== m.grade);

                    return (
                      <React.Fragment key={m.id}>
                         {showSeparator && (
                           <div className="col-span-2 border-t border-dashed border-gray-300 my-2 pt-1 relative h-6">
                             <span className="absolute top-[-8px] left-2 bg-white px-2 text-xs text-gray-500 font-bold">
                                {m.grade}
                             </span>
                           </div>
                         )}

                        <div className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                             <input
                                type="checkbox"
                                value={m.id}
                                checked={isSelected}
                                onChange={() => toggleMember(m.id)}
                                disabled={loading}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                             
                             <div className="flex flex-col truncate">
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm ${isUnavailable ? 'text-orange-600 font-medium' : !isActive ? 'text-red-600 font-bold line-through' : 'text-gray-700 font-medium'}`}>
                                      {m.name}
                                    </span>
                                    {sortBy === 'name' && (
                                       <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded-sm">{m.grade}</span>
                                    )}
                                </div>
                                {!isActive && <span className="text-[9px] text-red-500">(비활성)</span>}
                             </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                              {/* Count Badge */}
                              {isActive && (() => {
                                const count = events.filter(ev => ev.id !== eventId && ev.member_ids?.includes(m.id)).length + (isSelected ? 1 : 0);
                                const otherEventsCount = events.filter(ev => ev.id !== eventId && ev.member_ids?.includes(m.id)).length;
                                const totalCount = otherEventsCount + (isSelected ? 1 : 0);
                                
                                return totalCount > 0 ? (
                                    <span 
                                      className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold cursor-help border border-blue-100"
                                      title="이번 달 미사에 배정된 총 횟수"
                                    >
                                        {totalCount}회
                                    </span>
                                ) : null;
                              })()}

                              {/* Main Member Radio */}
                              {isSelected && (
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="mainMember"
                                    checked={isMain}
                                    onChange={() => setMainMemberId(m.id)}
                                    disabled={loading}
                                    className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                                  />
                                  <span className={`text-[10px] whitespace-nowrap ${isMain ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>주</span>
                                </label>
                              )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                정확히 {requiredServers ?? '-'}명 선택하고, 한 명을 주복사로 지정해주세요.
              </p>
            </div>
          )}

          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

          {/* 하단 버튼 */}
          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 mt-6">
            {!readOnly && eventId && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={loading}
                className="text-red-600 border-red-400"
              >
                삭제
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>
                {readOnly ? '닫기' : '취소'}
              </Button>
            </DialogClose>
            {!readOnly && (
              <Button onClick={handleSave} disabled={loading}>
                {loading ? '저장 중...' : eventId ? '수정' : '저장'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MassEventDrawer;
