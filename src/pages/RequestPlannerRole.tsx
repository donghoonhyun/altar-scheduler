// src/pages/RequestPlannerRole.tsx
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
import { Parish, getDioceseName } from '@/types/parish';
import { useParishes } from '@/hooks/useParishes';
import { useDioceses, Diocese } from '@/hooks/useDioceses';
import { COLLECTIONS } from '@/lib/collections';
import { 
  ShieldCheck, 
  Church, 
  Users, 
  User, 
  Phone, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Info,
  Trash2,
  Home,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

type ServerGroupItem = {
  id: string;
  name: string;
  parish_code: string;
  active?: boolean;
};

type PendingRequest = {
  id: string; 
  serverGroupId: string; 
  groupName: string; 
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
  const { data: diocesesData } = useDioceses();

  // Existing request state
  const [existingRequest, setExistingRequest] = useState<PendingRequest | null>(null);
  const [requestHistory, setRequestHistory] = useState<PendingRequest[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Selection
  const [selectedDiocese, setSelectedDiocese] = useState<string>('');
  const [selectedParish, setSelectedParish] = useState<string>('');
  const [serverGroups, setServerGroups] = useState<ServerGroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // User Info
  const [userName, setUserName] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isPhoneEditable, setIsPhoneEditable] = useState(false);
  const [loading, setLoading] = useState(false);

  // 📝 사용자 프로필 정보 누락 체크
  const [showProfileUpdate, setShowProfileUpdate] = useState<boolean>(false);

  useEffect(() => {
    const skipped = sessionStorage.getItem('profile_skip');
    if (skipped) {
      setShowProfileUpdate(false);
      return;
    }

    if (!session.loading && session.user) {
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
            setRequestHistory([]);
            setCheckingStatus(false);
            return;
        }

        const docs = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
        docs.sort((a, b) => {
            const timeA = a.data.created_at?.toMillis() || 0;
            const timeB = b.data.created_at?.toMillis() || 0;
            return timeB - timeA;
        });

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
                        const parishDoc = await getDoc(doc(db, COLLECTIONS.PARISHES, sgData.parish_code));
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

        let targetReq = allRequests.find(r => r.status === 'pending') || allRequests[0];
        
        if (session.currentServerGroupId) {
            const contextReq = allRequests.find(r => r.serverGroupId === session.currentServerGroupId && r.status === 'pending');
            if (contextReq) targetReq = contextReq;
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

    const loadProfile = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(data.user_name || user.displayName || '');
          setBaptismalName(data.baptismal_name || '');
          setPhone(data.phone || '');
          if (!data.phone) setIsPhoneEditable(true);
        } else {
            setUserName(user.displayName || '');
            setIsPhoneEditable(true);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadProfile();

    if (session.currentServerGroupId && session.serverGroups[session.currentServerGroupId]) {
        const groupInfo = session.serverGroups[session.currentServerGroupId];
        setSelectedParish(groupInfo.parishCode);
    }
  }, [user, existingRequest, checkingStatus, session.currentServerGroupId, session.serverGroups]);

  // 성당이 이미 선택된 경우 교구 자동 매칭
  useEffect(() => {
    if (selectedParish && parishes && !selectedDiocese) {
        const p = parishes.find(item => item.code === selectedParish);
        if (p) setSelectedDiocese(p.diocese);
    }
  }, [selectedParish, parishes, selectedDiocese]);

  // Load Server Groups when Parish changes
  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedParish) {
        setServerGroups([]);
        return;
      }
      try {
        const q = query(
          collection(db, COLLECTIONS.SERVER_GROUPS), 
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
        if (list.length === 1) {
            setSelectedGroup(list[0].id);
        } else {
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

    const currentRoles = session.groupRoles[selectedGroup] || [];
    if (currentRoles.includes('admin') || currentRoles.includes('planner')) {
        toast.error('이미 해당 복사단의 관리자(또는 플래너) 권한을 보유하고 있습니다.');
        return;
    }

    const alreadyPending = requestHistory.find(r => r.serverGroupId === selectedGroup && r.status === 'pending');
    if (alreadyPending) {
        toast.error('이미 해당 복사단에 승인 대기 중인 신청 건이 있습니다.');
        return;
    }

    setLoading(true);
    try {
      const requestRef = doc(db, COLLECTIONS.SERVER_GROUPS, selectedGroup, 'role_requests', user.uid);
      
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

      if (isPhoneEditable && phone) {
        await setDoc(doc(db, 'users', user.uid), {
            phone: phone,
            updated_at: serverTimestamp()
        }, { merge: true });
      }

      toast.success('플래너 권한 신청이 완료되었습니다. 관리자 승인을 기다려주세요.', {
        description: '대상자에게 알림이 곧 보내집니다.',
      });
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const cancelRequestById = async (req: PendingRequest) => {
    if (!user) return;
    if (!window.confirm("정말로 신청을 취소하시겠습니까?")) return;

    setLoading(true);
    try {
      await deleteDoc(
        doc(db, COLLECTIONS.SERVER_GROUPS, req.serverGroupId, 'role_requests', req.id)
      );
      toast.success("신청이 취소되었습니다.");
      setRequestHistory(prev => prev.filter(item => !(item.id === req.id && item.serverGroupId === req.serverGroupId)));
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
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-500 font-medium">신청 상태 확인 중...</p>
        </div>
    );
  }

  // View: Application Pending or Decided
  if (existingRequest && existingRequest.status === 'pending') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pt-12 text-center transition-colors duration-200">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner">
          <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            승인 대기 중
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
          플래너 권한 신청 후 관리자 승인을 기다리고 있습니다. 승인이 완료되면 알림을 보내드릴게요.
        </p>

        <Card className="dark:bg-slate-900 text-left mb-8 border-none shadow-sm overflow-hidden">
            <div className="bg-blue-600/5 dark:bg-blue-400/5 px-6 py-4 border-b border-blue-100 dark:border-blue-900/20">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">신청 정보</span>
            </div>
            <div className="p-6 space-y-5">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">신청 소속</span>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 text-right">
                        {existingRequest.parishName}<br/>
                        <span className="text-blue-600 dark:text-blue-400">{existingRequest.groupName}</span>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">신청자</span>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {existingRequest.user_name} ({existingRequest.baptismal_name})
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">신청일시</span>
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {existingRequest.created_at?.toDate 
                          ? dayjs(existingRequest.created_at.toDate()).format('YYYY년 MM월 DD일 HH:mm')
                          : '-'}
                    </div>
                </div>
            </div>
        </Card>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button 
                variant="outline"
                className="flex-1 h-12"
                onClick={() => navigate('/')}
            >
                <Home className="w-4 h-4 mr-2" />
                홈으로 돌아가기
            </Button>

            <Button 
                variant="destructive"
                className="flex-1 h-12 font-bold"
                onClick={() => cancelRequestById(existingRequest)}
                disabled={loading}
            >
                <Trash2 className="w-4 h-4 mr-2" />
                신청 취소하기
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
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

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            플래너 권한 신청
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          미사 일정을 관리하고 복사단원을 관리하는 '플래너' 권한을 신청합니다.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-sm dark:bg-slate-900">
            <div className="p-6 space-y-6">
                <div className="space-y-4">
                    <Label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Church className="w-4 h-4 text-slate-400" />
                        1. 소속 선택
                    </Label>
                    <div className="grid gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-slate-400">교구</Label>
                            <Select 
                                value={selectedDiocese} 
                                onValueChange={(val) => {
                                    setSelectedDiocese(val);
                                    setSelectedParish('');
                                    setSelectedGroup('');
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="교구를 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(diocesesData || []).map((diocese: Diocese) => (
                                        <SelectItem key={diocese.code} value={diocese.code}>
                                            {diocese.name_kor}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-slate-400">성당</Label>
                            <Select 
                                disabled={!selectedDiocese}
                                value={selectedParish} 
                                onValueChange={(val) => {
                                    setSelectedParish(val);
                                    setSelectedGroup('');
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={!selectedDiocese ? "교구를 먼저 선택하세요" : "성당을 선택하세요"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {parishes?.filter(p => !selectedDiocese || p.diocese === selectedDiocese).map((p: Parish) => (
                                        <SelectItem key={p.code} value={p.code}>
                                            {p.name_kor}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-slate-400">복사단</Label>
                            <Select 
                                disabled={!selectedParish}
                                value={selectedGroup} 
                                onValueChange={setSelectedGroup}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={!selectedParish ? "성당을 먼저 선택하세요" : "복사단을 선택하세요"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {serverGroups.map((sg) => (
                                        <SelectItem key={sg.id} value={sg.id}>
                                            {sg.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800" />

                <div className="space-y-4">
                    <Label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <User className="w-4 h-4 text-slate-400" />
                        2. 신청자 정보
                    </Label>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 space-y-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">이름</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{userName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">세례명</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{baptismalName || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400 shrink-0">연락처</span>
                            {isPhoneEditable ? (
                                <Input
                                    className="h-9 text-right text-sm font-bold"
                                    placeholder="010-0000-0000"
                                    value={phone}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        let formatted = raw;
                                        if (raw.length > 11) formatted = raw.slice(0, 11);
                                        
                                        if (formatted.length > 3 && formatted.length <= 7) {
                                            formatted = `${formatted.slice(0, 3)}-${formatted.slice(3)}`;
                                        } else if (formatted.length > 7) {
                                            formatted = `${formatted.slice(0, 3)}-${formatted.slice(3, 7)}-${formatted.slice(7)}`;
                                        }
                                        setPhone(formatted);
                                    }}
                                    maxLength={13}
                                />
                            ) : (
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{phone || '-'}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                        <Info className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-400">
                           정보 수정은 마이페이지(내 프로필)에서 가능합니다.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button 
                        variant="ghost" 
                        onClick={() => navigate(-1)} 
                        className="flex-1 h-12"
                        disabled={loading}
                    >
                        취소
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        className="flex-2 h-12 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                        disabled={loading}
                    >
                        {loading ? '신청 중...' : '신청하기'}
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>

        {/* Request History Section */}
        {requestHistory.length > 0 && (
            <div className="mt-12 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <History className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">신청 내역</h3>
                </div>
                <div className="space-y-3">
                    {requestHistory.map((req) => (
                        <div key={req.id + req.serverGroupId} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{req.parishName}</div>
                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{req.groupName}</div>
                                </div>
                                <div>
                                    {req.status === 'approved' ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full border border-green-100 dark:border-green-900/50">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">승인됨</span>
                                        </div>
                                    ) : req.status === 'rejected' ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-100 dark:border-red-900/50">
                                            <XCircle className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">반려됨</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/50">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">대기 중</span>
                                            </div>
                                            <Button 
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => cancelRequestById(req)} 
                                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                                {req.created_at?.toDate 
                                    ? dayjs(req.created_at.toDate()).format('YYYY.MM.DD HH:mm')
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
