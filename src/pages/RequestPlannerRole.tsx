import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  doc,
  getDoc,
  collectionGroup,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { toast } from 'sonner';
import UpdateUserProfileDialog from './components/UpdateUserProfileDialog';
import { Parish } from '@/types/parish';
import { useParishes } from '@/hooks/useParishes';
import { Button, Input } from '@/components/ui';

type ServerGroupItem = {
  id: string;
  name: string;
  parish_code: string;
  active?: boolean;
};

// role_requests pending info
type PendingRequest = {
  id: string; // user uid
  serverGroupId: string; // The group they applied to
  groupName: string; // Fetched group name
  parishName: string;
  created_at: any;
  user_name: string;
  baptismal_name: string;
  status?: string;
};

export default function RequestPlannerRole() {
  const navigate = useNavigate();
  const session = useSession();
  const user = session.user;
  const { data: parishes } = useParishes(true);

  // Existing request state
  const [existingRequest, setExistingRequest] = useState<PendingRequest | null>(null);
  const [requestHistory, setRequestHistory] = useState<PendingRequest[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Selection
  const [selectedParish, setSelectedParish] = useState<string>('');
  const [serverGroups, setServerGroups] = useState<ServerGroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // User Info
  const [userName, setUserName] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 📝 사용자 프로필 정보 누락 체크
  const [showProfileUpdate, setShowProfileUpdate] = useState<boolean>(false);

  useEffect(() => {
    // 이미 건너 뛰었으면 다시 안 띄움
    const skipped = sessionStorage.getItem('profile_skip');
    if (skipped) {
      setShowProfileUpdate(false);
      return;
    }

    // 세션 로딩이 끝났고(userInfo 체크 가능), 로그인 상태일 때
    if (!session.loading && session.user) {
      // userInfo가 아예 없거나, userName이 비어있으면 팝업
      if (!session.userInfo || !session.userInfo.userName) {
        setShowProfileUpdate(true);
      } else {
        setShowProfileUpdate(false);
      }
    }
  }, [session.loading, session.user, session.userInfo]);

  // Check for existing pending requests
  useEffect(() => {
    const checkPendingRequests = () => {
      if (!user) return;
      
      setCheckingStatus(true); 

      const q = query(
        collectionGroup(db, 'role_requests'),
        where('uid', '==', user.uid)
      );
      
      const unsubscribe = onSnapshot(q, async (snap) => {
        if (snap.empty) {
            setExistingRequest(null);
            setCheckingStatus(false);
            return;
        }

        const docs = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
        docs.sort((a, b) => {
            const timeA = a.data.created_at?.toMillis() || 0;
            const timeB = b.data.created_at?.toMillis() || 0;
            return timeB - timeA;
        });

        // Process all docs to get full history
        const allRequests = await Promise.all(docs.map(async (docObj) => {
            const data = docObj.data;
            const serverGroupRef = docObj.ref.parent.parent;
            let groupName = '알 수 없는 복사단';
            let parishName = '';
            
            if (serverGroupRef) {
                try {
                    const sgSnap = await getDoc(serverGroupRef);
                    if (sgSnap.exists()) {
                        const sgData = sgSnap.data();
                        groupName = sgData.name;
                        const parishDoc = await getDoc(doc(db, 'parishes', sgData.parish_code));
                        if (parishDoc.exists()) {
                             parishName = (parishDoc.data() as Parish).name_kor;
                        }
                    }
                } catch (e) {
                    console.error("Error fetching group info", e);
                }
            }
            
            return {
                id: docObj.id,
                serverGroupId: serverGroupRef?.id || '',
                groupName,
                parishName,
                created_at: data.created_at,
                user_name: data.user_name,
                baptismal_name: data.baptismal_name,
                status: data.status,
                ref: docObj.ref
            } as PendingRequest & { ref: any };
        }));

        allRequests.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
        setRequestHistory(allRequests);

        // Determine which request to show mainly (existing logic using resolved list)
        let targetReq = allRequests[0];
        
        if (session.currentServerGroupId) {
            const contextReq = allRequests.find(r => r.ref.parent.parent?.id === session.currentServerGroupId);
            if (contextReq) {
                targetReq = contextReq;
            } else {
                setExistingRequest(null);
                setCheckingStatus(false);
                return;
            }
        }
        
        setExistingRequest(targetReq);
        setCheckingStatus(false);
      }, (err) => {
          console.error("Error watching requests:", err);
          setCheckingStatus(false);
      });

      return unsubscribe;
    };

    const unsubscribe = checkPendingRequests();
    return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
            (unsubscribe as any)();
        }
    };
  }, [user, session.currentServerGroupId]);

  // Load User Profile & Pre-fill Context
  useEffect(() => {
    if (existingRequest || checkingStatus) return; 

    // Pre-fill based on User Profile
    const loadProfile = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(data.user_name || user.displayName || '');
          setBaptismalName(data.baptismal_name || '');
          setPhone(data.phone || '');
        } else {
            setUserName(user.displayName || '');
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadProfile();

    // Pre-fill Parish/Group based on Session Context
    if (session.currentServerGroupId && session.serverGroups[session.currentServerGroupId]) {
        const groupInfo = session.serverGroups[session.currentServerGroupId];
        setSelectedParish(groupInfo.parishCode);
    }

  }, [user, existingRequest, checkingStatus, session.currentServerGroupId, session.serverGroups]);

  // Load Server Groups when Parish changes
  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedParish) {
        setServerGroups([]);
        return;
      }
      try {
        const q = query(
          collection(db, 'server_groups'), 
          where('parish_code', '==', selectedParish),
          where('active', '==', true)
        );
        const snap = await getDocs(q);
        const list: ServerGroupItem[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ServerGroupItem, 'id'>),
          }));
        
        setServerGroups(list);
        
        // Auto-select if only one group exists
        if (list.length === 1) {
            setSelectedGroup(list[0].id);
        } else {
            // Force reset to require manual selection if multiple (or zero)
            setSelectedGroup(''); 
        }
      } catch (e) {
        console.error('Failed to load server groups', e);
      }
    };
    loadGroups();
  }, [selectedParish]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!selectedGroup) {
      toast.error('복사단을 선택해주세요.');
      return;
    }

    if (!userName || !baptismalName || !phone) {
      toast.error('이름, 세례명, 전화번호를 모두 입력해주세요.');
      return;
    }

    // Check existing role
    const currentRoles = session.groupRoles[selectedGroup] || [];
    if (currentRoles.includes('admin') || currentRoles.includes('planner')) {
        toast.error('이미 해당 복사단의 관리자(또는 플래너) 권한을 보유하고 있습니다.');
        return;
    }

    // Check duplicates in history
    const alreadyPending = requestHistory.find(r => r.serverGroupId === selectedGroup && r.status === 'pending');
    if (alreadyPending) {
        toast.error('이미 해당 복사단에 승인 대기 중인 신청 건이 있습니다.');
        return;
    }

    setLoading(true);
    try {
      // Create Request in server_groups/{sgId}/role_requests/{uid}
      const requestRef = doc(db, 'server_groups', selectedGroup, 'role_requests', user.uid);
      
      await setDoc(requestRef, {
        uid: user.uid,
        email: user.email,
        user_name: userName,
        baptismal_name: baptismalName,
        phone,
        role: 'planner',
        status: 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Optionally update user profile if changed? 
      // For now, let's keep it simple.

      toast.success('플래너 권한 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
      // Reload to show 'Pending' state instead of redirecting immediately if we want them to see it.
      // Or just re-run the check.
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!existingRequest || !user) return;
    await cancelRequestById(existingRequest);
  };

  const cancelRequestById = async (req: PendingRequest) => {
    if (!user) return;
    if (!window.confirm("정말로 신청을 취소하시겠습니까?")) return;

    setLoading(true);
    try {
      await deleteDoc(
        doc(db, 'server_groups', req.serverGroupId, 'role_requests', req.id) // req.id is user uid.
        // Wait, req.id in the map above (line 114) is docObj.id which IS the user uid. 
        // Correct.
      );

      toast.success("신청이 취소되었습니다.");
      // We don't necessarily need reload if snapshot listener updates automatically.
      // But based on previous logic, reload is used.
      // Snapshot listener should update the list automatically though.
      // Let's rely on snapshot if possible, but reload is safer for full state reset.
      // I'll stick to logic similar to existing usage or let snapshot handle it.
      // Ideally snapshot handles it.
      
      
      // Optimistic Update
      setRequestHistory(prev => prev.filter(item => !(item.id === req.id && item.serverGroupId === req.serverGroupId)));
      
      // If we are cancelling the one currently being viewed as 'existingRequest', we should probably clear it?
      if (existingRequest && existingRequest.serverGroupId === req.serverGroupId) {
          setExistingRequest(null);
      }
      
    } catch (e) {
      console.error("Failed to cancel request", e);
      toast.error("신청 취소 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return <div className="p-10 text-center">확인 중...</div>;
  }

  // View: Application Pending
  if (existingRequest) {
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 flex flex-col pt-20 text-center transition-colors duration-200">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 mx-auto">
          <svg className="w-8 h-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {existingRequest.status === 'approved' ? '승인 완료' : 
             existingRequest.status === 'rejected' ? '신청 반려' : 
             '승인 대기 중'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {existingRequest.status === 'approved' ? '플래너 권한이 승인되었습니다.' : 
           existingRequest.status === 'rejected' ? '요청하신 권한 신청이 반려되었습니다.' :
           '플래너 권한 신청 후 관리자 승인을 기다리고 있습니다.'}
        </p>


        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-6 w-full text-left space-y-4 mb-8 border border-gray-200 dark:border-slate-700">
            <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">신청 소속</span>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {existingRequest.parishName} {existingRequest.groupName}
                </div>
            </div>
            <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">신청자</span>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {existingRequest.user_name} ({existingRequest.baptismal_name})
                </div>
            </div>
            <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">신청일시</span>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {existingRequest.created_at?.toDate 
                      ? existingRequest.created_at.toDate().toLocaleString('ko-KR', { 
                          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        }) 
                      : '-'}
                </div>
            </div>
            <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">상태</span>
                {existingRequest.status === 'approved' ? (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/50">
                       승인됨
                   </span>
                ) : existingRequest.status === 'rejected' ? (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                       반려됨
                   </span>
                ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                        검토 중
                    </span>
                )}
            </div>
        </div>
        
        {existingRequest.status === 'approved' ? (
             <Button 
                className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                onClick={() => window.location.href = '/'} 
             >
                메인화면으로 이동
             </Button>
        ) : existingRequest.status === 'rejected' ? (
             <div className="w-full space-y-3">
                 <p className="text-sm text-red-600 dark:text-red-400">관리자가 요청을 반려했습니다. 다시 신청하시겠습니까?</p>
                 <Button 
                    variant="outline"
                    className="w-full dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700"
                    onClick={() => setExistingRequest(null)} // Clear request to show form
                 >
                    다시 신청하기
                 </Button>
                 <Button 
                    variant="ghost"
                    className="w-full dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-800"
                    onClick={() => navigate('/')} 
                 >
                    홈으로 이동
                 </Button>
             </div>
        ) : (
        <div className="flex gap-3 w-full mt-4">
            <Button 
                variant="outline"
                className="flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700"
                onClick={() => navigate('/')}
            >
                홈으로 돌아가기
            </Button>

            <Button 
                className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600 text-white shadow-md focus:ring-red-300"
                onClick={handleCancelRequest}
                disabled={loading}
            >
                신청 취소
            </Button>
        </div>
        )}
      </div>
    );
  }



  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 transition-colors duration-200">
      {/* 사용자 프로필 누락 시 다이얼로그 띄움 */}
      {showProfileUpdate && session.user && (
        <UpdateUserProfileDialog
          uid={session.user.uid}
          currentName={session.userInfo?.userName}
          currentBaptismalName={session.userInfo?.baptismalName}
          onClose={() => {
            sessionStorage.setItem('profile_skip', 'true');
            setShowProfileUpdate(false);
          }}
        />
      )}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">플래너 권한 신청</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          관리자 승인 후 플래너로 활동할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Organization Selection */}
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">1. 소속 선택</h3>
            <div className="grid gap-3">
                <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">성당</label>
                    <select
                    className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    value={selectedParish}
                    onChange={(e) => {
                        setSelectedParish(e.target.value);
                        setSelectedGroup('');
                    }}
                    >
                    <option value="">성당을 선택하세요</option>
                    {parishes?.map((p: Parish) => (
                        <option key={p.code} value={p.code}>
                        {p.name_kor}
                        </option>
                    ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">복사단</label>
                    <select
                    className="w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 dark:disabled:bg-slate-900/50 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    disabled={!selectedParish}
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                    <option value="">복사단을 선택하세요</option>
                    {serverGroups.map((sg) => (
                        <option key={sg.id} value={sg.id}>
                        {sg.name}
                        </option>
                    ))}
                    </select>
                </div>
            </div>
        </div>

        {/* Step 2: Applicant Info */}
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">2. 신청자 정보</h3>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 space-y-4 border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">이름</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{userName}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">세례명</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{baptismalName || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">전화번호</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{phone || '-'}</span>
                </div>
            </div>
            <p className="text-[11px] text-gray-400 text-right">
               * 정보 수정은 마이페이지에서 가능합니다.
            </p>
        </div>

        <div className="pt-4 flex gap-3">
            <Button 
                variant="outline" 
                onClick={() => navigate(-1)} 
                className="flex-1 h-12 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700"
                disabled={loading}
            >
                취소
            </Button>
            <Button 
                onClick={handleSubmit} 
                className="flex-1 h-12 text-base"
                disabled={loading}
            >
                {loading ? '신청 중...' : '권한 신청하기'}
            </Button>
        </div>

        {/* Request History Section */}
        {requestHistory.length > 0 && (
            <div className="mt-12 border-t border-gray-200 dark:border-slate-800 pt-8">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">나의 신청 내역</h3>
                <div className="space-y-3">
                    {requestHistory.map((req) => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{req.parishName}</div>
                                    <div className="text-sm font-bold text-gray-900 dark:text-gray-200">{req.groupName}</div>
                                </div>
                                <div>
                                    {req.status === 'approved' ? (
                                        <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded">승인됨</span>
                                    ) : req.status === 'rejected' ? (
                                        <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded">반려됨</span>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded">승인 대기</span>
                                            <Button 
                                                variant="destructive"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    cancelRequestById(req);
                                                }} 
                                                className="h-7 px-2 text-xs ml-1 bg-red-500 hover:bg-red-600 dark:bg-red-900/50 dark:hover:bg-red-900/70 dark:text-red-200"
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                {req.created_at?.toDate 
                                    ? req.created_at.toDate().toLocaleString('ko-KR', { 
                                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                      }) 
                                    : '-'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
