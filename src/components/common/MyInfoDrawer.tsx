import { useState, useEffect } from 'react';
import { useSession } from '@/state/session';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn, formatPhoneNumber } from '@/lib/utils';
import DrawerSectionTitle from '@/components/common/DrawerSectionTitle';

interface MemberInfo {
  name_kor?: string; // from server_groups member data
  baptismal_name?: string; // from server_groups member data
  grade?: string;
  notes?: string;
  active?: boolean;
}

interface MyInfoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverGroupId?: string;
}

export default function MyInfoDrawer({ open, onOpenChange, serverGroupId }: MyInfoDrawerProps) {
  const session = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [userName, setUserName] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [phone, setPhone] = useState('');
  const [userCategory, setUserCategory] = useState('Layman');

  // Group specific info (readonly mostly)
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  // Initialize data when open or session changes
  useEffect(() => {
    if (open && session.user) {
      // 1. Set global user info
      setUserName(session.userInfo?.userName || session.user.displayName || '');
      setBaptismalName(session.userInfo?.baptismalName || '');
      // Phone is not in session.userInfo currently, need fetch from direct doc if not there?
      // actually fetchSessionData loads users/{uid} but only picks userName/baptismalName.
      // We might need to fetch phone again or update session to include phone.
      // For now let's fetch 'users/{uid}' fully here to be sure.
      fetchUserData();

      // 2. Fetch group specific info if in a group
      if (serverGroupId) {
        fetchMemberInfo();
      }
    }
  }, [open, session.user, serverGroupId]);

  const fetchUserData = async () => {
    if (!session.user) return;
    const db = getFirestore();
    try {
      const userDoc = await getDoc(doc(db, 'users', session.user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserName(data.user_name || session.user.displayName || '');
        setBaptismalName(data.baptismal_name || '');
        setPhone(data.phone || '');
        setUserCategory(data.user_category || 'Layman');
      }
    } catch (e) {
      console.error('User data fetch error', e);
    }
  };

  const fetchMemberInfo = async () => {
    if (!serverGroupId || !session.user) return;
    const db = getFirestore();
    try {
      const ref = doc(db, 'server_groups', serverGroupId, 'members', session.user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setMemberInfo(snap.data() as MemberInfo);
      } else {
        setMemberInfo(null);
      }
    } catch (e) {
      console.log("Member info fetch error", e);
    }
  };

  const handleSave = async () => {
    if (!session.user) return;
    if (!userName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    const db = getFirestore();
    try {
      // Update global user profile
      await updateDoc(doc(db, 'users', session.user.uid), {
        user_name: userName,
        baptismal_name: baptismalName,
        phone: phone,
        user_category: userCategory,
      });

      // Also update member info in current group if it exists?
      // Usually better to keep them in sync, but maybe 'users' is the source of truth for name.
      // If we update 'users', session.refreshSession should pick it up.
      
      await session.refreshSession?.();
      toast.success("정보가 수정되었습니다.");
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast.error("정보 수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to current data
    fetchUserData();
  };

  const roleDisplay = serverGroupId && (() => {
    const roles = session.groupRoles[serverGroupId] || [];
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('planner')) return 'Planner';
    return 'Server';
  })();

  return (
    <Sheet open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setIsEditing(false); // Reset edit mode on close
    }}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>나의 정보</SheetTitle>
          <SheetDescription>
            {isEditing ? "정보를 수정 후 저장해주세요." : "등록된 나의 정보를 확인합니다."}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <DrawerSectionTitle>기본 정보</DrawerSectionTitle>
            <div className="space-y-3 px-1">
              <div>
                <label className="text-sm font-medium text-gray-700">이메일</label>
                <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                  {session.user?.email}
                </div>
              </div>

              {/* 이름 & 세례명 가로 배치 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">이름</label>
                  {isEditing ? (
                    <Input 
                      value={userName} 
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="이름"
                    />
                  ) : (
                    <div className="p-2 text-sm text-gray-900 border border-transparent">
                      {userName}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">세례명</label>
                  {isEditing ? (
                    <Input 
                      value={baptismalName} 
                      onChange={(e) => setBaptismalName(e.target.value)}
                      placeholder="세례명"
                    />
                  ) : (
                    <div className="p-2 text-sm text-gray-900 border border-transparent">
                      {baptismalName || '-'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">전화번호</label>
                {isEditing ? (
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    placeholder="010-0000-0000"
                    maxLength={13}
                  />
                ) : (
                  <div className="p-2 text-sm text-gray-900 border border-transparent">
                    {phone ? formatPhoneNumber(phone) : '-'}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">신자구분</label>
                {isEditing ? (
                  <div className="flex gap-2 mt-1">
                    {[
                      { value: 'Father', label: '신부님' },
                      { value: 'Sister', label: '수녀님' },
                      { value: 'Layman', label: '평신도' }
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setUserCategory(cat.value)}
                        className={cn(
                          "flex-1 py-2 text-sm font-medium rounded-md border transition-all",
                          userCategory === cat.value
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-sm text-gray-900 border border-transparent">
                    {userCategory === 'Father' ? '신부님' : 
                     userCategory === 'Sister' ? '수녀님' : '평신도'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Group Info (Read Only) */}
          {serverGroupId && (
            <div className="space-y-4 pt-2">
              <DrawerSectionTitle>복사단 활동 정보</DrawerSectionTitle>
              <div className="space-y-3 text-sm px-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">본당</span>
                  <span className="font-medium">{session.serverGroups[serverGroupId]?.parishName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">복사단</span>
                  <span className="font-medium">{session.serverGroups[serverGroupId]?.groupName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">역할</span>
                  <span className="font-medium">{roleDisplay}</span>
                </div>
                {memberInfo && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">학년</span>
                      <span className="font-medium">{memberInfo.grade || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">상태</span>
                      <span className={`font-medium ${memberInfo.active ? 'text-green-600' : 'text-amber-600'}`}>
                        {memberInfo.active ? '활동 중' : '대기/중지'}
                      </span>
                    </div>
                    {memberInfo.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-600">비고</span>
                        <span className="text-gray-800 bg-gray-50 p-2 rounded">{memberInfo.notes}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={loading} className="w-full sm:w-auto">
                취소
              </Button>
              <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                {loading ? '저장 중...' : '저장하기'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
              정보 수정하기
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full sm:w-auto mt-2 sm:mt-0">
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
