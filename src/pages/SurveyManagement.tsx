import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/collections';
import { Container, Card, Heading } from '@/components/ui'; // Assuming these exist
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { toast } from 'sonner';

interface SurveyDoc {
  id: string; // yyyymm
  status: 'OPEN' | 'CLOSED';
  start_date?: Timestamp;
  end_date?: Timestamp;
  member_ids?: string[];
  responses?: Record<string, {
    uid: string;
    unavailable: string[];
    updated_at: Timestamp;
  }>;
}

interface MemberInfo {
  id: string;
  name: string;
  baptismal_name?: string;
  grade?: string;
  status?: string;
  active?: boolean;
}

export default function SurveyManagement() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const db = getFirestore();

  const [surveys, setSurveys] = useState<SurveyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail Drawer State
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyDoc | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, MemberInfo>>({}); // Cache member names
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);


  // Filter & Sort State
  const [sortBy, setSortBy] = useState<'name' | 'grade'>('name');
  const [showSubmitted, setShowSubmitted] = useState(true);
  const [showUnsubmitted, setShowUnsubmitted] = useState(true);

  const fetchSurveys = useCallback(async (isRefresh = false) => {
    if (!serverGroupId) return;
    try {
      if (isRefresh) setRefreshing(true);
      const q = query(collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'availability_surveys'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SurveyDoc));
      // Sort descending by ID (YYYYMM)
      list.sort((a, b) => b.id.localeCompare(a.id));
      setSurveys(list);
      if (isRefresh) toast.success("새로고침 되었습니다.");
    } catch (e) {
      console.error(e);
      if (isRefresh) toast.error("새로고침 실패");
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [serverGroupId]);

  const fetchAllMembers = useCallback(async () => {
       if (!serverGroupId) return;
       try {
           const q = query(collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members'));
           const snap = await getDocs(q);
           const newMap: Record<string, MemberInfo> = {};
           snap.forEach(doc => {
               const d = doc.data();
               newMap[doc.id] = {
                   id: doc.id,
                   name: d.name_kor,
                   baptismal_name: d.baptismal_name,
                   grade: d.grade,
                   status: d.status || 'active',
                   active: d.active
               };
           });
           setMemberMap(newMap);
           setMembersLoaded(true);
       } catch (e) {
           console.error("Member fetch failed", e);
       }
  }, [serverGroupId]);

  useEffect(() => {
    fetchSurveys();
    fetchAllMembers();
  }, [fetchSurveys, fetchAllMembers]);

  // Removed old selective fetchMembers effect since we fetch all now

  const handleOpenDetail = (s: SurveyDoc) => {
    setSelectedSurvey(s);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
      setIsDrawerOpen(false);
      setTimeout(() => setSelectedSurvey(null), 300);
  };

  if (loading || !membersLoaded) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent">
       <Container className="py-6">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8 dark:text-gray-200">
                   <ArrowLeft size={24} />
                </Button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설문 관리</h1>
             </div>
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { fetchSurveys(true); fetchAllMembers(); }} 
                disabled={refreshing}
                className="gap-2 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700"
             >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                새로고침
             </Button>
          </div>
          
          <div className="grid gap-4">
             {surveys.length === 0 ? (
                 <div className="text-center text-gray-500 py-10">생성된 설문이 없습니다.</div>
             ) : (
                 surveys.map(survey => {
                     // Active count logic
                     const allMemberIds = survey.member_ids || [];
                     const responseKeys = Object.keys(survey.responses || {});
                     
                     // Filter active (Removed: show all history)
                     const total = allMemberIds.length;
                     const responseCount = responseKeys.length;
                     
                     const rate = total > 0 ? Math.round((responseCount / total) * 100) : 0;
                     const dateKey = survey.id; // YYYYMM
                     const title = `${dateKey.slice(0, 4)}년 ${parseInt(dateKey.slice(4))}월 설문`;

                     return (
                         <Card 
                            key={survey.id} 
                            className="p-4 transition-shadow dark:bg-slate-800 dark:border-slate-700"
                         >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                       {survey.start_date && dayjs(survey.start_date.toDate()).format('YYYY.MM.DD')} ~ 
                                       {survey.end_date && dayjs(survey.end_date.toDate()).format('YYYY.MM.DD')}
                                    </p>
                                </div>
                                <Badge variant={survey.status === 'OPEN' ? 'default' : 'secondary'} className={survey.status === 'OPEN' ? 'bg-green-600 dark:bg-green-700 dark:text-white' : 'bg-gray-400 dark:bg-gray-600 dark:text-gray-200'}>
                                   {survey.status === 'OPEN' ? '진행중' : '마감됨'}
                                </Badge>
                            </div>
                            
                            <div className="mt-4">
                               <div className="flex justify-between text-sm mb-1">
                                  <span className="text-gray-600 dark:text-gray-400">응답률</span>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">{rate}% ({responseCount}/{total}명)</span>
                               </div>
                               <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                                  <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
                               </div>
                               
                               <div className="grid grid-cols-3 gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleOpenDetail(survey)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                                        설문 명단
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => navigate(`/server-groups/${serverGroupId}/surveys/${survey.id}/by-server`)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                                        복사별 보기
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => navigate(`/server-groups/${serverGroupId}/surveys/${survey.id}/calendar`)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                                        달력 보기
                                    </Button>
                               </div>
                            </div>
                         </Card>
                     );
                 })
             )}
          </div>
       </Container>

       {/* Detail Drawer */}
       <Drawer open={isDrawerOpen} onOpenChange={(o) => !o && closeDrawer()}>
          <DrawerContent className="max-h-[85vh] flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <DrawerHeader>
                  <DrawerTitle className="dark:text-gray-100">
                      {selectedSurvey && `${selectedSurvey.id.slice(0,4)}년 ${parseInt(selectedSurvey.id.slice(4))}월 설문 현황`}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-gray-500 font-normal dark:text-gray-400 mt-1">
                     ※ 회색으로 표시된 명단은 현재 비활동이거나 삭제된 복사입니다.
                  </DrawerDescription>
              </DrawerHeader>
              
               <div className="p-4 overflow-y-auto flex-1">
                  {detailLoading ? (
                      <div className="py-10 text-center text-gray-400">명단 로딩 중...</div>
                  ) : selectedSurvey ? (
                      <div className="space-y-4">
                          {(() => {
                              // Active Only Counts (Removed: show all history)
                              const targets = selectedSurvey.member_ids || [];
                              const total = targets.length;
                              
                              const responseKeys = Object.keys(selectedSurvey.responses || {});
                              const responseCount = responseKeys.length;
                              
                              const rate = total > 0 ? Math.round((responseCount / total) * 100) : 0;

                              return (
                                  <div className="bg-gray-50 p-3 rounded-lg text-center dark:bg-slate-800">
                                      <div className="text-sm">
                                          <span className="font-bold text-gray-900 dark:text-gray-100">총 대상자 {total}명</span>
                                          <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                                          <span className="font-bold text-blue-600 dark:text-blue-400">응답자 {responseCount}명</span>
                                          <span className="ml-1 text-gray-500 dark:text-gray-400">({rate}%)</span>
                                      </div>
                                  </div>
                              );
                          })()}
                          
                          <div className="space-y-3">
                              <div className="flex flex-col gap-2 bg-white sticky top-0 z-10 dark:bg-slate-900">
                                  <div className="flex justify-between items-center">
                                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">응답자 목록</h4>
                                      <div className="flex bg-gray-100 dark:bg-slate-800 rounded p-0.5">
                                          <button 
                                              onClick={() => setSortBy('name')} 
                                              className={`text-xs px-2 py-0.5 rounded transition-all ${sortBy === 'name' ? 'bg-white shadow-sm font-bold text-gray-900 dark:bg-slate-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                          >
                                              이름순
                                          </button>
                                          <button 
                                              onClick={() => setSortBy('grade')} 
                                              className={`text-xs px-2 py-0.5 rounded transition-all ${sortBy === 'grade' ? 'bg-white shadow-sm font-bold text-gray-900 dark:bg-slate-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                          >
                                              학년순
                                          </button>
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-800">
                                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                                          <input 
                                              type="checkbox" 
                                              checked={showSubmitted} 
                                              onChange={(e) => setShowSubmitted(e.target.checked)} 
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 dark:bg-slate-800 dark:border-slate-600" 
                                          />
                                          제출자 보기
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                                          <input 
                                              type="checkbox" 
                                              checked={showUnsubmitted} 
                                              onChange={(e) => setShowUnsubmitted(e.target.checked)} 
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 dark:bg-slate-800 dark:border-slate-600" 
                                          />
                                          미제출자 보기
                                      </label>
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                  {(() => {
                                      const targets = selectedSurvey.member_ids || [];
                                      const responses = selectedSurvey.responses || {};
                                      
                                      let list = targets.map(uid => {
                                          const info = memberMap[uid] || { id: uid, name: '...', grade: '' };
                                          const hasRes = !!responses[uid];
                                          return { ...info, hasRes };
                                      });

                                      // Filter
                                      list = list.filter(m => {
                                          if (m.hasRes && !showSubmitted) return false;
                                          if (!m.hasRes && !showUnsubmitted) return false;
                                          return true;
                                      });
                                      
                                      // Split lists
                                      const validList: typeof list = [];
                                      const bottomList: typeof list = [];
                                      
                                      list.forEach(m => {
                                          if (m.status === 'deleted' || m.active === false || m.name === '...') {
                                              bottomList.push(m);
                                          } else {
                                              validList.push(m);
                                          }
                                      });

                                      // Sort helper
                                      const sortFn = (a: typeof list[0], b: typeof list[0]) => {
                                          if (sortBy === 'grade') {
                                              if (a.grade !== b.grade) {
                                                  return (a.grade || '').localeCompare(b.grade || '');
                                              }
                                              return a.name.localeCompare(b.name);
                                          } else {
                                              return a.name.localeCompare(b.name);
                                          }
                                      };
                                      
                                      validList.sort(sortFn);
                                      bottomList.sort(sortFn);

                                      if (validList.length === 0 && bottomList.length === 0) {
                                          return <div className="col-span-2 text-center text-gray-400 py-4 text-xs">표시할 대상이 없습니다.</div>;
                                      }

                                      return (
                                          <>
                                              {validList.map(m => (
                                                  <div key={m.id} className={`p-2 rounded border text-sm flex items-center justify-between ${m.hasRes ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                      <div className="flex items-center gap-1.5 overflow-hidden">
                                                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                                            {m.name}
                                                            {m.baptismal_name && <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1 font-normal">({m.baptismal_name})</span>}
                                                          </span>
                                                          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{m.grade}</span>
                                                      </div>
                                                      {m.hasRes ? (
                                                          <Badge variant="outline" className="text-[10px] bg-white text-blue-600 border-blue-200 dark:bg-transparent dark:text-blue-300 dark:border-blue-700 px-1 py-0 h-5 shrink-0">제출</Badge>
                                                      ) : (
                                                          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">미제출</span>
                                                      )}
                                                  </div>
                                              ))}

                                              {bottomList.length > 0 && (
                                                  <>
                                                      {validList.length > 0 && (
                                                          <div className="col-span-2 py-2 flex items-center gap-2">
                                                              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                                                              <span className="text-[10px] text-gray-400">활동종료 / 정보없음</span>
                                                              <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                                                          </div>
                                                      )}
                                                      {bottomList.map(m => (
                                                          <div key={m.id} className="p-2 rounded border border-gray-200 bg-gray-50 text-sm flex items-center justify-between opacity-60 dark:bg-slate-800/50 dark:border-slate-700">
                                                              <div className="flex items-center gap-1.5 overflow-hidden">
                                                                  <span className="font-medium text-gray-500 dark:text-gray-400 truncate text-xs">
                                                                    {m.name}
                                                                    {m.baptismal_name && <span className="text-[10px] ml-1 font-normal">({m.baptismal_name})</span>}
                                                                    <span className="text-[9px] ml-1 text-red-500 font-normal">(비활동)</span>
                                                                  </span>
                                                              </div>
                                                              {m.hasRes ? (
                                                                  <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-500 border-gray-200 dark:bg-transparent dark:text-gray-500 dark:border-gray-700 px-1 py-0 h-5 shrink-0">제출됨</Badge>
                                                              ) : (
                                                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">정보없음</span>
                                                              )}
                                                          </div>
                                                      ))}
                                                  </>
                                              )}
                                          </>
                                      );
                                  })()}
                              </div>
                          </div>
                      </div>
                  ) : null}
               </div>
              <DrawerFooter className="dark:bg-slate-900">
                 <Button variant="outline" onClick={closeDrawer} className="dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700">닫기</Button>
              </DrawerFooter>
          </DrawerContent>
       </Drawer>
    </div>
  );
}
