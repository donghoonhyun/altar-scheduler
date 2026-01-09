import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  Timestamp,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Container, Card, Heading, Button, InfoBox } from '@/components/ui';
import { ArrowLeft, User, Shield, Calendar, Edit2, Check, X, Info, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  const fetchMemberships = async () => {
    if (!serverGroupId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'memberships'),
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
      await updateDoc(doc(db, 'memberships', id), {
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
      await deleteDoc(doc(db, 'memberships', id));
      toast.success('멤버가 삭제되었습니다.');
      fetchMemberships();
    } catch (err) {
      console.error('Delete member failed:', err);
      toast.error('삭제에 실패했습니다.');
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
    <Container className="py-8 min-h-screen">
      {/* ... header ... */}
       <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900">
            멤버십 역할 관리
          </Heading>
          <p className="text-gray-500 text-sm">
            복사단의 멤버별 권한과 정보를 관리합니다.
          </p>
        </div>
      </div>

      {/* Header with Count & Filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-gray-800">
             멤버 <span className="text-xs font-normal text-gray-500">({filteredMemberships.length}명)</span>
          </h2>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-gray-50 p-1 rounded-lg">
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
                      ? "bg-white shadow-sm text-gray-900 border border-gray-200"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-md transition-colors whitespace-nowrap">
              <input 
                type="checkbox"
                checked={hideInactive}
                onChange={(e) => setHideInactive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-[10px] font-bold text-gray-500">비활성 제외</span>
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
                "relative bg-white rounded-xl border shadow-sm p-5 transition-all",
                editingId === m.id ? "border-blue-500 ring-1 ring-blue-500 shadow-md" : "border-gray-100 hover:border-gray-200 hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0 pr-8">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
                      <User size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {m.user_name}
                        </span>
                        {m.baptismal_name && (
                           <span className="text-gray-500 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                             {m.baptismal_name}
                           </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            m.active 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-gray-900 text-white border-gray-900'
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
                  <div className="flex items-center justify-between text-[11px] text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
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
                                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
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
                                   ? 'bg-green-50 text-green-700 border-green-200'
                                   : 'bg-gray-50 text-gray-500 border-gray-200'
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
                              className="flex-1 h-9 text-xs border-gray-200"
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
                                r === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                r === 'planner' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                'bg-emerald-50 text-emerald-700 border-emerald-100'
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
    </Container>
  );
};

export default MemberRoleManagement;
