// src/components/SendSurveyDrawer.tsx
import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DialogDescription } from '@/components/ui/dialog-description';
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
  onSnapshot
} from 'firebase/firestore';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import type { MassStatus } from '@/types/firestore';
import { APP_BASE_URL } from '@/lib/env';
import { RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// ---------- 🔹 Type Definitions ----------
interface MemberDoc {
  id: string;
  name_kor: string;
  baptismal_name?: string;
  grade?: string;
  active: boolean;
}

interface AvailabilitySurveyDoc {
  start_date?: any;
  end_date?: any;
  member_ids?: string[];
  status?: 'OPEN' | 'CLOSED';
  created_at?: any;
  updated_at?: any;
  responses?: Record<string, {
      uid: string;
      unavailable: string[] | Record<string, any>; // Support both new array and old map
      updated_at: any;
  }>;
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
  const db = getFirestore();
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

  // ---------- 🔹 Load Members & Events (Manual Refresh) ---------- 
  const fetchBasics = useCallback(async () => {
      try {
        setIsRefreshing(true);
        // Load active members
        const membersRef = collection(db, `server_groups/${serverGroupId}/members`);
        const q = query(membersRef, where('active', '==', true));
        const snap = await getDocs(q);
        const mList: MemberDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MemberDoc, 'id'>),
        }));
        setMembers(mList);
        // Only set default selection if empty
        setSelectedMembers(prev => prev.length === 0 ? mList.map((m) => m.id) : prev);

        // Fetch Mass Events for details
        const startStr = dayjs(currentMonth + '01').startOf('month').format('YYYYMMDD');
        const endStr = dayjs(currentMonth + '01').endOf('month').format('YYYYMMDD');
        
        const eventsRef = collection(db, `server_groups/${serverGroupId}/mass_events`);
        const eq = query(eventsRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr));
        const eSnap = await getDocs(eq);
        const eMap: Record<string, MassEventDoc> = {};
        eSnap.forEach(d => {
            eMap[d.id] = { id: d.id, ...d.data() } as MassEventDoc;
        });
        setMassEvents(eMap);
      } catch (err) {
        console.error('Fetch basics error:', err);
      } finally {
        setIsRefreshing(false);
      }
  }, [db, serverGroupId, currentMonth]);

  // ---------- 🔹 Real-time Survey Listener ----------
  useEffect(() => {
    if (!open) return;

    fetchBasics(); // Load static data once

    const surveyRef = doc(
       db,
       `server_groups/${serverGroupId}/availability_surveys/${currentMonth}`
    );

    const unsub = onSnapshot(surveyRef, (sSnap) => {
        if (sSnap.exists()) {
            const data = sSnap.data() as AvailabilitySurveyDoc;
            setExistingSurvey(data); // Real-time update
            if (data.status === 'OPEN') {
               setSurveyUrl(`${APP_BASE_URL}/survey/${serverGroupId}/${currentMonth}`);
            }
        } else {
            setExistingSurvey(null);
            setSurveyUrl(null);
        }
    }, (error) => {
        console.error("Survey snapshot error:", error);
    });

    return () => unsub();
  }, [open, serverGroupId, currentMonth, db, fetchBasics]);

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
      const ref = doc(db, `server_groups/${serverGroupId}/availability_surveys/${currentMonth}`);

      await setDoc(
        ref,
        {
          start_date: fromLocalDateToFirestore(startDate, timezone),
          end_date: fromLocalDateToFirestore(endDate, timezone),
          member_ids: selectedMembers,
          created_at: serverTimestamp(),
          status: 'OPEN',
        },
        { merge: true }
      );

      const url = `https://altar-scheduler.web.app/survey/${serverGroupId}/${currentMonth}`;
      setSurveyUrl(url);
      // setExistingSurvey({ status: 'OPEN' }); // onSnapshot will handle this
      toast.success('설문이 시작되었습니다.');
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
      await navigator.clipboard.writeText(surveyUrl);
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

  // ---------- 🔹 Render ----------
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md space-y-4">
        <div className="space-y-1">
          <DialogTitle>📩 복사 일정 설문</DialogTitle>
          <DialogDescription>
            이번 달 확정된 미사 일정에 대해 복사들의 참석 불가 여부를 조사합니다.
          </DialogDescription>
        </div>

        {/* ✅ 기존 설문 존재 시 안내 */}
        {existingSurvey && (
          <div className="space-y-4">
              <div className={`border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-colors ${
                existingSurvey.status === 'OPEN' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
              }`}>
                  {/* Date Range */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">설문 기간</span>
                      <span className="text-sm font-bold text-gray-900">
                        {dayjs(existingSurvey.start_date?.toDate()).format('M/D')} ~ {dayjs(existingSurvey.end_date?.toDate()).format('M/D')}
                      </span>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">설문 상태</span>
                      <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${existingSurvey.status === 'OPEN' ? 'text-blue-600' : 'text-red-500'}`}>
                               {existingSurvey.status === 'OPEN' ? 'OPEN (진행중)' : 'CLOSED (마감됨)'}
                          </span>
                          <Switch
                              checked={existingSurvey.status === 'OPEN'}
                              disabled={monthStatus !== 'MASS-CONFIRMED'}
                              onCheckedChange={async (checked) => {
                                  try {
                                      const newStatus = checked ? 'OPEN' : 'CLOSED';
                                      const ref = doc(db, `server_groups/${serverGroupId}/availability_surveys/${currentMonth}`);
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

              {/* Submission Statistics */}
              {(() => {
                  const targetMembers = members.filter(m => existingSurvey.member_ids?.includes(m.id));
                  const submittedCount = targetMembers.filter(m => existingSurvey.responses?.[m.id]).length;
                  const notSubmittedCount = targetMembers.length - submittedCount;
                  
                  return (
                      <div className="flex items-center justify-between text-sm">
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">제출:</span>
                                <span className="text-green-600 font-bold">{submittedCount}명</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">미제출:</span>
                                <span className="text-gray-500 font-bold">{notSubmittedCount}명</span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={fetchBasics} 
                            disabled={isRefreshing}
                            className="h-6 w-6 p-0 rounded-full hover:bg-gray-100"
                            title="데이터 새로고침"
                          >
                            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                          </Button>
                      </div>
                  );
              })()}

              {/* Members Status List */}
              <div className="border rounded-md max-h-[450px] overflow-y-auto">
                 {members
                   .filter(m => existingSurvey.member_ids?.includes(m.id))
                   .sort((a, b) => {
                       // Sort by name_kor first, then by grade
                       const nameCompare = a.name_kor.localeCompare(b.name_kor, 'ko');
                       if (nameCompare !== 0) return nameCompare;
                       return (a.grade || '').localeCompare(b.grade || '', 'ko');
                   })
                   .map(m => {
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
                     const assignedCount = Object.values(massEvents).filter(ev => 
                        ev.member_ids?.includes(m.id)
                     ).length;

                     return (
                         <div key={m.id} className="border-b last:border-b-0">
                             <div 
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => isSubmitted && setExpandedMemberId(isExpanded ? null : m.id)}
                             >
                                  <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{m.name_kor}</span>
                                          {assignedCount > 0 && (
                                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                                  배정 {assignedCount}
                                              </span>
                                          )}
                                      </div>
                                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                          {m.baptismal_name && <span>{m.baptismal_name}</span>}
                                          {m.baptismal_name && m.grade && <span>·</span>}
                                          {m.grade && <span>{m.grade}</span>}
                                      </div>
                                  </div>

                                 <div>
                                     {isSubmitted ? (
                                         <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                             제출완료 {unavailableCount > 0 && `(불참 ${unavailableCount})`}
                                         </span>
                                     ) : (
                                         <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                                             미제출
                                         </span>
                                     )}
                                 </div>
                             </div>
                             
                             {/* Detail Expansion */}
                             {isExpanded && isSubmitted && (
                                 <div className="bg-slate-50 p-3 text-sm border-t">
                                     <p className="font-semibold mb-2 text-gray-700">참석 불가능한 일정:</p>
                                     {unavailableIds.length === 0 ? (
                                         <p className="text-gray-500">없음 (모두 참석 가능)</p>
                                     ) : (
                                         <ul className="space-y-1">
                                             {unavailableIds.map(eid => {
                                                 const ev = massEvents[eid];
                                                 return (
                                                     <li key={eid} className="flex gap-2 text-gray-600">
                                                         <span>• {ev ? `${dayjs(ev.event_date).format('M/D(ddd)')} ${ev.title}` : '알 수 없는 일정'}</span>
                                                     </li>
                                                 )
                                             })}
                                         </ul>
                                     )}
                                 </div>
                             )}
                         </div>
                     );
                 })}
              </div>
          </div>
        )}

        {/* ✅ 신규 설문만 입력 가능 */}
        {!existingSurvey && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium">설문 시작일</label>
              <Input
                type="date"
                value={dayjs(startDate).format('YYYY-MM-DD')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">설문 종료일</label>
              <Input
                type="date"
                value={dayjs(endDate).format('YYYY-MM-DD')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1">설문 대상자</label>
              <div className="border rounded-md max-h-[200px] overflow-y-auto p-2 text-sm">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.id)}
                      onChange={() => handleToggleMember(m.id)}
                    />
                    <span>{m.name_kor}</span>
                    {m.baptismal_name && (
                      <span className="text-gray-500 text-xs ml-1">({m.baptismal_name})</span>
                    )}
                    {m.grade && <span className="ml-auto text-gray-400 text-xs">{m.grade}</span>}
                  </div>
                ))}
              </div>
            </div>

            <Button
              disabled={isLoading}
              className="w-full border-blue-400 text-blue-700 hover:bg-blue-50"
              variant="outline"
              onClick={handleStartSurvey}
            >
              {isLoading ? '설문 생성 중...' : '설문 시작'}
            </Button>
          </div>
        )}

        {/* ✅ URL 표시 영역 (기존 or 신규) */}
        {surveyUrl && (
          <div className="flex items-center justify-between mt-4 border rounded-md p-2 bg-gray-50">
            <span className="text-sm truncate text-gray-600">{surveyUrl}</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-2 border-blue-400 text-blue-700 hover:bg-blue-50"
              onClick={handleCopy}
            >
              URL 복사
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
