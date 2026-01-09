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
import { ArrowLeft, Search, Edit2, Trash2, Check, X, ChevronDown, Heart } from 'lucide-react';
import { toast } from 'sonner';
import UserSupportDrawer from './UserSupportDrawer';

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
        // Simple search by name (case-sensitive usually in Firestore unless handled)
        // For partial search, Firestore is limited. We might rely on exact match or prefix.
        // Let's implement name-based prefix search if possible, or just exact for email/name
        // Ideally we use a 'keywords' array or similar, but for now let's try prefix search on user_name
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
        // Search results might not be paginated nicely with this simple logic
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
    <Container className="py-8 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin')}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900">
            유저 관리
          </Heading>
          <p className="text-gray-500 text-sm">
            전체 사용자 목록을 조회하고 관리합니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50/50">
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                <Input 
                    placeholder="이름으로 검색..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 min-w-[200px]"
                />
                <Button type="submit" size="sm" variant="outline" className="h-9">
                    <Search size={16} />
                </Button>
            </form>
        </div>

        {/* List */}
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">이름 / 세례명</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">이메일 / 전화번호</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구분</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">관리</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {users.length === 0 && !loading && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                    {users.map(user => (
                        <tr key={user.uid} className="hover:bg-gray-50/50">
                            {editingId === user.uid ? (
                                <>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <Input 
                                                value={editForm.user_name || ''} 
                                                onChange={e => setEditForm({...editForm, user_name: e.target.value})}
                                                placeholder="이름"
                                                className="h-8 text-sm"
                                            />
                                            <Input 
                                                value={editForm.baptismal_name || ''} 
                                                onChange={e => setEditForm({...editForm, baptismal_name: e.target.value})}
                                                placeholder="세례명"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                            <Input 
                                                value={editForm.phone || ''} 
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                                placeholder="전화번호"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                         <select 
                                            className="border rounded text-sm p-1 w-full"
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
                                            <Button size="icon" variant="outline" onClick={cancelEdit} className="h-8 w-8">
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{user.user_name}</div>
                                        <div className="text-xs text-gray-500">{user.baptismal_name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900">{user.email}</div>
                                        <div className="text-xs text-gray-500">{user.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                            user.user_category === 'Father' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            user.user_category === 'Sister' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-green-50 text-green-700 border-green-200'
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
                                            >
                                                수정
                                            </Button>
                                            <Button 
                                                size="sm"
                                                className="bg-pink-100 text-pink-600 hover:bg-pink-200 border-pink-200"
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
        <div className="md:hidden bg-gray-50 p-2 space-y-2">
            {users.length === 0 && !loading && (
                <div className="text-center text-gray-400 text-sm py-8">
                    데이터가 없습니다.
                </div>
            )}
            {users.map(user => (
                <div key={user.uid} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                    {editingId === user.uid ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">이름</label>
                                    <Input 
                                        value={editForm.user_name || ''} 
                                        onChange={e => setEditForm({...editForm, user_name: e.target.value})}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">세례명</label>
                                    <Input 
                                        value={editForm.baptismal_name || ''} 
                                        onChange={e => setEditForm({...editForm, baptismal_name: e.target.value})}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">전화번호</label>
                                <Input 
                                    value={editForm.phone || ''} 
                                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                    className="h-8 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">구분</label>
                                <select 
                                    className="border rounded text-sm p-1.5 w-full bg-white"
                                    value={editForm.user_category || 'Layman'}
                                    onChange={e => setEditForm({...editForm, user_category: e.target.value})}
                                >
                                    <option value="Layman">평신도</option>
                                    <option value="Father">신부님</option>
                                    <option value="Sister">수녀님</option>
                                </select>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8">
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
                                    <span className="font-bold text-gray-900">{user.user_name}</span>
                                    {user.baptismal_name && (
                                        <span className="text-sm text-gray-600">({user.baptismal_name})</span>
                                    )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                    user.user_category === 'Father' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    user.user_category === 'Sister' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-green-50 text-green-700 border-green-200'
                                }`}>
                                    {user.user_category === 'Father' ? '신부님' : 
                                     user.user_category === 'Sister' ? '수녀님' : '평신도'}
                                </span>
                            </div>
                            
                            <div className="space-y-0.5 mb-3">
                                <div className="text-sm text-gray-500">{user.email}</div>
                                <div className="text-sm text-gray-700">{user.phone || '-'}</div>
                            </div>
                            
                            <div className="flex justify-end pt-2 border-t border-gray-50">
                                <Button 
                                    size="sm"
                                    variant="edit"
                                    onClick={() => startEdit(user)}
                                >
                                    수정
                                </Button>
                                <Button 
                                    size="sm"
                                    className="bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-200 ml-2"
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
            <div className="p-4 border-t border-gray-100 text-center">
                 <Button variant="ghost" size="sm" onClick={() => fetchUsers(false)} disabled={loading}>
                    {loading ? '로딩 중...' : <><ChevronDown size={16} className="mr-1"/> 더보기</>}
                 </Button>
            </div>
        )}
      </div>
      
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
