import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, Timestamp } from 'firebase/firestore';
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
  grade?: string;
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

  const fetchSurveys = useCallback(async (isRefresh = false) => {
    if (!serverGroupId) return;
    try {
      if (isRefresh) setRefreshing(true);
      const q = query(collection(db, 'server_groups', serverGroupId, 'availability_surveys'));
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

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  // Fetch member info when a survey is selected
  useEffect(() => {
    if (!serverGroupId || !selectedSurvey) return;
    
    const fetchMembers = async () => {
      setDetailLoading(true);
      const targetIds = selectedSurvey.member_ids || [];
      const newMap = { ...memberMap };
      const missingIds = targetIds.filter(id => !newMap[id]);

      if (missingIds.length > 0) {
         // Fetch all members in one go if possible, or batched.
         // For optimization, we can fetch all members of the group once, or just the missing ones.
         // Let's fetch individual for now as simple approach, or better yet, fetch all group members once in parent?
         // For now, let's just fetch individual docs.
         await Promise.all(missingIds.map(async (uid) => {
             try {
                const snap = await getDoc(doc(db, 'server_groups', serverGroupId, 'members', uid));
                if (snap.exists()) {
                    const d = snap.data();
                    newMap[uid] = { id: uid, name: d.name_kor, grade: d.grade };
                } else {
                    newMap[uid] = { id: uid, name: '알수없음' };
                }
             } catch(e) { console.error(e); }
         }));
         setMemberMap(newMap);
      }
      setDetailLoading(false);
    };
    fetchMembers();
  }, [selectedSurvey, serverGroupId]);

  const handleOpenDetail = (s: SurveyDoc) => {
    setSelectedSurvey(s);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
      setIsDrawerOpen(false);
      setTimeout(() => setSelectedSurvey(null), 300);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50/50">
       <Container className="py-6">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
                   <ArrowLeft size={24} />
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">설문 관리</h1>
             </div>
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchSurveys(true)} 
                disabled={refreshing}
                className="gap-2"
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
                     const total = survey.member_ids?.length || 0;
                     const responseCount = Object.keys(survey.responses || {}).length;
                     const rate = total > 0 ? Math.round((responseCount / total) * 100) : 0;
                     const dateKey = survey.id; // YYYYMM
                     const title = `${dateKey.slice(0, 4)}년 ${parseInt(dateKey.slice(4))}월 설문`;

                     return (
                         <Card 
                            key={survey.id} 
                            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleOpenDetail(survey)}
                         >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                       {survey.start_date && dayjs(survey.start_date.toDate()).format('YYYY.MM.DD')} ~ 
                                       {survey.end_date && dayjs(survey.end_date.toDate()).format('YYYY.MM.DD')}
                                    </p>
                                </div>
                                <Badge variant={survey.status === 'OPEN' ? 'default' : 'secondary'} className={survey.status === 'OPEN' ? 'bg-green-600' : 'bg-gray-400'}>
                                   {survey.status === 'OPEN' ? '진행중' : '마감됨'}
                                </Badge>
                            </div>
                            
                            <div className="mt-4">
                               <div className="flex justify-between text-sm mb-1">
                                  <span className="text-gray-600">응답률</span>
                                  <span className="font-bold text-blue-600">{rate}% ({responseCount}/{total}명)</span>
                               </div>
                               <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
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
          <DrawerContent className="max-h-[85vh]">
              <DrawerHeader>
                  <DrawerTitle>
                      {selectedSurvey && `${selectedSurvey.id.slice(0,4)}년 ${parseInt(selectedSurvey.id.slice(4))}월 설문 현황`}
                  </DrawerTitle>
              </DrawerHeader>
              
              <div className="p-4 overflow-y-auto">
                 {detailLoading ? (
                     <div className="py-10 text-center text-gray-400">명단 로딩 중...</div>
                 ) : selectedSurvey ? (
                     <div className="space-y-4">
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                           <span className="text-sm font-medium text-gray-600">총 대상자</span>
                           <span className="font-bold text-gray-900">{selectedSurvey.member_ids?.length || 0}명</span>
                        </div>
                        
                        <div className="space-y-2">
                           <h4 className="text-sm font-bold text-gray-700">응답자 목록</h4>
                           <div className="grid grid-cols-2 gap-2">
                              {/* Separate into Submitted / Not Submitted */}
                              {(() => {
                                  const targets = selectedSurvey.member_ids || [];
                                  const responses = selectedSurvey.responses || {};
                                  
                                  const list = targets.map(uid => {
                                      const info = memberMap[uid] || { id: uid, name: '...', grade: '' };
                                      const hasRes = !!responses[uid];
                                      return { ...info, hasRes };
                                  });
                                  
                                  // Sort: Submitted first, then by name
                                  list.sort((a, b) => {
                                      if (a.hasRes === b.hasRes) return a.name.localeCompare(b.name);
                                      return a.hasRes ? -1 : 1;
                                  });

                                  return list.map(m => (
                                      <div key={m.id} className={`p-2 rounded border text-sm flex items-center justify-between ${m.hasRes ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
                                           <div className="flex items-center gap-1.5">
                                              <span className="font-medium text-gray-800">{m.name}</span>
                                              <span className="text-[10px] text-gray-400">{m.grade}</span>
                                           </div>
                                           {m.hasRes ? (
                                               <Badge variant="outline" className="text-[10px] bg-white text-blue-600 border-blue-200 px-1 py-0 h-5">제출완료</Badge>
                                           ) : (
                                               <span className="text-[10px] text-gray-400">미제출</span>
                                           )}
                                      </div>
                                  ));
                              })()}
                           </div>
                        </div>
                     </div>
                 ) : null}
              </div>
              <DrawerFooter>
                 <Button variant="outline" onClick={closeDrawer}>닫기</Button>
              </DrawerFooter>
          </DrawerContent>
       </Drawer>
    </div>
  );
}
