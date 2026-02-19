import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  getDoc,
  runTransaction,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Container, Heading, Card } from '@/components/ui';
import { useSession } from '@/state/session';
import { ArrowLeft, ChevronDown, Baby, Mail } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';

interface RoleRequest {
  uid: string;
  email: string;
  user_name: string;
  baptismal_name: string;
  phone: string;
  role: 'planner';
  status: 'pending' | 'approved' | 'rejected';
  created_at: any;
  updated_at?: any;
  provider?: string;
}

export default function PlannerRoleApproval() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();
  
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // History State
  const [history, setHistory] = useState<RoleRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const HISTORY_PAGE_SIZE = 10;

  // Children Info State
  const [childrenMap, setChildrenMap] = useState<Record<string, string[]>>({});

  const fetchMembers = async () => {
    if (!serverGroupId) return;
    try {
      const q = query(collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members'));
      const snap = await getDocs(q);
      
      const map: Record<string, string[]> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.parent_uid && data.name_kor) {
          const childName = `${data.name_kor}(${data.baptismal_name || ''})`;
          if (!map[data.parent_uid]) {
            map[data.parent_uid] = [];
          }
          map[data.parent_uid].push(childName);
        }
      });
      setChildrenMap(map);
    } catch (e) {
      console.error('Failed to fetch members for children info', e);
    }
  };

  const fetchPendingRequests = async () => {
    if (!serverGroupId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      
      // Fetch User Provider for each request
      const list = await Promise.all(snap.docs.map(async (d) => {
          const reqData = d.data() as RoleRequest;
          try {
              const userSnap = await getDoc(doc(db, 'users', reqData.uid));
              if (userSnap.exists()) {
                  reqData.provider = userSnap.data().provider;
              }
          } catch(e) { console.error('Failed to fetch user provider', e); }
          return reqData;
      }));

      list.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
      setRequests(list);
    } catch (e) {
      console.error(e);
      toast.error('대기 중인 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (isInitial = false) => {
    if (!serverGroupId) return;
    setHistoryLoading(true);
    try {
      let q = query(
        collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests'),
        where('status', 'in', ['approved', 'rejected']),
        orderBy('updated_at', 'desc'),
        limit(HISTORY_PAGE_SIZE)
      );

      if (!isInitial && lastDoc) {
        q = query(
          collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests'),
          where('status', 'in', ['approved', 'rejected']),
          orderBy('updated_at', 'desc'),
          startAfter(lastDoc),
          limit(HISTORY_PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      
      const list = await Promise.all(snap.docs.map(async (d) => {
          const reqData = d.data() as RoleRequest;
          try {
              const userSnap = await getDoc(doc(db, 'users', reqData.uid));
              if (userSnap.exists()) {
                  reqData.provider = userSnap.data().provider;
              }
          } catch(e) { console.error('Failed to fetch user provider for history', e); }
          return reqData;
      }));
      
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === HISTORY_PAGE_SIZE);

      if (isInitial) {
        setHistory(list);
      } else {
        setHistory((prev) => [...prev, ...list]);
      }
    } catch (e: any) {
      console.error(e);
      // Ignore index errors silently or show friendly message if critical
      if (e.code === 'failed-precondition') {
          console.warn('Index might be missing for history query. Please check console link.');
      }
      toast.error('이력을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (serverGroupId) {
      fetchPendingRequests();
      fetchHistory(true);
      fetchMembers();
    }
  }, [serverGroupId]);

  const handleApprove = async (req: RoleRequest) => {
    if (!serverGroupId) return;
    if (!confirm(`${req.user_name}님의 플래너 권한을 승인하시겠습니까?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Check membership
        const membershipRef = doc(db, COLLECTIONS.MEMBERSHIPS, `${req.uid}_${serverGroupId}`);
        const membershipSnap = await transaction.get(membershipRef);
        
        // 2. Update request
        const requestRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests', req.uid);
        transaction.update(requestRef, {
          status: 'approved',
          updated_at: serverTimestamp(),
        });

        // 3. Update memberships
        if (membershipSnap.exists()) {
          const currentData = membershipSnap.data();
          let newRoles: string[] = [];
          if (Array.isArray(currentData.role)) {
            newRoles = [...currentData.role];
            if (!newRoles.includes('planner')) {
              newRoles.push('planner');
            }
          } else {
            // Handle legacy single-role string if exists, though unlikely now
            newRoles = [currentData.role, 'planner']; 
          }


          transaction.update(membershipRef, {
            role: newRoles, 
            active: true,
            updated_at: serverTimestamp(),
          });
        } else {
          // New Membership
          transaction.set(membershipRef, {
            uid: req.uid,
            server_group_id: serverGroupId,
            role: ['planner'],
            active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

      });

      toast.success('승인 완료되었습니다.');
      fetchPendingRequests();
      fetchHistory(true); // Refund history to show newest update
    } catch (e) {
      console.error(e);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (req: RoleRequest) => {
    if (!serverGroupId) return;
    if (!confirm(`${req.user_name}님의 요청을 반려하시겠습니까?`)) return;

    try {
      await updateDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests', req.uid), {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });
      toast.success('반려되었습니다.');
      fetchPendingRequests();
      fetchHistory(true);
    } catch (e) {
      console.error(e);
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <Container className="py-8 min-h-screen bg-transparent">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="dark:text-gray-200">
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            신규 권한 승인
          </Heading>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            플래너 권한 요청을 확인하고 승인합니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">로딩 중...</div>
      ) : (
        <>
          {requests.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400">대기 중인 권한 요청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <Card key={req.uid} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                       {session.serverGroups[serverGroupId || '']?.groupName}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{req.user_name}</span>
                        {req.provider && (
                            <div 
                                className="w-5 h-5 bg-white dark:bg-slate-700 rounded-full border border-gray-100 dark:border-slate-600 shadow-sm flex items-center justify-center p-0.5" 
                                title={req.provider === 'google.com' ? 'Google로 로그인' : req.provider === 'password' ? 'ID/Password로 로그인' : ''}
                            >
                                {req.provider === 'google.com' ? (
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="google" className="w-3 h-3" />
                                ) : (
                                    <Mail size={10} className="text-gray-400 dark:text-gray-300" />
                                )}
                            </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">({req.baptismal_name})</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                        플래너 신청
                      </span>
                    </div>
                    {childrenMap[req.uid] && childrenMap[req.uid].length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-md">
                         <Baby size={12} className="text-blue-500 dark:text-blue-400" />
                         <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                            자녀: {childrenMap[req.uid].join(', ')}
                         </span>
                      </div>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                      <p>{req.email}</p>
                      <p>{req.phone}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        신청일시: {req.created_at?.toDate().toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                        className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleApprove(req)}
                    >
                      승인
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex-1 sm:flex-none text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 dark:hover:bg-red-900/20 dark:border-red-900/50"
                        onClick={() => handleReject(req)}
                    >
                      반려
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* History Section */}
          <div className="mt-12">
            <h3 className="text-md font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              이전 신청 이력
            </h3>
            
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">이전 이력이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {history.map((req) => (
                  <div key={req.uid} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg shadow-sm hover:border-gray-200 dark:hover:border-slate-600 transition-colors">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-1 h-8 rounded-full flex-shrink-0 ${req.status === 'approved' ? 'bg-blue-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{req.user_name}</span>
                            {req.provider && (
                                <div 
                                    className="w-4 h-4 bg-white dark:bg-slate-700 rounded-full border border-gray-100 dark:border-slate-600 shadow-sm flex items-center justify-center p-0.5" 
                                    title={req.provider === 'google.com' ? 'Google로 로그인' : req.provider === 'password' ? 'ID/Password로 로그인' : ''}
                                >
                                    {req.provider === 'google.com' ? (
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="google" className="w-2.5 h-2.5" />
                                    ) : (
                                        <Mail size={8} className="text-gray-400 dark:text-gray-300" />
                                    )}
                                </div>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">({req.baptismal_name})</span>
                          </div>
                          {childrenMap[req.uid] && childrenMap[req.uid].length > 0 && (
                             <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 mb-1">
                               <Baby size={10} className="text-gray-400 dark:text-gray-500" />
                               <span>자녀: {childrenMap[req.uid].join(', ')}</span>
                             </div>
                          )}
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                            {req.phone} <span className="text-gray-300 dark:text-gray-600 mx-1">|</span> {req.email}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-2 truncate">
                             <span>{req.created_at?.toDate().toLocaleDateString()} 신청</span>
                             {req.updated_at && (
                               <span>• {req.updated_at?.toDate().toLocaleDateString()} {req.status === 'approved' ? '승인' : '반려'}</span>
                             )}
                          </div>
                        </div>
                     </div>
                     
                     <div className="flex-shrink-0 ml-2">
                          {req.status === 'approved' ? (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-medium dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50">
                              승인됨
                            </span>
                          ) : (
                            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-medium dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50">
                              반려됨
                            </span>
                          )}
                     </div>
                  </div>
                ))}
              </div>
            )}
            
            {hasMore && (
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchHistory(false)}
                  disabled={historyLoading}
                  className="text-gray-500 dark:text-gray-400 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {historyLoading ? '로딩 중...' : (
                    <>
                      더보기 <ChevronDown size={14} className="ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </Container>
  );
}

