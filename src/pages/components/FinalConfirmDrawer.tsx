import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko'; // ✅ Import Korean Locale
import { MassEventCalendar } from '@/types/massEvent';
import { COLLECTIONS } from '@/lib/collections';

interface FinalConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
  serverGroupId: string;
  currentMonth: Dayjs;
  events: MassEventCalendar[];
  isReadOnly?: boolean;
}

interface AssignedDate {
    dateStr: string; // "D(ddd)"
    eventId: string;
    massTitle: string; // Mass name/title
    isUnavailable: boolean; // 🔴 Warning Flag
}

interface AssignedMemberStat {
    id: string;
    name: string;
    baptismalName: string;
    grade: string;
    prevCount: number;
    currCount: number;
    assignedDates: AssignedDate[];
    startYear: string;
    isNovice: boolean;
}

interface MiniNotificationLog {
    id: string;
    created_at: any;
    title: string;
    body: string;
}

const FinalConfirmDrawer: React.FC<FinalConfirmDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  serverGroupId,
  currentMonth,
  events,
  isReadOnly = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'currCount' | 'prevCount' | 'name'>('currCount');
  const [dataLoading, setDataLoading] = useState(false);
  const [stats, setStats] = useState<AssignedMemberStat[]>([]);
  const [notiLogs, setNotiLogs] = useState<MiniNotificationLog[]>([]);

  useEffect(() => {
    // Ensure locale is set
    dayjs.locale('ko');
    
    if (open && serverGroupId) {
        setSortBy('currCount');
        fetchData();
        fetchNotiLogs();
    }
  }, [open, serverGroupId, events]);

  const fetchNotiLogs = async () => {
    try {
        const db = getFirestore();
        const monthKey = currentMonth.format('YYYYMM');

        // Simplified query - only use server_group_id to avoid composite index requirement
        // Filter month_id and trigger_status on client side
        const q = query(
            collection(db, 'system_notification_logs'),
            where('server_group_id', '==', serverGroupId),
            limit(50) // Get more to filter client-side
        );
        
        const snap = await getDocs(q);
        let logs = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as MiniNotificationLog[];
        
        // Client-side filtering
        logs = logs.filter(log => {
            const data = log as any;
            return data.month_id === monthKey && data.trigger_status === 'FINAL-CONFIRMED';
        });
        
        // Sort DESC client-side
        logs.sort((a, b) => {
             const tA = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
             const tB = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
             return tB - tA;
        });
        
        // Limit to 5 after filtering
        setNotiLogs(logs.slice(0, 5));
    } catch(e) {
        console.error('Failed to fetch logs', e);
    }
  };

  const fetchData = async () => {
    setDataLoading(true);
    const db = getFirestore();
    try {
        const monthKey = currentMonth.format('YYYYMM');

        // 0. Fetch Availability Survey for Unavailable Check
        const surveyRef = doc(db, `${COLLECTIONS.SERVER_GROUPS}/${serverGroupId}/availability_surveys/${monthKey}`);
        const surveySnap = await getDoc(surveyRef);
        const unavailableMap: Record<string, Set<string>> = {}; 
        
        if (surveySnap.exists()) {
             const sData = surveySnap.data();
             const responses = sData?.responses || {};
             Object.entries(responses).forEach(([uid, val]: [string, any]) => {
                  let ids: string[] = [];
                  if (Array.isArray(val.unavailable)) ids = val.unavailable;
                  else if (val.unavailable && typeof val.unavailable === 'object') ids = Object.keys(val.unavailable);
                  
                  if (ids.length > 0) {
                      unavailableMap[uid] = new Set(ids);
                  }
             });
        }

        // 1. Fetch Members
        const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members');
        const memberSnap = await getDocs(membersRef);
        
        // 2. Fetch Prev Month Events
        const prevMonth = currentMonth.clone().subtract(1, 'month');
        const startStr = prevMonth.startOf('month').format('YYYYMMDD');
        const endStr = prevMonth.endOf('month').format('YYYYMMDD');
        
        const q = query(
            collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_events'),
            where('event_date', '>=', startStr),
            where('event_date', '<=', endStr)
        );
        const prevSnap = await getDocs(q);
        
        // 3. Process Counts
        const prevCounts: Record<string, number> = {};
        prevSnap.forEach(doc => {
            const d = doc.data();
            if (d.member_ids && Array.isArray(d.member_ids)) {
                d.member_ids.forEach((uid: string) => {
                    prevCounts[uid] = (prevCounts[uid] || 0) + 1;
                });
            }
        });

        // 4. Process Current Month & Dates
        const currCounts: Record<string, number> = {};
        const assignedDatesMap: Record<string, AssignedDate[]> = {};
        
        events.forEach(ev => {
            if (ev.member_ids && Array.isArray(ev.member_ids)) {
                ev.member_ids.forEach(uid => {
                    currCounts[uid] = (currCounts[uid] || 0) + 1;
                    
                    if (!assignedDatesMap[uid]) assignedDatesMap[uid] = [];
                    
                    // Format D(ddd) -> Requires 'ko' locale loaded
                    const dateStr = dayjs(ev.event_date).format('D(ddd)'); 
                    
                    // Check Unavailability
                    const isUnavail = unavailableMap[uid]?.has(ev.id) || false;

                    assignedDatesMap[uid].push({
                        dateStr,
                        eventId: ev.id,
                        massTitle: ev.title || '미사',
                        isUnavailable: isUnavail
                    });
                });
            }
        });

        // 5. Combine
        // Novice Logic
        const currentYear = dayjs().year();
        let maxStartYear = 0;
        memberSnap.docs.forEach(d => {
             const m = d.data();
             if (m.active !== false) {
                 const y = parseInt(String(m.start_year||'0').trim(), 10);
                 if (y <= currentYear && y > maxStartYear) maxStartYear = y;
             }
        });

        const list = memberSnap.docs.map(doc => {
            const m = doc.data();
            if (m.active === false) return null;

            const id = doc.id;
            const prev = prevCounts[id] || 0;
            const curr = currCounts[id] || 0;
            
            const dates = (assignedDatesMap[id] || []).sort((a, b) => {
                 const extractDay = (s: string) => {
                     const match = s.match(/^(\d+)/);
                     return match ? parseInt(match[1], 10) : 0;
                 };
                 return extractDay(a.dateStr) - extractDay(b.dateStr);
            });

            const myYear = parseInt(String(m.start_year || '0').trim(), 10);

            return {
                id,
                name: m.name_kor || '',
                baptismalName: m.baptismal_name || '',
                grade: m.grade || '',
                prevCount: prev,
                currCount: curr,
                assignedDates: dates,
                startYear: m.start_year || '',
                isNovice: (maxStartYear > 0 && myYear === maxStartYear)
            };
        })
        .filter((m): m is AssignedMemberStat => m !== null && !!m.name);

        // Sort by CurrCount (ASC), then Name
        list.sort((a, b) => {
             if (a.currCount !== b.currCount) return a.currCount - b.currCount;
             return a.name.localeCompare(b.name, 'ko');
        });
        
        setStats(list);

    } catch (e) {
        console.error('Failed to load stats', e);
    } finally {
        setDataLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!onConfirm) return; // Guard clause
    if (!window.confirm('정말로 최종 확정하시겠습니까?\n확정 후에는 단원들에게 알림이 발송됩니다.')) {
        return;
    }

    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('⚠️ 최종 확정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: any) => {
      if (!ts) return '';
      return dayjs(ts.toDate ? ts.toDate() : ts).format('MM.DD HH:mm');
  }

  const sortedStats = useMemo(() => {
      const list = [...stats];
      if (sortBy === 'name') {
          list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      } else if (sortBy === 'prevCount') {
          list.sort((a, b) => {
              if (a.prevCount !== b.prevCount) return a.prevCount - b.prevCount;
              return a.currCount - b.currCount;
          });
      } else {
          // currCount
          list.sort((a, b) => {
              if (a.currCount !== b.currCount) return a.currCount - b.currCount;
              return a.name.localeCompare(b.name, 'ko');
          });
      }
      return list;
  }, [stats, sortBy]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 flex flex-col h-[85vh] bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-start shrink-0">
            <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    <CheckCircle2 size={22} className="text-red-600 dark:text-red-500" />
                    최종 확정 <span className="text-base font-normal text-gray-500 dark:text-gray-400">({currentMonth.format('M월')})</span>
                </DialogTitle>
                <DialogDescription className="text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                    <span className="block">아래 배정 현황을 마지막으로 확인하고 최종확정 바랍니다.</span>
                    <span className="block text-red-600 dark:text-red-400 font-medium">
                        ⚠️ 확정 후에는 단원들에게 알림(Push)되며 배정을 다시 할 수 없습니다.
                    </span>
                    <span className="block text-red-500 font-normal">
                         * 주의: 붉은색 날짜는 설문 불가 날짜와 겹치는 배정입니다.
                    </span>
                </DialogDescription>
            </div>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto p-0 bg-gray-50/50 dark:bg-slate-950/50">
            {dataLoading ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    데이터 불러오는 중...
                </div>
            ) : (
                <div className="min-w-full pb-4">
                    {/* Header */}
                    <div className="grid grid-cols-10 bg-gray-100/80 dark:bg-slate-800/80 border-b dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 py-2 px-4 sticky top-0 backdrop-blur-sm z-10">
                        <div 
                           className={`col-span-4 cursor-pointer hover:text-blue-600 flex items-center gap-1 ${sortBy === 'name' ? 'text-blue-600 dark:text-blue-400' : ''}`}
                           onClick={() => setSortBy('name')}
                        >
                           이름 (세례명) {sortBy === 'name' && '↓'}
                        </div>
                        <div 
                           className={`col-span-1 text-center cursor-pointer hover:text-blue-600 ${sortBy === 'prevCount' ? 'text-blue-600 dark:text-blue-400' : ''}`}
                           onClick={() => setSortBy('prevCount')}
                        >
                           전달 {sortBy === 'prevCount' && '↓'}
                        </div>
                        <div 
                           className={`col-span-1 text-center cursor-pointer hover:text-blue-600 ${sortBy === 'currCount' ? 'text-blue-600 dark:text-blue-400' : ''}`}
                           onClick={() => setSortBy('currCount')}
                        >
                           금월 {sortBy === 'currCount' && '↓'}
                        </div>
                        <div className="col-span-4 text-center">배정 날짜</div>
                    </div>
                    {/* Rows */}
                    {sortedStats.map((member, idx) => {
                        const prev = sortedStats[idx-1];
                        
                        let showSeparator = false;
                        let separatorLabel = '';
                        if (sortBy === 'currCount') {
                             showSeparator = !prev || prev.currCount !== member.currCount;
                             separatorLabel = `${member.currCount}회 배정`;
                        } else if (sortBy === 'prevCount') {
                             showSeparator = !prev || prev.prevCount !== member.prevCount;
                             separatorLabel = `전달 ${member.prevCount}회 배정`;
                        }

                        return (
                        <React.Fragment key={member.id}>
                            {showSeparator && (
                                <div className="col-span-10 bg-gray-50/80 dark:bg-slate-800/50 border-y border-gray-100 dark:border-slate-700 px-4 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                                    {separatorLabel}
                                </div>
                            )}
                            <div className="grid grid-cols-10 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 px-4 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors items-center">
                                <div className="col-span-4 flex items-center gap-1.5 overflow-hidden">
                                     <span className="font-medium text-gray-900 dark:text-gray-100 truncate shrink-0">{member.name}</span>
                                     <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 overflow-hidden">
                                        {member.isNovice && <span title="신입 복사">🐣</span>}
                                        <span className="truncate">({member.baptismalName})</span>
                                        {member.startYear && <span className="shrink-0">{member.startYear}</span>}
                                     </div>
                                </div>
                                <div className="col-span-1 text-center text-gray-500 dark:text-gray-400 text-xs">
                                    {member.prevCount}
                                </div>
                                <div className="col-span-1 text-center font-bold text-blue-600 dark:text-blue-400">
                                    {member.currCount}
                                </div>
                                <div className="col-span-4 flex flex-wrap gap-1 pl-2 justify-start">
                                    {member.assignedDates.length > 0 ? (
                                        member.assignedDates.map((item, i) => (
                                            <span 
                                                key={i} 
                                                className={`text-[11px] px-1.5 py-0.5 rounded border cursor-help ${
                                                    item.isUnavailable
                                                    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 font-bold"
                                                    : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800"
                                                }`}
                                                title={`${item.massTitle}${item.isUnavailable ? ' (설문 불가 날짜)' : ''}`}
                                            >
                                                {item.dateStr}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-600">-</span>
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Footer Area */}
        <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700">
            {/* Action Buttons */}
            <div className="p-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading} className="dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800">
                    {isReadOnly ? '닫기' : '취소'}
                </Button>
                {!isReadOnly && (
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={loading || dataLoading}
                        className="flex items-center gap-2 px-6"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? '확정 중...' : '최종 확정'}
                    </Button>
                )}
            </div>
            
            {/* Notification History Log */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <Bell className="w-3.5 h-3.5" />
                    최근 발송된 알림 (최종 확정)
                </div>
                {notiLogs.length === 0 ? (
                    <div className="text-center text-[10px] text-gray-400 py-2">
                        최근 발송 내역이 없습니다.
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {notiLogs.map(log => (
                            <div key={log.id} className="text-[10px] flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <span className="font-mono text-gray-400 dark:text-gray-500 shrink-0">{formatTime(log.created_at)}</span>
                                <span className="truncate">{log.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinalConfirmDrawer;
