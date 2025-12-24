import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils'; // optimized class names
import { useSession } from '@/state/session';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(timezone);

interface MemberDoc {
  id: string;
  name_kor: string;
  baptismal_name: string;
  grade?: string;
}

interface MassEventDoc {
  id: string;
  title: string;
  event_date: string; // YYYYMMDD
  member_ids?: string[]; // Assigned member IDs
  main_member_id?: string; // Main server ID
}

export default function ServerAssignmentStatus() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const db = getFirestore();
  const session = useSession();

  // ✅ Initialize from global session or default to current month
  const initialMonth = session.currentViewDate || dayjs().tz('Asia/Seoul').startOf('month');
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(true);

  // Sync with global session changes
  useEffect(() => {
    if (session.currentViewDate && !session.currentViewDate.isSame(currentMonth, 'month')) {
      setCurrentMonth(session.currentViewDate);
    }
  }, [session.currentViewDate]);

  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [unavailableMap, setUnavailableMap] = useState<Record<string, string[]>>({}); // memberId -> [eventId, eventId...]

  const yyyymm = currentMonth.format('YYYYMM');

  // Fetch Data
  useEffect(() => {
    if (!serverGroupId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Active Members
        const memRef = collection(db, `server_groups/${serverGroupId}/members`);
        const memQ = query(memRef, where('active', '==', true));
        const memSnap = await getDocs(memQ);
        const memList = memSnap.docs.map(d => ({ id: d.id, ...d.data() } as MemberDoc));
        
        // Sort Members: Name -> Baptismal Name
        memList.sort((a, b) => {
             const nameCmp = a.name_kor.localeCompare(b.name_kor, 'ko');
             if (nameCmp !== 0) return nameCmp;
             return (a.baptismal_name || '').localeCompare(b.baptismal_name || '', 'ko');
        });
        setMembers(memList);

        // 2. Fetch Mass Events for Month
        const startStr = currentMonth.format('YYYYMMDD');
        const endStr = currentMonth.endOf('month').format('YYYYMMDD');
        const evRef = collection(db, `server_groups/${serverGroupId}/mass_events`);
        const evQ = query(evRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr), orderBy('event_date', 'asc'));
        const evSnap = await getDocs(evQ);
        const evList = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as MassEventDoc));
        setEvents(evList);

        // 3. Fetch Survey Responses (Unavailable Info)
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);
        const uMap: Record<string, string[]> = {};
        
        if (surveySnap.exists()) {
             const sData = surveySnap.data();
             const responses = sData.responses || {};
             Object.values(responses).forEach((resp: any) => {
                 let ids: string[] = [];
                 if (Array.isArray(resp.unavailable)) {
                     ids = resp.unavailable;
                 } else if (resp.unavailable && typeof resp.unavailable === 'object') {
                     ids = Object.keys(resp.unavailable);
                 }
                 if (ids.length > 0) {
                     uMap[resp.uid] = ids;
                 }
             });
        }
        setUnavailableMap(uMap);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serverGroupId, yyyymm, db, currentMonth]);

  const handlePrevMonth = () => {
    const newMonth = currentMonth.subtract(1, 'month');
    setCurrentMonth(newMonth);
    session.setCurrentViewDate?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = currentMonth.add(1, 'month');
    setCurrentMonth(newMonth);
    session.setCurrentViewDate?.(newMonth);
  };

  if (loading) return <LoadingSpinner label="현황 조회 중..." />;

  // Render Helpers
  const renderCell = (member: MemberDoc, event: MassEventDoc) => {
      const isAssigned = event.member_ids?.includes(member.id);
      const isMain = event.main_member_id === member.id;
      const isUnavailable = unavailableMap[member.id]?.includes(event.id);

      if (isAssigned) {
          const isConflict = isUnavailable;
          
          return (
              <div 
                className={cn(
                  "flex items-center justify-center w-full h-full font-bold text-xs rounded shadow-sm border",
                  isConflict 
                    ? "bg-red-50 text-red-600 border-red-200" // Conflict: Assigned but Unavailable
                    : isMain 
                        ? "bg-blue-600 text-white border-blue-600" 
                        : "bg-blue-100 text-blue-800 border-blue-200"
                )}
                title={`${isMain ? "주복사" : "부복사"}${isConflict ? " (불참 설문)" : ""}`}
              >
                  {isMain ? "주" : "부"}
              </div>
          );
      }
      
      if (isUnavailable) {
          return (
            <div className="flex items-center justify-center w-full h-full bg-red-50 text-red-600 font-extrabold text-lg" title="참석불가">
                 ✕ 
            </div>
          );
      }

      return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
         <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
                <ArrowLeft size={20} />
             </Button>
             <h1 className="text-lg font-bold text-gray-800">복사별 배정 현황</h1>
         </div>
         
         <div className="flex items-center gap-4">
             <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="px-2">
                 <ChevronLeft size={20} />
             </Button>
             <span className="text-lg font-bold min-w-[100px] text-center">
                 {currentMonth.format('YYYY년 M월')}
             </span>
             <Button variant="ghost" size="sm" onClick={handleNextMonth} className="px-2">
                 <ChevronRight size={20} />
             </Button>
         </div>
         
         <div className="w-8"></div>{/* Spacer */}
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-auto relative p-4">
          <div className="inline-block min-w-full align-middle border rounded-lg bg-white shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                          <th scope="col" className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              성명
                          </th>
                          {events.map((ev, idx) => {
                            const dateObj = dayjs(ev.event_date);
                            const dateStr = dateObj.format('M/D');
                            const dayOfWeek = dateObj.format('(dd)');
                            const dayNum = dateObj.day(); // 0(Sun) ... 6(Sat)
                            
                            const nextEv = events[idx + 1];
                            const isSameDateAsNext = nextEv && nextEv.event_date === ev.event_date;
                            const borderClass = isSameDateAsNext ? 'border-r-0' : 'border-r';
                            
                            let bgClass = "bg-white";
                            if (dayNum === 0) bgClass = "bg-red-50"; // Sunday
                            if (dayNum === 6) bgClass = "bg-blue-50"; // Saturday

                            // Header bg needs to be solid to cover scroll
                            const headerBgClass = dayNum === 0 ? "bg-red-50" : (dayNum === 6 ? "bg-blue-50" : "bg-gray-50");

                            return (
                              <th key={ev.id} scope="col" className={`px-2 py-2 text-center min-w-[80px] ${borderClass} ${headerBgClass} last:border-r-0`}>
                                  <div className="flex flex-col items-center gap-1">
                                      <span className={`text-[10px] font-semibold ${dayNum === 0 ? "text-red-500" : (dayNum === 6 ? "text-blue-500" : "text-gray-400")}`}>
                                          {dateStr} {dayOfWeek}
                                      </span>
                                      <div className="bg-white border rounded px-1.5 py-0.5 text-xs text-gray-700 font-medium truncate max-w-[70px] shadow-sm" title={ev.title}>
                                          {ev.title}
                                      </div>
                                  </div>
                              </th>
                            );
                          })}
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {members.map(member => (
                          <tr key={member.id} className="hover:bg-gray-50">
                              <td className="sticky left-0 z-10 bg-white px-3 py-2 whitespace-nowrap text-sm border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-gray-50">
                                  <div className="flex flex-col">
                                      <div className="font-medium text-gray-900">{member.name_kor}</div>
                                      <div className="text-xs text-gray-500">{member.baptismal_name}</div>
                                  </div>
                              </td>
                              {events.map((ev, idx) => {
                                  const dateObj = dayjs(ev.event_date);
                                  const dayNum = dateObj.day();
                                  const nextEv = events[idx + 1];
                                  const isSameDateAsNext = nextEv && nextEv.event_date === ev.event_date;
                                  const borderClass = isSameDateAsNext ? 'border-r-0' : 'border-r';
                                  
                                  let bgClass = "";
                                  if (dayNum === 0) bgClass = "bg-red-50/50"; // Sunday (lighter)
                                  if (dayNum === 6) bgClass = "bg-blue-50/50"; // Saturday (lighter)
                                  
                                  return (
                                    <td key={`${member.id}-${ev.id}`} className={`px-2 py-2 whitespace-nowrap text-center h-[50px] ${borderClass} ${bgClass} last:border-r-0`}>
                                        {renderCell(member, ev)}
                                    </td>
                                  );
                              })}
                          </tr>
                      ))}
                      {members.length === 0 && (
                          <tr>
                              <td colSpan={events.length + 1} className="px-6 py-10 text-center text-gray-500 text-sm">
                                  등록된 복사가 없습니다.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
