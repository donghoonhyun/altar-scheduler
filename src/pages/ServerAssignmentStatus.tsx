import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutList, LayoutGrid, Download } from 'lucide-react';
import dayjs from 'dayjs';
import { utils, writeFile } from 'xlsx';
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
  const [viewMode, setViewMode] = useState<'by-member' | 'by-date'>('by-member');

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

  const memberMap = useMemo(() => {
    return members.reduce((acc, m) => {
      acc[m.id] = m;
      return acc;
    }, {} as Record<string, MemberDoc>);
  }, [members]);

  const eventsByDate = useMemo(() => {
     const grouped: Record<string, MassEventDoc[]> = {};
     events.forEach(ev => {
        if (!grouped[ev.event_date]) grouped[ev.event_date] = [];
        grouped[ev.event_date].push(ev);
     });
     return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

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

  const handleDownloadExcel = () => {
    const filename = `복사배정현황_${currentMonth.format('YYYYMM')}_${viewMode === 'by-member' ? '복사별' : '날짜별'}.xlsx`;
    const wb = utils.book_new();

    if (viewMode === 'by-member') {
       // 1. By Member Data
       const data = members.map(m => {
          const row: any = {
              '이름': m.name_kor,
              '세례명': m.baptismal_name,
              '학년': m.grade || '',
          };

          events.forEach(ev => {
              const isAssigned = ev.member_ids?.includes(m.id);
              const isMain = ev.main_member_id === m.id;
              const isUnavailable = unavailableMap[m.id]?.includes(ev.id);
              
              const dateKey = `${dayjs(ev.event_date).format('MM/DD')} ${ev.title}`;
              
              if (isAssigned) {
                  row[dateKey] = isMain ? '주' : '부';
                  if (isUnavailable) row[dateKey] += '!'; // Conflict
              } else if (isUnavailable) {
                  row[dateKey] = '✕';
              } else {
                  row[dateKey] = '';
              }
          });
          return row;
       });

       const ws = utils.json_to_sheet(data);
       // Auto-width for first few columns
       const wscols = [{wch: 10}, {wch: 10}, {wch: 6}];
       ws['!cols'] = wscols;

       utils.book_append_sheet(wb, ws, '복사별 현황');

    } else {
       // 2. By Date Data
       const data: any[] = [];
       
       eventsByDate.forEach(([dateStr, dayEvents]) => {
           dayEvents.forEach(ev => {
               const dateObj = dayjs(ev.event_date);
               const servers = (ev.member_ids || []).map(mid => {
                   const m = memberMap[mid];
                   if (!m) return '';
                   const isMain = ev.main_member_id === mid;
                   return `${m.name_kor}${isMain ? '(주)' : ''}`;
               }).join(', ');

               data.push({
                   '날짜': dateObj.format('YYYY-MM-DD'),
                   '요일': dateObj.format('ddd'),
                   '미사': ev.title,
                   '배정 복사': servers,
                   '인원': ev.member_ids?.length || 0
               });
           });
       });

       const ws = utils.json_to_sheet(data);
       const wscols = [{wch: 12}, {wch: 5}, {wch: 20}, {wch: 50}, {wch: 5}];
       ws['!cols'] = wscols;

       utils.book_append_sheet(wb, ws, '날짜별 현황');
    }

    writeFile(wb, filename);
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
          
         <div className="flex items-center gap-2">
            {/* Toggle View Mode */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                onClick={() => setViewMode('by-member')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'by-member' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                )}
                >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">복사별</span>
                </button>
                <button
                onClick={() => setViewMode('by-date')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'by-date' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                )}
                >
                    <LayoutList size={16} />
                <span className="hidden sm:inline">날짜별</span>
                </button>
            </div>
            
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="hidden sm:flex" title="엑셀로 저장">
                <Download size={16} className="mr-2" />
                엑셀
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownloadExcel} className="sm:hidden" title="엑셀로 저장">
                <Download size={16} />
            </Button>
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-auto relative p-4">
          <div className="inline-block min-w-full align-middle border rounded-lg bg-white shadow-sm overflow-hidden min-h-[500px]">
              {viewMode === 'by-member' ? (
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
              ) : (
                // By Date View
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px] border-r">
                                날짜
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                배정 복사
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {eventsByDate.map(([dateStr, dayEvents]) => {
                            const dateObj = dayjs(dateStr);
                            const dayNum = dateObj.day();
                            const isSun = dayNum === 0;
                            const isSat = dayNum === 6;
                            
                            return (
                                <tr key={dateStr} className={cn(
                                    "transition-colors hover:bg-gray-50",
                                    isSun ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : "bg-white"
                                )}>
                                    <td className={cn("px-6 py-4 whitespace-nowrap text-sm font-medium border-r align-top", isSun ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-900")}>
                                        {dateObj.format('M월 D일 (ddd)')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-3">
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} className="border rounded-md p-3 bg-white shadow-sm min-w-[200px] flex-1 max-w-[300px]">
                                                    <div className="text-xs font-semibold text-gray-500 mb-2 pb-1 border-b flex justify-between items-center">
                                                        <span>{ev.title}</span>
                                                        <span className="text-[10px] bg-gray-100 px-1.5 rounded">{ev.member_ids?.length || 0}명</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {ev.member_ids && ev.member_ids.length > 0 ? (
                                                            ev.member_ids.map(mid => {
                                                                const member = memberMap[mid];
                                                                const isMain = ev.main_member_id === mid;
                                                                if (!member) return null; // Should not happen if data consistent

                                                                return (
                                                                    <div key={mid} className={cn(
                                                                        "flex items-center gap-1.5 px-1.5 py-1 rounded text-xs transition-colors truncate",
                                                                        isMain 
                                                                           ? "bg-blue-50 text-blue-700 font-medium border border-blue-100" 
                                                                           : "bg-gray-50 text-gray-700 border border-transparent"
                                                                    )}>
                                                                        {isMain && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 rounded shrink-0">주</span>}
                                                                        <span className="truncate">{member.name_kor} {member.baptismal_name}</span>
                                                                    </div>
                                                                )
                                                            })
                                                        ) : (
                                                            <span className="col-span-2 text-xs text-gray-400 italic py-1 text-center">배정된 복사 없음</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {eventsByDate.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-6 py-10 text-center text-gray-500">
                                    일정이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
              )}
          </div>
      </div>
    </div>
  );
}
