import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
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
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions'; // httpsCallable removed
import dayjs from 'dayjs';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
import { RefreshCw, Bell, Smartphone, MessageCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Lock, Pencil, Copy, Database } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/state/session';

interface MassEventDrawerProps {
  eventId?: string;
  date: Date | null;
  serverGroupId: string;
  onClose: () => void;
  monthStatus?: string;
  events?: MassEventCalendar[];
  readOnly?: boolean;
}

interface NotificationLog {
    type: 'app_push' | 'sms' | 'kakaotalk';
    sent_at: any; // Timestamp
    recipient_count: number;
    status: 'success' | 'partial' | 'failure';
    message?: string;
    group_id?: string;
    details?: { member_id: string; name: string; phone?: string; result: string }[];
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
  const { isSuperAdmin } = useSession();

  const [title, setTitle] = useState('');
  const [requiredServers, setRequiredServers] = useState<number | null>(2);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [mainMemberId, setMainMemberId] = useState<string | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; grade: string; active: boolean; start_year?: string }[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showUnavailableWarning, setShowUnavailableWarning] = useState(false);
  const [locked, setLocked] = useState(false); // 🔒 Anti-AutoAssign Lock
  const [isExpandedServerCount, setIsExpandedServerCount] = useState(false); // 🔽 Expand Server Count UI
  const [isTitleEditMode, setIsTitleEditMode] = useState(false); // ✏️ Title Edit Mode

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false); // ✅ [New] 미배정 필터 (구 당월참여제외 대체)
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'curr_count' | 'grade'>('curr_count');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showDebugId, setShowDebugId] = useState(false); // 🐛 Debug ID Dialog State
  
  // ✅ 전월 배정 횟수 상태
  const [prevMonthCounts, setPrevMonthCounts] = useState<Record<string, number>>({});

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

  // ✅ 전월 배정 통계 불러오기
  useEffect(() => {
    if (!date || !serverGroupId) return;

    const fetchStats = async () => {
        try {
            const prevMonth = dayjs(date).subtract(1, 'month');
            const startStr = prevMonth.startOf('month').format('YYYYMMDD');
            const endStr = prevMonth.endOf('month').format('YYYYMMDD');

            const q = query(
                collection(db, 'server_groups', serverGroupId, 'mass_events'),
                where('event_date', '>=', startStr),
                where('event_date', '<=', endStr)
            );
            
            const snap = await getDocs(q);
            const counts: Record<string, number> = {};
            
            snap.forEach(doc => {
                const data = doc.data();
                if (data.member_ids && Array.isArray(data.member_ids)) {
                    data.member_ids.forEach((mid: string) => {
                        counts[mid] = (counts[mid] || 0) + 1;
                    });
                }
            });
            setPrevMonthCounts(counts);
        } catch (e) {
            console.error('Failed to fetch prev month stats', e);
        }
    };
    
    fetchStats();
  }, [date, serverGroupId, db]);

  // ✅ 기존 이벤트 불러오기
  // ✅ 기존 이벤트 불러오기
  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as DocumentData;
        
        setTitle(data.title || '');
        const reqVal = parseInt(String(data.required_servers ?? 2), 10);
        setRequiredServers(!isNaN(reqVal) ? reqVal : 2);
        setLocked(data.anti_autoassign_locked || false); // 🔒 Load Lock State
        const loadedMemberIds = (data.member_ids as string[]) || [];
        setMemberIds(loadedMemberIds);
        setMainMemberId(data.main_member_id || null);

        // Notifications
        const logs = (data.notifications || []) as NotificationLog[];
        // Sort by date desc
        logs.sort((a, b) => {
            const tA = a.sent_at?.toDate ? a.sent_at.toDate().getTime() : 0;
            const tB = b.sent_at?.toDate ? b.sent_at.toDate().getTime() : 0;
            return tB - tA;
        });
        setNotificationLogs(logs);
      }
    } catch (err) {
      console.error('❌ 이벤트 불러오기 오류:', err);
    }
  }, [eventId, serverGroupId, db]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

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
    await Promise.all([fetchMembers(), fetchSurveyData(), fetchEvent()]);
    setIsRefreshing(false);
  };

  // ✅ 복사 선택 토글
  const toggleMember = (id: string) => {
    const isUnavailable = unavailableMembers.has(id);
    
    if (isUnavailable && !memberIds.includes(id)) {
      setShowUnavailableWarning(true);
      toast.warning('해당 단원은 스케줄상 참석이 어렵습니다. (설문 불참)', {
          duration: 3000,
          description: '그래도 배정하시겠습니까?'
      });
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
    if (!title || requiredServers === null || (!eventId && !date)) {
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
            anti_autoassign_locked: locked, // 🔒 Save Lock State
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
             anti_autoassign_locked: locked, // 🔒 Save Lock State
             // status: 'MASS-NOTCONFIRMED', // ❌ DEPRECATED: Status managed by month_status
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

  // ✅ [New] 삭제된 이력 State
  const [deletedHistory, setDeletedHistory] = useState<{ id: string; title: string; deletedAt: Date; data: any; deletedBy?: string; deletedByName?: string }[]>([]);

  // ✅ [New] 삭제 이력 조회 (생성 모드일 때만)
  useEffect(() => {
    // 조회 조건: 신규 생성이며(date 있음, eventId 없음), serverGroupId가 유효할 때
    if (eventId || !date || !serverGroupId) {
        setDeletedHistory([]);
        return;
    }
    
    // 실시간 감시 (onSnapshot) 및 Client-side filtering으로 변경
    const historyRef = collection(db, 'server_groups', serverGroupId, 'deleted_mass_events');
    // 최근 삭제된 30건을 가져와서 현재 날짜와 일치하는 것만 필터링 (Where 절 인덱스 문제 회피 및 디버깅 용이성)
    const q = query(historyRef, orderBy('deleted_at', 'desc'), limit(30));

    const unsubscribe = onSnapshot(q, (snap) => {
        const yyyymmdd = dayjs(date).format('YYYYMMDD');
        
        const list = snap.docs
            .map(doc => {
                const d = doc.data();
                const delTime = d.deleted_at?.toDate ? d.deleted_at.toDate() : new Date();
                return {
                    id: doc.id,
                    title: d.title || '(제목없음)',
                    deletedAt: delTime,
                    data: d.data,
                    eventDate: d.event_date, // 필터링용
                    deletedBy: d.deleted_by, // 삭제자 UID
                    deletedByName: d.deleted_by_name // 삭제자 이름 (저장된 값)
                };
            })
            .filter(item => item.eventDate === yyyymmdd) // 날짜 일치 여부 확인
            .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

        setDeletedHistory(list);
    }, (error) => {
        console.error('Failed to subscribe to deleted history', error);
    });

    return () => unsubscribe();
  }, [eventId, date, serverGroupId, db]);



  // ✅ [New] 복구 처리
  const handleRestore = async (historyId: string, backupData: any) => {
      if (!window.confirm(`'${backupData.title}' 일정을 복구하시겠습니까?`)) return;
      
      const restoreToast = toast.loading('일정을 복구하고 있습니다...');
      try {
          const originalId = backupData.id;
          // 1. Restore to mass_events
          const eventRef = doc(db, 'server_groups', serverGroupId, 'mass_events', originalId);
          await setDoc(eventRef, backupData);

          // 2. Remove from history
          const historyRef = doc(db, 'server_groups', serverGroupId, 'deleted_mass_events', historyId);
          await deleteDoc(historyRef);

          toast.success('일정이 복구되었습니다.', { id: restoreToast });
          onClose(); // Close to refresh
      } catch (e) {
          console.error('Restore failed', e);
          toast.error('복구 중 오류가 발생했습니다.', { id: restoreToast });
      }
  };

  // ✅ 삭제 처리 (복구 가능하도록 수정 + History 저장)
  const handleDelete = async () => {
    if (!eventId) return;
    if (!window.confirm('이 미사 일정을 삭제하시겠습니까?')) return;
    
    setLoading(true);
    try {
      // 1. 복구용 데이터 백업
      const eventRef = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) throw new Error('삭제할 데이터를 찾을 수 없습니다.');
      
      const backupData = eventSnap.data();
      
      // 🔥 [Fix] event_date가 DB에 없는 경우를 대비해 date props에서 생성 (안전장치)
      const eventDateStr = backupData.event_date || (date ? dayjs(date).format('YYYYMMDD') : '');

      if (!eventDateStr) {
          throw new Error('이벤트 날짜 정보를 찾을 수 없어 삭제 이력을 저장할 수 없습니다.');
      }

      // 2. History Collection에 저장 (Persistent Undo)
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const historyCollection = collection(db, 'server_groups', serverGroupId, 'deleted_mass_events');
      
      // 사용자 이름 조회 (삭제자 실명 기록)
      let deleterName = '알수없음';
      if (currentUser) {
          deleterName = currentUser.displayName || '사용자';
          try {
              // Users 컬렉션에서 정확한 이름 조회 시도
              const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
              if (userSnap.exists()) {
                  const userData = userSnap.data();
                  if (userData.name) deleterName = userData.name;
              }
          } catch (e) {
              console.warn('Failed to fetch deleter name', e);
          }
      }

      const { addDoc } = await import('firebase/firestore'); 
      const historyDoc = await addDoc(historyCollection, {
              original_id: eventId,
              event_date: eventDateStr, // 쿼리용 필드
              title: title,
              data: { ...backupData, id: eventId }, 
              deleted_at: serverTimestamp(),
              deleted_by: currentUser?.uid || 'unknown',
              deleted_by_name: deleterName
      });

      // 3. 삭제 수행 (설문 데이터 유지)
      await deleteDoc(eventRef);
      console.log(`🗑️ MassEvent deleted: ${eventId}`);
      
      onClose();

      // 4. 복구(Undo) 토스트 표시
      toast.success('미사 일정이 삭제되었습니다.', {
        duration: 5000,
        action: {
          label: '실행 취소',
          onClick: async () => {
             const loadingToast = toast.loading('일정을 복구하고 있습니다...');
             try {
                await setDoc(eventRef, backupData); // Restore Data
                await deleteDoc(historyDoc);        // Clean up History
                
                toast.success('미사 일정이 복구되었습니다.', { id: loadingToast });
             } catch (restoreErr) {
               console.error('복구 실패:', restoreErr);
               toast.error('일정 복구에 실패했습니다.', { id: loadingToast });
             }
          },
        },
      });

    } catch (err) {
      console.error('❌ 삭제 오류:', err);
      setErrorMsg('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ [New] 신입 식별을 위한 Max Start Year 계산
  const maxStartYear = React.useMemo(() => {
      let max = 0;
      const currentYear = dayjs().year();
      members.forEach(m => {
          if (!m.active) return;
          const y = parseInt(String(m.start_year || '0').trim(), 10);
          if (!isNaN(y) && y <= currentYear && y > max) {
              max = y;
          }
      });
      return max;
  }, [members]);

  // ✅ [New] 이번 달 배정 횟수 계산 (현재 이벤트 제외)
  const currentMonthCounts = React.useMemo(() => {
      const map: Record<string, number> = {};
      if (!events) return map;

      events.forEach(ev => {
          // Exclude current event
          if (ev.id === eventId) return;

          if (ev.member_ids && Array.isArray(ev.member_ids)) {
              ev.member_ids.forEach(mid => {
                  map[mid] = (map[mid] || 0) + 1;
              });
          }
      });
      return map;
  }, [events, eventId]);

  // ✅ 정렬 및 필터링된 멤버 리스트
  const sortedMembers = React.useMemo(() => {
    // 1. 필터링
    const filtered = members.filter((m) => {
      // (1) 설문에서 '불가능'으로 체크된 멤버 숨기기
      if (hideUnavailable && unavailableMembers.has(m.id)) {
        return false;
      }
      
      // 구 'hideAssigned' 로직 제거됨. 아래 'filterUnassigned'가 대체함.
      
      // (3) 미배정 필터 (이번 달 배정이 0인 경우만 표시)
      if (filterUnassigned) {
          // 뱃지에 표시되는 뒤쪽 숫자(이번 달 배정 횟수)가 0이어야 함.
          // events prop이 최신 상태일 때 정확히 계산하기 위해 인라인 필터 사용.
          const otherEventsCount = events 
              ? events.filter(ev => ev.id !== eventId && ev.member_ids?.includes(m.id)).length
              : 0;
          
          // 사용자가 '미배정'을 체크했을 때, 이미 선택된(배정된) 사람은 목록에서 사라져야 한다고 기대함.
          // 따라서 현재 선택 여부(isSelected)도 카운트에 포함.
          const isSelected = memberIds.includes(m.id);
          const totalAssignCount = otherEventsCount + (isSelected ? 1 : 0);
              
          if (totalAssignCount > 0) return false;
      }
      
      // Active 상태이거나, 이미 배정된 멤버(비활성 포함)인 경우 표시
      // @ts-ignore
      return m.active === true || memberIds.includes(m.id);
    });

    // 2. 정렬
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ko');
      } else if (sortBy === 'count') {
          // 전월 배정수 오름차순
          const countA = prevMonthCounts[a.id] || 0;
          const countB = prevMonthCounts[b.id] || 0;
          if (countA !== countB) return countA - countB;
          return a.name.localeCompare(b.name, 'ko');
      } else if (sortBy === 'curr_count') {
          // 당월 배정수 오름차순 (현재 선택 여부 포함)
          const isSelectedA = memberIds.includes(a.id) ? 1 : 0;
          const isSelectedB = memberIds.includes(b.id) ? 1 : 0;
          const countA = (currentMonthCounts[a.id] || 0) + isSelectedA;
          const countB = (currentMonthCounts[b.id] || 0) + isSelectedB;
          
          if (countA !== countB) return countA - countB;
          return a.name.localeCompare(b.name, 'ko');
      } else {
        // 학년별 정렬
        const gradeOrder = ['M1','M2','M3','H1','H2','H3'];
        const idxA = gradeOrder.indexOf(a.grade);
        const idxB = gradeOrder.indexOf(b.grade);
        
        if (idxA !== idxB) {
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        }
        // 학년 같으면 이름순
        return a.name.localeCompare(b.name, 'ko');
      }
    });
      }, [members, hideUnavailable, unavailableMembers, memberIds, sortBy, prevMonthCounts, events, eventId, filterUnassigned]);

  // 🔴 비활성 멤버 포함 여부 확인
  const hasInactiveAssigned = memberIds.some(id => {
      const m = members.find(mem => mem.id === id);
      // @ts-ignore
      return m && m.active === false;
  });

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md h-full fixed right-0 top-0 p-0 flex flex-col bg-white dark:bg-slate-800 shadow-2xl overflow-hidden fade-in">
        {/* ✅ Fixed Header */}
        <div className="space-y-1 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <DialogTitle>
            📝 {readOnly ? '미사 일정 상세' : eventId ? '미사 일정 수정' : '미사 일정 등록'}
            {date && (
              <span className="ml-2 text-base font-bold text-blue-600 dark:text-blue-400">
                ({dayjs(date).format('M월 D일 (ddd)')})
              </span>
            )}
            {/* Superadmin Debug Icon */}
            {isSuperAdmin && eventId && (
               <span 
                 onClick={(e) => {
                    e.stopPropagation();
                    setShowDebugId(true);
                 }}
                 className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-gray-400 border border-gray-300 rounded cursor-pointer hover:text-blue-600 hover:border-blue-600 opacity-30 hover:opacity-100 transition-all select-none bg-transparent"
                 title="Doc ID 보기"
               >
                 S
               </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {readOnly ? '미사 일정의 상세 정보를 확인합니다.' : '미사 일정을 새로 등록하거나 기존 일정을 수정합니다.'}
          </DialogDescription>
        </div>
        
        {/* ✅ Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 w-full">
        
        {/* ✅ [New] 삭제된 이력 표시 영역 */}
        {!eventId && deletedHistory.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-2 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1">
                        🗑️ 삭제된 항목 ({deletedHistory.length})
                    </span>
                    <span className="text-[10px] text-orange-600/70 dark:text-orange-500">
                      최근 삭제된 일정을 복구할 수 있습니다.
                    </span>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {deletedHistory.map((item) => {
                        // 사용자 이름 찾기 (1. 저장된 이름 -> 2. members 목록 매칭 -> 3. 기본값)
                        let deleterName = item.deletedByName;
                        
                        if (!deleterName) {
                            const deleter = members.find(m => m.id === item.deletedBy);
                            deleterName = deleter ? deleter.name.split(' ')[0] : (item.deletedBy === 'user' ? '사용자' : '알수없음');
                        }

                        return (
                        <div key={item.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-orange-100 dark:border-orange-900/50 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{item.title}</span>
                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <span>삭제됨: {dayjs(item.deletedAt).format('HH:mm:ss')}</span>
                                    <span>·</span>
                                    <span>by {deleterName}</span>
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-[10px] px-2 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:hover:bg-orange-900/50"
                                onClick={() => handleRestore(item.id, item.data)}
                            >
                                복구
                            </Button>
                        </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Body */}
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          {/* 미사 제목 */}
          <div className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 dark:text-gray-200">미사 제목</span>
              {eventId && !readOnly && (
                <button
                  type="button"
                  onClick={() => setIsTitleEditMode(!isTitleEditMode)}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    isTitleEditMode 
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                      : "text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-slate-700"
                  )}
                  title={isTitleEditMode ? "수정 완료" : "제목 수정"}
                  disabled={loading}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-2 py-1 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 read-only:bg-gray-50 read-only:text-gray-700 dark:read-only:bg-slate-800 dark:read-only:text-gray-300"
              placeholder="예: 주일 11시 미사"
              disabled={loading || readOnly}
              readOnly={eventId ? !isTitleEditMode : false}
            />
          </div>



          {/* 필요 인원 */}
          <div className="block space-y-2">
            <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-200">필요 인원</span>
                <button 
                  type="button"
                  onClick={() => setIsExpandedServerCount(!isExpandedServerCount)}
                  className="p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 rounded-full transition-colors"
                  title={isExpandedServerCount ? "접기" : "더 보기"}
                >
                    {isExpandedServerCount ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {(isExpandedServerCount 
                  ? [...Array.from({ length: 10 }, (_, i) => i + 1), 0] 
                  : [1, 2, 3, 4, 5]
              ).map((n) => {
                 const isChecked = requiredServers === n;
                 return (
                    <div 
                        key={n} 
                        className="flex items-center space-x-2 cursor-pointer group"
                        onClick={() => {
                            setRequiredServers(n);
                            if (n === 0) {
                                setMemberIds([]);
                                setMainMemberId(null);
                            }
                        }}
                    >
                        <div className={`
                            w-4 h-4 rounded-full border flex items-center justify-center transition-all
                            ${isChecked 
                                ? 'border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900' 
                                : 'border-gray-400 group-hover:border-gray-500 dark:border-gray-500 dark:group-hover:border-gray-400'
                            }
                        `}>
                            {isChecked && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                        </div>
                        <Label className={`font-normal cursor-pointer select-none ${isChecked ? 'text-blue-700 font-bold dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {n}명
                        </Label>
                    </div>
                 );
              })}
            </div>
          </div>

          {/* 🔒 자동 배정 제외 설정 */}
          <div className={`relative flex items-center space-x-2 p-3 rounded border transition-colors ${
              locked 
                ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/50" 
                : "bg-gray-50 border-gray-100 dark:bg-slate-700/50 dark:border-slate-700"
          }`}>
            <input
                id="chk-locked"
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                disabled={loading || readOnly}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <Label htmlFor="chk-locked" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none flex flex-col flex-1">
                <div className="flex items-center gap-1">
                    <span>🚫 자동 배정 제외 (고정)</span>
                </div>
                <span className={`text-[10px] font-normal mt-0.5 ${locked ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                    체크 시, 자동배정에서 제외됩니다.
                </span>
            </Label>
            {locked && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md ring-2 ring-white dark:ring-slate-800 animate-in zoom-in z-10 pointer-events-none">
                    <Lock size={14} strokeWidth={3} />
                </div>
            )}
          </div>

          {/* 기 배정된 복사 표시 */}
          {eventId && (
            <div className="block">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-200">배정된 복사</span>
                <button 
                    onClick={() => {
                        if (window.confirm('배정된 복사 선택을 모두 취소하시겠습니까?')) {
                            setMemberIds([]);
                            setMainMemberId(null);
                        }
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline underline-offset-2 flex items-center gap-1"
                    disabled={loading || readOnly}
                >
                    <XCircle size={12} /> 전체 선택취소
                </button>
              </div>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded dark:bg-slate-700/50 dark:border-slate-600">
                {memberIds.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">배정된 복사가 없습니다.</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...memberIds]
                      .sort((a, b) => (a === mainMemberId ? -1 : b === mainMemberId ? 1 : 0))
                      .map((id) => {
                        const member = members.find((m) => m.id === id);
                        const isMain = id === mainMemberId;
                        // @ts-ignore
                        const isActive = member ? member.active : false;
                        const isUnavailable = unavailableMembers.has(id);

                        return (
                          <span
                            key={id}
                            className={`px-2 py-1 rounded text-sm border flex items-center gap-1 ${
                              !isActive 
                                    ? 'bg-red-100 border-red-300 text-red-700' // 🔴 비활성: 전체 붉음
                                    : isMain
                                        ? `bg-blue-600 font-bold ${isUnavailable ? 'border-orange-400 text-orange-200' : 'border-blue-600 text-white'}` // 🔵 주복사: 배경 파랑 유지, 불참시 텍스트 경고
                                        : isUnavailable
                                            ? 'bg-green-50 border-orange-300 text-orange-700 font-medium' // 🟢 일반: 배경 초록 유지, 불참시 텍스트 오렌지
                                            : 'bg-green-50 border-green-200 text-green-900'
                            }`}
                          >
                            {member
                              ? (
                                  <>
                                    <span>{member.name} {isMain ? '(주복사)' : ''}</span>
                                    {isActive && maxStartYear > 0 && member.start_year && parseInt(String(member.start_year).trim(), 10) === maxStartYear && (
                                        <span className="text-xs ml-0.5" title="신입 복사">🐣</span>
                                    )}
                                    {member.start_year && (
                                    <span className={`text-[10px] ml-0.5 ${
                                        !isActive ? 'text-red-800' :
                                        isMain ? (isUnavailable ? 'text-orange-200' : 'text-blue-100') :
                                        isUnavailable ? 'text-orange-800' : 'text-violet-600'
                                    }`}>
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
                <span className="font-medium text-gray-900 dark:text-gray-200">배정 복사 선택</span>
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


                   {/* Row 2: Controls (Two Rows now) */}
                   <div className="flex flex-col gap-2 mb-2">
                      {/* Line 1: Checkboxes & Legend */}
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             {/* 🔹 설문제외 체크박스 */}
                             <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-700 px-2 py-1 rounded border border-gray-100 dark:border-slate-600 hover:border-gray-200 transition-colors">
                               <input 
                                 id="chk-unavailable"
                                 type="checkbox" 
                                 checked={hideUnavailable}
                                 onChange={(e) => setHideUnavailable(e.target.checked)}
                                 className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                               />
                               <label htmlFor="chk-unavailable" className="text-xs text-orange-600 font-bold cursor-pointer select-none">
                                 설문제외
                               </label>
                             </div>
        
                              {/* 🔹 미배정 필터 (New) - 구 당월참여제외 대체 */}
                              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 hover:border-blue-200 transition-colors">
                                <input 
                                  id="chk-unassigned"
                                  type="checkbox" 
                                  checked={filterUnassigned}
                                  onChange={(e) => setFilterUnassigned(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="chk-unassigned" className="text-xs text-blue-700 dark:text-blue-300 font-bold cursor-pointer select-none">
                                  당월미배정
                                </label>
                              </div>
        
                             {showUnavailableWarning && (
                              <span className="text-xs text-orange-600 font-medium animate-pulse ml-1">
                                  ⚠️ 불참
                              </span>
                            )}
                         </div>

                         {/* 신입 기준 범례 (Moved Here) */}
                         {maxStartYear > 0 && (
                            <span className="text-[10px] text-yellow-900 dark:text-yellow-100 bg-yellow-200 dark:bg-yellow-700/80 px-2 py-0.5 rounded select-none font-medium" title="자동 배정 시 해당 연도 입단자를 신입으로 간주합니다.">
                               신입기준: {maxStartYear}년
                            </span>
                         )}
                      </div>

                  {/* Line 2: Sort Buttons */}
                  <div className="flex items-center justify-end w-full">
                      <div className="flex items-center bg-gray-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                        <button
                          onClick={() => setSortBy('curr_count')} 
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all",
                            sortBy === 'curr_count' ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          당월
                        </button>
                        <button
                          onClick={() => setSortBy('count')} 
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all",
                            sortBy === 'count' ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          전월
                        </button>
                        <button
                          onClick={() => setSortBy('name')} 
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all",
                            sortBy === 'name' ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          이름
                        </button>
                        <button
                          onClick={() => setSortBy('grade')} 
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all",
                            sortBy === 'grade' ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          학년
                        </button>
                      </div>
                  </div>
               </div>
              <div className="mt-2 border rounded p-3 max-h-[600px] overflow-y-auto dark:border-slate-600">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {sortedMembers.map((m, idx) => {
                    const isUnavailable = unavailableMembers.has(m.id);
                    const isSelected = memberIds.includes(m.id);
                    const isMain = m.id === mainMemberId;
                    const isActive = m.active;
                    
                    // ✅ 신입 여부 계산 (Row Highlighting용)
                    const myYear = parseInt(String(m.start_year || '0').trim(), 10);
                    const isNovice = isActive && maxStartYear > 0 && myYear === maxStartYear;

                     // Header Separator for Grade or Count Sort
                     const prev = sortedMembers[idx - 1];
                     let showSeparator = false;
                     let separatorLabel = '';

                     if (sortBy === 'grade') {
                         showSeparator = !prev || prev.grade !== m.grade;
                         separatorLabel = m.grade;
                     } else if (sortBy === 'count') {
                          const currCount = prevMonthCounts[m.id] || 0;
                          const prevCount = prev ? (prevMonthCounts[prev.id] || 0) : -1;
                          showSeparator = !prev || prevCount !== currCount;
                          separatorLabel = `${currCount}회`;
                      } else if (sortBy === 'curr_count') {
                          const isSelectedCurr = memberIds.includes(m.id) ? 1 : 0;
                          const isSelectedPrev = prev && memberIds.includes(prev.id) ? 1 : 0;
                          
                          const countCurr = (currentMonthCounts[m.id] || 0) + isSelectedCurr;
                          const countPrev = prev ? ((currentMonthCounts[prev.id] || 0) + isSelectedPrev) : -1;
                          
                          showSeparator = !prev || countPrev !== countCurr;
                          separatorLabel = `${countCurr}회`;
                      }

                    return (
                      <React.Fragment key={m.id}>
                         {showSeparator && (
                            <div className="col-span-2 border-t border-dashed border-gray-300 dark:border-slate-600 my-2 pt-1 relative h-6">
                              <span className="absolute top-[-8px] left-2 bg-white dark:bg-slate-800 px-2 text-xs text-gray-500 dark:text-gray-400 font-bold">
                                 {separatorLabel}
                              </span>
                            </div>
                         )}
                        
                        <div className="flex items-center justify-between p-1 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded">
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
                                    <span 
                                      className={`text-sm cursor-help ${
                                          isUnavailable ? 'text-orange-600 font-medium' 
                                          : !isActive ? 'text-red-600 font-bold line-through' 
                                          : 'text-gray-700 dark:text-gray-200 font-medium'
                                      } ${
                                          isNovice ? 'bg-yellow-200 dark:bg-yellow-700/80 px-1 rounded' : ''
                                      }`}
                                      title={`${m.name}${isNovice ? ' (신입)' : ''} / 입단: ${m.start_year || '-'}년 / 학년: ${m.grade} / 상태: ${m.active ? '활동' : '비활동'}`}
                                    >
                                      {m.name}
                                    </span>
                                    {m.start_year && <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{m.start_year}</span>}
                                    {/* 신입 배지 */}
                                    {isActive && (() => {
                                        const myYear = parseInt(String(m.start_year || '0').trim(), 10);
                                        const isNovice = maxStartYear > 0 && myYear === maxStartYear;
                                        
                                        if (isNovice) {
                                            return (
                                                <span 
                                                    className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 px-1 rounded ml-1 cursor-help"
                                                    title="신입 복사 (막내)"
                                                >
                                                    🐣
                                                </span>
                                            );
                                        }
                                        return null; 
                                     })()}
                                    {sortBy === 'name' && (
                                       <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-700 px-1 rounded-sm">{m.grade}</span>
                                    )}
                                </div>
                                {!isActive && <span className="text-[9px] text-red-500">(비활성)</span>}
                             </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                              {/* Count Badge */}
                              {/* Count Badge (Prev Month) */}
                              {isActive && (() => {
                                  const prevCount = prevMonthCounts[m.id] || 0;
                                  const otherEventsCount = events.filter(ev => ev.id !== eventId && ev.member_ids?.includes(m.id)).length;
                                  const currCount = otherEventsCount + (isSelected ? 1 : 0);

                                  return (
                                    <span 
                                      className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium cursor-help border border-slate-200"
                                      title={`전월: ${prevCount}회 / 금월: ${currCount}회`}
                                    >
                                        {prevCount}{currCount > 0 ? `+${currCount}` : ''}
                                    </span>
                                  );
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                정확히 {requiredServers ?? '-'}명 선택하고, 한 명을 주복사로 지정해주세요.
              </p>
            </div>
          )}

          {/* 알림 발송 이력 (상세보기/수정 모드일 때만) */}
          {eventId && (
             <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-200">
                            알림 발송 이력
                        </span>
                        {/* 🔔 오늘 발송 예정 알림 */}
                        {(() => {
                            if (!date) return null;
                            
                            const today = dayjs(); 
                            const eventDate = dayjs(date);
                            
                            // Condition 1: Date is Tomorrow (D-1)
                            const isTomorrow = today.add(1, 'day').isSame(eventDate, 'day');

                            // Condition 2: Status is 'FINAL-CONFIRMED' (Month Status only)
                            // Backend now checks month_status for the given date.
                            const isConfirmed = monthStatus === 'FINAL-CONFIRMED';
                            
                            // Condition 3: Has Assigned Members
                            const hasMembers = memberIds.length > 0;

                            if (isTomorrow && isConfirmed && hasMembers) {
                                return (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold animate-pulse flex items-center gap-1">
                                        <Bell size={10} className="fill-current" />
                                        오늘 20시 알림예정
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    
                    <button 
                        onClick={handleRefresh}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                        title="이력 새로고침"
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                    </button>
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700">
                   {notificationLogs.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">발송된 이력이 없습니다.</p>
                   ) : (
                      <>
                        <div className="divide-y divide-gray-100 dark:divide-slate-800">
                           {(showAllLogs ? notificationLogs : notificationLogs.slice(0, 3)).map((log, idx) => {
                              const sentDate = log.sent_at?.toDate ? dayjs(log.sent_at.toDate()) : dayjs(log.sent_at);
                              
                              // Local state for expansion could be tricky in map, simpler to use a state tracking expanded IDs or just use <details> tag style or a simple toggler component.
                              // Since we can't easily add state inside this map without a sub-component, let's create a small inline component logic or just make the content structure better.
                              // Let's use a simpler approach: Render Message FIRST.
                              
                              return (
                                 <LogItem key={idx} log={log} sentDate={sentDate} serverMembers={members} />
                              );
                           })}
                        </div>
                        
                        {/* 더보기 버튼 */}
                        {notificationLogs.length > 3 && (
                            <button 
                                onClick={() => setShowAllLogs(!showAllLogs)}
                                className="w-full py-2 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 bg-gray-50/50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors border-t border-gray-100 dark:border-slate-700 rounded-b-lg"
                            >
                                {showAllLogs ? (
                                    <>접기 <ChevronUp size={12} /></>
                                ) : (
                                    <>더보기 ({notificationLogs.length - 3}건) <ChevronDown size={12} /></>
                                )}
                            </button>
                        )}
                      </>
                   )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                   * 미사 하루 전 저녁 8시에 학부모님께 자동으로 발송됩니다. (설정 ON 시)
                </p>
             </div>
          )}

          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

          {/* 하단 버튼 */}
          {/* 하단 버튼 */}
          {monthStatus === 'FINAL-CONFIRMED' && !readOnly && (
              <div className="mt-6 mb-2 p-1.5 bg-red-100 border-l-4 border-red-500 text-red-700 font-bold flex items-center justify-center gap-1.5 rounded shadow-sm dark:bg-red-900/30 dark:text-red-400 dark:border-red-600">
                  <span className="animate-pulse">⚠️</span>
                  <span className="text-xs">최종확정 상태입니다. 주의하여 수정하세요.</span>
              </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex justify-between items-center mt-4">
            {/* 좌측: 삭제 버튼 */}
            <div>
                {!readOnly && eventId && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading || monthStatus === 'FINAL-CONFIRMED'}
                    className={cn(
                        monthStatus === 'FINAL-CONFIRMED' && "bg-gray-200 text-gray-400 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-500 opacity-100"
                    )}
                  >
                    삭제
                  </Button>
                )}
            </div>

            {/* 우측: 취소/저장 버튼 */}
            <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" disabled={loading}>
                    {readOnly ? '닫기' : '취소'}
                  </Button>
                </DialogClose>
                {!readOnly && (
                  <Button 
                    onClick={handleSave} 
                    disabled={loading}
                  >
                    {loading ? '저장 중...' : eventId ? '수정' : '저장'}
                  </Button>
                )}
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* 🐛 Debug ID Dialog */}
    <Dialog open={showDebugId} onOpenChange={setShowDebugId}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl">
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl shrink-0">
                        <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            관리자 데이터 뷰어
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                             현재 미사 일정의 시스템 내부 데이터입니다.<br/>
                             개발자 및 관리자 전용 정보입니다.
                        </DialogDescription>
                    </div>
                </div>

                {/* Body Content */}
                <div className="space-y-4">
                    {/* Section: Standard Info */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Basic Information</span>
                             <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                        </div>

                        {/* Field: Document ID */}
                        <div className="group relative bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm">
                            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                                Document ID (DocId)
                            </Label>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 break-all">
                                    {eventId || 'N/A'}
                                </code>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-white dark:hover:bg-slate-700 rounded-lg shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                                    onClick={() => {
                                        if (eventId) {
                                            navigator.clipboard.writeText(eventId);
                                            toast.success('문서 ID가 복사되었습니다.');
                                        }
                                    }}
                                    title="ID 복사"
                                >
                                    <Copy size={14} className="text-slate-500" />
                                </Button>
                            </div>
                        </div>

                         {/* Placeholder for Future Fields */}
                         {/* <div className="...">...</div> */}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => setShowDebugId(false)}
                        className="px-6 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        닫기
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
};

const LogItem: React.FC<{ log: NotificationLog; sentDate: dayjs.Dayjs; serverMembers: any[] }> = ({ log, sentDate, serverMembers }) => {
    const [expanded, setExpanded] = useState(false);
  
    return (
       <div 
         className="p-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer group"
         onClick={() => setExpanded(!expanded)}
       >
          {/* Top Row: Icon, Type, Message Preview, Time */}
          <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                 log.type === 'sms' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 
                 log.type === 'kakaotalk' ? 'bg-yellow-300 text-black border border-yellow-400' :
                 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
              }`}>
                 {log.type === 'app_push' ? <Bell size={10} /> : 
                  log.type === 'sms' ? <Smartphone size={10} /> :
                  <MessageCircle size={10} fill="currentColor" />
                 }
              </div>
  
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                             {log.type === 'app_push' ? '앱 푸시' : log.type === 'sms' ? '문자' : '알림톡'}
                          </span>
                          
                           {/* Summary: Display SERVER Names (looked up from members list) */}
                           {log.details && log.details.length > 0 && (
                               <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-slate-600 pl-2 ml-1">
                                    <span className="truncate max-w-[100px]">
                                        {log.details.map(d => {
                                            const server = serverMembers.find(m => m.id === d.member_id);
                                            // 괄호 뒤(세례명) 제거하고 이름만 깔끔하게 표시 (선택사항)
                                            // const simpleName = server ? server.name.split(' ')[0] : d.name;
                                            return server ? server.name : d.name;
                                        }).join(', ')}
                                    </span>
                               </div>
                           )}

                           {/* Result Summary Badge */}
                           {log.status === 'success' ? (
                               <span className="text-[10px] text-green-600 dark:text-green-400 font-medium whitespace-nowrap">성공</span>
                           ) : log.status === 'partial' ? (
                               <span className="text-[10px] text-orange-500 font-medium whitespace-nowrap">일부 성공</span>
                           ) : (
                               <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">실패</span>
                           )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono ml-2 shrink-0">
                         {sentDate.format('MM.DD HH:mm')}
                      </span>
                  </div>
                  
                  {/* Message Content (Primary) */}
                  <p className={`text-xs text-gray-600 dark:text-gray-300 leading-snug ${expanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                      {log.message || '내용 없음'}
                  </p>
  
                  {/* Details (Expanded View) - Shows Recipient (Parent) Info */}
                  {expanded && (
                     <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        
                        {/* Recipients List */}
                         {log.details && log.details.length > 0 && (
                             <div className="grid gap-2">
                                 {log.details.map((detail, dIdx) => (
                                      <div key={dIdx} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-800/50 p-2 rounded">
                                          <div className="flex items-center gap-2">
                                             <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                {detail.name}
                                             </span>
                                             {detail.phone && (
                                                <span className="text-gray-400 font-mono text-[10px] tracking-wide">
                                                    {detail.phone}
                                                </span>
                                             )}
                                          </div>
                                          <span className={`shrink-0 text-[10px] font-medium ${detail.result === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                              {detail.result === 'success' ? '발송 완료' : '실패'}
                                          </span>
                                      </div>
                                 ))}
                             </div>
                         )}

                        {/* Group ID (Moved Below) */}
                        {log.group_id && (
                             <div className="flex items-center justify-end gap-2">
                                 <span className="text-[9px] text-gray-400">Group ID</span>
                                 <span className="text-[9px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                     {log.group_id}
                                 </span>
                             </div>
                        )}
                     </div>
                  )}
              </div>
          </div>
       </div>
    );
  };
  
export default MassEventDrawer;
