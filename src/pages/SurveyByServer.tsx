import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import { Container } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MassStatus } from '@/types/firestore';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';

dayjs.extend(weekOfYear);
dayjs.locale('ko');

interface SurveyDoc {
  id: string; // yyyymm
  status: 'OPEN' | 'CLOSED';
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

export default function SurveyByServer() {
  const { serverGroupId, surveyId } = useParams<{ serverGroupId: string; surveyId: string }>();
  const navigate = useNavigate();
  const db = getFirestore();

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<SurveyDoc | null>(null);
  const [memberList, setMemberList] = useState<MemberInfo[]>([]);
  const [eventMap, setEventMap] = useState<Record<string, MassEventDoc>>({}); // ID -> Doc
  const [deletedEventMap, setDeletedEventMap] = useState<Record<string, MassEventDoc>>({}); 
  const [weeks, setWeeks] = useState<{ start: string; end: string; label: string }[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [monthlyStatus, setMonthlyStatus] = useState<MassStatus>('MASS-NOTCONFIRMED');

  const fetchSurveyAndData = useCallback(async () => {
    if (!serverGroupId || !surveyId) return;

    try {
      setLoading(true);

      // 1. Fetch Survey
      const surveyRef = doc(db, 'server_groups', serverGroupId, 'availability_surveys', surveyId);
      const surveySnap = await getDoc(surveyRef);

      if (!surveySnap.exists()) {
        alert('설문을 찾을 수 없습니다.');
        navigate(-1);
        return;
      }

      const surveyData = { id: surveySnap.id, ...surveySnap.data() } as SurveyDoc;
      setSurvey(surveyData);

      // 2. Fetch Events for the month (to map ID -> Date)
      const year = parseInt(surveyId.slice(0, 4));
      const month = parseInt(surveyId.slice(4)) - 1;
      const startOfMonth = dayjs(new Date(year, month, 1));
      const endOfMonth = startOfMonth.endOf('month');

      const startStr = startOfMonth.format('YYYYMMDD');
      const endStr = endOfMonth.format('YYYYMMDD');

      const eventsQuery = query(
        collection(db, 'server_groups', serverGroupId, 'mass_events'),
        where('event_date', '>=', startStr),
        where('event_date', '<=', endStr)
      );
      const eventsSnap = await getDocs(eventsQuery);
      
      const newEventMap: Record<string, MassEventDoc> = {};
      eventsSnap.forEach((d) => {
          const data = d.data();
          newEventMap[d.id] = { id: d.id, event_date: data.event_date, title: data.title };
      });
      setEventMap(newEventMap);

      // 2.5 Fetch Deleted Events
      const deletedQuery = query(
        collection(db, 'server_groups', serverGroupId, 'deleted_mass_events'),
        where('event_date', '>=', startStr),
        where('event_date', '<=', endStr)
      );
      const deletedSnap = await getDocs(deletedQuery);
      const newDeletedMap: Record<string, MassEventDoc> = {};
      deletedSnap.forEach(doc => {
          const data = doc.data();
          if (data.original_id && data.event_date) {
             newDeletedMap[data.original_id] = {
                 id: data.original_id,
                 event_date: data.event_date,
                 title: data.title || '(삭제됨)',
                 isDeleted: true
             };
          }
      });
      setDeletedEventMap(newDeletedMap);

      // 2.6 Fetch Monthly Status
      try {
          const monthStatusRef = doc(db, 'server_groups', serverGroupId, 'month_status', surveyId);
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

      // 3. Calculate Weeks
      // We will define weeks based on rows in a calendar (Sun-Sat)
      const calculatedWeeks: { start: string; end: string; label: string }[] = [];
      let current = startOfMonth.startOf('week'); // Start from Sunday of the first week
      const lastDay = endOfMonth.endOf('week'); // End at Saturday of the last week

      let weekCount = 1;
      
      // Using a safer loop to avoid infinite loops if something is wrong with dates
      // Iterate by weeks
      // Actually simpler: iterate days and push to week buckets? 
      // Or just generate the ranges.
      
      // Let's generate ranges strictly within the month context for the grid headers.
      // Week 1: Open -> Sat
      // Week 2: Sun -> Sat   ...
      
      // Alternative approach:
      // Loop from startOfMonth to endOfMonth.
      // Group by week index.
      // But standard "Calendar View" weeks are usually 5 or 6 rows.
      
      // Let's just create 5 or 6 columns based on the month's calendar rows.
      // To simulate "Calendar Grid Rows", we can use `dayjs().week()` but year switch is tricky.
      // Better:
      const calendarWeeks = [];
      let iter = startOfMonth.clone().startOf('week'); 
      // Note: startOfMonth day might be Wed. .startOf('week') gives Sunday before it.
      // We want to cover the month.
      
      while (iter.isBefore(endOfMonth) || iter.isSame(endOfMonth, 'day')) {
          // If the week is fully outside (before survey start), skip? No, standard calendar shows them.
          // User asked for "1주/2주..."
          // Let's just push the start date of the week.
          calendarWeeks.push(iter);
          iter = iter.add(1, 'week');
      }
      
      // If the loop stopped but we haven't covered the very last days (e.g. end of month is Sat),
      // the loop condition `iter.isBefore(endOfMonth)` handles the start of the week.
      // If `startOfMonth` was Sunday, iter is startOfMonth.
      
      // Ensure we don't go too far.
      // Let's map these to label and ranges.
      
      const processedWeeks = calendarWeeks.map((wStart, idx) => ({
          start: wStart.format('YYYYMMDD'),
          end: wStart.endOf('week').format('YYYYMMDD'),
          label: `${idx + 1}주차`,
          obj: wStart
      }));
      
      setWeeks(processedWeeks);


      // 4. Fetch Members
      const targetIds = surveyData.member_ids || [];
      const responses = surveyData.responses || {};
      // Include anyone who responded even if not in current list (edge case)
      const allUids = Array.from(new Set([...targetIds, ...Object.keys(responses)]));

      if (allUids.length > 0) {
          const members: MemberInfo[] = [];
          // Batch fetching logic not available easily without chunks, so parallel promises
          await Promise.all(allUids.map(async (uid) => {
             const mRef = doc(db, 'server_groups', serverGroupId, 'members', uid);
             const mSnap = await getDoc(mRef);
             if (mSnap.exists()) {
                 const md = mSnap.data();
                 members.push({ 
                     id: uid, 
                     name: md.name_kor, 
                     baptismal_name: md.baptismal_name, 
                     grade: md.grade,
                     active: md.active
                 });
             } else {
                 members.push({ id: uid, name: 'Unknown', active: false });
             }
          }));
          
          // Filter active=true
          const activeMembers = members.filter(m => m.active === true);

          // Sort by Name
          activeMembers.sort((a, b) => a.name.localeCompare(b.name));
          setMemberList(activeMembers);
      }

    } catch (e) {
      console.error(e);
      alert('데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [serverGroupId, surveyId, db, navigate]);

  useEffect(() => {
    fetchSurveyAndData();
  }, [fetchSurveyAndData]);


  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-900 transition-colors">
      <Container className="py-6 overflow-x-auto">

        <div className="flex flex-col gap-2 mb-6">
            {/* Row 1: Title and Month Status */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 dark:hover:bg-slate-800">
                      <ArrowLeft size={24} className="text-gray-900 dark:text-gray-100" />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                        {`${parseInt(surveyId!.slice(4))}월 복사별 불참 현황`}
                    </h1>
                </div>
                <StatusBadge status={monthlyStatus} />
            </div>

            {/* Row 2: Description */}
            <div className="pl-1 mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 break-keep">
                   복사단원별 미사 불참 현황을 주차별로 확인할 수 있습니다. 삭제된 미사도 포함하여 조회 가능합니다.
                </p>
            </div>
        </div>

        {/* Row 3: Filter Container */}
        <div className="flex justify-start items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm mb-4 transition-colors">
            <div className="flex items-center gap-2">
                 <Switch 
                     id="show-deleted-by-server" 
                     checked={showDeleted} 
                     onCheckedChange={setShowDeleted}
                     className="data-[state=checked]:bg-orange-500"
                 />
                 <Label htmlFor="show-deleted-by-server" className="text-xs cursor-pointer text-gray-600 dark:text-gray-300">
                     삭제된 미사 포함
                 </Label>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 overflow-hidden min-w-[800px]">
            {/* Header Row */}
            <div className="grid border-b border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300 font-bold text-sm text-center"
                 style={{ gridTemplateColumns: `120px repeat(${weeks.length}, 1fr)` }}>
                <div className="py-3 px-2 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center">
                    이름
                </div>
                {weeks.map(week => (
                    <div key={week.label} className="py-3 px-2 border-r border-gray-200 dark:border-slate-700 last:border-r-0">
                        {week.label} <span className="text-[10px] font-normal text-gray-500 block">
                           ({dayjs(week.start).format('M.D')}~{dayjs(week.end).format('M.D')})
                        </span>
                    </div>
                ))}
            </div>

            {/* Body Rows */}
            {memberList.map(member => {
                const response = survey.responses?.[member.id];
                const unavailableEventIds = response?.unavailable || [];
                
                // Map event IDs to dates
                const unavailableDates = unavailableEventIds
                    .map(eid => {
                        if (eventMap[eid]) return eventMap[eid];
                        if (showDeleted && deletedEventMap[eid]) return deletedEventMap[eid];
                        return null;
                    })
                    .filter(Boolean)
                    .map(ev => ({ ...ev, dayjsDate: dayjs(ev!.event_date) })); // Add dayjs object

                unavailableDates.sort((a,b) => (a.event_date || '').localeCompare(b.event_date || ''));

                return (
                    <div key={member.id} 
                         className="grid border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm transition-colors"
                         style={{ gridTemplateColumns: `120px repeat(${weeks.length}, 1fr)` }}
                    >
                        {/* Name Column */}
                        <div className="py-3 px-4 border-r border-gray-100 dark:border-slate-700 font-medium text-gray-900 dark:text-gray-100 flex flex-col justify-center">
                            <span>
                                {member.name}
                                {member.baptismal_name && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-normal">({member.baptismal_name})</span>}
                            </span>
                            <span className="text-xs text-gray-400 font-normal">{member.grade}</span>
                        </div>

                        {/* Content: Merged "Unsubmitted" or Weekly Cells */}
                        {!response ? (
                            <div className="flex items-center justify-center p-2 bg-slate-50/30 dark:bg-slate-800/20" style={{ gridColumn: '2 / -1' }}>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-6 py-2 rounded-full dark:bg-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-600">
                                    미제출
                                </span>
                            </div>
                        ) : (
                            weeks.map(week => {
                                const weekStart = dayjs(week.start);
                                const weekEnd = dayjs(week.end);
                                
                                // Filter unavailables in this week
                                const eventsInWeek = unavailableDates.filter(ev => {
                                    // Check if event date is within this week range
                                    return (ev.dayjsDate.isAfter(weekStart.subtract(1, 'day')) && ev.dayjsDate.isBefore(weekEnd.add(1, 'day')));
                                });

                                return (
                                    <div key={week.label} className="py-2 px-2 border-r border-gray-100 dark:border-slate-700 last:border-r-0 text-center flex flex-wrap gap-1 content-center justify-center min-h-[60px]">
                                        {eventsInWeek.length > 0 ? (
                                            eventsInWeek.map(ev => {
                                                const isDeleted = ev!.isDeleted;
                                                return (
                                                    <span key={ev!.id} className={`text-xs px-1.5 py-1.5 rounded flex flex-col items-center gap-0.5 min-w-[48px] border ${
                                                        isDeleted 
                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-500' 
                                                        : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
                                                    }`}>
                                                        <span className={`font-semibold leading-none ${isDeleted ? 'line-through' : ''}`}>
                                                            {ev!.dayjsDate.format('D일')}({ev!.dayjsDate.format('dd')})
                                                        </span>
                                                        <span className="text-[10px] leading-none opacity-90 whitespace-nowrap flex items-center gap-0.5">
                                                            {isDeleted && <Trash2 size={8} />}
                                                            {ev!.title}
                                                        </span>
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                );
            })}
        </div>
      </Container>
    </div>
  );
}
