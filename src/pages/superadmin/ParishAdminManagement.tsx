import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { Container, Card, Heading, Button, Input, Label } from '@/components/ui';
import { ArrowLeft, User, Plus, X, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ServerGroup {
  id: string;
  name: string;
}

interface AdminUser {
  id: string; // membership id
  uid: string;
  user_name: string;
  baptismal_name: string;
  email: string;
  roles: string[];
}

interface UserSearchResult {
  uid: string;
  user_name: string;
  baptismal_name?: string;
  email: string;
  phone?: string;
  created_at?: Timestamp;
  memberships?: string[];
}

export default function ParishAdminManagement() {
  const { parishCode } = useParams<{ parishCode: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const [parishName, setParishName] = useState('');
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const [adminsByGroup, setAdminsByGroup] = useState<Record<string, AdminUser[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Create Group State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // 1. Init Data
  useEffect(() => {
    if (!parishCode) return;
    loadData();
  }, [parishCode]);

  const loadData = async () => {
    if (!parishCode) return;
    setLoading(true);
    try {
      // 1) Fetch Parish Name
      const parishDoc = await getDoc(doc(db, 'parishes', parishCode));
      if (parishDoc.exists()) {
        setParishName(parishDoc.data().name_kor || parishCode);
      }

      // 2) Fetch Server Groups
      const sgQ = query(collection(db, 'server_groups'), where('parish_code', '==', parishCode));
      const sgSnap = await getDocs(sgQ);
      const groups: ServerGroup[] = sgSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id
      }));
      setServerGroups(groups);

      // 3) Fetch Admins for each Group
      const adminsMap: Record<string, AdminUser[]> = {};
      
      await Promise.all(groups.map(async (g) => {
        // Membership query where server_group_id == g.id AND role contains 'admin'
        // Firestore limitation: array-contains 'admin'
        const mQ = query(
          collection(db, 'memberships'), 
          where('server_group_id', '==', g.id),
          where('role', 'array-contains', 'admin')
        );
        const mSnap = await getDocs(mQ);
        
        const groupAdmins: AdminUser[] = [];
        
        // Fetch User details for each membership
        await Promise.all(mSnap.docs.map(async (mDoc) => {
          const mData = mDoc.data();
          const uid = mData.uid;
          
          // Fetch User Profile
          const userDoc = await getDoc(doc(db, 'users', uid));
          const userData = userDoc.exists() ? userDoc.data() : {};

          groupAdmins.push({
            id: mDoc.id,
            uid: uid,
            user_name: userData.user_name || 'Unknown',
            baptismal_name: userData.baptismal_name || '',
            email: userData.email || '',
            roles: mData.role || []
          });
        }));

        adminsMap[g.id] = groupAdmins;
      }));

      setAdminsByGroup(adminsMap);

    } catch (e) {
      console.error(e);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Search Users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Simple search by email equality or name equality
      // Firestore doesn't support full-text search easily without Algolia.
      // We will try to find by email first.
      
      const term = searchQuery.trim();
      // 1. Try Email
      let q = query(collection(db, 'users'), where('email', '==', term));
      let snap = await getDocs(q);
      
      if (snap.empty) {
        // 2. Try User Name (이름)
        q = query(collection(db, 'users'), where('user_name', '==', term));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        // 3. Try Baptismal Name (세례명)
        q = query(collection(db, 'users'), where('baptismal_name', '==', term));
        snap = await getDocs(q);
      }

      const results: UserSearchResult[] = await Promise.all(snap.docs.map(async (d) => {
        const userData = d.data();
        
        // Fetch Memberships
        const memQ = query(collection(db, 'memberships'), where('uid', '==', d.id));
        const memSnap = await getDocs(memQ);
        const membershipInfos = memSnap.docs.map(m => {
            const mData = m.data();
            const roles = mData.role ? (Array.isArray(mData.role) ? mData.role.join(', ') : mData.role) : '-';
            return `${mData.server_group_id} [${roles}]`;
        });

        return {
          uid: d.id,
          user_name: userData.user_name,
          baptismal_name: userData.baptismal_name,
          email: userData.email,
          phone: userData.phone,
          created_at: userData.created_at,
          memberships: membershipInfos
        };
      }));
      setSearchResults(results);

    } catch (e) {
      console.error(e);
      toast.error('검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  // 3. Add Admin Role
  const handleAddAdmin = async (user: UserSearchResult) => {
    if (!targetGroupId) return;
    
    try {
      const membershipId = `${user.uid}_${targetGroupId}`;
      const membershipRef = doc(db, 'memberships', membershipId);
      const membershipDoc = await getDoc(membershipRef);

      if (membershipDoc.exists()) {
        const currentRoles = membershipDoc.data().role || [];
        if (currentRoles.includes('admin')) {
          toast.info('이미 어드민 권한이 있습니다.');
          return;
        }
        await updateDoc(membershipRef, {
          role: arrayUnion('admin'),
          updated_at: serverTimestamp()
        });
      } else {
        // New Membership
        await setDoc(membershipRef, {
          uid: user.uid,
          server_group_id: targetGroupId,
          parish_code: parishCode,
          role: ['admin', 'planner'], // Give planner by default too? Yes usually.
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      }

      toast.success(`${user.user_name}님을 어드민으로 추가했습니다.`);
      setIsModalOpen(false);
      loadData(); // Reload list

    } catch (e) {
      console.error(e);
      toast.error('어드민 추가 실패');
    }
  };

  // 4. Remove Admin Role
  const handleRemoveAdmin = async (admin: AdminUser, groupId: string) => {
    if (!confirm(`${admin.user_name}님의 어드민 권한을 해제하시겠습니까?`)) return;

    try {
      const membershipRef = doc(db, 'memberships', admin.id);
      
      // If user has other roles (like planner, server), just remove admin.
      // If user has ONLY admin (or admin + planner), maybe downgrade to planner?
      // Let's just remove 'admin'.
      
      const newRoles = admin.roles.filter(r => r !== 'admin');
      
      if (newRoles.length === 0) {
          // If no roles left, delete membership completely?
          // Or keep as empty role? Better delete to clean up.
          await deleteDoc(membershipRef);
      } else {
          await updateDoc(membershipRef, {
              role: arrayRemove('admin'),
              updated_at: serverTimestamp()
          });
      }

      toast.success('어드민 권한을 해제했습니다.');
      loadData();

    } catch (e) {
        console.error(e);
        toast.error('권한 해제 실패');
    }
  };

  // 5. Create Server Group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
        toast.error('복사단 이름을 입력해주세요.');
        return;
    }
    if (!session.user || !parishCode) {
        toast.error('로그인이 필요합니다.');
        return;
    }

    setCreatingGroup(true);
    try {
        const counterRef = doc(db, 'counters', 'server_groups');
        
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextSeq = 1;
            if (counterDoc.exists()) {
                nextSeq = (counterDoc.data().last_seq || 0) + 1;
            }
            transaction.set(counterRef, { last_seq: nextSeq }, { merge: true });

            const sgId = `SG${nextSeq.toString().padStart(5, '0')}`;
            const sgRef = doc(db, 'server_groups', sgId);

            transaction.set(sgRef, {
                parish_code: parishCode,
                name: newGroupName,
                active: true,
                timezone: 'Asia/Seoul',
                locale: 'ko-KR',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });

            // Make current user (SuperAdmin) an admin/planner of the new group
            const membershipId = `${session.user?.uid}_${sgId}`;
            const membershipRef = doc(db, 'memberships', membershipId);
            transaction.set(membershipRef, {
                uid: session.user?.uid,
                server_group_id: sgId,
                parish_code: parishCode,
                role: ['admin', 'planner'],
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });
        });

        toast.success('복사단이 생성되었습니다.');
        setIsCreateModalOpen(false);
        setNewGroupName('');
        loadData(); // Reload
        session.refreshSession?.();

    } catch (e) {
        console.error(e);
        toast.error('생성 실패');
    } finally {
        setCreatingGroup(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

  return (
    <Container className="py-8 min-h-screen bg-transparent">
       <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin')} className="dark:text-gray-200">
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            복사단 어드민 관리
          </Heading>
          <p className="text-gray-500 text-sm font-medium mt-1 dark:text-gray-400">
             {parishName} ({parishCode})
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {serverGroups.map(group => (
            <Card key={group.id} className="p-5 border-none shadow-sm space-y-4 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{group.name}</h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{group.id}</span>
                    </div>
                    <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-2 text-violet-600 border-violet-100 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/50 dark:hover:bg-violet-900/40"
                        onClick={() => {
                            setTargetGroupId(group.id);
                            setSearchQuery('');
                            setSearchResults([]);
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={16} /> 어드민 추가
                    </Button>
                </div>

                <div className="space-y-2">
                    {adminsByGroup[group.id]?.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">지정된 어드민이 없습니다.</p>
                    ) : (
                        adminsByGroup[group.id]?.map(admin => (
                            <div key={admin.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-900 p-3 rounded-lg border border-transparent dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 flex items-center justify-center text-gray-400 dark:text-gray-500">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                            {admin.user_name} 
                                            {admin.baptismal_name && <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({admin.baptismal_name})</span>}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">{admin.email}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleRemoveAdmin(admin, group.id)}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        ))}

        {serverGroups.length === 0 && (
            <div className="text-center py-10 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-slate-700">
                <p className="mb-4">등록된 복사단이 없습니다.</p>
                <Button 
                    variant="outline"
                    className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    <Plus size={16} /> 새 복사단 생성
                </Button>
            </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <Card className="w-full max-w-md p-6 max-h-[80vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <Heading size="md" className="text-xl font-bold dark:text-gray-100">어드민 추가</Heading>
                    <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="dark:text-gray-400">
                        <X size={20} />
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input 
                                placeholder="이메일 또는 이름으로 검색" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pr-8 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-2"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <Button onClick={handleSearch} disabled={searching}>
                            <Search size={18} />
                        </Button>
                    </div>

                    <div className="space-y-2 mt-2">
                        {searchResults.map(user => (
                            <div key={user.uid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                            {user.user_name}
                                            {user.baptismal_name && <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">({user.baptismal_name})</span>}
                                        </p>
                                        <span className="text-[10px] text-gray-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-slate-600">
                                            가입일: {user.created_at ? format(user.created_at.toDate(), 'yyyy-MM-dd') : '-'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {user.email}
                                        {user.phone && <span className="ml-2 pl-2 border-l border-gray-300">{user.phone}</span>}
                                    </p>
                                    {user.memberships && user.memberships.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {user.memberships.map((m, idx) => (
                                                <span key={idx} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Button 
                                    size="sm" 
                                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 shrink-0 ml-2 dark:bg-violet-700 dark:hover:bg-violet-600"
                                    onClick={() => handleAddAdmin(user)}
                                >
                                    선택
                                </Button>
                            </div>
                        ))}
                        {searchResults.length === 0 && !searching && searchQuery && (
                            <p className="text-center text-sm text-gray-400 py-4">검색 결과가 없습니다.</p>
                        )}
                    </div>
                </div>
            </Card>
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 animate-in zoom-in-95 duration-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <Heading size="md" className="text-xl font-bold dark:text-gray-100">새 복사단 생성</Heading>
              <Button variant="ghost" size="icon" onClick={() => setIsCreateModalOpen(false)} className="dark:text-gray-400">
                <X size={20} />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-sm font-bold dark:text-gray-300">성당 (Code)</Label>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {parishCode}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-name" className="text-sm font-bold dark:text-gray-300">복사단 이름</Label>
                <Input 
                  id="new-name" 
                  placeholder="예: 학생 복사단" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                    variant="ghost" 
                    className="flex-1 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-200" 
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={creatingGroup}
                >
                  취소
                </Button>
                <Button 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleCreateGroup}
                    disabled={creatingGroup}
                >
                  {creatingGroup ? '생성 중...' : '생성하기'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </Container>
  );
}
