// src/components/SendSurveyDrawer.tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/state/session';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import type { MassStatus } from '@/types/firestore';
import { APP_BASE_URL } from '@/lib/env';
import { RefreshCw, ChevronDown, ChevronUp, Bell, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { COLLECTIONS } from '@/lib/collections';
import { callNotificationApi } from '@/lib/notificationApi';
import DrawerHeader from '@/components/common/DrawerHeader';

// ---------- 🔹 Type Definitions ----------
interface NotificationLog {
  type: 'app_push' | 'sms' | 'kakaotalk';
  sent_at: any;
  recipient_count: number;
  status: 'success' | 'partial' | 'failure';
  title?: string;
  body?: string;
}

const ALL_GRADES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3'];

interface MemberDoc {
  id: string;
  name_kor: string;
  baptismal_name?: string;
  grade?: string;
  active: boolean;
  parent_uid?: string;
  created_at?: any;
}

interface AvailabilitySurveyDoc {
  start_date?: any;
  end_date?: any;
  member_ids?: string[];
  status?: 'OPEN' | 'CLOSED';
  created_at?: any;
  updated_at?: any;
  notifications?: NotificationLog[]; // ✅ Added notifications field
  responses?: Record<
    string,
    {
      uid: string;
      unavailable: string[] | Record<string, any>; // Support both new array and old map
      updated_at: any;
    }
  >;
}

interface MassEventDoc {
  id: string;
  title: string;
  event_date: string;
  member_ids?: string[];
}

interface SendSurveyDrawerProps {
  open: boolean;
  onClose: () => void;
  serverGroupId: string;
  currentMonth: string; // YYYYMM
  monthStatus: MassStatus;
  timezone?: string;
}

// ---------- 🔹 Component ----------
export function SendSurveyDrawer({
  open,
  onClose,
  serverGroupId,
  currentMonth,
  monthStatus,
  timezone = 'Asia/Seoul',
}: SendSurveyDrawerProps) {
  const navigate = useNavigate();
  const db = getFirestore();
  const session = useSession();
  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>(dayjs().toDate());
  const [endDate, setEndDate] = useState<Date>(dayjs().add(7, 'day').toDate());
  const [surveyUrl, setSurveyUrl] = useState<string | null>(null);
  const [existingSurvey, setExistingSurvey] = useState<AvailabilitySurveyDoc | null>(null);
  const [massEvents, setMassEvents] = useState<Record<string, MassEventDoc>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null); // For showing details
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<'name' | 'grade'>('name');
  const [isEditingMembers, setIsEditingMembers] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [showExcludedOnly, setShowExcludedOnly] = useState(false);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);
  const [showUnsubmittedOnly, setShowUnsubmittedOnly] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const [allServerMembers, setAllServerMembers] = useState<MemberDoc[]>([]);

  // ---------- 🔹 Load Members & Events (Manual Refresh) ----------
  const fetchBasics = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Load ALL members (active & inactive)
      const membersRef = collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/members`);
      // const q = query(membersRef, where('active', '==', true)); // Fetch all now
      const snap = await getDocs(membersRef);
      const mList: MemberDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MemberDoc, 'id'>),
      }));
      setAllServerMembers(mList);

      // Default view: only active members
      const activeMembers = mList.filter((m) => m.active);
      setMembers(activeMembers);

      // Only set default selection if empty
      setSelectedMembers((prev) => (prev.length === 0 ? activeMembers.map((m) => m.id) : prev));

      // Fetch Mass Events for details
      const startStr = dayjs(currentMonth + '01')
        .startOf('month')
        .format('YYYYMMDD');
      const endStr = dayjs(currentMonth + '01')
        .endOf('month')
        .format('YYYYMMDD');

      const eventsRef = collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/mass_events`);
      const eq = query(
        eventsRef,
        where('event_date', '>=', startStr),
        where('event_date', '<=', endStr)
      );
      const eSnap = await getDocs(eq);
      const eMap: Record<string, MassEventDoc> = {};
      eSnap.forEach((d) => {
        eMap[d.id] = { id: d.id, ...d.data() } as MassEventDoc;
      });
      setMassEvents(eMap);
    } catch (err) {
      console.error('Fetch basics error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [db, serverGroupId, currentMonth]);

  // Sync members view to include any selected members (even if inactive/hidden)
  useEffect(() => {
    if (selectedMembers.length > 0 && allServerMembers.length > 0) {
      setMembers((prev) => {
        const missingIds = selectedMembers.filter((id) => !prev.find((m) => m.id === id));
        if (missingIds.length === 0) return prev;

        const missingDocs = allServerMembers.filter((m) => missingIds.includes(m.id));
        if (missingDocs.length === 0) return prev;

        // Add missing docs to view
        return [...prev, ...missingDocs].sort((a, b) => a.name_kor.localeCompare(b.name_kor, 'ko'));
      });
    }
  }, [selectedMembers, allServerMembers]);

  // ---------- 🔹 Real-time Survey Listener ----------
  useEffect(() => {
    if (!open) return;

    fetchBasics(); // Load static data once

    const surveyRef = doc(
      db,
      `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${currentMonth}`
    );

    const unsub = onSnapshot(
      surveyRef,
      (sSnap) => {
        if (sSnap.exists()) {
          const data = sSnap.data() as AvailabilitySurveyDoc;
          setExistingSurvey(data); // Real-time update
          if (data.status === 'OPEN') {
            setSurveyUrl(`/apps/ordo-altar/survey/${serverGroupId}/${currentMonth}`);
          }
          // Update selected members for editing
          if (data.member_ids) {
            setSelectedMembers(data.member_ids);
          }
          if (data.start_date) setStartDate(data.start_date.toDate());
          if (data.end_date) setEndDate(data.end_date.toDate());
        } else {
          setExistingSurvey(null);
          setSurveyUrl(null);
        }
      },
      (error) => {
        console.error('Survey snapshot error:', error);
      }
    );

    return () => unsub();
  }, [open, serverGroupId, currentMonth, db, fetchBasics]);

  // ---------- 🔹 Manual Notification ----------
  const [isSendingNoti, setIsSendingNoti] = useState(false);

  const handleManualNotification = async () => {
    if (!existingSurvey || !serverGroupId) return;

    // Determine type based on month status (User Rule)
    // - "미사확정(MASS-CONFIRMED)" => "설문시작 알림발송"
    // - "설문확정(SURVEY-CONFIRMED)" => "설문종료 알림발송"
    // - Others => Disabled
    let type = '';
    let confirmMsg = '';

    if (monthStatus === 'MASS-CONFIRMED') {
      type = 'SURVEY_OPENED';
      confirmMsg = '📢 설문 시작 알림을 발송하시겠습니까?';
    } else if (monthStatus === 'SURVEY-CONFIRMED') {
      type = 'SURVEY_CLOSED';
      confirmMsg = '🔒 설문 마감 알림을 발송하시겠습니까?';
    } else {
      toast.error('현재 월 상태에서는 알림을 발송할 수 없습니다.');
      return;
    }

    if (!confirm(confirmMsg)) return;

    try {
      setIsSendingNoti(true);
      const data = await callNotificationApi<any>(functions, {
        action: 'enqueue_survey',
        serverGroupId,
        month: currentMonth,
        type,
      });
      if (data.success) {
        toast.success(`알림이 대기열에 등록되었습니다. (대상: ${data.queued_count ?? 0}명)`);
      } else {
        toast.error(`알림 발송 실패: ${data.message}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`오류 발생: ${e.message}`);
    } finally {
      setIsSendingNoti(false);
    }
  };

  // ---------- 🔹 Create new survey ----------
  const handleStartSurvey = async () => {
    if (monthStatus !== 'MASS-CONFIRMED') {
      toast.error('미사 일정이 확정된 상태에서만 설문을 시작할 수 있습니다.');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('선택된 설문 대상자가 없습니다.');
      return;
    }

    try {
      setIsLoading(true);
      const ref = doc(
        db,
        `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${currentMonth}`
      );

      await setDoc(
        ref,
        {
          start_date: fromLocalDateToFirestore(startDate, timezone),
          end_date: fromLocalDateToFirestore(endDate, timezone),
          member_ids: selectedMembers,
          created_at: serverTimestamp(),
          status: 'OPEN',
          opened_by: session.user?.uid || 'unknown',
          opened_by_name: session.user?.displayName || 'Unknown',
        },
        { merge: true }
      );

      const url = `/apps/ordo-altar/survey/${serverGroupId}/${currentMonth}`;
      setSurveyUrl(url);

      // ✅ 설문 시작 알림 자동 발송
      try {
        const data = await callNotificationApi<any>(functions, {
          action: 'enqueue_survey',
          serverGroupId,
          month: currentMonth,
          type: 'SURVEY_OPENED',
        });
        if (data.success) {
          toast.success('설문이 시작되었습니다.', {
            description: `대상자 ${data.queued_count ?? 0}명에게 알림이 발송되었습니다.`,
          });
        } else {
          toast.warning('설문은 시작되었으나 알림 발송에 실패했습니다.', {
            description: data.message,
          });
        }
      } catch (notiErr: any) {
        console.error('Auto-notification error:', notiErr);
        toast.warning('설문은 시작되었으나 알림 발송 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Firestore setDoc error:', err);
      toast.error('Firestore 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- 🔹 Copy URL ----------
  const handleCopy = async () => {
    if (!surveyUrl) return;
    try {
      const fullUrl = surveyUrl.startsWith('/')
        ? `${window.location.origin}${surveyUrl}`
        : surveyUrl;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('설문 링크가 복사되었습니다.');
    } catch {
      toast.error('URL 복사에 실패했습니다.');
    }
  };

  // ---------- 🔹 Member selection toggle ----------
  const handleToggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // ---------- 🔹 Update Members ----------
  const handleUpdateMembers = async () => {
    if (!existingSurvey) return;
    try {
      setIsLoading(true);
      const ref = doc(
        db,
        `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${currentMonth}`
      );
      await setDoc(ref, { member_ids: selectedMembers }, { merge: true });
      toast.success('설문 대상자가 수정되었습니다.');
      setIsEditingMembers(false);
    } catch (e) {
      console.error(e);
      toast.error('설문 대상자 수정 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- 🔹 Update Dates ----------
  const handleUpdateDates = async () => {
    if (!existingSurvey) return;
    try {
      setIsLoading(true);
      const ref = doc(
        db,
        `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${currentMonth}`
      );

      await setDoc(
        ref,
        {
          start_date: fromLocalDateToFirestore(startDate, timezone),
          end_date: fromLocalDateToFirestore(endDate, timezone),
        },
        { merge: true }
      );

      toast.success('설문 기간이 수정되었습니다.');
      setIsEditingDates(false);
    } catch (e) {
      console.error(e);
      toast.error('설문 기간 수정 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- 🔹 Render ----------
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          hideClose
          className="max-w-md w-full h-full p-0 flex flex-col overflow-hidden bg-white dark:bg-gray-800"
        >
          <DialogTitle className="sr-only">복사 일정 설문</DialogTitle>
          <DialogDescription className="sr-only">설정 및 알림 발송</DialogDescription>

          {/* ✅ Standardized Premium Header */}
          <DrawerHeader
            title={`📩 복사 일정 설문 (${dayjs(currentMonth, 'YYYYMM').format('YYYY년 MM월')})`}
            subtitle="이번 달 확정된 미사 일정에 대해 복사들의 참석 불가 여부를 조사합니다."
            onClose={onClose}
          />

          {/* ✅ Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* ✅ 기존 설문 존재 시 안내 */}
            {existingSurvey && (
              <div className="space-y-4">
                <div
                  className={`border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-colors ${
                    existingSurvey.status === 'OPEN'
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  }`}
                >
                  {/* Date Range */}
                  {/* Date Range or Edit Form */}
                  {isEditingDates ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={dayjs(startDate).format('YYYY-MM-DD')}
                          onChange={(e) => setStartDate(new Date(e.target.value))}
                          className="h-8 text-xs"
                        />
                        <span className="self-center date-range-separator">~</span>
                        <Input
                          type="date"
                          value={dayjs(endDate).format('YYYY-MM-DD')}
                          onChange={(e) => setEndDate(new Date(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingDates(false);
                            if (existingSurvey.start_date)
                              setStartDate(existingSurvey.start_date.toDate());
                            if (existingSurvey.end_date)
                              setEndDate(existingSurvey.end_date.toDate());
                          }}
                          className="h-6 text-xs"
                        >
                          취소
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateDates}
                          disabled={isLoading}
                          className="h-6 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0"
                        >
                          저장
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        설문 기간
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {dayjs(existingSurvey.start_date?.toDate()).format('M/D')} ~{' '}
                          {dayjs(existingSurvey.end_date?.toDate()).format('M/D')}
                        </span>
                        {existingSurvey.status === 'OPEN' && (
                          <button
                            onClick={() => setIsEditingDates(true)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      설문 상태
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${existingSurvey.status === 'OPEN' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}
                      >
                        {existingSurvey.status === 'OPEN' ? 'OPEN (진행중)' : 'CLOSED (마감됨)'}
                      </span>
                      <Switch
                        checked={existingSurvey.status === 'OPEN'}
                        disabled={monthStatus !== 'MASS-CONFIRMED'}
                        onCheckedChange={async (checked) => {
                          try {
                            const newStatus = checked ? 'OPEN' : 'CLOSED';
                            const ref = doc(
                              db,
                              `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${currentMonth}`
                            );
                            await setDoc(ref, { status: newStatus }, { merge: true });
                            toast.success(`설문 상태가 ${newStatus}로 변경되었습니다.`);
                          } catch (e) {
                            console.error(e);
                            toast.error('상태 변경 실패');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Edit Members Mode or View Mode */}
                {isEditingMembers ? (
                  <div className="space-y-4 border rounded-xl p-4 bg-white dark:bg-slate-900/50 shadow-sm dark:border-slate-700">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 dark:text-gray-200">
                        설문 대상자 수정
                      </h3>
                      <div className="flex gap-2">
                        {/* ✅ Add Member Button */}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingMembers(false);
                            if (existingSurvey.member_ids)
                              setSelectedMembers(existingSurvey.member_ids);
                          }}
                        >
                          취소
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleUpdateMembers}
                          disabled={isLoading}
                        >
                          저장
                        </Button>
                      </div>
                    </div>

                    {/* Reuse Member List Logic (Sort Toggle for New Survey Mode - Editing Members) */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-0.5 rounded-lg text-xs font-medium">
                          <button
                            onClick={() => setSortOrder('name')}
                            className={cn(
                              'px-2.5 py-1 rounded-md transition-all',
                              sortOrder === 'name'
                                ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            )}
                          >
                            이름
                          </button>
                          <button
                            onClick={() => setSortOrder('grade')}
                            className={cn(
                              'px-2.5 py-1 rounded-md transition-all',
                              sortOrder === 'grade'
                                ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            )}
                          >
                            학년
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                          <input
                            type="checkbox"
                            id="show-unchecked-edit"
                            checked={showUncheckedOnly}
                            onChange={(e) => setShowUncheckedOnly(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label
                            htmlFor="show-unchecked-edit"
                            className="text-xs text-gray-500 cursor-pointer select-none font-normal"
                          >
                            비대상
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-md max-h-[450px] overflow-y-auto p-2 text-sm dark:border-slate-700">
                      {(() => {
                        let sortedMembers = [...members].sort((a, b) => {
                          if (sortOrder === 'grade') {
                            const idxA = ALL_GRADES.indexOf(a.grade || '');
                            const idxB = ALL_GRADES.indexOf(b.grade || '');
                            if (idxA !== idxB) {
                              if (idxA === -1) return 1;
                              if (idxB === -1) return -1;
                              return idxA - idxB;
                            }
                          }
                          return a.name_kor.localeCompare(b.name_kor, 'ko');
                        });

                        if (showUncheckedOnly) {
                          sortedMembers = sortedMembers.filter(
                            (m) => !selectedMembers.includes(m.id)
                          );
                        }

                        return sortedMembers.map((m, idx) => {
                          const prev = sortedMembers[idx - 1];
                          const showSeparator =
                            sortOrder === 'grade' && (!prev || prev.grade !== m.grade) && m.grade;

                          return (
                            <div key={m.id}>
                              {showSeparator && (
                                <div className="border-t border-dashed border-gray-300 dark:border-slate-700 my-3 relative h-4">
                                  <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 text-[10px] text-gray-400 dark:text-slate-400 font-bold shadow-sm">
                                    {m.grade}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded px-1 transition-colors">
                                <input
                                  type="checkbox"
                                  className="cursor-pointer"
                                  id={`edit-check-${m.id}`}
                                  checked={selectedMembers.includes(m.id)}
                                  onChange={() => handleToggleMember(m.id)}
                                />
                                <label
                                  htmlFor={`edit-check-${m.id}`}
                                  className="flex-1 cursor-pointer flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="dark:text-gray-200">{m.name_kor}</span>
                                    {(!m.active || !m.parent_uid) && (
                                      <span
                                        className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1 py-0.5 rounded flex items-center gap-0.5 ml-1"
                                        title={!m.active ? '비활성 상태' : '부모(보호자) 연동 정보 없음'}
                                      >
                                        <AlertCircle size={10} />
                                        확인필요
                                      </span>
                                    )}
                                    {m.baptismal_name && (
                                      <span className="text-gray-500 dark:text-gray-400 text-xs ml-0.5">
                                        ({m.baptismal_name})
                                      </span>
                                    )}
                                    {m.grade && (
                                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
                                        {m.grade}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {m.created_at && (
                                      <span className="text-[10px] text-gray-300 dark:text-slate-600">
                                        {dayjs(
                                          m.created_at?.toDate
                                            ? m.created_at.toDate()
                                            : m.created_at
                                        ).format('YY.MM.DD HH:mm')}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Submission Statistics */}
                    {(() => {
                      const targetMembers = members.filter((m) =>
                        existingSurvey.member_ids?.includes(m.id)
                      );
                      const submittedCount = targetMembers.filter(
                        (m) => existingSurvey.responses?.[m.id]
                      ).length;
                      const notSubmittedCount = targetMembers.length - submittedCount;

                      return (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium dark:text-gray-200">제출:</span>
                              <span className="text-green-600 dark:text-green-400 font-bold">
                                {submittedCount}명
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium dark:text-gray-200">미제출:</span>
                              <span className="text-gray-500 dark:text-gray-400 font-bold">
                                {notSubmittedCount}명
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {existingSurvey.status === 'OPEN' && (
                              <Button variant="unit" onClick={() => setIsEditingMembers(true)}>
                                대상자 수정
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={fetchBasics}
                              disabled={isRefreshing}
                              className="h-6 w-6 p-0 rounded-full hover:bg-gray-100"
                              title="데이터 새로고침"
                            >
                              <RefreshCw
                                size={14}
                                className={cn(
                                  isRefreshing ? 'animate-spin' : '',
                                  'text-gray-500 dark:text-gray-400'
                                )}
                              />
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 정렬 탭 (Segmented Control) - Added here for existing survey view */}
                    <div className="flex justify-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-0.5 rounded-lg text-xs font-medium">
                          <button
                            onClick={() => setSortOrder('name')}
                            className={cn(
                              'px-2.5 py-1 rounded-md transition-all',
                              sortOrder === 'name'
                                ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            )}
                          >
                            이름
                          </button>
                          <button
                            onClick={() => setSortOrder('grade')}
                            className={cn(
                              'px-2.5 py-1 rounded-md transition-all',
                              sortOrder === 'grade'
                                ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            )}
                          >
                            학년
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                          <input
                            type="checkbox"
                            id="show-unsubmitted"
                            checked={showUnsubmittedOnly}
                            onChange={(e) => setShowUnsubmittedOnly(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label
                            htmlFor="show-unsubmitted"
                            className="text-xs text-gray-500 cursor-pointer select-none font-normal"
                          >
                            미제출만 보기
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Members Status List */}
                    <div className="border rounded-md max-h-[450px] overflow-y-auto dark:border-slate-700">
                      {(() => {
                        let filteredMembers = members.filter((m) =>
                          existingSurvey.member_ids?.includes(m.id)
                        );

                        if (showUnsubmittedOnly) {
                          filteredMembers = filteredMembers.filter(
                            (m) => !existingSurvey.responses?.[m.id]
                          );
                        }

                        const sorted = filteredMembers.sort((a, b) => {
                          if (sortOrder === 'grade') {
                            const idxA = ALL_GRADES.indexOf(a.grade || '');
                            const idxB = ALL_GRADES.indexOf(b.grade || '');

                            if (idxA !== idxB) {
                              if (idxA === -1) return 1;
                              if (idxB === -1) return -1;
                              return idxA - idxB;
                            }
                          }
                          return a.name_kor.localeCompare(b.name_kor, 'ko');
                        });

                        return sorted.map((m, idx) => {
                          const prev = sorted[idx - 1];
                          const showSeparator =
                            sortOrder === 'grade' && (!prev || prev.grade !== m.grade) && m.grade;
                          const response = existingSurvey.responses?.[m.id];
                          const isSubmitted = !!response;
                          const isExpanded = expandedMemberId === m.id;

                          // Helper to get unavailable event IDs safely
                          let unavailableIds: string[] = [];
                          if (response?.unavailable) {
                            if (Array.isArray(response.unavailable)) {
                              unavailableIds = response.unavailable;
                            } else {
                              unavailableIds = Object.keys(response.unavailable);
                            }
                          }
                          const unavailableCount = unavailableIds.length;

                          // Calculate assigned count from massEvents (loaded via fetchBasics)
                          const assignedCount = Object.values(massEvents).filter((ev) =>
                            ev.member_ids?.includes(m.id)
                          ).length;

                          return (
                            <div key={m.id} className="border-b last:border-b-0">
                              {showSeparator && (
                                <div className="border-t border-dashed border-gray-300 my-2 relative h-4">
                                  <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-gray-400 font-medium">
                                    {m.grade}
                                  </span>
                                </div>
                              )}
                              <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors h-11"
                                onClick={() =>
                                  isSubmitted && setExpandedMemberId(isExpanded ? null : m.id)
                                }
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="font-semibold text-[15px] dark:text-gray-100">
                                      {m.name_kor}
                                    </span>
                                    {(!m.active || !m.parent_uid) && (
                                      <span
                                        className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1 py-0.5 rounded flex items-center gap-0.5 ml-0.5"
                                        title={!m.active ? '비활성 상태' : '부모(보호자) 연동 정보 없음'}
                                      >
                                        <AlertCircle size={10} />
                                        확인필요
                                      </span>
                                    )}
                                    {m.baptismal_name && (
                                      <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
                                        ({m.baptismal_name})
                                      </span>
                                    )}
                                    {m.grade && (
                                      <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">
                                        {m.grade}
                                      </span>
                                    )}
                                  </div>

                                  {assignedCount > 0 && (
                                    <span className="shrink-0 text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium border border-indigo-100 dark:border-indigo-800/50">
                                      배정 {assignedCount}
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0 ml-2">
                                  {isSubmitted ? (
                                    <span
                                      className={cn(
                                        'text-xs px-2.5 py-1 rounded-md font-medium border transition-colors',
                                        unavailableCount > 0
                                          ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                                      )}
                                    >
                                      {unavailableCount > 0
                                        ? `불참 ${unavailableCount}`
                                        : '전일가능'}
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-gray-50 text-gray-400 border border-gray-100 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50 px-2.5 py-1 rounded-md">
                                      미제출
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                    title="설문 수정/제출"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Using navigate to keep drawer context and preserve auth state (especially inside iframes).
                                      navigate(`/survey/${serverGroupId}/${currentMonth}?uid=${m.id}`);
                                      onClose();
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                      <path d="m15 5 4 4" />
                                    </svg>
                                  </Button>
                                </div>
                              </div>

                              {/* Detail Expansion */}
                              {isExpanded && isSubmitted && (
                                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 text-sm border-t dark:border-slate-800">
                                  <p className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                    참석 불가능한 일정:
                                  </p>
                                  {unavailableIds.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400">
                                      없음 (모두 참석 가능)
                                    </p>
                                  ) : (
                                    <div className="space-y-1">
                                      {(() => {
                                        // 1. Event 객체 매핑 및 정렬
                                        const events = unavailableIds
                                          .map((id) => massEvents[id])
                                          .filter((e) => !!e)
                                          .sort((a, b) => a.event_date.localeCompare(b.event_date)); // YYYYMMDD string sort

                                        // 2. 날짜별 그룹핑
                                        const grouped: Record<string, typeof events> = {};
                                        events.forEach((ev) => {
                                          if (!grouped[ev.event_date]) grouped[ev.event_date] = [];
                                          grouped[ev.event_date].push(ev);
                                        });

                                        // 3. 렌더링 (주 단위 구분선 추가)
                                        const dates = Object.keys(grouped).sort();
                                        let lastWeek = -1;

                                        return dates.map((dateStr, idx) => {
                                          const dayDate = dayjs(dateStr);
                                          const currentWeek = dayDate.week();
                                          const showDivider =
                                            idx > 0 && lastWeek !== -1 && currentWeek !== lastWeek;
                                          lastWeek = currentWeek;

                                          const groupEvents = grouped[dateStr];
                                          // 같은 날짜 내에서는 title 순 정렬 (오전/오후 등)
                                          groupEvents.sort((a, b) =>
                                            a.title.localeCompare(b.title)
                                          );

                                          return (
                                            <div key={dateStr}>
                                              {/* 주 구분선 (토요일이 지나고 일요일이 될때, 혹은 주가 바뀔때) */}
                                              {showDivider && (
                                                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />
                                              )}

                                              <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                                {/* 날짜 라벨 (고정 너비) */}
                                                <span className="text-[11px] font-medium min-w-[60px] pt-0.5">
                                                  • {dayDate.format('M/D(ddd)')}
                                                </span>

                                                {/* 해당 날짜의 일정들 (가로 배치) */}
                                                <div className="flex flex-wrap gap-1.5">
                                                  {groupEvents.map((ev) => (
                                                    <span
                                                      key={ev.id}
                                                      className="text-xs bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300"
                                                    >
                                                      {ev.title}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}

                {/* ✅ 알림 발송 이력 */}
                <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1">
                        <Bell size={14} className="text-gray-500" /> 알림 발송 이력
                      </span>
                    </div>
                    <Button
                      variant="unit"
                      onClick={handleManualNotification}
                      disabled={
                        isSendingNoti ||
                        (monthStatus !== 'MASS-CONFIRMED' && monthStatus !== 'SURVEY-CONFIRMED')
                      }
                    >
                      {isSendingNoti
                        ? '발송 중...'
                        : monthStatus === 'MASS-CONFIRMED'
                          ? '📣 설문시작 알림발송'
                          : monthStatus === 'SURVEY-CONFIRMED'
                            ? '🔒 설문종료 알림발송'
                            : '🔒 알림 발송'}
                    </Button>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700">
                    {!existingSurvey.notifications || existingSurvey.notifications.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        발송된 이력이 없습니다.
                      </p>
                    ) : (
                      <>
                        <div className="divide-y divide-gray-100 dark:divide-slate-800">
                          {(() => {
                            // Sort descending by sent_at
                            const logs = [...existingSurvey.notifications!].sort((a, b) => {
                              // Handle Timestamp or date
                              // @ts-ignore
                              const tA = a.sent_at?.toDate
                                ? a.sent_at.toDate().getTime()
                                : new Date(a.sent_at).getTime();
                              // @ts-ignore
                              const tB = b.sent_at?.toDate
                                ? b.sent_at.toDate().getTime()
                                : new Date(b.sent_at).getTime();
                              return tB - tA;
                            });

                            const displayedLogs = showAllLogs ? logs : logs.slice(0, 3);

                            return displayedLogs.map((log, idx) => {
                              // @ts-ignore
                              const sentDate = log.sent_at?.toDate
                                ? dayjs(log.sent_at.toDate())
                                : dayjs(log.sent_at);

                              return (
                                <div key={idx} className="p-3 text-xs">
                                  <div className="flex justify-between items-start mb-1">
                                    <span
                                      className={`font-bold ${log.status === 'success' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}
                                    >
                                      {log.title || '알림'}
                                    </span>
                                    <span className="text-gray-400">
                                      {sentDate.format('MM.DD HH:mm')}
                                    </span>
                                  </div>
                                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                                    {log.body}
                                  </p>
                                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                                    <span>발송대상: {log.recipient_count}명</span>
                                    <span>{log.type === 'app_push' ? '앱푸시' : log.type}</span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {existingSurvey.notifications.length > 3 && (
                          <button
                            onClick={() => setShowAllLogs(!showAllLogs)}
                            className="w-full py-2 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 bg-gray-50/50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors border-t border-gray-100 dark:border-slate-700 rounded-b-lg"
                          >
                            {showAllLogs ? (
                              <>
                                접기 <ChevronUp size={12} />
                              </>
                            ) : (
                              <>
                                더보기 ({existingSurvey.notifications.length - 3}건){' '}
                                <ChevronDown size={12} />
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ✅ 신규 설문만 입력 가능 */}
            {!existingSurvey && (
              <div className="space-y-4 mt-3">
                {/* 날짜 선택 (가로 배치) */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">설문 시작일</label>
                    <Input
                      type="date"
                      value={dayjs(startDate).format('YYYY-MM-DD')}
                      onChange={(e) => setStartDate(new Date(e.target.value))}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">설문 종료일</label>
                    <Input
                      type="date"
                      value={dayjs(endDate).format('YYYY-MM-DD')}
                      onChange={(e) => setEndDate(new Date(e.target.value))}
                    />
                  </div>
                </div>

                {/* 설문 대상자 목록 */}
                <div>
                  <div className="mb-2">
                    {/* Row 1: Title & Toggle */}
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-medium">설문 대상자</label>
                      <button
                        onClick={() => setIsTargetExpanded(!isTargetExpanded)}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        {isTargetExpanded ? (
                          <ChevronUp size={16} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-500" />
                        )}
                      </button>
                    </div>

                    {/* Row 2: Controls */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-normal whitespace-nowrap">
                          (전체 {members.length} / 제외 {members.length - selectedMembers.length})
                        </span>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1">
                          <input
                            type="checkbox"
                            id="show-excluded"
                            checked={showExcludedOnly}
                            onChange={(e) => setShowExcludedOnly(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label
                            htmlFor="show-excluded"
                            className="text-xs text-gray-500 cursor-pointer select-none font-normal"
                          >
                            제외만
                          </label>
                        </div>
                      </div>

                      {/* 정렬 탭 (Segmented Control) */}
                      <div className="flex items-center bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-0.5 rounded-lg text-xs font-medium shrink-0">
                        <button
                          onClick={() => setSortOrder('name')}
                          className={cn(
                            'px-2 py-0.5 rounded-md transition-all text-[11px]',
                            sortOrder === 'name'
                              ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          )}
                        >
                          이름
                        </button>
                        <button
                          onClick={() => setSortOrder('grade')}
                          className={cn(
                            'px-2 py-0.5 rounded-md transition-all text-[11px]',
                            sortOrder === 'grade'
                              ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white font-semibold'
                              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          )}
                        >
                          학년
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'border rounded-md overflow-y-auto p-2 text-sm transition-all duration-300 ease-in-out dark:border-slate-700',
                      isTargetExpanded ? 'max-h-[50vh]' : 'max-h-[450px]'
                    )}
                  >
                    {(() => {
                      let processedMembers = [...members].sort((a, b) => {
                        if (sortOrder === 'grade') {
                          // 학년 정렬 우선: ALL_GRADES 인덱스 비교
                          const idxA = ALL_GRADES.indexOf(a.grade || '');
                          const idxB = ALL_GRADES.indexOf(b.grade || '');

                          if (idxA !== idxB) {
                            // 없는 학년(-1)은 뒤로 보냄
                            if (idxA === -1) return 1;
                            if (idxB === -1) return -1;
                            return idxA - idxB;
                          }
                        }
                        // 이름 정렬 (기본 혹은 학년 같을 때)
                        return a.name_kor.localeCompare(b.name_kor, 'ko');
                      });

                      // 제외만 보기 필터링
                      if (showExcludedOnly) {
                        processedMembers = processedMembers.filter(
                          (m) => !selectedMembers.includes(m.id)
                        );
                      }

                      return processedMembers.map((m, idx) => {
                        const prev = processedMembers[idx - 1];
                        const showSeparator =
                          sortOrder === 'grade' && (!prev || prev.grade !== m.grade) && m.grade;

                        return (
                          <div key={m.id}>
                            {showSeparator && (
                              <div className="border-t border-dashed border-gray-300 dark:border-slate-700 my-3 relative h-4">
                                <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 font-bold shadow-sm">
                                  {m.grade}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded px-1 transition-colors">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                id={`check-${m.id}`}
                                checked={selectedMembers.includes(m.id)}
                                onChange={() => handleToggleMember(m.id)}
                              />
                              <label
                                htmlFor={`check-${m.id}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <div className="flex items-center gap-1">
                                  <span className="dark:text-gray-200">{m.name_kor}</span>
                                  {(!m.active || !m.parent_uid) && (
                                    <span
                                      className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1 py-0.5 rounded flex items-center gap-0.5 ml-1"
                                      title={!m.active ? '비활성 상태' : '부모(보호자) 연동 정보 없음'}
                                    >
                                      <AlertCircle size={10} />
                                      확인필요
                                    </span>
                                  )}
                                  {m.baptismal_name && (
                                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-0.5">
                                      ({m.baptismal_name})
                                    </span>
                                  )}
                                  {m.grade && (
                                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
                                      {m.grade}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {m.created_at && (
                                    <span className="text-[10px] text-gray-300 dark:text-slate-600">
                                      {dayjs(
                                        m.created_at?.toDate ? m.created_at.toDate() : m.created_at
                                      ).format('YY.MM.DD HH:mm')}
                                    </span>
                                  )}
                                </div>
                              </label>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 하단 버튼 (가로 배치) */}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={onClose}>
                    닫기
                  </Button>
                  <Button disabled={isLoading} className="flex-1" onClick={handleStartSurvey}>
                    {isLoading ? '생성 중...' : '설문 시작'}
                  </Button>
                </div>
              </div>
            )}

            {/* ✅ URL 표시 영역 (기존 or 신규) */}
            {surveyUrl && (
              <div className="flex items-center justify-between mt-2 border rounded-md px-3 py-1 bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800">
                <span className="text-sm truncate text-gray-600 dark:text-gray-400">
                  {surveyUrl}
                </span>
                <Button
                  variant="unit"
                  className="ml-2 whitespace-nowrap shrink-0 px-4"
                  onClick={handleCopy}
                >
                  URL 복사
                </Button>
              </div>
            )}

            {/* 닫기 버튼 (기존 설문 화면일 때만 맨 하단에 표시) */}
            {existingSurvey && (
              <div className="pt-2">
                <Button variant="outline" className="w-full" onClick={onClose}>
                  닫기
                </Button>
              </div>
            )}

            {/* 기존 닫기 버튼 제거 (위로 이동됨) */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
