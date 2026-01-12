// src/pages/superadmin/UserManagement.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  where,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { Container, Heading, Button, Input } from '@/components/ui';
import { ArrowLeft, Search, Edit2, Trash2, Check, X, ChevronDown, Heart, Shield, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import UserSupportDrawer from './UserSupportDrawer';
import UserMembershipsDialog from './UserMembershipsDialog';

interface UserData {
  uid: string;
  email: string;
  user_name: string;
  baptismal_name: string;
  phone: string;
  user_category?: string;
  updated_at?: any;
  created_at?: any;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const session = useSession();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserData>>({});
  const [supportTarget, setSupportTarget] = useState<UserData | null>(null);
  const [membershipTarget, setMembershipTarget] = useState<UserData | null>(null);

  const PAGE_SIZE = 20;

  // Initial Load
  useEffect(() => {
    fetchUsers(true);
  }, []);

  const fetchUsers = async (isInitial = false, search = '') => {
    setLoading(true);
    try {
      let q;

      if (search) {
        q = query(
          collection(db, 'users'),
          where('user_name', '>=', search),
          where('user_name', '<=', search + '\uf8ff'),
          limit(PAGE_SIZE)
        );
      } else {
        if (isInitial || !lastDoc) {
          q = query(
            collection(db, 'users'),
            orderBy('updated_at', 'desc'),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            collection(db, 'users'),
            orderBy('updated_at', 'desc'),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
          );
        }
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserData));

      if (isInitial || search) {
        setUsers(list);
      } else {
        setUsers(prev => [...prev, ...list]);
      }

      if (!search) {
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false); 
      }
    } catch (e) {
      console.error(e);
      toast.error('유저 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLastDoc(null);
    fetchUsers(true, searchTerm);
  };

  const handleExcelDownload = async () => {
    try {
      toast.info('엑셀 다운로드를 준비 중입니다...');
      let q;
      
      // 검색 조건이 있으면 해당 조건으로 전체 조회, 없으면 전체 조회 (limit 없음)
      if (searchTerm) {
        q = query(
          collection(db, 'users'),
          where('user_name', '>=', searchTerm),
          where('user_name', '<=', searchTerm + '\uf8ff')
        );
      } else {
        q = query(
          collection(db, 'users'),
          orderBy('updated_at', 'desc')
        );
      }

      const snap = await getDocs(q);
      const allUsers = snap.docs.map(doc => {
        const data = doc.data() as UserData;
        return {
          'UID': doc.id,
          '이름': data.user_name,
          '세례명': data.baptismal_name,
          '이메일': data.email,
          '전화번호': data.phone || '',
          '구분': data.user_category === 'Father' ? '신부님' : 
                   data.user_category === 'Sister' ? '수녀님' : '평신도',
          '생성일': data.created_at?.toDate ? data.created_at.toDate().toLocaleString() : '',
          '수정일': data.updated_at?.toDate ? data.updated_at.toDate().toLocaleString() : '',
        };
      });

      if (allUsers.length === 0) {
        toast.warning('다운로드할 데이터가 없습니다.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(allUsers);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
      
      const fileName = `Users_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast.success('엑셀 다운로드 완료');
    } catch (e) {
      console.error(e);
      toast.error('엑셀 다운로드 실패');
    }
  };

  const startEdit = (user: UserData) => {
    setEditingId(user.uid);
    setEditForm(user);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
        await updateDoc(doc(db, 'users', editingId), {
            ...editForm,
            updated_at: serverTimestamp() 
        });
        
        setUsers(users.map(u => u.uid === editingId ? { ...u, ...editForm } : u));
        toast.success('수정되었습니다.');
        cancelEdit();
    } catch (e) {
        console.error(e);
        toast.error('수정 실패');
    }
  };

  const deleteUser = async (uid: string, name: string) => {
    if (!confirm(`'${name}' 사용자를 정말 삭제하시겠습니까? (복구 불가)`)) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
        setUsers(users.filter(u => u.uid !== uid));
        toast.success('삭제되었습니다.');
    } catch (e) {
        console.error(e);
        toast.error('삭제 실패');
    }
  };

  return (
    <Container className="py-8 min-h-screen bg-transparent">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin')} className="dark:text-gray-200">
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            유저 관리
          </Heading>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            전체 사용자 목록을 조회하고 관리합니다.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/50">
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                <Input 
                    placeholder="이름으로 검색..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 min-w-[200px] dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <Button type="submit" size="sm" variant="outline" className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700">
                    <Search size={16} />
                </Button>
            </form>
            <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={handleExcelDownload} className="hidden sm:flex dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700" title="엑셀로 저장">
                    <Download size={16} className="mr-2" />
                    엑셀
                </Button>
                <Button variant="outline" size="icon" onClick={handleExcelDownload} className="sm:hidden dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-700" title="엑셀로 저장">
                    <Download size={16} />
                </Button>
            </div>
        </div>

        {/* List */}
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">이름 / 세례명</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">이메일 / 전화번호</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">구분</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">관리</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {users.length === 0 && !loading && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                    {users.map(user => (
                        <tr key={user.uid} className={
                            editingId === user.uid 
                                ? "bg-blue-50 dark:bg-slate-800" 
                                : "hover:bg-gray-50/50 dark:hover:bg-slate-800/50"
                        }>
                            {editingId === user.uid ? (
                                <>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <Input 
                                                value={editForm.user_name || ''} 
                                                onChange={e => setEditForm({...editForm, user_name: e.target.value})}
                                                placeholder="이름"
                                                className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                            <Input 
                                                value={editForm.baptismal_name || ''} 
                                                onChange={e => setEditForm({...editForm, baptismal_name: e.target.value})}
                                                placeholder="세례명"
                                                className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                            <Input 
                                                value={editForm.phone || ''} 
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                                placeholder="전화번호"
                                                className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                         <select 
                                            className="border rounded text-sm p-1 w-full bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                            value={editForm.user_category || 'Layman'}
                                            onChange={e => setEditForm({...editForm, user_category: e.target.value})}
                                        >
                                            <option value="Layman">평신도</option>
                                            <option value="Father">신부님</option>
                                            <option value="Sister">수녀님</option>
                                         </select>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="icon" variant="primary" onClick={saveEdit} className="h-8 w-8">
                                                <Check size={16} />
                                            </Button>
                                            <Button size="icon" variant="destructive" onClick={() => deleteUser(user.uid, user.user_name)} className="h-8 w-8">
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
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{user.user_name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.baptismal_name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 dark:text-gray-200">{user.email}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.phone}</div>
                                        {user.updated_at && (
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                                {user.updated_at?.toDate ? user.updated_at.toDate().toLocaleString() : String(new Date(user.updated_at))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                            user.user_category === 'Father' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50' :
                                            user.user_category === 'Sister' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50' :
                                            'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50'
                                        }`}>
                                            {user.user_category === 'Father' ? '신부님' : 
                                             user.user_category === 'Sister' ? '수녀님' : '평신도'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button 
                                                size="sm"
                                                variant="edit"
                                                onClick={() => startEdit(user)}
                                                className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                            >
                                                수정
                                            </Button>
                                            <Button 
                                                size="sm"
                                                className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200 ml-2 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50 dark:hover:bg-purple-900/30"
                                                variant="outline"
                                                onClick={() => setMembershipTarget(user)}
                                            >
                                                <Shield size={14} className="mr-1" />
                                                멤버십
                                            </Button>
                                            <Button 
                                                size="sm"
                                                className="bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-200 ml-2 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-900/50 dark:hover:bg-pink-900/30"
                                                variant="outline"
                                                onClick={() => setSupportTarget(user)}
                                            >
                                                <Heart size={14} className="mr-1" />
                                                지원
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden bg-gray-50 dark:bg-slate-800/50 p-2 space-y-2">
            {users.length === 0 && !loading && (
                <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                    데이터가 없습니다.
                </div>
            )}
            {users.map(user => (
                <div key={user.uid} className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-gray-200 dark:border-slate-800 shadow-sm">
                    {editingId === user.uid ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">이름</label>
                                    <Input 
                                        value={editForm.user_name || ''} 
                                        onChange={e => setEditForm({...editForm, user_name: e.target.value})}
                                        className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">세례명</label>
                                    <Input 
                                        value={editForm.baptismal_name || ''} 
                                        onChange={e => setEditForm({...editForm, baptismal_name: e.target.value})}
                                        className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">전화번호</label>
                                <Input 
                                    value={editForm.phone || ''} 
                                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                    className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">구분</label>
                                <select 
                                    className="border rounded text-sm p-1.5 w-full bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    value={editForm.user_category || 'Layman'}
                                    onChange={e => setEditForm({...editForm, user_category: e.target.value})}
                                >
                                    <option value="Layman">평신도</option>
                                    <option value="Father">신부님</option>
                                    <option value="Sister">수녀님</option>
                                </select>
                            </div>

                            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700">
                                    취소
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteUser(user.uid, user.user_name)} className="h-8">
                                    삭제
                                </Button>
                                <Button size="sm" variant="primary" onClick={saveEdit} className="h-8">
                                    저장
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{user.user_name}</span>
                                    {user.baptismal_name && (
                                        <span className="text-sm text-gray-600 dark:text-gray-400">({user.baptismal_name})</span>
                                    )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                    user.user_category === 'Father' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50' :
                                    user.user_category === 'Sister' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50' :
                                    'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50'
                                }`}>
                                    {user.user_category === 'Father' ? '신부님' : 
                                     user.user_category === 'Sister' ? '수녀님' : '평신도'}
                                </span>
                            </div>
                            

                            
                            <div className="space-y-0.5 mb-3">
                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">{user.phone || '-'}</div>
                                {user.updated_at && (
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                        최종수정: {user.updated_at?.toDate ? user.updated_at.toDate().toLocaleString() : String(new Date(user.updated_at))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end pt-2 border-t border-gray-50 dark:border-slate-800">
                                <Button 
                                    size="sm"
                                    variant="edit"
                                    onClick={() => startEdit(user)}
                                    className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                    수정
                                </Button>
                                <Button 
                                    size="sm"
                                    className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200 ml-2 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50 dark:hover:bg-purple-900/30"
                                    variant="outline"
                                    onClick={() => setMembershipTarget(user)}
                                >
                                    <Shield size={14} className="mr-1" />
                                    멤버십
                                </Button>
                                <Button 
                                    size="sm"
                                    className="bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-200 ml-2 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-900/50 dark:hover:bg-pink-900/30"
                                    variant="outline"
                                    onClick={() => setSupportTarget(user)}
                                >
                                    <Heart size={14} className="mr-1" />
                                    지원
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
        
        {hasMore && !searchTerm && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 text-center">
                 <Button variant="ghost" size="sm" onClick={() => fetchUsers(false)} disabled={loading} className="dark:text-gray-400 dark:hover:bg-slate-800">
                    {loading ? '로딩 중...' : <><ChevronDown size={16} className="mr-1"/> 더보기</>}
                 </Button>
            </div>
        )}
      </div>
      
      {membershipTarget && (
        <UserMembershipsDialog 
            open={!!membershipTarget} 
            onOpenChange={(open) => !open && setMembershipTarget(null)}
            uid={membershipTarget.uid} 
            userName={membershipTarget.user_name}
        />
      )}

      {supportTarget && (
        <UserSupportDrawer 
            open={!!supportTarget} 
            onOpenChange={(open) => !open && setSupportTarget(null)}
            uid={supportTarget.uid}
            userName={supportTarget.user_name}
            email={supportTarget.email} 
        />
      )}
    </Container>
  );
}
