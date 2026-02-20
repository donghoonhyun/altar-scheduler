import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  setDoc,
  Timestamp,
  getDoc,
  deleteDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Container, Card, Heading, Button, InfoBox, Input } from '@/components/ui';
import { ArrowLeft, User, Shield, Calendar, Edit2, Check, X, Info, Trash2, Mail, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { COLLECTIONS } from '@/lib/collections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DrawerHeader from '@/components/common/DrawerHeader';

interface MembershipWithUser {
  id: string;
  uid: string;
  role: string[];
  parish_code: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  user_name?: string;
  baptismal_name?: string;
  email?: string;
  active?: boolean;
  provider?: string;
}

const MemberRoleManagement: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipWithUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [hideInactive, setHideInactive] = useState<boolean>(false);
  const [editActive, setEditActive] = useState<boolean>(false);

  // Add Member State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'email' | 'name'>('email');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addRoles, setAddRoles] = useState<string[]>([]);

  const fetchMemberships = async () => {
    if (!serverGroupId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERSHIPS),
        where('server_group_id', '==', serverGroupId)
      );
      const snap = await getDocs(q);
      
      const membershipData = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const userDoc = await getDoc(doc(db, 'users', data.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          return {
            id: d.id,
            ...data,
            role: Array.isArray(data.role) ? data.role : [data.role],
            active: data.active ?? false,
            user_name: userData.user_name || 'Unknown',
            baptismal_name: userData.baptismal_name || '',
            email: userData.email || '',
            provider: userData.provider || '',
          } as MembershipWithUser;
        })
      );
      
      setMemberships(membershipData);
    } catch (err) {
      console.error('Failed to fetch memberships:', err);
      toast.error('멤버 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, [serverGroupId]);

  const handleEdit = (m: MembershipWithUser) => {
    setEditingId(m.id);
    setEditRoles(m.role);
    setEditActive(m.active ?? false);
  };

  const toggleRole = (role: string) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const handleUpdate = async (id: string) => {
    if (editRoles.length === 0) {
      toast.error('최소 하나 이상의 역할이 필요합니다.');
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.MEMBERSHIPS, id), {
        role: editRoles,
        active: editActive,
        updated_at: Timestamp.now()
      });
      toast.success('멤버 정보가 수정되었습니다.');
      setEditingId(null);
      fetchMemberships();
    } catch (err) {
      console.error('Update member failed:', err);
      toast.error('수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`정말로 '${name}' 님을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.MEMBERSHIPS, id));
      toast.success('멤버가 삭제되었습니다.');
      fetchMemberships();
    } catch (err) {
      console.error('Delete member failed:', err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  
  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error(searchMode === 'email' ? '이메일을 입력해주세요.' : '이름을 입력해주세요.');
      return;
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
      const field = searchMode === 'email' ? 'email' : 'user_name';
      const q = query(collection(db, 'users'), where(field, '==', searchQuery.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('해당 정보로 가입된 유저를 찾을 수 없습니다.');
      } else {
        // If multiple found via name, we just take the first for now as per simple implementation
        setSearchResult({ uid: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err) {
      console.error(err);
      toast.error('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchResult || !serverGroupId) return;
    if (addRoles.length === 0) {
      toast.error('최소 하나 이상의 역할을 선택해주세요.');
      return;
    }
    const exists = memberships.some(m => m.uid === searchResult.uid);
    if (exists) {
      toast.error('이미 이 복사단에 등록된 유저입니다.');
      return;
    }

    try {
      const sgDoc = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId));
      const parishCode = sgDoc.exists() ? sgDoc.data().parish_code : '';

      const membershipId = `${searchResult.uid}_${serverGroupId}`;

    await setDoc(doc(db, COLLECTIONS.MEMBERSHIPS, membershipId), {
      uid: searchResult.uid,
      server_group_id: serverGroupId,
      parish_code: parishCode,
      role: addRoles,
      active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
      toast.success('새 멤버가 성공적으로 추가되었습니다.');
      setIsAddModalOpen(false);
      setSearchQuery('');
      setSearchResult(null);
      setAddRoles([]);
      fetchMemberships();
    } catch (err) {
      console.error('Add member failed:', err);
      toast.error('가입 처리에 실패했습니다.');
    }
  };

  const availableRoles = ['admin', 'planner', 'server'];

  const filteredMemberships = memberships.filter(m => {
    const roleMatch = selectedRole === 'all' || m.role.includes(selectedRole);
    // If hideInactive is true, only show active members
    const statusMatch = hideInactive ? m.active : true;
    return roleMatch && statusMatch;
  });



  return (
    <Container className="py-8 min-h-screen bg-transparent">
      {/* ... header ... */}
       <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="dark:text-gray-200">
          <ArrowLeft size={24} />
        </Button>
        
        <div className="flex-1">
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            멤버십 역할 관리
          </Heading>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            복사단의 멤버별 권한과 정보를 관리합니다.
          </p>
        </div>
        <Button 
            onClick={() => { setIsAddModalOpen(true); setSearchQuery(''); setSearchResult(null); setAddRoles([]); }}
            className="gap-1.5 font-bold font-sans dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
        >
            <Plus size={16} />
            새 멤버 추가
        </Button>
      </div>

      {/* Header with Count & Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">
             멤버 <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({filteredMemberships.length}명)</span>
          </h2>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-gray-50 dark:bg-slate-800 p-1 rounded-lg">
              {[
                { id: 'all', label: '전체' },
                { id: 'admin', label: '어드민' },
                { id: 'planner', label: '플래너' },
                { id: 'server', label: '복사' },
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                    selectedRole === role.id
                      ? "bg-white dark:bg-slate-600 shadow-sm text-gray-900 dark:text-white border border-gray-200 dark:border-slate-500"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-slate-700"
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors whitespace-nowrap">
              <input 
                type="checkbox"
                checked={hideInactive}
                onChange={(e) => setHideInactive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-offset-slate-900"
              />
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">비활성 제외</span>
            </label>
          </div>
      </div>

      {/* Grid View */}
      {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
      ) : filteredMemberships.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
            멤버 정보가 없습니다.
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMemberships.map((m) => (
            <div 
              key={m.id} 
              className={cn(
                "relative bg-white dark:bg-slate-800 rounded-xl border shadow-sm p-5 transition-all",
                editingId === m.id ? "border-blue-500 ring-1 ring-blue-500 shadow-md" : "border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0 pr-8">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 border border-blue-100 dark:border-blue-900/50">
                        <User size={18} />
                      </div>
                      {/* Provider Badge */}
                      {m.provider && (
                        <div 
                          className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-slate-700 rounded-full border border-gray-100 dark:border-slate-600 shadow-sm flex items-center justify-center p-0.5" 
                          title={m.provider === 'google.com' ? 'Google로 로그인' : m.provider === 'password' ? 'ID/Password로 로그인' : ''}
                        >
                            {m.provider === 'google.com' ? (
                              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="google" className="w-3 h-3" />
                            ) : (
                              <Mail size={10} className="text-gray-400 dark:text-gray-300" />
                            )}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {m.user_name}
                        </span>
                        {m.baptismal_name && (
                           <span className="text-gray-500 dark:text-gray-400 text-[10px] bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                             {m.baptismal_name}
                           </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            m.active 
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/40' 
                              : 'bg-gray-900 text-white border-gray-900 dark:bg-gray-700 dark:border-gray-600'
                          }`}>
                            {m.active ? '활성' : '비활성'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                  </div>

                  {/* Edit Button (Absolute Top-Right in View Mode) */}
                  {editingId !== m.id && (
                     <button 
                        className="absolute top-4 right-4 text-gray-300 hover:text-blue-600 transition-colors p-1"
                        onClick={() => handleEdit(m)}
                     >
                       <Edit2 size={16} />
                     </button>
                  )}
              </div>

              {/* Content Section */}
              <div className="space-y-4">
                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-1.5">
                         <Info size={12} />
                         {m.parish_code}
                      </div>
                      <div className="flex items-center gap-1.5">
                         <Calendar size={12} />
                         {m.updated_at ? format(m.updated_at.toDate(), 'yy.MM.dd') : '-'}
                      </div>
                  </div>

                  {/* Roles / Edit Area */}
                  <div>
                    {editingId === m.id ? (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                         {/* Edit Roles */}
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500">역할 설정</label>
                            <div className="flex flex-wrap gap-1.5">
                              {availableRoles.map(r => (
                                <button
                                  key={r}
                                  onClick={() => toggleRole(r)}
                                  className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all border w-full sm:w-auto text-center ${
                                    editRoles.includes(r)
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                      : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사'}
                                </button>
                              ))}
                           </div>
                         </div>
                         
                         {/* Edit Status */}
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-500">계정 상태</label>
                             <button
                               onClick={() => setEditActive(!editActive)}
                               className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-between ${
                                 editActive
                                   ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/40'
                                   : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'
                               }`}
                             >
                               <span>{editActive ? '활성 계정' : '비활성 계정'}</span>
                               <span className={`w-2 h-2 rounded-full ${editActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                             </button>
                         </div>

                         {/* Action Buttons */}
                         <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <Button 
                              size="sm" 
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9 text-xs"
                              onClick={() => handleUpdate(m.id)}
                            >
                              <Check size={14} className="mr-1" /> 저장
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 h-9 text-xs border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
                              onClick={() => setEditingId(null)}
                            >
                              <X size={14} className="mr-1" /> 취소
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-9 w-9 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100"
                              onClick={() => handleDelete(m.id, m.user_name || '사용자')}
                            >
                              <Trash2 size={16} />
                            </Button>
                         </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                          {m.role.map(r => (
                            <span 
                              key={r} 
                              className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
                                r === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40' :
                                r === 'planner' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40' :
                                'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40'
                              }`}
                            >
                              {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사'}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      
      <InfoBox title="역할 부여 안내" className="mt-8">
        한 멤버에게 여러 역할을 동시에 부여할 수 있습니다. 
        변경 사항은 저장 즉시 반영되며 다음 로그인부터 해당 권한이 활성화됩니다.
        어드민은 모든 설정을 변경할 수 있으며, 플래너는 일정 관리 권한을 가집니다.
      </InfoBox>

      {/* 새 멤버 추가 모달 */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 font-sans border-0 shadow-2xl rounded-l-[32px] rounded-br-[32px] overflow-hidden bg-white dark:bg-slate-900 outline-none [&>button]:text-white [&>button]:opacity-100 [&>button:hover]:bg-white/10 [&&>button]:hidden">
          <DrawerHeader 
            title="새 멤버 추가하기" 
            subtitle="기존 가입 검색을 통해"
            onClose={() => setIsAddModalOpen(false)}
          >
            <div className="space-y-0 text-left pt-2 pb-1 text-white">
              <p className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5 mt-2">
                기존 가입 검색을 통해
              </p>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight font-gamja flex items-center gap-1.5 justify-start p-0 m-0">
                <User size={20} className="text-white opacity-80" />
                새 멤버 추가하기
              </DialogTitle>
            </div>
          </DrawerHeader>
          <div className="p-6 pt-6 space-y-6">
            <div className="space-y-4">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                    <button 
                        onClick={() => { setSearchMode('email'); setSearchResult(null); }}
                        className={cn(
                            "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            searchMode === 'email' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700"
                        )}
                    >이메일 검색</button>
                    <button 
                        onClick={() => { setSearchMode('name'); setSearchResult(null); }}
                        className={cn(
                            "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                            searchMode === 'name' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700"
                        )}
                    >이름 검색</button>
                </div>

                <form onSubmit={handleSearchUser} className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {searchMode === 'email' ? '유저 검색 (이메일)' : '유저 검색 (이름)'}
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input 
                                type={searchMode === 'email' ? "email" : "text"}
                                placeholder={searchMode === 'email' ? "user@example.com" : "이름 입력"} 
                                className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 disabled:opacity-50 h-11 pl-9 w-full transition-shadow dark:text-white rounded-xl font-sans"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button type="submit" variant="secondary" disabled={isSearching} className="h-11 px-4 font-bold shrink-0">
                            {isSearching ? '검색중...' : '검색'}
                        </Button>
                    </div>
                </form>
            </div>

            {searchResult && (
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex justify-center items-center text-blue-600 dark:bg-blue-900/30 shrink-0">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{searchResult.user_name} {searchResult.baptismal_name && <span className="text-xs text-gray-500 font-normal">({searchResult.baptismal_name})</span>}</p>
                            <p className="text-xs text-gray-500">{searchResult.email}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-400">부여할 역할 (다중선택 가능)</label>
                        <div className="flex flex-wrap gap-1.5">
                            {['admin', 'planner', 'server'].map(r => (
                                <button
                                    type="button"
                                    key={r}
                                    onClick={() => setAddRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                        addRoles.includes(r)
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사(Server)'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-gray-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                <Button 
                    variant="primary" 
                    type="button"
                    onClick={handleAddMember} 
                    disabled={!searchResult}
                    className="font-bold gap-1.5"
                >
                    <Plus size={16} /> 추가하기
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </Container>
  );
};

export default MemberRoleManagement;
