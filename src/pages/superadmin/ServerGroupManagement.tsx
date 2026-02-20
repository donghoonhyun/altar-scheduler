// src/pages/superadmin/ServerGroupManagement.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  runTransaction,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { useParishes } from '@/hooks/useParishes';
import { useDioceses } from '@/hooks/useDioceses';
import { Container, Heading, Button, Input } from '@/components/ui';
import { ArrowLeft, Search, Plus, Edit2, Trash2, Check, X, Shield, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from '@/state/session';
import PremiumHeader from '@/components/common/PremiumHeader';

interface ServerGroupData {
  id: string; // Document ID (e.g. SG00001)
  parish_code: string;
  name: string;
  active: boolean;
  timezone?: string;
  created_at?: any;
  updated_at?: any;
}

export default function ServerGroupManagement() {
  const navigate = useNavigate();
  const session = useSession();
  
  const [serverGroups, setServerGroups] = useState<ServerGroupData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // List Filters
  const [filterDiocese, setFilterDiocese] = useState<string>('all');
  const [filterParishCode, setFilterParishCode] = useState<string>('all');
  
  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDiocese, setNewGroupDiocese] = useState('');
  const [newGroupParishCode, setNewGroupParishCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServerGroupData>>({});

  const { data: parishes } = useParishes(); // To resolve parish_code to Name and select in dropdown
  const { data: diocesesData } = useDioceses();

  useEffect(() => {
    fetchServerGroups();
  }, []);

  const fetchServerGroups = async () => {
    setLoading(true);
    try {
      // 복합 쿼리 인덱스 에러 방지: 
      // 생성일(created_at) 기준으로 전체를 불러온 뒤에 
      // React 측에서 'filteredGroups' 를 통해 교구/성당/텍스트 필터링을 즉시 적용합니다.
      const q = query(
        collection(db, COLLECTIONS.SERVER_GROUPS),
        orderBy('created_at', 'desc')
      );
      
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServerGroupData));
      setServerGroups(list);
    } catch (e) {
      console.error(e);
      toast.error('복사단 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupParishCode) {
      toast.error('성당과 복사단 이름을 모두 입력해주세요.');
      return;
    }

    try {
      setIsCreating(true);
      
      // Use the raw path for the counter document rather than combining two full paths
      const counterRef = doc(db, 'app_altar/v1/counters/server_groups');
      
      const newSgId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        if (counterDoc.exists()) {
          nextSeq = (Number(counterDoc.data()?.last_seq) || 0) + 1;
        }
        transaction.set(counterRef, { last_seq: nextSeq }, { merge: true });

        const sgId = `SG${nextSeq.toString().padStart(5, '0')}`;
        const sgRef = doc(db, COLLECTIONS.SERVER_GROUPS, sgId);

        transaction.set(sgRef, {
          parish_code: newGroupParishCode,
          name: newGroupName.trim(),
          active: true,
          timezone: 'Asia/Seoul',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // 슈퍼어드민을 해당 복사단의 admin/planner로 추가해둘지 선택할 수 있지만 일단 생략
        // (필요 시 SuperAdminMain에서 접근 권한 부여 로직을 추가하거나 DB에서 직접 수정)

        return sgId;
      });

      toast.success(`복사단(${newGroupName})이 생성되었습니다.`);
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupParishCode('');
      fetchServerGroups();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '복사단 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (sg: ServerGroupData) => {
    setEditingId(sg.id);
    setEditForm(sg);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
        await updateDoc(doc(db, COLLECTIONS.SERVER_GROUPS, editingId), {
            name: editForm.name,
            parish_code: editForm.parish_code,
            active: editForm.active,
            updated_at: serverTimestamp() 
        });
        
        setServerGroups(serverGroups.map(sg => sg.id === editingId ? { ...sg, ...editForm } : sg));
        toast.success('수정되었습니다.');
        cancelEdit();
    } catch (e) {
        console.error(e);
        toast.error('수정 실패');
    }
  };

  const deleteServerGroup = async (id: string, name: string) => {
    if (!confirm(`'${name}' 복사단을 정말 삭제하시겠습니까? (하위 데이터가 있을 수 있습니다)`)) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.SERVER_GROUPS, id));
        setServerGroups(serverGroups.filter(sg => sg.id !== id));
        toast.success('삭제되었습니다.');
    } catch (e) {
        console.error(e);
        toast.error('삭제 실패');
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
      try {
          await updateDoc(doc(db, COLLECTIONS.SERVER_GROUPS, id), {
              active: !currentActive,
              updated_at: serverTimestamp(),
          });
          setServerGroups(serverGroups.map(sg => sg.id === id ? { ...sg, active: !currentActive } : sg));
          toast.success(currentActive ? '비활성화 처리되었습니다.' : '활성화 처리되었습니다.');
      } catch (e) {
          console.error(e);
          toast.error('상태 변경 실패');
      }
  };

  // Search and Filter logic
  const filteredGroups = serverGroups.filter(sg => {
      // 1. Filter by Diocese
      if (filterDiocese !== 'all') {
          const parish = parishes?.find(p => p.code === sg.parish_code);
          if (!parish || parish.diocese !== filterDiocese) return false;
      }
      
      // 2. Filter by Parish
      if (filterParishCode !== 'all' && sg.parish_code !== filterParishCode) {
          return false;
      }

      // 3. Text Search
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const parishName = parishes?.find(p => p.code === sg.parish_code)?.name_kor || '';
          if (!sg.name.toLowerCase().includes(term) && 
              !sg.id.toLowerCase().includes(term) &&
              !parishName.toLowerCase().includes(term)) {
              return false;
          }
      }
      
      return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* 🔹 표준 페이지 헤더 */}
      <PremiumHeader 
        title="성당/복사단 관리"
        subtitle="마스터 데이터를 관리하는"
        icon={<Shield size={20} />}
        backUrl="/superadmin"
      />
      <Container className="pt-3 pb-6 min-h-screen bg-transparent">

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden p-0 mb-10">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-slate-800/50">
            <div className="flex flex-row items-center gap-2 overflow-x-auto shrink p-1 w-full min-w-0 pr-4">
                <Select value={filterDiocese} onValueChange={(val) => { setFilterDiocese(val); setFilterParishCode('all'); }}>
                    <SelectTrigger className="h-9 w-[140px] shrink-0 bg-white dark:bg-slate-800 dark:border-slate-700 font-sans">
                        <SelectValue placeholder="모든 교구" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">모든 교구</SelectItem>
                        {(diocesesData || []).map(diocese => (
                            <SelectItem key={diocese.code} value={diocese.code}>{diocese.name_kor}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterParishCode} onValueChange={setFilterParishCode} disabled={filterDiocese === 'all'}>
                    <SelectTrigger className="h-9 w-[160px] shrink-0 bg-white dark:bg-slate-800 dark:border-slate-700 font-sans">
                        <SelectValue placeholder={filterDiocese === 'all' ? "교구 선택 필요" : "모든 성당"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        <SelectItem value="all">모든 성당</SelectItem>
                        {parishes?.filter(p => p.diocese === filterDiocese).map(p => (
                            <SelectItem key={p.code} value={p.code}>{p.name_kor}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button 
                    variant="secondary"
                    onClick={fetchServerGroups}
                    disabled={loading}
                    className="h-9 w-9 shrink-0 p-0 font-bold font-sans dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl"
                    title="조회"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </Button>

                <div className="relative shrink-0 w-[140px] sm:w-[180px] ml-0 sm:ml-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        placeholder="이름, 성당 검색" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-9 w-full pl-9 pr-8 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-sans bg-white"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
            
            <Button 
                onClick={() => setIsCreateModalOpen(true)}
                className="font-bold font-sans shrink-0 h-9 w-9 p-0 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 text-white"
                title="새 복사단 생성"
            >
                <Plus size={20} />
            </Button>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                            성당
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[150px]">
                            복사단 (ID)
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                            상태
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[160px]">
                            생성일시
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                            관리
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-sans">
                    {filteredGroups.length === 0 && !loading && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                    {filteredGroups.map(sg => {
                        const parishName = parishes?.find(p => p.code === sg.parish_code)?.name_kor || sg.parish_code;
                        return (
                        <tr key={sg.id} className={
                            editingId === sg.id 
                                ? "bg-blue-50 dark:bg-slate-800" 
                                : "hover:bg-gray-50/50 dark:hover:bg-slate-800/50"
                        }>
                            {editingId === sg.id ? (
                                <>
                                    <td className="px-5 py-4">
                                        <Select 
                                            value={editForm.parish_code || ''}
                                            onValueChange={(v) => setEditForm({...editForm, parish_code: v})}
                                        >
                                            <SelectTrigger className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 bg-white border-gray-200">
                                                <SelectValue placeholder="성당 선택" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                {parishes?.map(p => (
                                                    <SelectItem key={p.code} value={p.code}>{p.name_kor}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-5 py-4">
                                        <Input 
                                            value={editForm.name || ''} 
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            placeholder="복사단 이름"
                                            className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white"
                                        />
                                    </td>
                                    <td className="px-5 py-4">
                                        <select 
                                            className="border rounded text-sm p-1 min-w-[100px] h-8 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                            value={editForm.active ? 'true' : 'false'}
                                            onChange={e => setEditForm({...editForm, active: e.target.value === 'true'})}
                                        >
                                            <option value="true">활성</option>
                                            <option value="false">비활성</option>
                                        </select>
                                    </td>
                                    <td className="px-5 py-4 text-xs text-gray-500">
                                        -
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="icon" variant="primary" onClick={saveEdit} className="h-8 w-8">
                                                <Check size={16} />
                                            </Button>
                                            <Button size="icon" variant="destructive" onClick={() => deleteServerGroup(sg.id, sg.name)} className="h-8 w-8">
                                                <Trash2 size={16} />
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={cancelEdit} className="h-8 w-8 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700">
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-5 py-3">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {parishName}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                            {sg.name}
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono mt-0.5">
                                            {sg.id}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <button 
                                            onClick={() => toggleActive(sg.id, sg.active)}
                                            className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${
                                                sg.active 
                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50' 
                                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'
                                            }`}
                                        >
                                            {sg.active ? '활성화됨' : '비활성'}
                                        </button>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {sg.created_at?.toDate ? sg.created_at.toDate().toLocaleString() : String(new Date(sg.created_at))}
                                    </td>
                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Button 
                                                size="icon"
                                                variant="outline"
                                                onClick={() => navigate(`/server-groups/${sg.id}/admin/members`)}
                                                className="h-8 w-8 text-blue-600 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-900/30 hover:bg-blue-50 transition-colors"
                                                title="멤버 권한 관리 (어드민/플래너/복사)"
                                            >
                                                <Users size={16} />
                                            </Button>
                                            <Button 
                                                size="icon"
                                                variant="outline"
                                                onClick={() => startEdit(sg)}
                                                className="h-8 w-8 text-gray-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                                title="복사단 정보 수정"
                                            >
                                                <Edit2 size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      </div>

      {/* 새 복사단 생성 다이얼로그 */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden font-sans border-0 shadow-2xl">
            <div className="relative h-20 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] rounded-b-[32px] shadow-lg overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                <div className="absolute top-4 left-6 right-6">
                    <div className="space-y-0 text-left">
                        <p className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5">
                            새로운 관리를 위해
                        </p>
                        <h1 className="text-2xl font-bold text-white tracking-tight font-gamja flex items-center gap-1.5">
                            <Shield size={20} className="text-white opacity-80" />
                            새 복사단 생성
                        </h1>
                    </div>
                </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 p-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">소속 교구</label>
                    <Select value={newGroupDiocese} onValueChange={(val) => { setNewGroupDiocese(val); setNewGroupParishCode(''); }}>
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="교구를 먼저 선택하세요" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {(diocesesData || []).map((diocese) => (
                                <SelectItem key={diocese.code} value={diocese.code}>
                                    {diocese.name_kor}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">소속 성당</label>
                    <Select disabled={!newGroupDiocese} value={newGroupParishCode} onValueChange={setNewGroupParishCode}>
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder={!newGroupDiocese ? "교구를 먼저 선택하세요" : "성당을 선택하세요"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {parishes?.filter(p => !newGroupDiocese || p.diocese === newGroupDiocese).map((p) => (
                                <SelectItem key={p.code} value={p.code}>
                                    {p.name_kor}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">복사단 이름</label>
                    <Input 
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="예: 제1복사단"
                        className="h-11 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700"
                    />
                </div>

                <div className="flex justify-end gap-2 mt-8 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                        취소
                    </Button>
                    <Button type="submit" variant="primary" disabled={isCreating} className="font-bold">
                        {isCreating ? '생성 중...' : '생성'}
                    </Button>
                </div>
            </form>
        </DialogContent>
      </Dialog>
    </Container>
    </div>
  );
}
