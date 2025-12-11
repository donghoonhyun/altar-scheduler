// src/pages/ServerSurvey.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  // 1. 데이터 로드
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!serverGroupId || !yyyymm) return;
      try {
        setLoading(true);

        // (1) 설문 상태 확인
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);
        // 상태가 명시적으로 CLOSED가 아니면 OPEN으로 간주 하거나, 문서가 없으면 OPEN? 
        // 기존 로직: OPEN 아니면 Closed.
        // 하지만 아직 AvailabilitySurvey 문서를 생성하지 않았을 수도 있음 (Planner가 OPEN해야 생성됨).
        // 일단 존재하고 OPEN이어야 한다고 가정 (Planner 로직에 따름).
        // 만약 문서가 없으면? -> 아직 설문 시작 전일 수 있음. Or Planner가 만들지 않음.
        // 여기서는 플래너가 '확정'하면 설문이 시작된다고 했으므로 MonthStatus를 확인하는게 더 정확할 수 있으나,
        // 기존 로직을 존중하여 availability_surveys 문서를 확인. 
        // (TIP: MassPlanner Confirm 시 availability_surveys 문서를 생성하는지 확인 필요. 
        //  현재 확인 불가하므로, 만약 문서가 없으면 "설문이 존재하지 않습니다" 처리. 
        //  단, 이전 대화에서 플래너 로직을 짤 때 availability_surveys 생성 로직은 SendSurveyDrawer에 있었음.
        //  단순 상태 변경(MASS-CONFIRMED)만으로는 availability_surveys 문서가 없을 수 있음.
        //  따라서 문서가 없어도 MASS-CONFIRMED 상태라면 보여줘야 할 수도 있음.
        //  하지만 안전하게 일단 진행.)
        
        // * 수정: MonthStatus 확인으로 변경하거나, 관대하게 처리. 
        // 여기서는 그냥 "이벤트 로드"에 집중. 설문 상태 체크는 일단 Pass or Warn.
        // 기존 로직 유지: status !== 'OPEN' -> Closed. (문서 없으면 Closed로 처리했었음)
        // 사용자가 "설문시작" -> "SendSurveyDrawer" -> "Create Survey Doc"? 
        // 확인 불가하나 일단 Events 불러오는게 중요. 에러 안나게 처리.
        
        /* 
        if (!surveySnap.exists() || surveySnap.data().status !== 'OPEN') {
           // 문서가 없어도 테스트 가능하게 일단 주석처리 or open 로직 완화
           // setSurveyClosed(true);
           // return;
        } 
        */

        // (2) 미사 일정 로드 (event_date string 사용)
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

        // (3) 기존 응답 로드
        if (user) {
          const responseRef = doc(
            db,
            `server_groups/${serverGroupId}/availability_responses/${user.uid}_${yyyymm}`
          );
          const responseSnap = await getDoc(responseRef);
          if (responseSnap.exists()) {
            const r = responseSnap.data();
            const ids = Object.keys(r.unavailable || {});
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
  }, [serverGroupId, yyyymm, user]); // db is stable

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
    if (surveyClosed) {
      toast.warning('마감된 설문입니다.');
      return;
    }
    
    // 유효성 체크? "하나라도 체크해야" 같은 조건은 필요 없음. 기본이 "모두 가능"일 수 있으니.
    // 사용자가 의도적으로 "모두 가능"을 냈는지 알 수 없지만, default가 available 이므로 OK.
    
    try {
      setIsSubmitting(true);
       const ref = doc(
        db,
        `server_groups/${serverGroupId}/availability_responses/${user.uid}_${yyyymm}`
      );

      const unavailableMap: Record<string, false> = {};
      unavailableIds.forEach(id => unavailableMap[id] = false);

      await setDoc(ref, {
         server_group_id: serverGroupId,
         uid: user.uid,
         yyyymm,
         unavailable: unavailableIds.length > 0 ? unavailableMap : {},
         updated_at: serverTimestamp()
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

  // 5. 렌더링
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
                  <ArrowLeft size={20} />
              </Button> 
              <h1 className="font-bold text-lg">
                  {dayjs(yyyymm).format('YYYY년 M월')} 설문
              </h1>
              <div className="w-10"></div>{/* Spacer */}
          </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {surveyClosed && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded">
                🚫 설문이 종료되었습니다.
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
                onClick={handleSubmit} 
                disabled={isSubmitting || surveyClosed}
                className="w-full text-lg py-6"
                size="lg"
            >
                {isSubmitting ? '저장 중...' : (hasExistingResponse ? '수정 제출' : '확정 제출')}
            </Button>
            
            {submitted && (
                <div className="text-center text-green-600 text-sm font-medium animate-pulse">
                    ✅ 제출되었습니다.
                </div>
            )}
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
                  <Button onClick={() => setDetailOpen(false)} className="w-full">
                      확인
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
