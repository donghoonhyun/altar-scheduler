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

import { ChevronLeft, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const targetMemberId = searchParams.get('memberId') || user?.uid;
  const [targetMemberName, setTargetMemberName] = useState('');
  const [surveyPeriod, setSurveyPeriod] = useState('');

  const [currentDate, setCurrentDate] = useState(dayjs(yyyymm)); // 달력 표시용 (기본은 설문 월)
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  
  const [surveyClosed, setSurveyClosed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasExistingResponse, setHasExistingResponse] = useState(false);
  const [loading, setLoading] = useState(true);

  // Drawer (Detail View) State
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [accessDenied, setAccessDenied] = useState(false);

  // 1. 데이터 로드
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!serverGroupId || !yyyymm) return;
      try {
        setLoading(true);

        if (targetMemberId) {
             const mRef = doc(db, `server_groups/${serverGroupId}/members/${targetMemberId}`);
             getDoc(mRef).then(snap => {
                 if(snap.exists()) setTargetMemberName(snap.data().name_kor);
             }).catch(console.error);
        }

        // (2) 미사 일정 로드 (event_date string 사용) - 권한 체크 전에 먼저 로드
        const startStr = dayjs(yyyymm + '01').startOf('month').format('YYYYMMDD');
        const endStr = dayjs(yyyymm + '01').endOf('month').format('YYYYMMDD');

        const q = query(
          collection(db, `server_groups/${serverGroupId}/mass_events`),
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
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);

        if (!surveySnap.exists()) {
           setSurveyClosed(true); // 문서가 없으면 로드 불가
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

        // MEMBER CHECK (로그인 유저가 대상인지)
        if (user && targetMemberId) {
            const members = surveyData.member_ids || [];
            if (!members.includes(targetMemberId)) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            // (3) 기존 응답 로드 (responses 맵 내에서 확인)
            const responsesMap = surveyData.responses || {};
            const myResponse = responsesMap[targetMemberId];
            if (myResponse) {
                // Support both array (new) and map (old/legacy) for unavailable
                let ids: string[] = [];
                if (Array.isArray(myResponse.unavailable)) {
                    ids = myResponse.unavailable;
                } else if (myResponse.unavailable && typeof myResponse.unavailable === 'object') {
                     ids = Object.keys(myResponse.unavailable);
                }
                setUnavailableIds(ids);
                setHasExistingResponse(true);
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

  const handleAllAvailableCheck = (checked: boolean) => {
      // 모두 가능 체크 -> unavailableIds 비우기
      // 체크 해제 -> 변화 없음 (사용자가 직접 선택하도록)
      if (checked) {
          setUnavailableIds([]);
      }
  };
  
  const isAllAvailable = unavailableIds.length === 0;

  const handleSubmit = async () => {
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
        `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`
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
      return eventsByDate[day] || [];
  }, [selectedDate, eventsByDate]);

  if (loading || loadingUser) return <LoadingSpinner label="로딩 중..." />;



  // 6. 렌더링
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between min-h-[3.5rem]">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
                  <ArrowLeft size={20} />
              </Button> 
              <div className="flex flex-col items-center">
                <h1 className="font-bold text-lg leading-tight">
                    {dayjs(yyyymm).format('YYYY년 M월')} 설문 {targetMemberName && `(${targetMemberName})`}
                </h1>
                {surveyPeriod && (
                    <span className="text-xs text-gray-500 mt-0.5">
                        설문 기간: {surveyPeriod}
                    </span>
                )}
              </div>
              <div className="w-8"></div>{/* Spacer */}
          </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {surveyClosed && !accessDenied && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded">
                🚫 설문이 종료되었습니다.
            </div>
        )}
        
        {accessDenied && (
             <div className="mb-4 p-3 bg-orange-100 text-orange-700 text-sm rounded">
                ⚠️ 설문 대상자가 아닙니다.
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-4">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs font-semibold text-gray-500">
                <div className="text-red-500">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div className="text-blue-500">토</div>
            </div>

            {/* 달력 그리드 */}
            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                {/* Empty Cells */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = eventsByDate[day] || [];
                    const isToday = false; // 필요시 구현
                    
                    return (
                        <div 
                            key={day} 
                            onClick={() => handleDayClick(day)}
                            className="flex flex-col items-center min-h-[60px] cursor-pointer active:bg-gray-100 rounded transition-colors"
                        >
                            <span className={cn(
                                "text-sm w-7 h-7 flex items-center justify-center rounded-full mb-1",
                                // 날짜 스타일 (오늘 등)
                            )}>
                                {day}
                            </span>
                            
                            {/* Dots Container */}
                            <div className="flex gap-0.5 flex-wrap justify-center px-1">
                                {dayEvents.map(ev => {
                                    const isUnavailable = unavailableIds.includes(ev.id);
                                    return (
                                        <div 
                                            key={ev.id}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                isUnavailable ? "bg-red-300" : "bg-green-500"
                                            )}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        
        {/* Footer Actions */}
        <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
                <Checkbox 
                    id="all-ok" 
                    checked={isAllAvailable} 
                    onCheckedChange={handleAllAvailableCheck}
                />
                <label htmlFor="all-ok" className="text-sm font-medium cursor-pointer flex-1">
                    모든 일정에 참석 가능합니다
                    
                
                </label>
                
            </div>
            
            <Button 
                variant="primary"
                onClick={handleSubmit} 
                disabled={isSubmitting || surveyClosed}
                className="w-full"
                size="lg"
            >
                {isSubmitting ? '저장 중...' : (hasExistingResponse ? '수정 제출' : '확정 제출')}
            </Button>
            
            {submitted && (
                <div className="text-center text-green-600 text-sm font-medium animate-pulse">
                    ✅ 제출되었습니다.
                </div>
            )}
            <p className="text-center text-xs text-blue-600 font-semibold mt-2">
                설문이 종료될 때까지 수정할 수 있습니다.
            </p>

            
            
        </div>
      </div>

      {/* Detail Drawer (Dialog as Bottom Sheet) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-sm rounded-t-xl rounded-b-none sm:rounded-xl bottom-0 top-auto translate-y-0 sm:translate-y-[-50%] sm:top-[50%] fixed data-[state=open]:animate-in data-[state=closed]:animate-out slide-in-from-bottom-full sm:slide-in-from-bottom-10 h-auto max-h-[80vh] overflow-y-auto w-full p-4 gap-4 bg-white">
              <DialogHeader className="text-left">
                  <DialogTitle className="text-lg">
                      {selectedDate?.format('M월 D일 (ddd)')} 미사
                  </DialogTitle>
                  <DialogDescription>
                      본인이 참석할 수 <span className="text-red-500 font-bold">없는</span> 미사만 체크 해제하세요.
                  </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                  {selectedEvents.length === 0 ? (
                      <p className="text-center text-gray-400 py-4">미사 일정이 없습니다.</p>
                  ) : selectedEvents.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                          <div>
                              <div className="font-semibold text-gray-900">{ev.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                  필요인원 {ev.required_servers || 0}명
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className={cn(
                                  "text-xs font-bold mr-2",
                                  unavailableIds.includes(ev.id) ? "text-red-500" : "text-green-600"
                              )}>
                                  {unavailableIds.includes(ev.id) ? "불가능" : "가능"}
                              </span>
                              <Checkbox 
                                  checked={!unavailableIds.includes(ev.id)} // Checked = Available
                                  onCheckedChange={(checked) => toggleAvailability(ev.id, checked as boolean)}
                                  className="w-6 h-6 border-2 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                          </div>
                      </div>
                  ))}
              </div>

              <DialogFooter className="sm:justify-center">
                  <Button variant="primary" onClick={() => setDetailOpen(false)} className="w-full">
                      확인
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>


    </div>
  );
}
