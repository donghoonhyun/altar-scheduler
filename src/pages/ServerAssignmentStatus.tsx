import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutList, LayoutGrid, Download, CalendarDays } from 'lucide-react';
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
import { COLLECTIONS } from '@/lib/collections';
import timezone from 'dayjs/plugin/timezone';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MassStatus } from '@/types/firestore';
import { Printer, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import ReactMarkdown from 'react-markdown';

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
  const [viewDetailMode, setViewDetailMode] = useState<'daily' | 'monthly'>('monthly');
  const [monthlyStatus, setMonthlyStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');
  const [extraStatuses, setExtraStatuses] = useState<Record<string, MassStatus>>({});

  // Sync with global session changes
  useEffect(() => {
    if (session.currentViewDate && !session.currentViewDate.isSame(currentMonth, 'month')) {
      setCurrentMonth(session.currentViewDate);
    }
  }, [session.currentViewDate]);

  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  // const [unavailableMap, setUnavailableMap] = useState<Record<string, string[]>>({}); // Removed per request

  // AI Analysis State
  const [aiData, setAiData] = useState<{ content: string; total_count?: number; created_at?: any } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Default collapsed
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]); // Renamed to avoid reserved word collision

  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [useAi, setUseAi] = useState(false); // Toggle AI feature based on parish settings

  const yyyymm = currentMonth.format('YYYYMM');

  // Check Parish AI Setting
  useEffect(() => {
    if (!serverGroupId) return;
    const checkAiSetting = async () => {
        try {
            // 1. Get Parish Code from Server Group
            const sgSnap = await getDoc(doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}`));
            if (!sgSnap.exists()) return;
            const parishCode = sgSnap.data().parish_code;

            // 2. Get AI Setting from Parish
            if (parishCode) {
                const parishSnap = await getDoc(doc(db, `parishes/${parishCode}`));
                if (parishSnap.exists()) {
                    setUseAi(parishSnap.data().ai_service_active === true);
                }
            }
        } catch(e) {
            console.error('Failed to check AI setting', e);
        }
    };
    checkAiSetting();
  }, [serverGroupId, db]);

  // Fetch Existing AI Insight & History
  useEffect(() => {
    if (!serverGroupId) return;
    const fetchInsight = async () => {
        try {
            // 1. Fetch Current Insight
            const ref = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/ai_insights/${yyyymm}`);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                setAiData({ 
                    content: data.content, 
                    total_count: data.total_count || 1,
                    created_at: data.created_at
                });
            } else {
                setAiData(null);
            }

            // 2. Fetch History
            const histRef = collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/ai_insights/${yyyymm}/history`);
            const histQ = query(histRef, orderBy('created_at', 'desc'));
            const histSnap = await getDocs(histQ);
            const histList = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAnalysisHistory(histList);

        } catch (e) {
            console.error(e);
        }
    };
    fetchInsight();
  }, [serverGroupId, yyyymm, db]);

  const handleAiAnalysis = async () => {
      if (analyzing) return;
      setAnalyzing(true);
      try {
          const analyzeFn = httpsCallable(functions, 'altar_analyzeMonthlyAssignments');
          const result = await analyzeFn({ 
              serverGroupId, 
              yyyymm: currentMonth.format('YYYY-MM') 
          }) as { data: { success: boolean, content: string } };
          
          if (result.data.success) {
              const now = new Date();
              setAiData(prev => ({ 
                  content: result.data.content, 
                  total_count: (prev?.total_count || 0) + 1,
                  created_at: { seconds: now.getTime() / 1000 }
              }));
              setIsExpanded(true); 

              // Add to history list locally
              setAnalysisHistory(prev => [{
                id: 'temp-' + now.getTime(),
                content: result.data.content,
                created_at: { seconds: now.getTime() / 1000 },
                model: 'gemini-2.5-flash'
            }, ...prev]);
          }
      } catch (e) {
          console.error('AI Analysis failed', e);
          alert('AI 분석 중 오류가 발생했습니다.');
      } finally {
          setAnalyzing(false);
      }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = new Date(ts.seconds * 1000);
    return dayjs(date).format('M/D HH:mm');
  };

  // Fetch Data
  useEffect(() => {
    if (!serverGroupId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Active Members
        const memRef = collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/members`);
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

        // 2. Fetch Mass Events logic
        // If monthly view, fetch prev/curr/next months. If daily, just current.
        let startStr: string, endStr: string;
        if (viewDetailMode === 'monthly') {
          startStr = currentMonth.subtract(1, 'month').startOf('month').format('YYYYMMDD');
          endStr = currentMonth.add(1, 'month').endOf('month').format('YYYYMMDD');
        } else {
          startStr = currentMonth.startOf('month').format('YYYYMMDD');
          endStr = currentMonth.endOf('month').format('YYYYMMDD');
        }
        const evRef = collection(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/mass_events`);
        const evQ = query(evRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr), orderBy('event_date', 'asc'));
        const evSnap = await getDocs(evQ);
        const evList = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as MassEventDoc));
        setEvents(evList);

        // 3. (Removed) Fetch Survey Responses logic was here
        // The user requested to show ONLY assigned info, regardless of survey status.

        // 4. Fetch Monthly Status (Current & Neighbors)
        const fetchStatus = async (m: dayjs.Dayjs) => {
            try {
                const ym = m.format('YYYYMM');
                const ref = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/month_status/${ym}`);
                const snap = await getDoc(ref);
                return { key: ym, status: snap.exists() ? (snap.data().status as MassStatus) : 'MASS-NOTCONFIRMED' as MassStatus };
            } catch {
                return { key: m.format('YYYYMM'), status: 'MASS-NOTCONFIRMED' as MassStatus };
            }
        };

        const statusResults = await Promise.all([
            fetchStatus(currentMonth.subtract(1, 'month')),
            fetchStatus(currentMonth),
            fetchStatus(currentMonth.add(1, 'month'))
        ]);

        const newStatusMap: Record<string, MassStatus> = {};
        statusResults.forEach(r => newStatusMap[r.key] = r.status);
        setExtraStatuses(newStatusMap);
        setMonthlyStatus(newStatusMap[yyyymm]);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serverGroupId, yyyymm, db, currentMonth, viewDetailMode]);

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

      if (isAssigned) {
          return (
              <div 
                className={cn(
                  "flex items-center justify-center w-full h-full font-bold text-xs rounded shadow-sm border",
                  isMain 
                        ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:text-white dark:border-blue-500" 
                        : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                )}
                title={isMain ? "주복사" : "부복사"}
              >
                  {isMain ? "주" : "부"}
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
           const count = events.filter(ev => ev.member_ids?.includes(m.id)).length;
           const row: any = {
               '이름': m.name_kor,
               '세례명': m.baptismal_name,
               '학년': m.grade || '',
               '배정횟수': count,
           };

           events.forEach(ev => {
               const isAssigned = ev.member_ids?.includes(m.id);
               const isMain = ev.main_member_id === m.id;
               
               const dateKey = `${dayjs(ev.event_date).format('MM/DD')} ${ev.title}`;
               
               if (isAssigned) {
                   row[dateKey] = isMain ? '주' : '부';
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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-transparent overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 py-4 flex flex-col gap-1 shadow-sm shrink-0">
         {/* Row 1: Title & Status */}
         <div className="flex justify-between items-center">
             <div className="flex items-center gap-1">
                 <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 mr-2 dark:text-gray-200">
                    <ArrowLeft size={24} />
                 </Button>
                 
                 <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                    <ChevronLeft size={20} />
                 </Button>

                 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 min-w-[110px] text-center">
                    {currentMonth.format('YYYY년 M월')}
                 </h1>

                 <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                    <ChevronRight size={20} />
                 </Button>

                 <span className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-2">
                    배정 현황
                 </span>
             </div>
             <StatusBadge status={monthlyStatus} />
         </div>

          <div className="pl-11 pr-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                 월별 미사 배정 현황을 조회하고 번표를 출력할 수 있습니다.
              </p>

              {/* AI Insight Section */}
              {useAi && (
              <div className="bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/30 rounded-lg overflow-hidden shadow-sm transition-all pb-0 relative">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/10 dark:to-slate-800"
                    onClick={() => {
                        if (aiData) setIsExpanded(!isExpanded);
                        else handleAiAnalysis();
                    }}
                  >
                        <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-white dark:bg-slate-700 rounded-full shadow-sm text-purple-600 dark:text-purple-400">
                                <Sparkles size={14} />
                             </div>
                             <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                AI 배정 분석 {aiData && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">({aiData.total_count}회 분석됨)</span>}
                             </span>
                             {analysisHistory.length > 0 && (
                                <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        className="text-[11px] flex items-center gap-1 bg-white dark:bg-slate-700 border border-purple-100 dark:border-slate-600 rounded px-2 py-0.5 hover:bg-purple-50 dark:hover:bg-slate-600 transition-colors text-gray-600 dark:text-gray-300"
                                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                                    >
                                        🕒 이력 ({analysisHistory.length})
                                        <ChevronDown size={12} />
                                    </button>
                                    
                                    {showHistoryDropdown && (
                                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 z-50 max-h-60 overflow-y-auto">
                                            {analysisHistory.map((h, idx) => (
                                                <div 
                                                    key={h.id}
                                                    className={cn(
                                                        "px-3 py-2 text-xs border-b dark:border-slate-700 last:border-0 hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center group",
                                                        // Highlight current if needed
                                                    )}
                                                    onClick={() => {
                                                        setAiData(prev => ({ ...prev!, content: h.content, created_at: h.created_at }));
                                                        setShowHistoryDropdown(false);
                                                        setIsExpanded(true);
                                                    }}
                                                >
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                        {formatTime(h.created_at)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 group-hover:text-purple-500">
                                                        {idx === 0 ? '최신' : '과거'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>
                        <div className="flex items-center gap-2">
                             {!aiData ? (
                                 <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        handleAiAnalysis();
                                    }}
                                    disabled={analyzing}
                                 >
                                    {analyzing ? <LoadingSpinner size="sm" /> : <><Sparkles size={12} /> 분석 시작</>}
                                 </Button>
                             ) : (
                                 <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                     {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                 </button>
                             )}
                        </div>
                  </div>

                  {/* AI Content */}
                  {aiData && (
                      <div className={cn(
                          "bg-white dark:bg-slate-800/50 border-t border-purple-50/50 dark:border-purple-900/20 transition-all duration-300",
                          isExpanded ? "p-4 pt-2" : "max-h-[100px] overflow-hidden relative p-4 pt-2"
                      )}>
                          {aiData.created_at && (
                              <div className="flex justify-end mb-2">
                                  <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                                      분석시점: {formatTime(aiData.created_at)}
                                  </span>
                              </div>
                          )}
                          <div className={cn(
                              "text-gray-700 dark:text-gray-300 text-xs sm:text-sm leading-relaxed",
                              isExpanded && "h-[600px] overflow-y-auto pr-2 custom-scrollbar" // Increased height to 600px
                          )}>
                              <ReactMarkdown
                                components={{
                                    h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2 text-purple-800 dark:text-purple-300" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-base font-bold mt-3 mb-1 text-gray-900 dark:text-gray-100 border-l-4 border-purple-400 pl-2" {...props} />,
                                    h3: ({node, ...props}) => <h3 className="text-sm font-bold mt-2 mb-1 text-gray-800 dark:text-gray-200" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2 pl-1" {...props} />,
                                    li: ({node, ...props}) => <li className="ml-1" {...props} />,
                                    strong: ({node, ...props}) => <strong className="font-bold text-gray-900 dark:text-white bg-purple-50 dark:bg-purple-900/40 px-0.5 rounded" {...props} />,
                                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                }}
                              >
                                  {aiData.content}
                              </ReactMarkdown>
                          </div>
                          
                          {/* Fade Overlay when collapsed */}
                          {!isExpanded && (
                              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-slate-800 to-transparent flex items-end justify-center pb-2 cursor-pointer"
                                  onClick={() => setIsExpanded(true)}
                              >
                                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-full shadow-sm border border-purple-100 dark:border-purple-800">
                                      더 읽으려면 클릭하세요
                                  </span>
                              </div>
                          )}

                          {isExpanded && (
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800/95 backdrop-blur-sm -mb-4 -mx-4 px-4 py-3">
                                <span className="text-[10px] text-gray-400">
                                    최근 생성됨 • Google Gemini 2.5 Flash
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAiAnalysis(); 
                                    }}
                                    disabled={analyzing}
                                >
                                    {analyzing ? <LoadingSpinner size="sm" /> : '🔄 다시 분석하기'}
                                </Button>
                            </div>
                          )}
                      </div>
                  )}
              </div>
              )}
          </div>

          {/* Row 3: Controls */}
         <div className="flex flex-col sm:flex-row justify-between items-center mt-4 bg-gray-50 dark:bg-slate-800/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700 gap-2">
             {/* Left: View Mode */}
             <div className="flex bg-white dark:bg-slate-800 p-1 rounded-md border dark:border-slate-600 shadow-sm">
                <button
                onClick={() => setViewMode('by-member')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                    viewMode === 'by-member' ? "bg-blue-50 text-blue-600 dark:bg-slate-700 dark:text-blue-300 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                )}
                >
                <LayoutGrid size={14} />
                복사별
                </button>
                <button
                onClick={() => setViewMode('by-date')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                    viewMode === 'by-date' ? "bg-blue-50 text-blue-600 dark:bg-slate-700 dark:text-blue-300 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                )}
                >
                <LayoutList size={14} />
                날짜별
                </button>
            </div>

            {/* ✅ Sub Toggle for By-Member View */}
            {viewMode === 'by-member' && (
                 <div className="flex bg-white dark:bg-slate-800 p-1 rounded-md border dark:border-slate-600 shadow-sm ml-2">
                    <button
                        onClick={() => setViewDetailMode('monthly')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                            viewDetailMode === 'monthly' ? "bg-gray-100 text-gray-900 dark:bg-slate-700 dark:text-gray-100 font-bold" : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                        )}
                    >
                        <CalendarDays size={14} />
                        월별
                    </button>
                    <button
                        onClick={() => setViewDetailMode('daily')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                            viewDetailMode === 'daily' ? "bg-gray-100 text-gray-900 dark:bg-slate-700 dark:text-gray-100 font-bold" : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                        )}
                    >
                        일별
                    </button>
                 </div>
            )}

            {/* Center: Legend (Removed) */}


            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                 <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`/server-groups/${serverGroupId}/print-schedule/${yyyymm}`, '_blank')} 
                    className="gap-2 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700"
                >
                    <Printer size={14} />
                    복사번표출력
                </Button>

                <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="gap-2 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700" title="엑셀로 저장">
                    <Download size={14} />
                    엑셀
                </Button>
            </div>
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-auto relative p-4">
          <div className="inline-block min-w-full align-middle border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[500px]">
              {viewMode === 'by-member' ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                  <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                      <tr>
                          <th scope="col" className="sticky left-0 z-20 bg-gray-50 dark:bg-slate-800 px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px] border-r dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              성명
                          </th>
                          
                          {/* Daily Header */}
                          {viewDetailMode === 'daily' && events.map((ev, idx) => {
                             const dateObj = dayjs(ev.event_date);
                             const dateStr = dateObj.format('M/D');
                             const dayOfWeek = dateObj.format('(dd)');
                             const dayNum = dateObj.day(); // 0(Sun) ... 6(Sat)
                             
                             const nextEv = events[idx + 1];
                             const isSameDateAsNext = nextEv && nextEv.event_date === ev.event_date;
                             const borderClass = isSameDateAsNext ? 'border-r-0' : 'border-r dark:border-slate-700';
                             
                             let bgClass = "bg-white dark:bg-slate-900";
                             if (dayNum === 0) bgClass = "bg-red-50 dark:bg-red-900/10"; // Sunday
                             if (dayNum === 6) bgClass = "bg-blue-50 dark:bg-blue-900/10"; // Saturday

                             // Header bg needs to be solid to cover scroll
                             const headerBgClass = dayNum === 0 ? "bg-red-50 dark:bg-red-900/10" : (dayNum === 6 ? "bg-blue-50 dark:bg-blue-900/10" : "bg-gray-50 dark:bg-slate-800");

                             return (
                               <th key={ev.id} scope="col" className={`px-1 py-1 text-center min-w-[60px] ${borderClass} ${headerBgClass} last:border-r-0`}>
                                   <div className="flex flex-col items-center gap-1">
                                       <span className={`text-[10px] font-semibold ${dayNum === 0 ? "text-red-500 dark:text-red-400" : (dayNum === 6 ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500")}`}>
                                           {dateStr} {dayOfWeek}
                                       </span>
                                       <div className="bg-white dark:bg-slate-700 border dark:border-slate-600 rounded px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-200 font-medium truncate max-w-[70px] shadow-sm" title={ev.title}>
                                           {ev.title}
                                       </div>
                                   </div>
                               </th>
                             );
                          })}

                          {/* Monthly Header */}
                          {viewDetailMode === 'monthly' && (
                             <>
                                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-slate-700 w-[30%] bg-gray-50 dark:bg-slate-800">
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                      <span>{currentMonth.subtract(1, 'month').format('YY년 M월')}</span>
                                      <StatusBadge status={extraStatuses[currentMonth.subtract(1, 'month').format('YYYYMM')]} size="sm" />
                                    </div>
                                </th>
                                <th scope="col" className="px-3 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-r dark:border-slate-700 w-[30%] bg-blue-50/30 dark:bg-blue-900/10">
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                      <span>{currentMonth.format('YY년 M월')}</span>
                                      <StatusBadge status={extraStatuses[currentMonth.format('YYYYMM')]} size="sm" />
                                    </div>
                                </th>
                                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%] bg-gray-50 dark:bg-slate-800">
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                      <span>{currentMonth.add(1, 'month').format('YY년 M월')}</span>
                                      <StatusBadge status={extraStatuses[currentMonth.add(1, 'month').format('YYYYMM')]} size="sm" />
                                    </div>
                                </th>
                             </>
                          )}
                      </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-600">
                       {members.map(member => {
                           // Count only current month for display consistency, or total? Let's show current month count.
                           const count = events.filter(ev => ev.member_ids?.includes(member.id) && dayjs(ev.event_date).isSame(currentMonth, 'month')).length;
                           return (
                            <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-2 py-1.5 whitespace-nowrap text-sm border-r dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-gray-50 align-top">
                                    <div className="flex items-center h-full pt-1">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{member.name_kor}</span>
                                        <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1.5">{member.baptismal_name}</span>
                                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold ml-1.5 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">({count}회)</span>
                                    </div>
                                </td>
                                
                                {/* Daily Body */}
                                {viewDetailMode === 'daily' && events.map((ev, idx) => {
                                   const dateObj = dayjs(ev.event_date);
                                   const dayNum = dateObj.day();
                                   const nextEv = events[idx + 1];
                                   const isSameDateAsNext = nextEv && nextEv.event_date === ev.event_date;
                                   const borderClass = isSameDateAsNext ? 'border-r-0' : 'border-r dark:border-slate-700';
                                   
                                   let bgClass = "";
                                   if (dayNum === 0) bgClass = "bg-red-50/50 dark:bg-red-900/10"; // Sunday (lighter)
                                   if (dayNum === 6) bgClass = "bg-blue-50/50 dark:bg-blue-900/10"; // Saturday (lighter)
                                   
                                   return (
                                     <td key={`${member.id}-${ev.id}`} className={`px-1 py-1 whitespace-nowrap text-center h-[34px] ${borderClass} ${bgClass} last:border-r-0`}>
                                         {renderCell(member, ev)}
                                     </td>
                                   );
                               })}

                                {/* Monthly Body */}
                                {viewDetailMode === 'monthly' && (
                                   [
                                     currentMonth.subtract(1, 'month'),
                                     currentMonth,
                                     currentMonth.add(1, 'month')
                                   ].map((targetM, mIdx) => {
                                      const mEvents = events.filter(ev => 
                                        dayjs(ev.event_date).isSame(targetM, 'month') && 
                                        ev.member_ids?.includes(member.id)
                                      );
                                      
                                      const isCurr = mIdx === 1;
                                      
                                      return (
                                        <td key={mIdx} className={cn("px-2 py-2 align-top border-r dark:border-slate-700 last:border-r-0", isCurr && "bg-blue-50/10 dark:bg-blue-900/5")}>
                                          <div className="flex flex-wrap gap-1.5">
                                               {mEvents.length === 0 ? (
                                                  <span className="text-gray-300 dark:text-slate-700 text-[10px]">-</span>
                                               ) : (
                                                  mEvents.map(ev => {
                                                      const dateObj = dayjs(ev.event_date);
                                                      const isMain = ev.main_member_id === member.id;
                                                      return (
                                                        <div key={ev.id} className={cn(
                                                            "flex items-center gap-1 border rounded px-1.5 py-1 text-[11px]",
                                                            isMain 
                                                              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-200"
                                                              : "bg-white border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300"
                                                        )}>
                                                            <div className={cn(
                                                                "w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold text-white shrink-0",
                                                                isMain ? "bg-blue-600" : "bg-slate-400"
                                                            )}>
                                                                {isMain ? '주' : '부'}
                                                            </div>
                                                            <span className="font-medium">
                                                                {dateObj.format('D(dd)')}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[60px]" title={ev.title}>
                                                                {ev.title}
                                                            </span>
                                                        </div>
                                                      );
                                                  })
                                               )}
                                          </div>
                                        </td>
                                      )
                                   })
                                )}
                            </tr>
                           );
                        })}
                       {members.length === 0 && (
                           <tr>
                               <td colSpan={viewDetailMode === 'daily' ? events.length + 1 : 4} className="px-6 py-10 text-center text-gray-500 text-sm">
                                   등록된 복사가 없습니다.
                               </td>
                           </tr>
                       )}
                   </tbody>
              </table>
              ) : (
                // By Date View
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                    <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[150px] border-r dark:border-slate-700">
                                날짜
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                배정 복사
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-600">
                        {eventsByDate.map(([dateStr, dayEvents]) => {
                            const dateObj = dayjs(dateStr);
                            const dayNum = dateObj.day();
                            const isSun = dayNum === 0;
                            const isSat = dayNum === 6;
                            
                            return (
                                <tr key={dateStr} className={cn(
                                    "transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50",
                                    isSun ? "bg-red-50/40 dark:bg-red-900/10" : isSat ? "bg-blue-50/40 dark:bg-blue-900/10" : "bg-white dark:bg-slate-900"
                                )}>
                                    <td className={cn("px-6 py-4 whitespace-nowrap text-sm font-medium border-r dark:border-slate-700 align-top", isSun ? "text-red-600 dark:text-red-400" : isSat ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100")}>
                                        {dateObj.format('M월 D일 (ddd)')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-3">
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} className="border dark:border-slate-700 rounded-md p-3 bg-white dark:bg-slate-800 shadow-sm min-w-[200px] flex-1 max-w-[300px]">
                                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-300 mb-2 pb-1 border-b dark:border-slate-700 flex justify-between items-center">
                                                        <span>{ev.title}</span>
                                                        <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 rounded">{ev.member_ids?.length || 0}명</span>
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
                                                                           ? "bg-blue-50 text-blue-700 font-medium border border-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900/50" 
                                                                           : "bg-gray-50 text-gray-700 border border-transparent dark:bg-slate-700 dark:text-gray-300 dark:border-transparent"
                                                                    )}>
                                                                        {isMain && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 px-1 rounded shrink-0">주</span>}
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
