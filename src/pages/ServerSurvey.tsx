// src/pages/ServerSurvey.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import PremiumHeader from '@/components/common/PremiumHeader';
import { cn } from '@/lib/utils';
import { COLLECTIONS } from '@/lib/collections';
import { AltarServer, type ServerPose } from '@/components/characters/AltarServer';

interface MassEventDoc {
  id: string;
  title: string;
  event_date: string; // YYYYMMDD
  required_servers?: number;
}

export default function ServerSurvey() {
  const { serverGroupId, yyyymm } = useParams<{ serverGroupId: string; yyyymm: string }>();
  const navigate = useNavigate();
  const db = getFirestore();
  const auth = getAuth();
  const [user, loadingUser] = useAuthState(auth);
  
  const [searchParams] = useSearchParams();
  const targetMemberId = searchParams.get('uid') || searchParams.get('memberId') || user?.uid;
  // 복사 메인의 "설문 응답 보기"로 들어오면 설문 상태와 무관하게 보기 전용
  const viewOnly = searchParams.get('view') === '1';
  const [targetMemberName, setTargetMemberName] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [surveyPeriod, setSurveyPeriod] = useState('');

  const [currentDate, setCurrentDate] = useState(dayjs(yyyymm)); // 달력 표시용 (기본은 설문 월)
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  
  const [surveyClosed, setSurveyClosed] = useState(false);
  const [surveyMissing, setSurveyMissing] = useState(false);
  const [respondedAt, setRespondedAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasExistingResponse, setHasExistingResponse] = useState(false);
  const [loading, setLoading] = useState(true);

  // Drawer (Detail View) State
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [accessDenied, setAccessDenied] = useState(false);

  const [targetWarningType, setTargetWarningType] = useState<'inactive' | 'no_parent' | null>(null);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);

  // 1. 데이터 로드
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!serverGroupId || !yyyymm) return;
      try {
        setLoading(true);

        if (targetMemberId) {
             const mRef = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/members/${targetMemberId}`);
             getDoc(mRef).then(snap => {
                 if(snap.exists()) {
                     const data = snap.data();
                     setTargetMemberName(data.name_kor);
                     if (data.baptismal_name) setBaptismalName(data.baptismal_name);

                     if (data.active === false) {
                         setTargetWarningType('inactive');
                         setWarningDialogOpen(true);
                     } else if (!data.parent_uid) {
                         setTargetWarningType('no_parent');
                         setWarningDialogOpen(true);
                     }
                 }
             }).catch(console.error);
        }

        // (2) 미사 일정 로드 (event_date string 사용) - 권한 체크 전에 먼저 로드
        const startStr = dayjs(yyyymm + '01').startOf('month').format('YYYYMMDD');
        const endStr = dayjs(yyyymm + '01').endOf('month').format('YYYYMMDD');

        const q = query(
          collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/mass_events`),
          where('event_date', '>=', startStr),
          where('event_date', '<=', endStr),
          orderBy('event_date', 'asc')
        );
        const snap = await getDocs(q);
        const list: MassEventDoc[] = snap.docs.map((d) => {
             const data = d.data();
             return {
                 id: d.id,
                 title: data.title,
                 event_date: data.event_date,
                 required_servers: data.required_servers
             } as MassEventDoc;
        });
        setEvents(list);

        // (1) 설문 문서 로드
        const surveyRef = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);

        if (!surveySnap.exists()) {
           setSurveyClosed(true); // 문서가 없으면 로드 불가
           setSurveyMissing(true);
           setLoading(false);
           return;
        }

        const surveyData = surveySnap.data();
        
        // STATUS CHECK
        if (surveyData.status !== 'OPEN') {
           setSurveyClosed(true);
        }

        // Survey Period
        if (surveyData.start_date && surveyData.end_date) {
            const start = surveyData.start_date.toDate();
            const end = surveyData.end_date.toDate();
            setSurveyPeriod(`${dayjs(start).format('M월 D일')}~${dayjs(end).format('M월 D일')}`);
        }

        // MEMBER CHECK & PERMISSION CHECK
        if (user && targetMemberId) {
            const members = surveyData.member_ids || [];
            
            // 1. 대상자가 설문 대상에 포함되는지 확인
            if (!members.includes(targetMemberId)) {
                // 플래너가 보러 왔는데 대상자가 아니라면? -> "설문 대상이 아닙니다" 표시
                // 하지만 설문 대상이 아니어도 플래너가 수정하고 싶을 수도 있음 (추가하면서). 
                // 일단 기존 로직 유지하되 메시지 명확히.
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            // 2. 권한 확인 (본인 or 플래너/관리자)
            // Note: We check session roles or just assume if they can access this page and are not blocking Firestore rules.
            // But for UI safety, let's check basic logic.
            // Client-side guard:
            const isMySurvey = user.uid === targetMemberId;
            // We need session to check roles properly, but session hook might not be ready or imported here?
            // Let's assume if the user navigates here via valid route, they are at least authenticated.
            // Ideally we should import useSession from '@/state/session' but let's try to check Firestore directly if needed,
            // or rely on Firestore Security Rules to fail the write if not allowed.
            // But for "Read", anyone can read the survey doc? The doc contains all responses?
            // Yes, "responses" is a map in one doc. So if I can read the doc, I can read everyone's.
            // So we rely on the logic here to filter "myResponse" for display.
            
            // If we provided a specific targetMemberId via URL, we want to load THAT user's response.
            // So we just need to trust targetMemberId if provided.
            
            // (3) 기존 응답 로드
            const responsesMap = surveyData.responses || {};
            const targetResponse = responsesMap[targetMemberId];
            
            if (targetResponse) {
                let ids: string[] = [];
                if (Array.isArray(targetResponse.unavailable)) {
                    ids = targetResponse.unavailable;
                } else if (targetResponse.unavailable && typeof targetResponse.unavailable === 'object') {
                     ids = Object.keys(targetResponse.unavailable);
                }
                setUnavailableIds(ids);
                setHasExistingResponse(true);
                const updatedAt = targetResponse.updated_at?.toDate?.();
                setRespondedAt(updatedAt ? dayjs(updatedAt).format('M월 D일') : '');
            } else {
                // If no response, ensure unavailableIds is empty
                setUnavailableIds([]);
                setHasExistingResponse(false);
            }
        }

      } catch (err) {
        console.error(err);
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyData();
  }, [serverGroupId, yyyymm, user, targetMemberId]); // db is stable

  // 2. 캘린더 데이터 계산
  const daysInMonth = useMemo(() => {
    const d = dayjs(yyyymm + '01');
    return d.daysInMonth();
  }, [yyyymm]);

  const startDayOfWeek = useMemo(() => {
    const d = dayjs(yyyymm + '01');
    return d.day(); // 0(Sun) ~ 6(Sat)
  }, [yyyymm]);

  // 날짜별 이벤트 Grouping
  const eventsByDate = useMemo(() => {
     const map: Record<number, MassEventDoc[]> = {};
     events.forEach(ev => {
         const day = parseInt(ev.event_date.slice(6, 8));
         if (!map[day]) map[day] = [];
         map[day].push(ev);
     });
     return map;
  }, [events]);

  // 3. 핸들러
  const handleDayClick = (day: number) => {
    const date = dayjs(yyyymm).date(day);
    setSelectedDate(date);
    setDetailOpen(true);
  };

  const toggleAvailability = (eventId: string, isAvailable: boolean) => {
     // isAvailable === true -> 참석 가능 -> unavailableIds에서 제거
     // isAvailable === false -> 참석 불가 -> unavailableIds에 추가
     setUnavailableIds(prev => {
         if (isAvailable) {
             return prev.filter(id => id !== eventId);
         } else {
             return [...prev, eventId];
         }
     });
  };

  const handleBulkUnavailable = (targetEvent: MassEventDoc, makeUnavailable: boolean) => {
      const targetDayOfWeek = dayjs(targetEvent.event_date, 'YYYYMMDD').day();
      
      // Find all matching events (same title, same day of week)
      const matchingEvents = events.filter(ev => {
          const d = dayjs(ev.event_date, 'YYYYMMDD');
          return ev.title === targetEvent.title && d.day() === targetDayOfWeek;
      });

      const matchingIds = matchingEvents.map(e => e.id);

      setUnavailableIds(prev => {
          if (makeUnavailable) {
              // Add all matching IDs (avoid duplicates)
              const newIds = new Set([...prev, ...matchingIds]);
              return Array.from(newIds);
          } else {
              // Remove all matching IDs (make them available)
              return prev.filter(id => !matchingIds.includes(id));
          }
      });
  };

  const handleAllAvailableCheck = (checked: boolean) => {
      // 모두 가능 체크 -> unavailableIds 비우기
      // 체크 해제 -> 변화 없음 (사용자가 직접 선택하도록)
      if (checked) {
          setUnavailableIds([]);
      }
  };
  
  const isAllAvailable = unavailableIds.length === 0;

  /* isAllAvailable is already declared above */

  const handlePreSubmit = () => {
      if (!user) {
          toast.error('로그인이 필요합니다.');
          return;
      }
      setConfirmOpen(true);
  };

  const handleFinalSubmit = async () => {
    setConfirmOpen(false); // Close dialog first or after? Better close first to avoid UI flickering or double submit
    
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!targetMemberId) {
        toast.error('대상 복사가 식별되지 않았습니다.');
        return;
    }
    if (surveyClosed) {
      toast.warning('마감된 설문입니다.');
      return;
    }
    
    try {
      setIsSubmitting(true);

      // ✅ 제출 직전 최신 상태 확인 (Double Check)
      const surveyRef = doc(
        db,
        `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${yyyymm}`
      );
      const latestSnap = await getDoc(surveyRef);

      if (!latestSnap.exists()) {
          toast.error("설문 정보를 찾을 수 없습니다.");
          setSurveyClosed(true);
          return;
      }
      
      if (latestSnap.data().status !== 'OPEN') {
          toast.warning("이미 마감된 설문입니다.");
          setSurveyClosed(true);
          return;
      }

      // ✅ [보안 강화] 저장 시점에도 대상자인지 확인
      const surveyData = latestSnap.data();
      const targetMembers = surveyData.member_ids || [];
      if (!targetMembers.includes(targetMemberId)) {
          toast.error("설문 대상자가 아닙니다. (제출 거부됨)");
          setAccessDenied(true);
          return;
      }

       // 변경: availability_surveys 문서 내에 responses 필드 업데이트

      await setDoc(surveyRef, {
         responses: {
             [targetMemberId]: {
                 uid: targetMemberId,
                 unavailable: unavailableIds, // Save as array
                 updated_at: Timestamp.now()
             }
         }
      }, { merge: true });

      toast.success('설문이 제출되었습니다.');
      setSubmitted(true);
      setHasExistingResponse(true);

      // 성공 후 뒤로가기? or 머무르기?
      // navigate(-1); // 요청엔 없지만 편의상? 일단 머무름.
    } catch (e) {
        console.error(e);
        toast.error('제출 실패');
    } finally {
        setIsSubmitting(false);
    }
  };

  // 4. Drawer 렌더링용 선택된 날짜의 이벤트들
  const selectedEvents = useMemo(() => {
      if (!selectedDate) return [];
      const day = selectedDate.date();
      const list = eventsByDate[day] || [];
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  }, [selectedDate, eventsByDate]);

  if (loading || loadingUser) return <LoadingSpinner label="설문을 불러오고 있어요…" />;



  // 6. 렌더링
  const unavailableCount = events.filter((e) => unavailableIds.includes(e.id)).length;
  // 끝난 설문(또는 보기 전용 진입)은 내가 낸 응답을 확인만 할 수 있다
  const readOnly = surveyClosed || viewOnly;
  const noResponse = readOnly && !hasExistingResponse;
  const unavailableEvents = events
    .filter((e) => unavailableIds.includes(e.id))
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title, 'ko'));
  const guidePose: ServerPose =
    accessDenied || surveyMissing || noResponse ? 'rest' : readOnly ? 'wave' : submitted ? 'cheer' : isAllAvailable ? 'wave' : 'pray';

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-violet-50 via-sky-50 to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 transition-colors duration-300", readOnly ? "pb-12" : "pb-48")}>
      {/* Header */}
      <PremiumHeader
        subtitle={
          <div className="flex items-center gap-1.5 w-full">
            <span className="truncate">
              {targetMemberName ? `${targetMemberName}${baptismalName ? ' ' + baptismalName : ''}` : dayjs(yyyymm).format('YYYY년 M월')}
            </span>
            {targetWarningType && (
              <span className="shrink-0 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1 py-0.5 rounded flex items-center gap-0.5 border border-red-200 dark:border-red-800">
                <AlertCircle size={10} />
                {targetWarningType === 'inactive' ? '비활성 복사' : '부모 연동 없음'}
              </span>
            )}
          </div>
        }
        title={targetMemberName ? `${dayjs(yyyymm).format('YYYY년 M월')} 설문` : '미사 배정 설문'}
        onBack={() => {
          if (window.opener && window.opener !== window) {
            window.close();
          } else {
            navigate(-1);
          }
        }}
      />

      <div className="max-w-md md:max-w-4xl mx-auto p-4 space-y-3 ui-stagger">
        {/* 안내 카드 — 복사 캐릭터가 지금 할 일을 알려 준다 */}
        <section className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="w-16 shrink-0">
            <AltarServer key={guidePose} seed={targetMemberId || 'altar'} pose={guidePose} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-snug text-gray-900 dark:text-gray-50 break-keep">
              {accessDenied
                ? '설문 대상이 아니에요'
                : surveyMissing
                ? '아직 설문이 없어요'
                : noResponse
                ? '설문에 응답하지 않았어요'
                : readOnly
                ? '내가 낸 설문이에요'
                : submitted
                ? '제출했어요, 고마워요!'
                : '못 오는 날만 알려 주세요'}
            </p>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 break-keep">
              {accessDenied
                ? '플래너에게 문의해 주세요.'
                : surveyMissing
                ? '설문이 열리면 여기에서 참여할 수 있어요.'
                : readOnly
                ? surveyClosed
                  ? '설문이 끝나 고칠 수 없어요. 바꿀 내용은 선생님께 알려 주세요.'
                  : '설문 기간이 지났어요. 바꿀 내용은 선생님께 알려 주세요.'
                : '날짜를 눌러 참석할 수 없는 미사를 골라 주세요.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
              {surveyPeriod && (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  기간 {surveyPeriod}
                </span>
              )}
              {!accessDenied && !surveyMissing && (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1',
                    noResponse
                      ? 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'
                      : unavailableCount > 0
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}
                >
                  {noResponse ? '응답 없음' : unavailableCount > 0 ? `못 오는 미사 ${unavailableCount}개` : '모두 참석 가능'}
                </span>
              )}
              {readOnly && respondedAt && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  {respondedAt} 제출
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Orphaned Events Warning */}
        {(() => {
            const currentEventIds = new Set(events.map(e => e.id));
            const orphaned = unavailableIds.filter(id => !currentEventIds.has(id)).length;

            if (orphaned > 0 && !readOnly) {
                return (
                    <div className="p-3 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm rounded-2xl border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                        <span className="text-lg">📢</span>
                        <div>
                            <strong>일정 변경 알림</strong>
                            <p>
                                기존에 '불가능'으로 체크했던 항목 중 <strong>{orphaned}건</strong>의 일정이 삭제되거나 변경(재생성)되었습니다.<br/>
                                <span className="underline decoration-wavy">혹시 다시 생성된 미사가 없는지</span> 달력을 꼼꼼히 확인해주세요.
                            </p>
                        </div>
                    </div>
                );
            }
            return null;
        })()}

        <section className="rounded-3xl border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                <div className="text-rose-500">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div className="text-sky-500">토</div>
            </div>

            {/* 달력 그리드 */}
            <div className="grid grid-cols-7 gap-1">
                {/* Empty Cells */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = eventsByDate[day] || [];
                    const dayUnavailable = dayEvents.filter((ev) => unavailableIds.includes(ev.id)).length;
                    const dow = (startDayOfWeek + i) % 7;

                    return (
                        <div
                            key={day}
                            onClick={() => handleDayClick(day)}
                            className={cn(
                                "relative flex flex-col items-center md:items-stretch min-h-[60px] md:min-h-[100px] cursor-pointer rounded-2xl border pt-1.5 md:p-1.5 transition active:scale-95",
                                dayEvents.length === 0
                                    ? "border-transparent"
                                    : noResponse
                                    ? "border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/50"
                                    : dayUnavailable > 0
                                    ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20"
                                    : "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                            )}
                        >
                            <span className={cn(
                                "text-sm leading-none mb-1.5 md:self-start",
                                dayEvents.length === 0
                                    ? "text-gray-300 dark:text-slate-600"
                                    : dow === 0
                                    ? "text-rose-500"
                                    : dow === 6
                                    ? "text-sky-500"
                                    : "text-gray-700 dark:text-gray-200"
                            )}>
                                {day}
                            </span>

                            {/* Dots Container (Mobile) */}
                            <div className="flex gap-1 flex-wrap justify-center px-1 md:hidden">
                                {[...dayEvents]
                                    .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
                                    .map(ev => {
                                    const isUnavailable = unavailableIds.includes(ev.id);
                                    return (
                                        <div
                                            key={ev.id}
                                            className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white transition-colors duration-300",
                                                noResponse ? "bg-gray-300 dark:bg-slate-600" : isUnavailable ? "bg-rose-400" : "bg-emerald-500"
                                            )}
                                        >
                                            {noResponse ? '' : isUnavailable ? '✕' : '○'}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Text List (Desktop) */}
                            <div className="hidden md:flex flex-col gap-1 mt-1 w-full overflow-y-auto custom-scrollbar">
                                {[...dayEvents]
                                    .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
                                    .map(ev => {
                                    const isUnavailable = unavailableIds.includes(ev.id);
                                    return (
                                        <div
                                            key={ev.id}
                                            className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1",
                                                noResponse
                                                    ? "bg-white text-gray-500 border border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700"
                                                    : isUnavailable
                                                    ? "bg-white text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50"
                                                    : "bg-white text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50"
                                            )}
                                        >
                                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", noResponse ? "bg-gray-300" : isUnavailable ? "bg-red-500" : "bg-green-500")}></span>
                                            {ev.title}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 범례 */}
            <div className={cn("mt-3 flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3", noResponse && "hidden")}>
                <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">○</div>
                    <span>참석 가능</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-400 text-[9px] font-bold text-white">✕</div>
                    <span>못 가요</span>
                </div>
            </div>
        </section>

        {/* 보기 전용: 못 온다고 응답한 미사 목록 */}
        {readOnly && hasExistingResponse && !accessDenied && (
          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <h3 className="font-display text-lg text-gray-900 dark:text-gray-50">
              못 온다고 한 미사 <span className="text-rose-500">{unavailableEvents.length}</span>개
            </h3>
            {unavailableEvents.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">모든 미사에 참석할 수 있다고 응답했어요. 👍</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
                {unavailableEvents.map((ev) => {
                  const d = dayjs(ev.event_date, 'YYYYMMDD');
                  return (
                    <li key={ev.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="shrink-0 font-semibold text-gray-700 dark:text-gray-200">
                        {d.format('M월 D일')} ({'일월화수목금토'[d.day()]})
                      </span>
                      <span className="truncate text-gray-600 dark:text-gray-300">{ev.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* 하단 고정 제출 영역 — 달력을 내려도 항상 보인다 (보기 전용일 때는 없다) */}
      {!readOnly && (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/95 px-4 pb-4 pt-3 shadow-[0_-10px_30px_-14px_rgba(76,29,149,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto max-w-md md:max-w-4xl space-y-2">
            <div className="flex items-center gap-2 px-1">
                <Checkbox
                    id="all-ok"
                    checked={isAllAvailable}
                    onCheckedChange={handleAllAvailableCheck}
                    disabled={surveyClosed}
                    className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                />
                <label htmlFor="all-ok" className="text-sm font-medium cursor-pointer flex-1 dark:text-gray-200">
                    모든 일정에 참석할 수 있어요
                </label>
                {submitted && (
                    <span className="ui-pop-once rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        ✅ 제출됨
                    </span>
                )}
            </div>

            <Button
                variant="primary"
                onClick={handlePreSubmit}
                disabled={isSubmitting || surveyClosed}
                className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 font-display text-lg font-normal shadow-lg shadow-violet-500/30"
                size="lg"
            >
                {isSubmitting ? '저장 중...' : surveyClosed ? '설문이 끝났어요' : (hasExistingResponse ? '수정해서 제출하기' : '제출하기')}
            </Button>

            <p className="text-center text-[11px] text-gray-400">
                설문이 끝날 때까지 몇 번이든 고칠 수 있어요.
            </p>
        </div>
      </div>
      )}

      {/* Detail Drawer (Dialog as Bottom Sheet) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-sm rounded-t-xl rounded-b-none sm:rounded-xl bottom-0 top-auto translate-y-0 sm:translate-y-[-50%] sm:top-[50%] fixed data-[state=open]:animate-in data-[state=closed]:animate-out slide-in-from-bottom-full sm:slide-in-from-bottom-10 h-auto max-h-[80vh] overflow-y-auto w-full p-4 gap-4 bg-white dark:bg-slate-900 border dark:border-slate-800">
              <DialogHeader className="text-left">
                  <DialogTitle className="text-lg dark:text-white">
                      {selectedDate?.format('M월 D일 (ddd)')} 미사
                  </DialogTitle>
                  <DialogDescription className="dark:text-gray-400">
                      {noResponse ? (
                          '이 설문에는 응답하지 않았어요.'
                      ) : readOnly ? (
                          '설문에 응답한 내용이에요.'
                      ) : (
                          <>본인이 참석할 수 <span className="text-red-500 font-bold">없는</span> 미사만 체크 해제하세요.</>
                      )}
                  </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                  {selectedEvents.length === 0 ? (
                      <p className="text-center text-gray-400 py-4">미사 일정이 없습니다.</p>
                  ) : selectedEvents.map(ev => {
                      const isUnavailable = unavailableIds.includes(ev.id);
                      
                      // Calculate bulk state
                      const dayOfWeek = dayjs(ev.event_date, 'YYYYMMDD').day();
                      const matchingEvents = events.filter(e => 
                          e.title === ev.title && 
                          dayjs(e.event_date, 'YYYYMMDD').day() === dayOfWeek
                      );
                      const isBulkChecked = matchingEvents.length > 1 && matchingEvents.every(e => unavailableIds.includes(e.id));
                      const dayName = ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek];

                      return (
                      <div key={ev.id} className="flex flex-col p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 gap-2">
                          <div className="flex items-center justify-between">
                              <div>
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{ev.title}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      필요인원 {ev.required_servers || 0}명
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className={cn(
                                      "text-xs font-bold mr-2",
                                      noResponse ? "text-gray-400" : isUnavailable ? "text-red-500" : "text-green-600 dark:text-green-400"
                                  )}>
                                      {noResponse ? "응답 없음" : isUnavailable ? "불가능" : "가능"}
                                  </span>
                                  <Checkbox 
                                      checked={!isUnavailable} // Checked = Available
                                      onCheckedChange={(checked) => toggleAvailability(ev.id, checked as boolean)}
                                      disabled={readOnly}
                                      className={cn("w-6 h-6 border-2 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 dark:border-gray-500", noResponse && "hidden")}
                                  />
                              </div>
                          </div>
                          
                          {/* Bulk Option: Only show if currently unavailable */}
                          {!readOnly && isUnavailable && matchingEvents.length > 1 && (
                              <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30">
                                  <Checkbox 
                                      id={`bulk-${ev.id}`}
                                      checked={isBulkChecked}
                                      onCheckedChange={(checked) => handleBulkUnavailable(ev, checked as boolean)}
                                      className="w-4 h-4 border-red-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 dark:border-red-700"
                                  />
                                  <label htmlFor={`bulk-${ev.id}`} className="text-xs text-red-600 dark:text-red-300 cursor-pointer">
                                      이번 달 모든 {dayName}요일 '{ev.title}' 불가능
                                  </label>
                              </div>
                          )}
                      </div>
                      );
                  })}
              </div>

              {!readOnly && (
              <div className="mt-2">
                  <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 py-2 rounded-md">
                      ⚠️ 선택 후에 화면 하단의 [제출] 버튼을 눌러야 반영됩니다
                  </p>
              </div>
              )}

              <DialogFooter className="sm:justify-center">
                  <Button variant="primary" onClick={() => setDetailOpen(false)} className="w-full">
                      {readOnly ? '닫기' : '선택'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm rounded-t-xl rounded-b-none sm:rounded-xl bottom-0 top-auto translate-y-0 sm:translate-y-[-50%] sm:top-[50%] fixed data-[state=open]:animate-in data-[state=closed]:animate-out slide-in-from-bottom-full sm:slide-in-from-bottom-10 flex flex-col h-[80vh] w-full p-4 gap-4 bg-white dark:bg-slate-900 border dark:border-slate-800">
              <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-bold dark:text-white">제출 확인</DialogTitle>
                  <DialogDescription className="dark:text-gray-400">
                      선택한 설문 내용을 제출하시겠습니까?
                  </DialogDescription>
              </DialogHeader>

              <div className="mb-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                  <h4 className="text-sm font-semibold mb-2 dark:text-gray-200 shrink-0">
                      참석 <span className="text-red-500">불가능</span> 일정 ({unavailableIds.length}건)
                  </h4>
                  <div className="flex-1 max-h-[60vh] overflow-y-auto border rounded-lg p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                      {unavailableIds.length === 0 ? (
                          <div className="h-full flex flex-col justify-center items-center">
                              <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                                  모든 미사에 참석 가능합니다. 👍
                              </p>
                          </div>
                      ) : (
                          <div className="space-y-1">
                              {events.filter(e => unavailableIds.includes(e.id))
                                  .sort((a,b) => a.event_date.localeCompare(b.event_date))
                                  .map((ev, index, array) => {
                                      const currentWeekStart = dayjs(ev.event_date, 'YYYYMMDD').startOf('week').format('YYYY-MM-DD');
                                      const prevItem = index > 0 ? array[index - 1] : null;
                                      const prevWeekStart = prevItem ? dayjs(prevItem.event_date, 'YYYYMMDD').startOf('week').format('YYYY-MM-DD') : null;
                                      const isNewWeek = prevWeekStart && currentWeekStart !== prevWeekStart;

                                      return (
                                          <React.Fragment key={ev.id}>
                                              {isNewWeek && <div className="border-t border-gray-200 dark:border-gray-600 my-1 mx-1" />}
                                              <div className="text-sm flex justify-between p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors">
                                                  <span className="text-gray-600 dark:text-gray-300">
                                                      {dayjs(ev.event_date, 'YYYYMMDD').format('M/D')} ({['일', '월', '화', '수', '목', '금', '토'][dayjs(ev.event_date, 'YYYYMMDD').day()]})
                                                  </span>
                                                  <span className="font-medium text-gray-800 dark:text-gray-200">
                                                      {ev.title}
                                                  </span>
                                              </div>
                                          </React.Fragment>
                                      );
                                  })}
                          </div>
                      )}

                  </div>
              </div>

              <div className="flex gap-2 w-full">
                  <Button 
                      variant="outline" 
                      onClick={() => setConfirmOpen(false)}
                      className="flex-1 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                  >
                      취소
                  </Button>
                  <Button 
                      variant="primary" 
                      onClick={handleFinalSubmit}
                      className="flex-1 font-bold"
                  >
                      제출하기
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* Warning Dialog (Inactive or No Parent) */}
      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
          <DialogContent className="max-w-sm rounded-[16px] p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 focus:outline-none">
              <DialogHeader className="text-left">
                  <DialogTitle className="text-lg flex items-center gap-2 text-amber-600 dark:text-amber-500">
                      <AlertCircle size={20} />
                      확인 필요
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {targetWarningType === 'inactive' ? (
                          <>현재 <strong className="text-gray-800 dark:text-gray-200">{targetMemberName}</strong> 복사는 <strong>비활성 상태</strong>입니다.<br/>설문 진행에 문제가 없는지 확인해주세요.</>
                      ) : (
                          <>현재 <strong className="text-gray-800 dark:text-gray-200">{targetMemberName}</strong> 복사는 <strong>부모(보호자) 계정 연동 정보가 없습니다.</strong><br/>앱 설치나 로그인 안내가 필요할 수 있습니다.</>
                      )}
                  </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                  <Button variant="primary" onClick={() => setWarningDialogOpen(false)} className="w-full">
                      확인했습니다
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
