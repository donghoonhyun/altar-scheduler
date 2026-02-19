import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  limit, 
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Shield, Edit2, Trash2, Plus, Search, AlertCircle, X, ChevronRight, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { COLLECTIONS } from '@/lib/collections';

interface Membership {
  id: string; // document id
  server_group_id: string;
  role: string | string[];
  active: boolean;
  server_group_name?: string; // fetched
  parish_name?: string; // fetched
}

interface ServerGroup {
  id: string;
  name: string;
  parish_code?: string;
}

interface Parish {
  code: string;
  name_kor: string;
  diocese: string;
}

interface UserMembershipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  userName: string;
}

export default function UserMembershipsDialog({ open, onOpenChange, uid, userName }: UserMembershipsDialogProps) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  // Add Mode State
  const [isAdding, setIsAdding] = useState(false);
  const [addStep, setAddStep] = useState<'parish' | 'group' | 'role'>('parish');
  
  // Step 1: Parish
  const [parishSearchTerm, setParishSearchTerm] = useState('');
  const [foundParishes, setFoundParishes] = useState<Parish[]>([]);
  const [selectedParish, setSelectedParish] = useState<Parish | null>(null);
  const [isSearchingParish, setIsSearchingParish] = useState(false);

  // Step 2: Group
  const [foundGroups, setFoundGroups] = useState<ServerGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ServerGroup | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Step 3: Role
  const [newRoles, setNewRoles] = useState<string[]>([]);

  useEffect(() => {
    if (open && uid) {
      fetchMemberships();
      cancelAdd(); 
    }
  }, [open, uid]);

  const fetchMemberships = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTIONS.MEMBERSHIPS), where('uid', '==', uid));
      const snap = await getDocs(q);
      
      const list: Membership[] = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as any));

      const enrichedList = await Promise.all(list.map(async (m) => {
        if (!m.server_group_id) return m;
        if (m.server_group_id === 'global') return { ...m, server_group_name: 'Global System' };
        
        try {
            const sgSnap = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, m.server_group_id));
            if (sgSnap.exists()) {
                const sgData = sgSnap.data() as ServerGroup;
                let parishName = '';
                
                // Fetch Parish Name if available
                if (sgData.parish_code) {
                    try {
                        const parishQ = query(collection(db, 'parishes'), where('code', '==', sgData.parish_code));
                        const parishSnap = await getDocs(parishQ);
                        if (!parishSnap.empty) {
                            parishName = parishSnap.docs[0].data().name_kor;
                        } else {
                            // Fallback: Check if document ID matches
                            const pDoc = await getDoc(doc(db, 'parishes', sgData.parish_code));
                            if (pDoc.exists()) parishName = pDoc.data().name_kor;
                        }
                    } catch (err) {
                        console.error("Error fetching parish", err);
                    }
                }
                
                return { 
                    ...m, 
                    server_group_name: sgData.name,
                    parish_name: parishName
                };
            }
        } catch (e) {
            console.error("Failed to fetch SG name", e);
        }
        return m;
      }));

      // Sort by parish name then group name
      enrichedList.sort((a, b) => {
          const pA = a.parish_name || '';
          const pB = b.parish_name || '';
          if (pA !== pB) return pA.localeCompare(pB);
          return (a.server_group_name || '').localeCompare(b.server_group_name || '');
      });

      setMemberships(enrichedList);
    } catch (e) {
      console.error(e);
      toast.error('멤버십 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (m: Membership) => {
    setEditTargetId(m.id);
    setEditRoles(Array.isArray(m.role) ? [...m.role] : [m.role]);
    setEditActive(m.active);
    cancelAdd(); 
  };

  const cancelEdit = () => {
    setEditTargetId(null);
    setEditRoles([]);
  };

  const toggleEditRole = (role: string) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const saveEdit = async () => {
    if (!editTargetId) return;
    try {
        if (editRoles.length === 0 && editActive) {
            toast.error('Active 상태에서는 최소 하나의 역할이 필요합니다.');
            return;
        }

        await updateDoc(doc(db, COLLECTIONS.MEMBERSHIPS, editTargetId), {
            role: editRoles,
            active: editActive,
            updated_at: serverTimestamp()
        });

        setMemberships(prev => prev.map(m => 
            m.id === editTargetId 
                ? { ...m, role: editRoles, active: editActive } 
                : m
        ));
        
        toast.success('멤버십이 수정되었습니다.');
        cancelEdit();
    } catch (e) {
        console.error(e);
        toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const deleteMembership = async (m: Membership) => {
    if (!confirm(`${m.parish_name ? m.parish_name + ' ' : ''}${m.server_group_name} 멤버십을 정말 삭제하시겠습니까?`)) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.MEMBERSHIPS, m.id));
        setMemberships(prev => prev.filter(item => item.id !== m.id));
        toast.success('삭제되었습니다.');
    } catch (e) {
        console.error(e);
        toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // --- Add Logic ---

  const cancelAdd = () => {
    setIsAdding(false);
    setAddStep('parish');
    
    setParishSearchTerm('');
    setFoundParishes([]);
    setSelectedParish(null);

    setFoundGroups([]);
    setSelectedGroup(null);
    
    setNewRoles([]);
  };

  const searchParishes = async () => {
    if (!parishSearchTerm.trim()) return;
    setIsSearchingParish(true);
    try {
        const q = query(
            collection(db, 'parishes'),
            where('name_kor', '>=', parishSearchTerm),
            where('name_kor', '<=', parishSearchTerm + '\uf8ff'),
            limit(10)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ code: d.id, ...d.data() } as Parish));
        setFoundParishes(list);
    } catch (e) {
        console.error(e);
        toast.error('성당 검색 실패');
    } finally {
        setIsSearchingParish(false);
    }
  };

  const confirmParish = async (parish: Parish) => {
    setSelectedParish(parish);
    // Fetch server groups for this parish immediately
    setIsLoadingGroups(true);
    try {
        const q = query(collection(db, COLLECTIONS.SERVER_GROUPS), where('parish_code', '==', parish.code));
        const snap = await getDocs(q);
        const groups = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServerGroup));
        setFoundGroups(groups);
        setAddStep('group');
    } catch (e) {
        console.error(e);
        toast.error('복사단 목록 조회 실패');
        setSelectedParish(null); // revert
    } finally {
        setIsLoadingGroups(false);
    }
  };

  const confirmGroup = (group: ServerGroup) => {
      setSelectedGroup(group);
      setAddStep('role');
  };

  const toggleNewRole = (role: string) => {
    setNewRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const saveNewMembership = async () => {
    if (!selectedGroup) return;
    if (newRoles.length === 0) {
        toast.error('최소 하나의 역할을 선택해주세요.');
        return;
    }
    
    if (memberships.some(m => m.server_group_id === selectedGroup.id)) {
        toast.error('이미 해당 복사단에 멤버십이 존재합니다.');
        return;
    }

    try {
        const newDocRef = await addDoc(collection(db, COLLECTIONS.MEMBERSHIPS), {
            uid,
            server_group_id: selectedGroup.id,
            role: newRoles,
            active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });

        const newMembership: Membership = {
            id: newDocRef.id,
            server_group_id: selectedGroup.id,
            role: newRoles,
            active: true,
            server_group_name: selectedGroup.name,
            parish_name: selectedParish?.name_kor
        };

        setMemberships(prev => [newMembership, ...prev]);
        toast.success('멤버십이 추가되었습니다.');
        cancelAdd();
    } catch (e) {
        console.error(e);
        toast.error('멤버십 추가 실패');
    }
  };

  const AVAILABLE_ROLES = ['admin', 'planner', 'server'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {userName}님의 멤버십 정보
          </DialogTitle>
          <div 
            className="text-xs text-gray-400 font-mono mt-1 cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1 w-fit"
            onClick={() => {
                navigator.clipboard.writeText(uid);
                toast.success('UID가 복사되었습니다.');
            }}
            title="클릭하여 UID 복사"
          >
            UID: {uid}
          </div>
        </DialogHeader>

        {/* Add Button */}
        {!isAdding && !loading && (
            <div className="flex justify-end mb-2">
                <Button size="sm" onClick={() => setIsAdding(true)} variant="outline" className="text-xs h-8 border-dashed border-gray-300 hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:text-gray-300 dark:bg-slate-800">
                    <Plus size={14} className="mr-1" />
                    멤버십 추가
                </Button>
            </div>
        )}

        {/* Add Form (Stepper) */}
        {isAdding && (
            <div className="mb-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg space-y-3 relative overflow-hidden transition-all">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                        <Plus size={14} /> 
                        {addStep === 'parish' ? '성당 선택' : addStep === 'group' ? '복사단 선택' : '역할 할당'}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelAdd}>
                        <X size={14} />
                    </Button>
                </div>
                
                {/* Step Content */}
                <div className="min-h-[160px]">
                    {addStep === 'parish' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="성당 이름 검색... (예: 대구 범어)" 
                                    value={parishSearchTerm}
                                    onChange={e => setParishSearchTerm(e.target.value)}
                                    className="h-9 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    onKeyDown={e => e.key === 'Enter' && searchParishes()}
                                />
                                <Button size="sm" onClick={searchParishes} disabled={isSearchingParish || !parishSearchTerm.trim()} className="h-9">
                                    {isSearchingParish ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                </Button>
                            </div>
                            
                            {foundParishes.length > 0 && (
                                <div className="max-h-[120px] overflow-y-auto border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800">
                                    {foundParishes.map(p => (
                                        <div 
                                            key={p.code} 
                                            className="p-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-100 dark:border-slate-800 last:border-0 dark:text-gray-200 flex justify-between items-center group"
                                            onClick={() => confirmParish(p)}
                                        >
                                            <div>
                                                <div className="font-medium">{p.name_kor}</div>
                                                <div className="text-xs text-gray-400">{p.diocese} | {p.code}</div>
                                            </div>
                                            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {foundParishes.length === 0 && parishSearchTerm && !isSearchingParish && (
                                <div className="text-xs text-gray-400 text-center py-4">검색 결과가 없습니다</div>
                            )}
                        </div>
                    )}

                    {addStep === 'group' && selectedParish && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-2 border-b border-blue-100 dark:border-blue-900/30">
                                <Button size="icon" variant="ghost" className="h-6 w-6 -ml-2" onClick={() => setAddStep('parish')}>
                                    <ArrowLeft size={14} />
                                </Button>
                                <span className="font-bold">{selectedParish.name_kor}</span>
                                <span className="text-xs text-gray-400">선택됨</span>
                            </div>

                            {isLoadingGroups ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-gray-400" />
                                </div>
                            ) : foundGroups.length > 0 ? (
                                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                                     {foundGroups.map(g => (
                                        <div 
                                            key={g.id} 
                                            className="p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 cursor-pointer transition-colors"
                                            onClick={() => confirmGroup(g)}
                                        >
                                            <div className="text-sm font-medium dark:text-gray-100">{g.name}</div>
                                            <div className="text-xs text-gray-400">{g.id}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    등록된 복사단이 없습니다.
                                </div>
                            )}
                        </div>
                    )}

                    {addStep === 'role' && selectedGroup && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                             <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-2 border-b border-blue-100 dark:border-blue-900/30">
                                <Button size="icon" variant="ghost" className="h-6 w-6 -ml-2" onClick={() => setAddStep('group')}>
                                    <ArrowLeft size={14} />
                                </Button>
                                <div className="flex flex-col">
                                    <span className="font-bold">{selectedGroup.name}</span>
                                    <span className="text-[10px] text-gray-400">{selectedParish?.name_kor}</span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">부여할 역할 (다중 선택 가능)</label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_ROLES.map(role => (
                                        <button 
                                            key={role}
                                            onClick={() => toggleNewRole(role)}
                                            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                                                newRoles.includes(role) 
                                                    ? 'bg-blue-500 text-white border-blue-600 shadow-sm' 
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button className="w-full mt-4" onClick={saveNewMembership} disabled={newRoles.length === 0}>
                                저장 완료
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {loading ? (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" />
            </div>
        ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 pb-2">
                {memberships.length === 0 && !isAdding ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        멤버십 정보가 없습니다.
                    </div>
                ) : (
                    memberships.map((m) => (
                        <div key={m.id} className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm space-y-2 relative group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Building2 size={12} className="text-gray-400" />
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            {m.parish_name || 'System / Unlinked'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1 pl-4.5">
                                        {m.server_group_id === 'global' ? 'Global Admin' : (m.server_group_name || '알 수 없는 복사단')}
                                        {memberships.filter(chk => chk.server_group_id === m.server_group_id && chk.id !== m.id).length > 0 && 
                                            <span title="중복된 그룹 멤버십이 존재합니다.">
                                                <AlertCircle size={12} className="text-orange-500" />
                                            </span>
                                        }
                                    </h4>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block pl-4.5">
                                        Group ID: {m.server_group_id}
                                    </span>
                                </div>
                                {editTargetId !== m.id ? (
                                     <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-1 rounded font-medium ${m.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {m.active ? 'Active' : 'Inactive'}
                                        </span>
                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                            <button 
                                                onClick={() => startEdit(m)}
                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                title="수정"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => deleteMembership(m)}
                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                title="삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                     </div>
                                ) : (
                                    <span className="text-[10px] text-blue-500 font-bold animate-pulse">
                                        수정 중...
                                    </span>
                                )}
                            </div>
                            
                            {editTargetId === m.id ? (
                                <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded border border-gray-200 dark:border-slate-700 ml-4">
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">역할 수정</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {AVAILABLE_ROLES.map(role => (
                                            <button 
                                                key={role}
                                                onClick={() => toggleEditRole(role)}
                                                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                                    editRoles.includes(role) 
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-2">
                                        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={editActive} 
                                                onChange={(e) => setEditActive(e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                                            />
                                            Active 상태
                                        </label>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 px-2 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 text-xs">
                                                취소
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-7 px-2 hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold">
                                                저장
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-1 items-center pl-4.5">
                                    {(Array.isArray(m.role) ? m.role : [m.role])
                                      .sort((a, b) => {
                                          const priority: Record<string, number> = {
                                              'superadmin': 1,
                                              'admin': 2,
                                              'planner': 3,
                                              'server': 4
                                          };
                                          return (priority[a] || 99) - (priority[b] || 99);
                                      })
                                      .map((r, idx) => {
                                        let badgeStyle = "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";
                                        if (r === 'superadmin') badgeStyle = "bg-black text-white border-black dark:bg-slate-950 dark:border-slate-900";
                                        else if (r === 'admin') badgeStyle = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50";
                                        else if (r === 'planner') badgeStyle = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50";
                                        else if (r === 'server') badgeStyle = "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50";

                                        return (
                                            <span key={idx} className={`px-2 py-0.5 border rounded text-xs font-medium ${badgeStyle}`}>
                                                {r}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800 mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700">
                닫기
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
