import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, getDocs, query, where, Timestamp, writeBatch, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { openConfirm } from '@/components/common/ConfirmDialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';
import AddServerDrawer from '@/pages/components/AddServerDrawer';
import MoveMembersDrawer from '@/pages/components/MoveMembersDrawer';
import { UserRoleIcon } from '@/components/ui';
import { useSession } from '@/state/session';

interface Member {
  id: string;
  name_kor: string;
  baptismal_name: string;
  grade: string;
  start_year?: string;
  email?: string;
  active: boolean;
  request_confirmed?: boolean; // 승인 여부 (true: 승인됨, false/undefined: 미승인)
  parent_uid?: string;
  is_moved?: boolean; // ✅ [New] 이동 여부
  moved_at?: any;
  moved_by_name?: string;
  moved_to_sg_id?: string;
  moved_from_sg_id?: string; // ✅ [New] 어디서 온 복사단원인지
  // ✅ [New] 복사(Copy) 관련 필드
  copied_to_sg_id?: string;
  copied_at?: any;
  copied_by_name?: string;
  created_at?: any; // Firestore Timestamp
  // History
  history_logs?: HistoryLog[];
}

interface HistoryLog {
  date: Timestamp;
  action: string;
  changes: string[];
  editor: string;
}

interface UserInfo {
  user_name: string;
  baptismal_name?: string;
  email: string;
  phone?: string;
  roles?: string[]; // 'admin', 'planner'
  user_category?: string;
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

// Helper function to get changes
const getMemberChanges = (oldMember: Member, newActive: boolean, newGrade: string, newStartYear: string, newNameKor: string, newBaptismalName: string): string[] => {
  const changes: string[] = [];
  if (oldMember.active !== newActive) changes.push(`상태: ${oldMember.active ? '활동' : '비활동'} -> ${newActive ? '활동' : '비활동'}`);
  if (oldMember.grade !== newGrade) changes.push(`학년: ${oldMember.grade} -> ${newGrade}`);
  if ((oldMember.start_year || '') !== newStartYear) changes.push(`입단: ${oldMember.start_year || ''} -> ${newStartYear}`);
  if ((oldMember.name_kor || '') !== newNameKor) changes.push(`이름: ${oldMember.name_kor} -> ${newNameKor}`);
  if ((oldMember.baptismal_name || '') !== newBaptismalName) changes.push(`세례명: ${oldMember.baptismal_name} -> ${newBaptismalName}`);
  return changes;
};

export default function ServerList() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useSession();
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [inactiveMembers, setInactiveMembers] = useState<Member[]>([]);
  const [movedMembers, setMovedMembers] = useState<Member[]>([]); // ✅ [New] 전배간 복사단원
  const [deletedMembers, setDeletedMembers] = useState<Member[]>([]); // ✅ [New] 삭제된 복사단원
  const [loading, setLoading] = useState(true);
  const [parentInfos, setParentInfos] = useState<Record<string, UserInfo>>({});
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isMoveDrawerOpen, setIsMoveDrawerOpen] = useState(false); // ✅ [New] 이동 Drawer
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats>({ lastMonth: 0, thisMonth: 0, nextMonth: 0 });
  // ✅ 배정 현황 기준 월 (중간달)
  const [statsBaseDate, setStatsBaseDate] = useState(dayjs());
  const [showAllLogs, setShowAllLogs] = useState(false); // ✅ [New] 이력 더보기 토글
  
  // ✅ 상태 수정용 state
  const [editActive, setEditActive] = useState(false);
  const [editGrade, setEditGrade] = useState('');
  const [editStartYear, setEditStartYear] = useState('');
  // ✅ 이름/세례명 수정용 state
  const [editNameKor, setEditNameKor] = useState('');
  const [editBaptismalName, setEditBaptismalName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false); // 이름 수정 모드 토글
  const [isSaving, setIsSaving] = useState(false);

  // ✅ 정렬 상태: 'name' | 'grade' | 'start_year'
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'start_year'>('name');
  
  // ✅ 배정 로그 확장 상태
  const [expandedMonth, setExpandedMonth] = useState<'last' | 'this' | 'next' | null>(null);
  const [showMoved, setShowMoved] = useState(false); // ✅ [New] 전배 멤버 더보기 토글
  const [assignmentDetails, setAssignmentDetails] = useState<{eventId: string; title: string; date: string; rawDate: string}[]>([]);

  // ✅ 선택된 멤버 변경 시 상태 동기화
  useEffect(() => {
    if (selectedMember) {
      setEditActive(selectedMember.active);
      setEditGrade(selectedMember.grade || 'M1');
      setEditStartYear(selectedMember.start_year || '');
      setEditNameKor(selectedMember.name_kor || '');
      setEditBaptismalName(selectedMember.baptismal_name || '');
      setIsEditingName(false); // 초기화
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

      // 1. Pending: Active=false AND request_confirmed!=true AND !is_moved
      setPendingMembers(all.filter((m) => !m.active && !m.request_confirmed && !m.is_moved));
      
      // 2. Active: Active=true (implies confirmed or legacy) AND !is_moved
      const active = all.filter((m) => m.active && !m.is_moved);
      const nameSorter = (a: Member, b: Member) => {
        const keyA = (a.name_kor || '') + (a.baptismal_name || '');
        const keyB = (b.name_kor || '') + (b.baptismal_name || '');
        return keyA.localeCompare(keyB);
      };

      active.sort(nameSorter);
      setActiveMembers(active);

      // 3. Inactive: Active=false AND request_confirmed=true AND !is_moved
      const inactive = all.filter((m) => !m.active && m.request_confirmed && !m.is_moved);
      inactive.sort(nameSorter);
      setInactiveMembers(inactive);

      setInactiveMembers(inactive);
      
      // 4. Moved OR Copied History
      const histories = all.filter((m) => m.is_moved || m.copied_to_sg_id);
      histories.sort((a, b) => {
          // Compare moved_at vs copied_at. If both present (moved after copy), use moved_at.
          // Actually we care about the LATEST relevant event timestamp for sorting.
          
          const getTimestamp = (m: Member, field: 'moved' | 'copied') => {
              if (field === 'moved' && m.moved_at?.toDate) return m.moved_at.toDate().getTime();
              if (field === 'copied' && m.copied_at?.toDate) return m.copied_at.toDate().getTime();
              return 0;
          };

          const tA = Math.max(
             a.is_moved ? getTimestamp(a, 'moved') : 0, 
             a.copied_to_sg_id ? getTimestamp(a, 'copied') : 0
          );
          const tB = Math.max(
             b.is_moved ? getTimestamp(b, 'moved') : 0, 
             b.copied_to_sg_id ? getTimestamp(b, 'copied') : 0
          );
          
          if (tA !== tB) return tB - tA; // Newest first

          // Sort by Name ASC as secondary
          return (a.name_kor || '').localeCompare(b.name_kor || '');
      });
      setMovedMembers(histories);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverGroupId]);

  // ✅ 삭제된 복사단원 구독
  useEffect(() => {
    if (!serverGroupId) return;

    const delColRef = collection(db, 'server_groups', serverGroupId, 'del_members');
    const unsubscribe = onSnapshot(delColRef, (snap) => {
        const deleted = snap.docs.map(d => ({
            ...(d.data() as Member),
            id: d.id
        }));

        deleted.sort((a: any, b: any) => {
             const tA = a.deleted_at?.toDate ? a.deleted_at.toDate().getTime() : 0;
             const tB = b.deleted_at?.toDate ? b.deleted_at.toDate().getTime() : 0;
             return tB - tA; // 내림차순
        });

        setDeletedMembers(deleted);
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
              // Check membership for roles
              let roles: string[] = [];
              if (serverGroupId) {
                 try {
                    const memSnap = await getDoc(doc(db, 'memberships', `${uid}_${serverGroupId}`));
                    if (memSnap.exists()) {
                        const memData = memSnap.data();
                        if (Array.isArray(memData.role)) {
                            roles = memData.role;
                        } else if (typeof memData.role === 'string') {
                            roles = [memData.role];
                        }
                    }
                 } catch (e) { console.error('Membership check failed', e); }
              }

              newInfos[uid] = {
                user_name: data.user_name,
                baptismal_name: data.baptismal_name,
                email: data.email,
                phone: data.phone,
                roles,
                user_category: data.user_category,
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
    
    // 쿼리 범위: 지난달 1일 ~ 다음달 말일 (YYYYMMDD 형식)
    const startStr = base.subtract(1, 'month').startOf('month').format('YYYYMMDD');
    const endStr = base.add(1, 'month').endOf('month').format('YYYYMMDD');
    
    const q = query(
      collection(db, 'server_groups', serverGroupId, 'mass_events'),
      where('event_date', '>=', startStr), 
      where('event_date', '<=', endStr)
    );

    try {
        const snap = await getDocs(q);
        let lm = 0, tm = 0, nm = 0;
        
        snap.docs.forEach(doc => {
            const data = doc.data();
            // event_date는 YYYYMMDD 문자열이므로 dayjs로 파싱
            const date = dayjs(data.event_date, 'YYYYMMDD');
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

  // ✅ 배정 상세 정보 가져오기
  const fetchAssignmentDetails = async (memberId: string, monthType: 'last' | 'this' | 'next') => {
    if (!serverGroupId) return;
    
    const base = statsBaseDate;
    let targetMonth: dayjs.Dayjs;
    
    if (monthType === 'last') targetMonth = base.subtract(1, 'month');
    else if (monthType === 'this') targetMonth = base;
    else targetMonth = base.add(1, 'month');
    
    const startStr = targetMonth.startOf('month').format('YYYYMMDD');
    const endStr = targetMonth.endOf('month').format('YYYYMMDD');
    
    const q = query(
      collection(db, 'server_groups', serverGroupId, 'mass_events'),
      where('event_date', '>=', startStr),
      where('event_date', '<=', endStr)
    );
    
    try {
      const snap = await getDocs(q);
      const details: {eventId: string; title: string; date: string; rawDate: string}[] = [];
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        const members = data.member_ids || [];
        
        if (members.includes(memberId)) {
          const date = dayjs(data.event_date, 'YYYYMMDD');
          details.push({
            eventId: doc.id,
            title: data.title || '미사',
            date: date.format('M월 D일 (ddd)'),
            rawDate: data.event_date
          });
        }
      });
      
      // 날짜순 정렬 (YYYYMMDD 기준)
      details.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
      setAssignmentDetails(details);
    } catch(e) {
      console.error("Failed to fetch assignment details", e);
    }
  };



  // ✅ 승인 처리
  const handleApprove = async (uid: string) => {
    if (!serverGroupId) return;

    // 1. Check for duplicates in active members
    const targetMember = pendingMembers.find(m => m.id === uid);
    if (targetMember) {
        const duplicate = activeMembers.find(m => 
            m.name_kor === targetMember.name_kor && 
            m.baptismal_name === targetMember.baptismal_name
        );
        
        if (duplicate) {
            toast.error(`이미 활동 중인 복사단원에 동일한 이름과 세례명(${targetMember.name_kor}, ${targetMember.baptismal_name})이 존재합니다. 승인할 수 없습니다.`);
            return;
        }
    }

    const ok = await openConfirm({
      title: '회원 승인',
      message: '해당 회원을 승인하시겠습니까?',
      confirmText: '승인',
      cancelText: '취소',
    });

    if (!ok) return;

    try {
      const batch = writeBatch(db);
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const editorName = currentUser?.displayName || '관리자';

      // (1) server_groups/.../members 업데이트
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
      
      const newLog: HistoryLog = {
        date: Timestamp.now(),
        action: '승인',
        changes: ['상태: 비활동 -> 활동', '승인됨'],
        editor: editorName
      };

      batch.update(memberRef, { 
        active: true, 
        request_confirmed: true, // 승인 확정
        updated_at: new Date(),
        history_logs: arrayUnion(newLog)
      });

      // (2) memberships 컬렉션 업데이트 (active: true)
      const membershipRef = doc(db, 'memberships', `${uid}_${serverGroupId}`);
      // memberships 문서가 반드시 존재한다고 가정 (AddMember에서 생성됨)
      batch.update(membershipRef, {
        active: true,
        updated_at: new Date()
      });

      await batch.commit();

      toast.success('✅ 회원이 승인되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  // ✅ 삭제(거절) 처리 -> del_members로 이동
  const handleDelete = async (uid: string): Promise<boolean> => {
    if (!serverGroupId) return false;

    // pending, active, inactive, moved 중에서 찾아봄
    const targetMember = 
        pendingMembers.find(m => m.id === uid) || 
        activeMembers.find(m => m.id === uid) || 
        inactiveMembers.find(m => m.id === uid) ||
        movedMembers.find(m => m.id === uid);

    if (!targetMember) {
        toast.error('대상을 찾을 수 없습니다.');
        return false;
    }

    const ok = await openConfirm({
      title: '복사단원 삭제',
      message: '해당 복사단원을 삭제하시겠습니까?\n삭제된 단원은 [삭제된 복사단원] 목록으로 이동되며, 필요 시 복구할 수 있습니다.',
      confirmText: '삭제',
      cancelText: '취소',
    });

    if (!ok) return false;

    const auth = getAuth();
    const currentUser = auth.currentUser;

    try {
      const batch = writeBatch(db);
      
      // 1. del_members에 추가 (History 추가)
      const delRef = doc(db, 'server_groups', serverGroupId, 'del_members', uid);
      
      const newLog: HistoryLog = {
          date: Timestamp.now(),
          action: '삭제',
          changes: ['휴지통으로 이동'],
          editor: currentUser?.displayName || '관리자'
      };
      const existingLogs = targetMember.history_logs || [];

      batch.set(delRef, {
        ...targetMember,
        active: false, // 삭제되므로 active는 false
        deleted_at: serverTimestamp(),
        deleted_by_uid: currentUser?.uid,
        deleted_by_name: currentUser?.displayName || '관리자',
        history_logs: [newLog, ...existingLogs] // 최신 로그가 앞으로 오게 (하지만 Firestore 저장은 배열 순서대로임, 뷰에서 sort 필요)
      });

      // 2. members 문서 삭제
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
      batch.delete(memberRef);

      // 3. memberships 문서 삭제
      const membershipId = `${uid}_${serverGroupId}`;
      const membershipRef = doc(db, 'memberships', membershipId);
      batch.delete(membershipRef);

      await batch.commit();

      toast.success('휴지통으로 이동되었습니다.');
      return true;
    } catch (err) {
      console.error(err);
      toast.error('삭제 중 오류가 발생했습니다.');
      return false;
    }
  };

  // ✅ 복구 처리
  const handleRestore = async (uid: string, originalData: any) => {
      if (!serverGroupId) return;

      const ok = await openConfirm({
          title: '복사단원 복구',
          message: '선택한 단원을 복구하시겠습니까?\n(비활동 상태로 복구됩니다)',
          confirmText: '복구',
          cancelText: '취소'
      });
      if (!ok) return;

      try {
          const batch = writeBatch(db);

          // 1. members로 복귀 (History 추가)
          const memberRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
          
          // 삭제 관련 필드 제거
          const { deleted_at, deleted_by_uid, deleted_by_name, ...rest } = originalData;
          
          const auth = getAuth();
          const currentUser = auth.currentUser;
          const newLog: HistoryLog = {
              date: Timestamp.now(),
              action: '복구',
              changes: ['휴지통에서 복구 (비활동 상태)'],
              editor: currentUser?.displayName || '관리자'
          };
          const existingLogs = originalData.history_logs || [];

          batch.set(memberRef, {
              ...rest,
              active: false, // 복구 시 안전하게 비활동으로
              request_confirmed: true, // 복구된 멤버는 승인된 것으로 간주
              updated_at: serverTimestamp(),
              history_logs: [newLog, ...existingLogs]
          });

          // 2. memberships 생성
          const membershipRef = doc(db, 'memberships', `${uid}_${serverGroupId}`);
          batch.set(membershipRef, {
              uid,
              server_group_id: serverGroupId,
              role: ['server'],
              active: false,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
          });

          // 3. del_members에서 제거
          const delRef = doc(db, 'server_groups', serverGroupId, 'del_members', uid);
          batch.delete(delRef);

          await batch.commit();
          toast.success('복사단원이 복구되었습니다.');
      } catch (e) {
          console.error(e);
          toast.error('복구 중 오류가 발생했습니다.');
      }
  };

  // ✅ 상태 변경 저장
  const handleSaveStatus = async () => {
    if (!selectedMember || !serverGroupId) return;
    
    // 변경 사항 감지
    const changes = getMemberChanges(selectedMember, editActive, editGrade, editStartYear, editNameKor, editBaptismalName);

    if (changes.length === 0) {
        setIsDrawerOpen(false);
        return;
    }

    setIsSaving(true);
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const editorName = currentUser?.displayName || '관리자';

    try {
      const memberRef = doc(db, 'server_groups', serverGroupId, 'members', selectedMember.id);
      
      const updateData: any = { 
        active: editActive, 
        grade: editGrade,
        start_year: editStartYear,
        name_kor: editNameKor,
        baptismal_name: editBaptismalName,
        request_confirmed: true, // 수정 시 확정 상태 보장 (비활동 전환 시 필요)
        updated_at: new Date() 
      };

      const newLog: HistoryLog = {
          date: Timestamp.now(),
          action: '정보 수정',
          changes: changes,
          editor: editorName
      };
      
      updateData.history_logs = arrayUnion(newLog);

      await updateDoc(memberRef, updateData);
      
      // 로컬 상태 업데이트
      setSelectedMember(prev => {
          if (!prev) return null;
          const updatedLogs = [newLog, ...(prev.history_logs || [])];
          return { 
            ...prev, 
            active: editActive, 
            grade: editGrade, 
            start_year: editStartYear,
            name_kor: editNameKor,
            baptismal_name: editBaptismalName,
            request_confirmed: true,
            history_logs: updatedLogs
          };
      });
      
      toast.success('정보가 저장되었습니다.');
      setIsDrawerOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('정보 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(id);
      toast.success('ID가 복사되었습니다: ' + id);
  };

  const handleExcelDownload = () => {
    if (activeMembers.length === 0) return;
    
    try {
        const data = activeMembers.map(m => {
            const p = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
            return {
                '이름': m.name_kor,
                '세례명': m.baptismal_name,
                '학년': m.grade,
                '입단년도': m.start_year || '',
                '상태': m.active ? '활동중' : '비활동',
                '신청자(부모)': p ? p.user_name : '',
                '이메일': p ? p.email : '',
                '전화번호': p ? p.phone || '' : ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ActiveMembers");

        const fileName = `복사단원_활동중_${dayjs().format('YYYYMMDD')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        toast.success('엑셀 다운로드 완료');
    } catch (e) {
        console.error('Excel download failed', e);
        toast.error('엑셀 다운로드 실패');
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    
    // ✅ 배정 현황 상태 초기화
    setExpandedMonth(null);
    setAssignmentDetails([]);
    setStatsBaseDate(dayjs());
    
    if (selectedMember) {
      setEditActive(selectedMember.active);
      setEditGrade(selectedMember.grade || 'M1');
      setEditStartYear(selectedMember.start_year || '');
      setEditNameKor(selectedMember.name_kor || '');
      setEditBaptismalName(selectedMember.baptismal_name || '');
      setIsEditingName(false);
    }
  };

  const hasChanges = selectedMember ? (
    selectedMember.active !== editActive || 
    selectedMember.grade !== editGrade || 
    selectedMember.start_year !== editStartYear ||
    selectedMember.name_kor !== editNameKor ||
    selectedMember.baptismal_name !== editBaptismalName
  ) : false;

  // ✅ [New] 신입(막내) 연도 계산
  const maxStartYear = useMemo(() => {
    let max = 0;
    const currentYear = dayjs().year();
    activeMembers.forEach(m => {
       const y = parseInt(String(m.start_year || '0').trim(), 10);
       if (!isNaN(y) && y <= currentYear && y > max) {
           max = y;
       }
    });
    return max;
  }, [activeMembers]);

  // ✅ 정렬된 리스트 계산 (useMemo)
  const sortedActiveMembers = useMemo(() => {
    const list = [...activeMembers];
    if (sortBy === 'name') {
       // 이미 load시 정렬됨
       return list;
    } else if (sortBy === 'start_year') {
        // 입단년도 정렬 (ASC) -> Name
        return list.sort((a, b) => {
            const yA = a.start_year || '9999';
            const yB = b.start_year || '9999';
            if (yA !== yB) return yA.localeCompare(yB);
            
            const keyA = (a.name_kor || '') + (a.baptismal_name || '');
            const keyB = (b.name_kor || '') + (b.baptismal_name || '');
            return keyA.localeCompare(keyB);
        });
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
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft size={24} />
        </Button>
        <h1 className="text-2xl font-bold dark:text-white">복사단원 관리</h1>
      </div>



      {/* ✅ 승인 대기중 */}
      <Card className="p-4 bg-pink-50 border-pink-100 dark:bg-pink-900/20 dark:border-pink-900/50">
        <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-pink-300">
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
                  className="p-3 flex items-stretch gap-4 hover:shadow-md transition-shadow dark:bg-slate-700/60 dark:border-slate-600"
                >
                  {/* Left Column: Server Info & Actions */}
                  <div className="flex flex-row items-center gap-3 shrink-0">
                    {/* Server Info */}
                    <div className="text-left w-[90px]">
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{m.name_kor}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        ({m.baptismal_name}) · {m.grade}
                      </p>
                    </div>

                    {/* Actions (Vertical) */}
                    <div className="flex flex-col gap-1">
                      <Button
                        onClick={() => handleApprove(m.id)}
                        className="text-[11px] h-7 w-[50px] px-0"
                      >
                        승인
                      </Button>
                      <Button
                        onClick={() => handleDelete(m.id)}
                        variant="destructive"
                        className="text-[11px] h-7 w-[50px] px-0"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Applicant(Parent) Info */}
                  <div className="flex-1 border-l border-gray-100 dark:border-slate-700 pl-4 flex flex-col justify-center items-end min-w-0 text-right">
                    {parent ? (
                       <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 w-full flex flex-col items-end">
                           <div className="flex items-center justify-end gap-1.5">
                            {parent.roles && (
                                <div className="flex gap-0.5">
                                    {(parent.roles.includes('admin') || parent.roles.includes('planner')) && (
                                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border leading-none ${
                                            parent.roles.includes('admin') && parent.roles.includes('planner') ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                                            parent.roles.includes('admin') ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                                            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                        }`}>
                                            {parent.roles.includes('admin') && parent.roles.includes('planner') ? 'AP' : parent.roles.includes('admin') ? 'A' : 'P'}
                                        </span>
                                    )}
                                </div>
                            )}
                            <span className="font-bold text-gray-700 dark:text-gray-200">신청: {parent.user_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-x-2 text-gray-500 dark:text-gray-400">
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
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 pt-1.5 border-t border-dashed border-gray-100 dark:border-slate-700 w-full">
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
      <Card className="p-4 bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/50">
        <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-green-200 mb-2">
              활동중 복사단원{' '}
              <span className="text-sm font-normal text-gray-500">({activeMembers.length}명)</span>
            </h2>
            
            <div className="flex flex-wrap items-center justify-between gap-2">
               <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold px-2 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/40 dark:bg-green-900/10"
                  onClick={() => setIsAddDrawerOpen(true)}
                >
                  + 추가
                </Button>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
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
                        onClick={() => setSortBy('start_year')} 
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all",
                          sortBy === 'start_year' ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        입단년도
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
    
                    <div className="w-[1px] h-6 bg-gray-300 mx-1"></div>
    
                    <Button variant="outline" size="sm" onClick={handleExcelDownload} className="hidden sm:flex" title="엑셀로 저장">
                        <Download size={16} className="mr-2" />
                        엑셀
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleExcelDownload} className="sm:hidden" title="엑셀로 저장">
                        <Download size={16} />
                    </Button>
                </div>
            </div>
        </div>

        {sortedActiveMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">아직 승인된 복사단원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sortedActiveMembers.map((m, idx) => {
              const parent = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
              let dateStr = '';
              if (m.created_at?.toDate) {
                const d = m.created_at.toDate();
                dateStr = `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
              }

              // Check separator logic
              const prev = sortedActiveMembers[idx - 1];
              let showSeparator = false;
              let separatorLabel = '';

              if (sortBy === 'grade') {
                  showSeparator = !prev || prev.grade !== m.grade;
                  separatorLabel = m.grade;
              } else if (sortBy === 'start_year') {
                  showSeparator = !prev || prev.start_year !== m.start_year;
                  separatorLabel = m.start_year ? `${m.start_year}년` : '미입력';
              }

              return (
                <React.Fragment key={m.id}>
                  {showSeparator && (
                     <div className="col-span-2 md:col-span-3 border-t border-dashed border-gray-300 dark:border-gray-600 my-1 relative h-4">
                       <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-2 text-[10px] text-gray-400 font-medium">
                          {separatorLabel}
                       </span>
                     </div>
                  )}

                  <Card 
                    className="p-2 flex items-center justify-between text-left hover:shadow-md transition-shadow cursor-pointer dark:bg-slate-700/60 dark:border-slate-600"
                    onClick={() => {
                      setSelectedMember(m);
                      setIsDrawerOpen(true);
                    }}
                  >
                    {/* Left: Server Info (Prioritized) */}
                    <div className="flex-1 min-w-0 mr-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate flex items-center gap-1">
                        <span title={`입단: ${m.start_year || '-'}년`}>
                           {m.name_kor}
                        </span>
                        {/* 🐣 Novice Badge */}
                        {(() => {
                            const myYear = parseInt(String(m.start_year || '0').trim(), 10);
                            if (maxStartYear > 0 && myYear === maxStartYear) {
                                return (
                                    <span 
                                        className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 px-1 rounded cursor-help animate-in zoom-in" 
                                        title={`신입 복사 (${myYear}년)`}
                                    >
                                        🐣
                                    </span>
                                );
                            }
                            return null;
                        })()}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {m.baptismal_name} · {m.grade} {m.start_year && `· ${m.start_year}년`}
                        {m.moved_from_sg_id && (
                          <span className="ml-1 text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded border border-blue-200 dark:border-blue-800" title={`${m.moved_from_sg_id}에서 전배온 복사단원`}>
                            전배온
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {/* Right: Parent Info (Secondary, Truncatable) */}
                    {parent && (
                      <div className="text-right shrink-0 max-w-[40%]">
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate flex items-center justify-end gap-1">
                          <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">신청:</span>
                          <span className="text-gray-400 dark:text-gray-600 sm:hidden">부:</span>
                          
                          {/* Role Badge */}
                          {parent.roles && (parent.roles.includes('admin') || parent.roles.includes('planner')) && (
                             <span className={`text-[8px] font-bold px-1 py-0.5 rounded border leading-none mr-0.5 ${
                                parent.roles.includes('admin') && parent.roles.includes('planner') ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                                parent.roles.includes('admin') ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                                'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                             }`}>
                                {parent.roles.includes('admin') && parent.roles.includes('planner') ? 'AP' : parent.roles.includes('admin') ? 'A' : 'P'}
                             </span>
                          )}
                          
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
      <Card className="p-4 bg-gray-50 border-gray-200 dark:bg-slate-800/30 dark:border-slate-800">
        <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
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
                  className="p-2 flex items-center justify-between text-left hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-slate-900/50 dark:border-slate-700" 
                  onClick={() => {
                    setSelectedMember(m);
                    setIsDrawerOpen(true);
                  }}
                >
                  {/* Left: Server Info */}
                  <div className="flex-1 min-w-0 mr-1">
                    <p className="font-semibold text-gray-500 dark:text-gray-400 text-sm truncate flex items-center gap-1">
                        {m.name_kor}
                        {isSuperAdmin && (
                        <span 
                              onClick={(e) => handleCopyId(e, m.id)}
                              className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1 rounded cursor-copy hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700"
                              title="ID 복사"
                         >S</span>
                         )}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {m.baptismal_name} · {m.grade} {m.start_year && `· ${m.start_year}년`}
                    </p>
                  </div>
                  
                  {/* Right: Parent Info */}
                  {/* Right: Parent Info & Action */}
                  <div className="text-right shrink-0 max-w-[40%] flex flex-col items-end gap-0.5">
                    {parent ? (
                        <p className="text-[10px] text-gray-400 font-medium truncate flex items-center justify-end gap-1">
                          <span className="text-gray-300 mr-1 hidden sm:inline">신청:</span>
                          <span className="text-gray-300 mr-1 sm:hidden">부:</span>
                          
                          {/* Role Badge */}
                          {parent.roles && (parent.roles.includes('admin') || parent.roles.includes('planner')) && (
                             <span className={`text-[8px] font-bold px-1 py-0.5 rounded border leading-none mr-0.5 ${
                                parent.roles.includes('admin') && parent.roles.includes('planner') ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                                parent.roles.includes('admin') ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                                'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                             }`}>
                                {parent.roles.includes('admin') && parent.roles.includes('planner') ? 'AP' : parent.roles.includes('admin') ? 'A' : 'P'}
                             </span>
                          )}

                          {parent.user_name}
                        </p>
                    ) : (
                        <span className="text-[10px] text-gray-300">정보없음</span>
                    )}
                    
                    {dateStr && (
                        <p className="text-[9px] text-gray-300 mb-1">
                          {dateStr}
                        </p>
                    )}

                    <Button
                        variant="destructive" 
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={(e) => {
                             e.stopPropagation();
                             handleDelete(m.id);
                        }}
                    >
                        삭제
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <hr className="my-8 border-dashed border-gray-300 dark:border-gray-700" />

      {/* ✅ 일괄 변경 (Bulk Actions) */}
      <Card className="p-4 bg-orange-50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30">
        <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-orange-200">일괄 변경</h2>
        <div className="flex gap-2">
           <Button 
             className="bg-orange-500 hover:bg-orange-600 text-white"
             disabled={loading || (activeMembers.length === 0 && inactiveMembers.length === 0)}
             onClick={async () => {
               const activeCount = activeMembers.length;
               const inactiveCount = inactiveMembers.length;
               
               const ok = await openConfirm({
                 title: '일괄 학년 진급',
                 message: `활동단원 ${activeCount}명과 비활동단원 ${inactiveCount}명 전체를 한 학년씩 올리겠습니까? (고3 학년인 경우 변경되지 않습니다.)`,
                 confirmText: '실행',
                 cancelText: '취소',
               });

               if (ok && serverGroupId) {
                 try {
                   setIsSaving(true);
                   const batch = writeBatch(db);
                   let updateCount = 0;

                   const allTargets = [...activeMembers, ...inactiveMembers];
                   const auth = getAuth();
                   const currentUser = auth.currentUser;
                   const editorName = currentUser?.displayName || '관리자';
                   
                   allTargets.forEach(m => {
                     const currentIdx = ALL_GRADES.indexOf(m.grade);
                     // If found and not the last one, bump it up
                     if (currentIdx !== -1 && currentIdx < ALL_GRADES.length - 1) {
                        const nextGrade = ALL_GRADES[currentIdx + 1];
                        const ref = doc(db, 'server_groups', serverGroupId, 'members', m.id);
                        
                        const newLog: HistoryLog = {
                            date: Timestamp.now(),
                            action: '일괄 학년 진급',
                            changes: [`학년: ${m.grade} -> ${nextGrade}`],
                            editor: editorName
                        };

                        batch.update(ref, { 
                            grade: nextGrade, 
                            updated_at: new Date(),
                            history_logs: arrayUnion(newLog)
                        });
                        updateCount++;
                     }
                   });

                   if (updateCount > 0) {
                     await batch.commit();
                     toast.success(`총 ${updateCount}명의 학년을 변경했습니다.`);
                   } else {
                     toast.info('변경할 대상이 없거나 모두 최고 학년입니다.');
                   }
                 } catch (e) {
                   console.error(e);
                   toast.error('일괄 변경 중 오류가 발생했습니다.');
                 } finally {
                   setIsSaving(false);
                 }
               }
             }}
           >
             +1 학년 진급
           </Button>

           <Button
               variant="outline"
               className="border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/30"
               onClick={() => setIsMoveDrawerOpen(true)}
               disabled={activeMembers.length === 0 && inactiveMembers.length === 0}
           >
               복사단 이동(복제)
           </Button>
        </div>
      </Card>

       {/* ✅ Move Members Drawer */}
      <MoveMembersDrawer 
         open={isMoveDrawerOpen} 
         onOpenChange={setIsMoveDrawerOpen}
         currentServerGroupId={serverGroupId || ''}
         members={[...activeMembers, ...inactiveMembers]}
         parentInfos={parentInfos}
      />

      {/* ✅ [New] 전배/복제 이력 (Transfer/Copy History) */}
      <Card className="p-4 bg-gray-50/50 border-gray-100 dark:bg-slate-800/10 dark:border-slate-800 mt-8">
             <div className="flex items-center gap-2 mb-3">
                 <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                     전배/복제 이력 <span className="text-sm font-normal">({movedMembers.length}건)</span>
                 </h2>
             </div>
             
             {movedMembers.length === 0 ? (
                 <p className="text-gray-400 text-sm">이력이 없습니다.</p>
             ) : (
                 <div className="space-y-2">
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {movedMembers.slice(0, showMoved ? undefined : 3).map((m, idx) => {
                          const isMoved = m.is_moved;
                          const isCopied = !isMoved && !!m.copied_to_sg_id;
                          
                          let dateStr = '-';
                          let byName = '';
                          let targetSgId = '';
                          
                          if (isMoved) {
                              if (m.moved_at?.toDate) dateStr = dayjs(m.moved_at.toDate()).format('YY.MM.DD');
                              byName = m.moved_by_name || '관리자';
                              targetSgId = m.moved_to_sg_id || '';
                          } else if (isCopied) {
                              if (m.copied_at?.toDate) dateStr = dayjs(m.copied_at.toDate()).format('YY.MM.DD');
                              byName = m.copied_by_name || '관리자';
                              targetSgId = m.copied_to_sg_id || '';
                          }
                          
                          return (
                              <div key={m.id} className={`flex flex-col justify-center text-xs bg-white dark:bg-slate-900 border rounded shadow-sm p-3 relative overflow-hidden ${isMoved ? 'border-orange-100 dark:border-orange-900/30' : 'border-blue-100 dark:border-blue-900/30'}`}>
                                  {/* Type Badge */}
                                  <div className={`absolute top-0 right-0 px-1.5 py-0.5 text-[9px] font-bold rounded-bl-md ${
                                      isMoved 
                                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
                                        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                  }`}>
                                      {isMoved ? '전배' : '복제'}
                                  </div>

                                  <div className="flex items-center justify-between mb-1 mt-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                          <span className="font-bold text-gray-700 dark:text-gray-300 shrink-0 flex items-center gap-1">
                                             {m.name_kor}
                                             {isSuperAdmin && (
                                             <span 
                                                 onClick={(e) => handleCopyId(e, m.id)}
                                                 className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1 rounded cursor-copy hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700"
                                                 title="ID 복사"
                                             >S</span>
                                             )}
                                           </span>
                                           <span className="text-gray-400 truncate text-[10px]">
                                              ({m.baptismal_name}) · {m.grade}
                                          </span>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                                      <span className="flex items-center gap-1">
                                          To. <span className="font-medium text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title={targetSgId}>{targetSgId}</span>
                                      </span>
                                      <span className="text-[9px]">
                                          {dateStr}
                                      </span>
                                  </div>
                              </div>
                          );
                      })}
                     </div>

                     {movedMembers.length > 3 && (
                         <button 
                            onClick={() => setShowMoved(!showMoved)}
                            className="w-full mt-2 py-1.5 flex items-center justify-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50/50 hover:bg-gray-100 dark:bg-slate-800/20 dark:hover:bg-slate-800 rounded transition-colors"
                         >
                            {showMoved ? (
                                <>접기 <ChevronLeft className="rotate-90" size={12} /></>
                            ) : (
                                <>더보기 ({movedMembers.length - 3}건) <ChevronRight className="rotate-90" size={12} /></>
                            )}
                         </button>
                     )}
                 </div>
             )}
      </Card>

      {/* ✅ [New] 삭제된 복사단원 (Deleted Members) */}
      <Card className="p-4 bg-gray-50/50 border-gray-100 dark:bg-slate-800/10 dark:border-slate-800 mt-8 mb-20 opacity-80 hover:opacity-100 transition-opacity">
             <div className="flex items-center gap-2 mb-3">
                 <h2 className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                     삭제된 복사단원 <span className="text-sm font-normal">({deletedMembers.length}명)</span>
                 </h2>
             </div>
             
             {deletedMembers.length === 0 ? (
                 <p className="text-gray-400 text-sm">삭제된 단원이 없습니다.</p>
             ) : (
                 <div className="space-y-2">
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                     {deletedMembers.map((m: any) => {
                         let delDateStr = '-';
                         if (m.deleted_at?.toDate) {
                             delDateStr = dayjs(m.deleted_at.toDate()).format('YY.MM.DD');
                         }
                         
                         return (
                             <div key={m.id} className="flex flex-col justify-center text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-2 rounded shadow-sm opacity-70 hover:opacity-100 transition-opacity">
                                 <div className="flex items-center justify-between mb-1">
                                     <div className="flex items-center gap-1 min-w-0">
                                         <span className="font-bold text-gray-500 dark:text-gray-400 shrink-0 line-through flex items-center gap-1">
                                            {m.name_kor}
                                            {isSuperAdmin && (
                                            <span 
                                                onClick={(e) => handleCopyId(e, m.id)}
                                                className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1 rounded cursor-copy hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 no-underline"
                                                title="ID 복사"
                                            >S</span>
                                            )}
                                          </span>
                                          <span className="text-gray-400 truncate text-[10px]">
                                             ({m.baptismal_name})
                                         </span>
                                     </div>
                                     <div className="flex flex-col items-end">
                                         <span className="text-[9px] text-gray-400">
                                           Del by {m.deleted_by_name?.split(' ')[0] || '관리자'} <span className="text-[10px] text-gray-500">{delDateStr}</span>
                                         </span>
                                     </div>
                                 </div>
                                 <div className="flex items-center justify-end gap-2 text-[10px] text-gray-500 mt-1">
                                     <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-5 text-[10px] px-1.5 py-0"
                                        onClick={() => handleRestore(m.id, m)}
                                     >
                                        복구
                                     </Button>
                                 </div>
                             </div>
                         );
                     })}
                     </div>
                 </div>
             )}
      </Card>

      {/* ✅ Member Detail Sheet */}
      <Sheet open={isDrawerOpen} onOpenChange={(open) => {
        if (!open) handleCloseDrawer();
        else setIsDrawerOpen(true);
      }}>
        <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-xl font-bold flex flex-col gap-2 dark:text-gray-100">

                 {isEditingName ? (
                   <div className="flex items-center gap-2 w-full">
                      <input 
                          className="w-20 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-lg font-bold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 text-center"
                          value={editNameKor}
                          onChange={(e) => setEditNameKor(e.target.value)}
                          placeholder="이름"
                          autoFocus
                      />
                      <input 
                          className="w-28 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-base font-normal text-gray-500 dark:text-gray-400 placeholder:text-gray-400"
                          value={editBaptismalName}
                          onChange={(e) => setEditBaptismalName(e.target.value)}
                          placeholder="세례명"
                      />
                      <button onClick={() => setIsEditingName(false)} className="shrink-0 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">완료</button>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2">
                     <span>{selectedMember?.name_kor}</span>
                     <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                       ({selectedMember?.baptismal_name})
                     </span>
                     <button 
                       onClick={() => setIsEditingName(true)}
                       className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                     >
                       <Pencil size={14} />
                     </button>
                     {isSuperAdmin && selectedMember && (
                       <span 
                           onClick={(e) => handleCopyId(e, selectedMember.id)}
                           className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1 rounded cursor-copy hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 ml-1"
                           title="ID 복사"
                       >S</span>
                     )}
                   </div>
                 )}
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-6 pt-0">
               {/* 1. 복사단원 상세 정보 */}
               <div className="space-y-3 text-sm">
                 <h4 className="font-bold text-gray-900 dark:text-gray-100 border-l-4 border-blue-500 pl-2 text-sm mb-3">
                    복사단원 상세 정보
                 </h4>
                 {/* 학년 정보 (Dropdown) */}
                 <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-800 pb-2">
                   <span className="font-medium text-gray-500 dark:text-gray-400">학년</span>
                    <Select value={editGrade} onValueChange={setEditGrade} disabled={isSaving}>
                       <SelectTrigger className="w-[80px] h-8 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="z-[9999] dark:bg-gray-800 dark:border-gray-700">
                         {ALL_GRADES.map(g => (
                           <SelectItem key={g} value={g} className="dark:text-gray-200 dark:focus:bg-gray-700">{g}</SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-800 pb-2">
                    <span className="font-medium text-gray-500 dark:text-gray-400">입단년도</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        onClick={() => {
                          const current = parseInt(editStartYear) || new Date().getFullYear();
                          setEditStartYear((current - 1).toString());
                        }}
                        disabled={isSaving}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <input 
                        type="text" 
                        className="w-[50px] text-center border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm dark:bg-transparent dark:text-white"
                        value={editStartYear}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                          setEditStartYear(val);
                        }}
                        placeholder="YYYY"
                        disabled={isSaving}
                      />
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        onClick={() => {
                          const current = parseInt(editStartYear) || new Date().getFullYear();
                          setEditStartYear((current + 1).toString());
                        }}
                        disabled={isSaving}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                 </div>
                 <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-800 pb-2">
                   <span className="font-medium text-gray-500 dark:text-gray-400">상태</span>
                   <div className="flex items-center gap-2">
                      <Switch 
                         checked={editActive} 
                         onCheckedChange={setEditActive} 
                      />
                      <span className={editActive ? "text-green-600 font-bold dark:text-green-400" : "text-gray-600 dark:text-gray-400"}>
                        {editActive ? '활동중' : '비활동'}
                      </span>
                   </div>
                 </div>
               </div>

               {/* 2. 신청자 정보 (Compact) */}
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
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 border-l-4 border-blue-500 pl-2 text-sm">
                            신청자 정보
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-sm space-y-1">
                             <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm">
                               <span className="flex items-center gap-1">
                                    <UserRoleIcon category={pInfo.user_category} size={14} />
                                    {pInfo.roles && (pInfo.roles.includes('admin') || pInfo.roles.includes('planner')) && (
                                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border leading-none ${
                                            pInfo.roles.includes('admin') && pInfo.roles.includes('planner') ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                                            pInfo.roles.includes('admin') ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                                            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                        }`}>
                                            {pInfo.roles.includes('admin') && pInfo.roles.includes('planner') ? 'AP' : pInfo.roles.includes('admin') ? 'A' : 'P'}
                                        </span>
                                    )}
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{pInfo.user_name}</span>
                                </span>
                               {pInfo.baptismal_name && (
                                 <span className="text-gray-600 dark:text-gray-400">({pInfo.baptismal_name})</span>
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

               {/* 3. 복사 배정 현황 */}
               <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 border-l-4 border-blue-500 pl-2 text-sm">
                      복사 배정 현황
                    </h4>
                    <span className="text-[10px] text-gray-400">* 횟수 클릭 시 상세 내역</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                       {/* Left Arrow */}
                       <button onClick={() => {
                         setStatsBaseDate(prev => prev.subtract(1, 'month'));
                         setExpandedMonth(null);
                       }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400">
                           <ChevronLeft size={16} />
                       </button>

                       {/* Stats Grid */}
                       <div className="grid grid-cols-3 gap-2 text-center flex-1">
                           <button 
                             onClick={() => {
                               if (expandedMonth === 'last') {
                                 setExpandedMonth(null);
                               } else {
                                 setExpandedMonth('last');
                                 if (selectedMember) fetchAssignmentDetails(selectedMember.id, 'last');
                               }
                             }}
                             className={cn(
                               "flex flex-col hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors",
                               expandedMonth === 'last' && "bg-gray-100 dark:bg-gray-700 ring-1 ring-blue-200 dark:ring-blue-800"
                             )}
                           >
                              <span className="text-xs font-bold text-gray-500 mb-1">{statsBaseDate.subtract(1, 'month').format('YY년 M월')}</span>
                              <span className="font-bold text-lg dark:text-gray-200">{assignmentStats.lastMonth}회</span>
                           </button>
                           <button 
                             onClick={() => {
                               if (expandedMonth === 'this') {
                                 setExpandedMonth(null);
                               } else {
                                 setExpandedMonth('this');
                                 if (selectedMember) fetchAssignmentDetails(selectedMember.id, 'this');
                               }
                             }}
                             className={cn(
                               "flex flex-col border-x border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors",
                               expandedMonth === 'this' && "bg-gray-100 dark:bg-gray-700 ring-1 ring-blue-200 dark:ring-blue-800"
                             )}
                           >
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">{statsBaseDate.format('YY년 M월')}</span>
                              <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{assignmentStats.thisMonth}회</span>
                           </button>
                           <button 
                             onClick={() => {
                               if (expandedMonth === 'next') {
                                 setExpandedMonth(null);
                               } else {
                                 setExpandedMonth('next');
                                 if (selectedMember) fetchAssignmentDetails(selectedMember.id, 'next');
                               }
                             }}
                             className={cn(
                               "flex flex-col hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors",
                               expandedMonth === 'next' && "bg-gray-100 dark:bg-gray-700 ring-1 ring-blue-200 dark:ring-blue-800"
                             )}
                           >
                              <span className="text-xs font-bold text-gray-500 mb-1">{statsBaseDate.add(1, 'month').format('YY년 M월')}</span>
                              <span className="font-bold text-lg dark:text-gray-200">{assignmentStats.nextMonth}회</span>
                           </button>
                       </div>

                       {/* Right Arrow */}
                       <button onClick={() => {
                         setStatsBaseDate(prev => prev.add(1, 'month'));
                         setExpandedMonth(null);
                       }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400">
                           <ChevronRight size={16} />
                       </button>
                   </div>
                   
                   {/* Assignment Details */}
                   {expandedMonth && (
                     <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-1 animate-in slide-in-from-top-2 fade-in mt-2">
                       {assignmentDetails.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">배정 내역이 없습니다.</p>
                       ) : (
                           assignmentDetails.map((detail, idx) => (
                             <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 py-1">
                               <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                               <span className="font-medium min-w-[70px]">{detail.date}</span>
                               <span className="text-gray-300">|</span>
                               <span className="truncate">{detail.title}</span>
                             </div>
                           ))
                       )}
                     </div>
                   )}
                </div>
            </div>
            <SheetFooter className="flex-row gap-2 mt-6">
              <Button variant="secondary" className="flex-1" onClick={handleCloseDrawer}>닫기</Button>
              <Button className="flex-1" onClick={handleSaveStatus} disabled={isSaving || !hasChanges}>
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </SheetFooter>

            {/* ✅ History Logs Section */}
            <div className="pt-6 pb-12 px-1">
               <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                   변경 이력
                   <span className="text-xs font-normal text-gray-400">({selectedMember?.history_logs?.length || 0})</span>
               </h4>
               <div className="space-y-3 relative">
                   {/* Timeline Line */}
                   <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-gray-200 dark:bg-gray-800"></div>

                   {(() => {
                       const logs = [...(selectedMember?.history_logs || [])];
                       // Sort by date DESC
                       logs.sort((a, b) => {
                           const tA = a.date?.toDate ? a.date.toDate().getTime() : 0;
                           const tB = b.date?.toDate ? b.date.toDate().getTime() : 0;
                           return tB - tA;
                       });
                       
                       const visibleLogs = showAllLogs ? logs : logs.slice(0, 3);
                       
                       if (logs.length === 0) {
                           return <p className="text-xs text-gray-400 pl-4">이력이 없습니다.</p>;
                       }

                       return (
                           <>
                               {visibleLogs.map((log, idx) => {
                                   const logDate = log.date?.toDate ? dayjs(log.date.toDate()).format('YY.MM.DD HH:mm') : '-';
                                   return (
                                       <div key={idx} className="relative pl-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded transition-colors group">
                                           {/* Dot */}
                                           <div className="absolute left-0 top-3.5 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-slate-900 group-hover:bg-blue-400 group-hover:border-blue-100 dark:group-hover:border-slate-700 transition-colors"></div>
                                           
                                           <div className="flex flex-col gap-0.5">
                                               <div className="flex items-center justify-between">
                                                   <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{log.action}</span>
                                                   <span className="text-[10px] text-gray-400">
                                                        by {log.editor} <span className="ml-1">{logDate}</span>
                                                   </span>
                                               </div>
                                               <div className="text-[11px] text-gray-600 dark:text-gray-400">
                                                   {log.changes.map((c, cIdx) => (
                                                       <div key={cIdx}>{c}</div>
                                                   ))}
                                               </div>
                                           </div>
                                       </div>
                                   );
                               })}

                               {logs.length > 3 && (
                                   <button 
                                       onClick={() => setShowAllLogs(!showAllLogs)}
                                       className="w-full flex items-center justify-center py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-slate-800/50 rounded mt-2 z-10 relative"
                                   >
                                       {showAllLogs ? (
                                         <>접기 <ChevronLeft className="rotate-90 ml-1" size={12} /></>
                                       ) : (
                                         <>더보기 ({logs.length - 3}건) <ChevronRight className="rotate-90 ml-1" size={12} /></>
                                       )}
                                   </button>
                               )}
                           </>
                       );
                   })()}
               </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* ✅ Add Server Drawer */}
      <AddServerDrawer 
        open={isAddDrawerOpen} 
        onOpenChange={setIsAddDrawerOpen} 
        serverGroupId={serverGroupId || ''} 
      />
    </div>
  );
}
