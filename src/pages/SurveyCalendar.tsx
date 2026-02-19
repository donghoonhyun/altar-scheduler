import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, getDocs, Timestamp, where } from 'firebase/firestore';
import { Container } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MassStatus } from '@/types/firestore';
import { ArrowLeft, Loader2, Download, Trash2, User } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { COLLECTIONS } from '@/lib/collections';

interface SurveyDoc {
  id: string; // yyyymm
  status: 'OPEN' | 'CLOSED';
  start_date?: Timestamp;
  end_date?: Timestamp;
  member_ids?: string[];
  responses?: Record<string, {
    uid: string;
    unavailable: string[]; // List of Event IDs
    updated_at: Timestamp;
  }>;
}

interface MemberInfo {
  id: string;
  name: string;
  baptismal_name?: string;
  grade?: string;
  active?: boolean;
}

interface MassEventDoc {
    id: string;
    event_date: string; // YYYYMMDD
    title: string;
    isDeleted?: boolean;
}

export default function SurveyCalendar() {
  const { serverGroupId, surveyId } = useParams<{ serverGroupId: string; surveyId: string }>(); // surveyId is yyyymm
  const navigate = useNavigate();
  const db = getFirestore();

  const [survey, setSurvey] = useState<SurveyDoc | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, MemberInfo>>({});
  const [eventDateMap, setEventDateMap] = useState<Record<string, string>>({}); // eventId -> YYYY-MM-DD
  const [events, setEvents] = useState<MassEventDoc[]>([]); // Store all fetched events
  const [deletedEvents, setDeletedEvents] = useState<MassEventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MassEventDoc | null>(null);
  const [monthlyStatus, setMonthlyStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  
  // ✅ View Options
  const [viewMode, setViewMode] = useState<'available' | 'unavailable'>('available');
  const [displayMode, setDisplayMode] = useState<'count' | 'name'>('available' === 'available' ? 'count' : 'count'); 
  const [showDeleted, setShowDeleted] = useState(false); 
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all'); 

  // Toggle defaults:
  // "가능보기" (default)
  // "인원수 보기" (default)


  const fetchData = useCallback(async () => {
    if (!serverGroupId || !surveyId) return; // surveyId is like '202511'

    try {
      setLoading(true);
      // 1. Fetch Survey
      const surveyRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'availability_surveys', surveyId);
      const surveySnap = await getDoc(surveyRef);

      if (!surveySnap.exists()) {
        alert('설문 정보를 찾을 수 없습니다.');
        navigate(-1);
        return;
      }

      const surveyData = { id: surveySnap.id, ...surveySnap.data() } as SurveyDoc;
      setSurvey(surveyData);

      // 2. Fetch Monthly Status
      // Collection: ${COLLECTIONS.SERVER_GROUPS}/{gid}/month_status/{YYYYMM}'
      try {
          const monthStatusRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'month_status', surveyId);
          const monthStatusSnap = await getDoc(monthStatusRef);
          if (monthStatusSnap.exists()) {
              setMonthlyStatus(monthStatusSnap.data().status as MassStatus);
          } else {
              setMonthlyStatus('MASS-NOTCONFIRMED');
          }
      } catch (e) {
          console.warn('Failed to fetch monthly status', e);
          setMonthlyStatus('MASS-NOTCONFIRMED');
      }

      // 3. Fetch Mass Events for the month to map IDs to Dates
      const startStr = dayjs(surveyId + '01').startOf('month').format('YYYYMMDD');
      const endStr = dayjs(surveyId + '01').endOf('month').format('YYYYMMDD');

      const eventsQuery = query(
          collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_events'),
          where('event_date', '>=', startStr),
          where('event_date', '<=', endStr)
      );
      const eventsSnap = await getDocs(eventsQuery);
      
      const newEventDateMap: Record<string, string> = {};
      const newEvents: MassEventDoc[] = [];

      eventsSnap.forEach(doc => {
          const data = doc.data();
          // event_date is YYYYMMDD string in DB
          if (data.event_date) {
            const formattedDate = dayjs(data.event_date).format('YYYY-MM-DD');
            newEventDateMap[doc.id] = formattedDate;
            newEvents.push({ id: doc.id, event_date: data.event_date, title: data.title });
          }
      });
      setEventDateMap(newEventDateMap);
      setEvents(newEvents);

      // 4. Fetch Deleted Mass Events
      const deletedQuery = query(
        collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'deleted_mass_events'),
        where('event_date', '>=', startStr),
        where('event_date', '<=', endStr)
      );
      const deletedSnap = await getDocs(deletedQuery);
      const newDeletedEvents: MassEventDoc[] = [];
      deletedSnap.forEach(doc => {
          const data = doc.data();
          if (data.event_date && data.original_id) {
             newDeletedEvents.push({
                 id: data.original_id,
                 event_date: data.event_date,
                 title: data.title || '(삭제됨)',
                 isDeleted: true
             });
          }
      });
      setDeletedEvents(newDeletedEvents);

      // 3. Fetch Members
      const memberIds = surveyData.member_ids || [];
      const responses = surveyData.responses || {};
      
      const respondentUids = Object.values(responses).map(r => r.uid);
      const targetUids = [...new Set([...memberIds, ...respondentUids])];

      if (targetUids.length > 0) {
           const newMap: Record<string, MemberInfo> = {};
           await Promise.all(targetUids.map(async (uid) => {
               try {
                  const snap = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members', uid));
                  if (snap.exists()) {
                      const d = snap.data();
                      newMap[uid] = { 
                          id: uid, 
                          name: d.name_kor, 
                          baptismal_name: d.baptismal_name,
                          grade: d.grade,
                          active: d.active
                      };
                  } else {
                      newMap[uid] = { id: uid, name: '정보없음(삭제됨?)', active: false };
                  }
               } catch(e) { console.error(e); }
           }));
           setMemberMap(newMap);
      }
    } catch (e) {
      console.error(e);
      alert('데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [serverGroupId, surveyId, db, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sorted Members for Dropdown
  const sortedMembers = useMemo(() => {
      return Object.values(memberMap)
          .filter(m => m.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [memberMap]);

  const handleDownloadExcel = () => {
    if (!survey || events.length === 0) return;

    const data = events.map(ev => {
        const date = dayjs(ev.event_date).format('YYYY-MM-DD');
        
        // Calculate lists
        const unavailableUids: string[] = [];
        const responses = survey.responses || {};
        
        Object.values(responses).forEach(r => {
            if (r.unavailable && r.unavailable.includes(ev.id)) {
                unavailableUids.push(r.uid);
            }
        });

        const allMemberIds = survey.member_ids || [];
        const availableUids = allMemberIds
            .filter(id => !unavailableUids.includes(id))
            .filter(uid => memberMap[uid]?.active === true);

        // Also filter unavailable (responses from inactive members)
        const filteredUnavailableUids = unavailableUids.filter(uid => memberMap[uid]?.active === true);

        // Get names
        const getNames = (uids: string[]) => {
            return uids
                .map(uid => memberMap[uid]?.name || 'Unknown')
                .sort((a, b) => a.localeCompare(b))
                .join(', ');
        };

        return {
            '날짜': date,
            '미사': ev.title,
            '가능 인원수': availableUids.length,
            '불가 인원수': filteredUnavailableUids.length,
            '가능 명단': getNames(availableUids),
            '불가 명단': getNames(filteredUnavailableUids)
        };
    });

    // Sort by Date then Title
    data.sort((a: any, b: any) => {
        if (a['날짜'] !== b['날짜']) return a['날짜'].localeCompare(b['날짜']);
        return a['미사'].localeCompare(b['미사']);
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '설문결과');

    // Col widths
    ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 20 }, // Title
        { wch: 10 }, // Avail Count
        { wch: 10 }, // Unavail Count
        { wch: 50 }, // Avail Names
        { wch: 50 }, // Unavail Names
    ];

    XLSX.writeFile(wb, `설문결과_${surveyId}.xlsx`);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900 transition-colors">
       <Container className="py-6">
          <div className="flex flex-col gap-2 mb-6">
              {/* Row 1: Title and Month Status */}
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 dark:hover:bg-slate-800">
                        <ArrowLeft size={24} className="text-gray-900 dark:text-gray-100" />
                     </Button>
                     <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                         {`${parseInt(survey.id.slice(4))}월 불참 설문`}
                     </h1>
                     <Badge variant={survey.status === 'OPEN' ? 'default' : 'secondary'} className={`shrink-0 ${survey.status === 'OPEN' ? 'bg-green-600 hover:bg-green-700' : 'dark:bg-gray-700 dark:text-gray-300'}`}>
                        {survey.status === 'OPEN' ? '진행중' : '마감됨'}
                     </Badge>
                  </div>
                  <StatusBadge status={monthlyStatus} />
              </div>

               {/* Row 2: Description and Actions */}
               <div className="flex justify-between items-end mt-1 pl-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl break-keep">
                     <span className="font-bold">가능/불가</span> 보기에 따라 달력 및 상세 내역이 변경되며, <span className="font-bold">인원수/이름</span>으로 표시 방식을 전환할 수 있습니다. 삭제된 미사도 포함하여 조회 가능합니다.
                  </p>
                  <div className="flex gap-1 shrink-0 ml-4">
                    <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="hidden sm:flex dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200" title="엑셀로 저장">
                        <Download size={16} className="mr-2" />
                        엑셀
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleDownloadExcel} className="sm:hidden dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200" title="엑셀로 저장">
                        <Download size={16} />
                    </Button>
                  </div>
               </div>
          </div>


          <div className="flex flex-col sm:flex-row gap-2 justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm mb-4 transition-colors">
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-md">
                      <button
                        onClick={() => setViewMode('available')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${
                            viewMode === 'available' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        가능보기
                      </button>
                      <button
                        onClick={() => setViewMode('unavailable')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${
                            viewMode === 'unavailable' ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        불가보기
                      </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                       <Switch 
                           id="show-deleted" 
                           checked={showDeleted} 
                           onCheckedChange={setShowDeleted}
                           className="data-[state=checked]:bg-orange-500"
                       />
                       <Label htmlFor="show-deleted" className="text-xs cursor-pointer text-gray-600 dark:text-gray-300">
                           삭제된 미사 포함
                       </Label>
                  </div>

                  {/* Member ID Filtering */}
                  <div className="flex items-center gap-2 border-l pl-4 dark:border-slate-700">
                      <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                         <SelectTrigger className="w-[140px] h-8 text-xs bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                             <div className="flex items-center gap-1 truncate">
                                 <User size={12} className="text-gray-500" />
                                 <SelectValue placeholder="복사 선택" />
                             </div>
                         </SelectTrigger>
                         <SelectContent className="bg-white dark:bg-slate-800">
                             <SelectItem value="all" className="text-xs">전체 복사</SelectItem>
                             {sortedMembers.map(m => (
                                 <SelectItem key={m.id} value={m.id} className="text-xs">
                                     {m.name} {m.baptismal_name && `(${m.baptismal_name})`}
                                 </SelectItem>
                             ))}
                         </SelectContent>
                      </Select>
                  </div>
              </div>

              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                 <span className="text-xs text-gray-400 font-medium hidden sm:inline">|</span>
                 <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-md">
                    <button
                        onClick={() => setDisplayMode('count')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${
                            displayMode === 'count' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        인원수
                    </button>
                    <button
                        onClick={() => setDisplayMode('name')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${
                            displayMode === 'name' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        이름
                    </button>
                 </div>
              </div>
          </div>

          <div className="space-y-4">
               {/* Calendar Grid */}
               {(() => {
                   const year = parseInt(survey.id.slice(0, 4));
                   const month = parseInt(survey.id.slice(4)) - 1; // 0-indexed
                   const startOfMonth = dayjs(new Date(year, month, 1));
                   const daysInMonth = startOfMonth.daysInMonth();
                   const startDayOfWeek = startOfMonth.day(); // 0(Sun) - 6(Sat)

                   const weeks = [];
                   let currentWeek = Array(startDayOfWeek).fill(null);

                   for (let i = 1; i <= daysInMonth; i++) {
                       const date = startOfMonth.date(i);
                       currentWeek.push(date);
                       if (currentWeek.length === 7) {
                           weeks.push(currentWeek);
                           currentWeek = [];
                       }
                   }
                   if (currentWeek.length > 0) {
                       while(currentWeek.length < 7) currentWeek.push(null);
                       weeks.push(currentWeek);
                   }

 

                   // RE-IMPLEMENTING RENDER LOGIC WITH NEW STATE
                   // We need 'eventsByDate' which requires fetching titles. 
                   // Since I can't easily change the hook state structure and the render logic in one clean swap without rewriting the whole hook part,
                   // I will assume the 'events' are available or I will re-fetch/process them inside the render (not ideal) or update the hook in a separate block.
                   // Actually, I'll rewrite the whole component body slightly to include the new state and render logic.
                   
                   return (

                       <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-2 sm:p-4 transition-colors">
                           <div className="grid grid-cols-7 mb-2 sm:mb-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-bold">
                               <div className="text-red-500 dark:text-red-400">일</div>
                               <div>월</div>
                               <div>화</div>
                               <div>수</div>
                               <div>목</div>
                               <div>금</div>
                               <div className="text-blue-500 dark:text-blue-400">토</div>
                           </div>
                           <div className="space-y-1 sm:space-y-2">
                               {weeks.map((week, wIdx) => (
                                   <div key={wIdx} className="grid grid-cols-7 gap-1 sm:gap-2">
                                       {week.map((date, dIdx) => {
                                           if (!date) return <div key={dIdx} />;
                                           const dateStr = date.format('YYYY-MM-DD');
                                           
                                           // Merge active and deleted events
                                           let dayEvents = events.filter(e => dayjs(e.event_date).format('YYYY-MM-DD') === dateStr);
                                           
                                           if (showDeleted) {
                                               const activeIds = new Set(dayEvents.map(e => e.id));
                                               const dayDeleted = deletedEvents.filter(e => dayjs(e.event_date).format('YYYY-MM-DD') === dateStr);
                                               dayDeleted.forEach(de => {
                                                   if (!activeIds.has(de.id)) {
                                                       // dedupe
                                                       if (!dayEvents.find(x => x.id === de.id)) {
                                                           dayEvents.push(de);
                                                       }
                                                   }
                                               });
                                           }

                                           dayEvents.sort((a, b) => a.title.localeCompare(b.title));

                                           return (
                                               <div 
                                                   key={dIdx}
                                                   className={`min-h-[80px] sm:min-h-[120px] flex flex-col items-start justify-start p-1 rounded-lg transition-all border
                                                      bg-white border-gray-100 hover:bg-gray-50
                                                      dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700/50
                                                   `}
                                               >
                                                   <span className={`text-[10px] sm:text-xs w-full text-center mb-1 font-medium ${(date.day() === 0 ? 'text-red-500 dark:text-red-400' : date.day() === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300')}`}>
                                                      {date.date()}
                                                   </span>
                                                   
                                                   <div className="flex flex-col gap-1 w-full relative">
                                                       {dayEvents.map(ev => {
                                                            // Logic to determine count/names based on viewMode
                                                            const unavailableUids: string[] = [];
                                                            Object.values(survey.responses || {}).forEach(r => {
                                                                if (r.unavailable && r.unavailable.includes(ev.id)) {
                                                                    unavailableUids.push(r.uid);
                                                                }
                                                            });

                                                            const allMemberIds = survey.member_ids || [];
                                                            const availableUids = allMemberIds.filter(id => !unavailableUids.includes(id));

                                                            const rawTargetUids = viewMode === 'available' ? availableUids : unavailableUids;
                                                            // Filter Active
                                                            let targetUids = rawTargetUids.filter(uid => memberMap[uid]?.active === true);
                                                            
                                                            // 🟢 Member Filtering Logic
                                                            let isVisible = true;
                                                            if (selectedMemberId !== 'all') {
                                                                isVisible = targetUids.includes(selectedMemberId);
                                                                
                                                                if (isVisible) {
                                                                    // Show only that member's presence in the list
                                                                    targetUids = [selectedMemberId];
                                                                }
                                                            }

                                                            const count = targetUids.length;

                                                            if (selectedMemberId !== 'all' && !isVisible) return null;

                                                            const isEventSelected = selectedEvent?.id === ev.id;
                                                            
                                                                    const isDeleted = ev.isDeleted;
                                                                    
                                                                    // Styles
                                                                    let bgColor = viewMode === 'available' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-red-50 dark:bg-red-900/30';
                                                                    let borderColor = viewMode === 'available' ? 'border-blue-100 dark:border-blue-800' : 'border-red-100 dark:border-red-800';
                                                                    let textColor = viewMode === 'available' ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300';
                                                                    const badgeColor = viewMode === 'available' ? 'bg-blue-500' : 'bg-red-500';

                                                                    // Deleted Style Override
                                                                    if (isDeleted) {
                                                                        bgColor = 'bg-gray-100 dark:bg-slate-700';
                                                                        borderColor = 'border-gray-300 dark:border-slate-600';
                                                                        textColor = 'text-gray-500 dark:text-gray-400 line-through';
                                                                    }

                                                           return (
                                                               <div 
                                                                    key={ev.id} 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedEvent(ev);
                                                                    }}
                                                                    className={`
                                                                        w-full rounded border flex flex-col justify-start items-start cursor-pointer transition-all overflow-hidden
                                                                        ${isEventSelected ? 'ring-2 ring-gray-900 dark:ring-gray-100 border-gray-900 dark:border-gray-100 z-10 shadow-sm' : ''}
                                                                        ${count > 0 || isDeleted ? `${bgColor} ${borderColor} ${textColor}` : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'}
                                                                        hover:brightness-95 dark:hover:brightness-110
                                                                    `}
                                                               >
                                                                   {/* Header: Title + Count */}
                                                                   <div className="w-full flex items-center justify-between p-1 gap-1">
                                                                       <span className="text-[9px] sm:text-[10px] font-medium truncate leading-tight flex-1 text-left">{ev.title}</span>
                                                                       {displayMode === 'count' && count > 0 && (
                                                                            <span className={`${badgeColor} text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold px-0.5 shrink-0`}>
                                                                                {count}
                                                                            </span>
                                                                       )}
                                                                   </div>

                                                                   {/* Name List View */}
                                                                   {displayMode === 'name' && count > 0 && (
                                                                       <div className="w-full px-1 pb-1 pt-0 flex flex-wrap gap-0.5">
                                                                            {targetUids.map(uid => {
                                                                                const m = memberMap[uid];
                                                                                return (
                                                                                    <span key={uid} className="text-[8px] leading-tight opacity-90 truncate max-w-full">
                                                                                        {m?.name || '?'}{' '}
                                                                                    </span>
                                                                                )
                                                                            })}
                                                                       </div>
                                                                   )}
                                                               </div>
                                                           );
                                                       })}
                                                   </div>
                                               </div>
                                           );
                                       })}
                                   </div>
                               ))}
                           </div>
                       </div>
                   );
               })()}



               {/* Selected Event Details Drawer */}
               <Drawer open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                   <DrawerContent>
                       <DrawerHeader className="text-left">
                           <DrawerTitle className="flex items-center gap-2 text-xl">
                               {selectedEvent && (
                                   <>
                                       <span className={`w-1.5 h-6 rounded-full ${viewMode === 'available' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                                       {selectedEvent.isDeleted && <Trash2 size={16} className="text-gray-400 mr-1" />}
                                       <span className={selectedEvent.isDeleted ? 'line-through text-gray-500' : ''}>
                                          {selectedEvent.title}
                                       </span>
                                       <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">
                                            {dayjs(selectedEvent.event_date).format('M월 D일')}
                                       </span>
                                   </>
                               )}
                           </DrawerTitle>
                       </DrawerHeader>
                       
                       <div className="p-4 pt-0">
                           {selectedEvent && (
                               <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                       <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                           {viewMode === 'available' ? '참석 가능 인원' : '불참 인원'}
                                       </span>
                                       <Badge variant="secondary" className={`${viewMode === 'available' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-100 dark:border-red-800'}`}>
                                            {(() => {
                                                const unavailableUids: string[] = [];
                                                Object.values(survey.responses || {}).forEach(r => {
                                                    if(r.unavailable?.includes(selectedEvent.id)) unavailableUids.push(r.uid);
                                                });
                                                
                                                const allMemberIds = survey.member_ids || [];
                                                const availableUids = allMemberIds.filter(id => !unavailableUids.includes(id));
                                                
                                                const finalAvailable = availableUids.filter(uid => memberMap[uid]?.active === true);
                                                const finalUnavailable = unavailableUids.filter(uid => memberMap[uid]?.active === true);

                                                const count = viewMode === 'available' ? finalAvailable.length : finalUnavailable.length;
                                                return `${count}명`;
                                            })()}
                                       </Badge>
                                   </div>

                                    <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
                                       {(() => {
                                          const unavailableUids: string[] = [];
                                          Object.values(survey.responses || {}).forEach(r => {
                                              if(r.unavailable?.includes(selectedEvent.id)) unavailableUids.push(r.uid);
                                          });

                                          const allMemberIds = survey.member_ids || [];
                                          const availableUids = allMemberIds.filter(id => !unavailableUids.includes(id));
                                          
                                          const rawTargetUids = viewMode === 'available' ? availableUids : unavailableUids;
                                          const targetUids = rawTargetUids.filter(uid => memberMap[uid]?.active === true);

                                          if (targetUids.length === 0) return <div className="text-sm text-gray-400 w-full py-4 text-center bg-gray-50 dark:bg-slate-700/50 rounded-lg">해당 인원이 없습니다.</div>;

                                          // Sort: Grade -> Name
                                          const userList = targetUids.map(uid => memberMap[uid] || { id: uid, name: '...', grade: '' });
                                          userList.sort((a, b) => {
                                              // Grade Compare logic hard to access here, simplify to Name sort
                                              return a.name.localeCompare(b.name);
                                          });

                                          return userList.map(info => {
                                              return (
                                                  <div key={info.id} className="flex flex-col items-center justify-center p-2 rounded bg-gray-100 dark:bg-slate-700">
                                                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{info.name}</span>
                                                      {info.baptismal_name && <span className="text-[10px] text-blue-600 dark:text-blue-300 -mt-0.5">{info.baptismal_name}</span>}
                                                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{info.grade}</span>
                                                  </div>
                                              );
                                          });
                                       })()}
                                   </div>
                               </div>
                           )}
                       </div>

                       <DrawerFooter>
                           <Button onClick={() => setSelectedEvent(null)} className="w-full">닫기</Button>
                       </DrawerFooter>
                   </DrawerContent>
               </Drawer>
          </div>
       </Container>
    </div>
  );
}
