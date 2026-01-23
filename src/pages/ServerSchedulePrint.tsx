import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import Loader from '@/components/common/LoadingSpinner';
import { useSession } from '@/state/session';
import { Button } from '@/components/ui/button';
import { Printer, ZoomIn, ZoomOut, X } from 'lucide-react';

dayjs.extend(timezone);

interface MemberDoc {
  id: string;
  name_kor: string;
  baptismal_name: string;
}

interface MassEventDoc {
  id: string;
  title: string;
  event_date: string; // YYYYMMDD
  member_ids?: string[];
  main_member_id?: string;
}

export default function ServerSchedulePrint() {
  const { serverGroupId, yyyymm } = useParams<{ serverGroupId: string; yyyymm: string }>();
  const db = getFirestore();
  const session = useSession();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, MemberDoc>>({});
  const [fontSize, setFontSize] = useState(15); // Default size

  useEffect(() => {
    if (!serverGroupId || !yyyymm) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Group Info (for Title)
        const groupRef = doc(db, 'server_groups', serverGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
            setGroupName(groupSnap.data().name || '복사단');
        }

        // 2. Fetch Members
        const memRef = collection(db, `server_groups/${serverGroupId}/members`);
        const memQ = query(memRef); // active check optional? better to get all in case historical
        const memSnap = await getDocs(memQ);
        const mMap: Record<string, MemberDoc> = {};
        memSnap.forEach(d => {
            const data = d.data();
            mMap[d.id] = { id: d.id, name_kor: data.name_kor, baptismal_name: data.baptismal_name };
        });
        setMemberMap(mMap);

        // 3. Fetch Events
        const year = parseInt(yyyymm.slice(0, 4));
        const month = parseInt(yyyymm.slice(4)) - 1;
        const startOfMonth = dayjs(new Date(year, month, 1));
        const endOfMonth = startOfMonth.endOf('month');
        
        const startStr = startOfMonth.format('YYYYMMDD');
        const endStr = endOfMonth.format('YYYYMMDD');

        const evRef = collection(db, `server_groups/${serverGroupId}/mass_events`);
        const evQ = query(evRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr), orderBy('event_date', 'asc'));
        const evSnap = await getDocs(evQ);
        const evList = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as MassEventDoc));
        setEvents(evList);

      } catch (e) {
        console.error(e);
        alert('데이터 로딩 실패');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serverGroupId, yyyymm, db]);

  // Group events by date
  const eventsByDate = useMemo(() => {
      const map: Record<string, MassEventDoc[]> = {};
      events.forEach(ev => {
          if (!map[ev.event_date]) map[ev.event_date] = [];
          map[ev.event_date].push(ev);
      });
      // Sort each date's events?
      // Assuming title or creation order. Let's sort by Title for consistency
      Object.values(map).forEach(list => list.sort((a,b) => a.title.localeCompare(b.title)));
      return map;
  }, [events]);

  // Calculate Calendar Grid
  const weeks = useMemo(() => {
    if (!yyyymm) return [];
    const year = parseInt(yyyymm.slice(0, 4));
    const month = parseInt(yyyymm.slice(4)) - 1;
    const startOfMonth = dayjs(new Date(year, month, 1));
    const endOfMonth = startOfMonth.endOf('month');

    const calendar = [];
    let current = startOfMonth.startOf('week');
    
    // Safety break
    let limit = 0;
    while (current.isBefore(endOfMonth.endOf('week')) && limit < 10) {
       const weekRow = [];
       for(let i=0; i<7; i++) {
           weekRow.push(current);
           current = current.add(1, 'day');
       }
       calendar.push(weekRow);
       
       if (current.isAfter(endOfMonth)) break;
       limit++;
    }
    return calendar;
  }, [yyyymm]);


  if (loading) return <Loader />;

  const displayMonth = `${parseInt(yyyymm!.slice(4))}월`;

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0 print:overflow-hidden">
        {/* Print Styles Injection */}
        <style>{`
            @page {
                size: auto;
                margin: 10mm;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        `}</style>
        
        <div className="text-center mb-6">
            <h1 className="text-4xl font-serif font-bold tracking-wider underline underline-offset-8">
                {groupName} {displayMonth} 번표
            </h1>
        </div>

        <div className="w-full border-2 border-black">
            {/* Header: Days */}
            <div className="grid grid-cols-7 border-b border-black text-center font-bold text-lg bg-blue-50/50 print:bg-blue-50">
                {['주일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                    <div key={day} className={`py-1 border-r border-black last:border-r-0 ${
                        idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-black'
                    }`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wIdx) => (
                <div key={wIdx} className="border-b border-black last:border-b-0">
                    {/* Date Row */}
                    <div className="grid grid-cols-7 border-b border-gray-400 text-center bg-gray-50/50 print:bg-gray-50 h-[35px] items-center">
                         {week.map((date, dIdx) => {
                             const dateStr = date.format('YYYYMMDD');
                             const isCurrentMonth = date.month() === parseInt(yyyymm!.slice(4)) - 1;
                             
                             return (
                                <div key={dIdx} className={`text-lg font-semibold py-0.5 border-r border-black last:border-r-0 h-full flex items-center justify-center ${
                                    dIdx === 0 ? 'text-red-500' : dIdx === 6 ? 'text-blue-500' : 'text-gray-700'
                                } ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                                    {date.format('M월 D일')}
                                </div>
                             );
                         })}
                    </div>
                    
                    {/* Events Content Row */}
                    <div className="grid grid-cols-7 min-h-[185px]">
                         {week.map((date, dIdx) => {
                             const dateStr = date.format('YYYYMMDD');
                             const dayEvents = eventsByDate[dateStr] || [];
                             const isCurrentMonth = date.month() === parseInt(yyyymm!.slice(4)) - 1;

                             return (
                                <div key={dIdx} className="p-1 border-r border-black last:border-r-0 flex flex-col gap-2 text-[15px] h-full relative">
                                    {!isCurrentMonth && <div className="absolute inset-0 bg-gray-100/30 -z-10" />}
                                    
                                    {dayEvents.map(ev => (
                                        <div key={ev.id} className="flex flex-col">
                                            {/* Mass Title (only if it's special or to distinguish) */}
                                            {/* Usually just list servers, maybe with small title */}
                                            <div className="font-bold text-[13px] text-gray-600 mb-0.5 text-center bg-gray-100 rounded print:bg-gray-100 border border-gray-200">
                                                {ev.title}
                                            </div>
                                            
                                            {/* Servers */}
                                            <div className="flex flex-col gap-0.5 items-center">
                                                {/* Main Server */}
                                                {ev.main_member_id && memberMap[ev.main_member_id] && (
                                                    <span className="font-bold text-black truncate w-full text-center" style={{ fontSize: `${fontSize}px` }}>
                                                        {memberMap[ev.main_member_id].name_kor} <span className="font-normal" style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}>({memberMap[ev.main_member_id].baptismal_name})</span>
                                                    </span>
                                                )}
                                                {/* Sub Servers */}
                                                {(ev.member_ids || [])
                                                    .filter(id => id !== ev.main_member_id)
                                                    .map(id => memberMap[id] && (
                                                        <span key={id} className="text-gray-800 truncate w-full text-center" style={{ fontSize: `${fontSize}px` }}>
                                                           {memberMap[id].name_kor} <span className="text-gray-500" style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}>({memberMap[id].baptismal_name})</span>
                                                        </span>
                                                    ))
                                                }
                                                {(!ev.member_ids || ev.member_ids.length === 0) && (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             );
                         })}
                    </div>
                </div>
            ))}
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-4">
             {/* Print Metadata (Visible on Print) */}
             <div className="w-full text-right text-[10px] text-gray-500 border-t pt-2">
                출력일시: {dayjs().format('YYYY-MM-DD HH:mm')} | 출력자: {session.userInfo?.userName || session.userInfo?.baptismalName || '관리자'}
             </div>

             {/* Action Button (Hidden on Print) */}
             <div className="print:hidden flex flex-col items-center gap-2">
                 <div className="flex flex-wrap items-center justify-center gap-4">
                     <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">이름 글자 크기:</span>
                        <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.max(10, s - 1))} className="h-8 w-8">
                            <ZoomOut size={14} />
                        </Button>
                        <span className="text-sm w-8 text-center">{fontSize}px</span>
                        <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.min(24, s + 1))} className="h-8 w-8">
                            <ZoomIn size={14} />
                        </Button>
                     </div>

                     <Button onClick={() => window.print()} className="gap-2 bg-slate-900 text-white hover:bg-slate-800 px-8 h-[42px]">
                         <Printer size={16} />
                         인쇄하기
                     </Button>

                     <Button variant="outline" onClick={() => window.close()} className="gap-2 border-slate-300 hover:bg-slate-100 px-6 h-[42px]">
                         <X size={16} />
                         닫기
                     </Button>
                 </div>
                 <p className="text-xs text-gray-400">※ 인쇄 설정: '세로' 방향, '배경 그래픽' 체크 권장</p>
             </div>
        </div>
    </div>
  );
}
